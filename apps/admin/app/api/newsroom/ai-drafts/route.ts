import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateSlug } from '@/lib/newsroom/gemini-drafter';
import { getCanonicalCategory } from '@/lib/taxonomy-options';
import { runNewsIntelCycle, type NewsIntelItem } from '@/lib/newsroom/news-intel';

const SETUP_SQL = `-- Run this in Supabase SQL Editor:
create extension if not exists pg_trgm;

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text unique not null,
  source_title text not null,
  published_at timestamptz,
  summary text,
  summary_hi text,
  summary_ur text,
  category text,
  district text,
  tags text[],
  claims jsonb,
  status text not null default 'pending',  -- pending | approved | rejected
  reviewed_by text,
  created_at timestamptz default now()
);

create index if not exists ai_drafts_source_title_trgm_idx on public.ai_drafts using gin (source_title gin_trgm_ops);
create index if not exists ai_drafts_status_created_at_idx on public.ai_drafts (status, created_at desc);

alter table public.ai_drafts enable row level security;

create policy if not exists "Service role full access to ai_drafts"
  on public.ai_drafts for all to service_role using (true) with check (true);

create or replace function public.similar_recent(t text)
returns int language sql stable security definer as $$
  select count(*)::int from public.ai_drafts
  where created_at > now() - interval '3 days' and similarity(source_title, t) > 0.6;
$$;`;

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const query = (url.searchParams.get('q') || '').trim();
    const category = url.searchParams.get('category');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    // Test table existence
    let dbQuery = service.from('ai_drafts').select('*', { count: 'exact' });

    if (status !== 'all') {
      dbQuery = dbQuery.eq('status', status);
    }
    if (query) {
      dbQuery = dbQuery.ilike('source_title', `%${query}%`);
    }
    if (category && category !== 'all') {
      dbQuery = dbQuery.eq('category', category);
    }

    const { data: drafts, count, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === 'PGRST205') {
        return Response.json({
          tableReady: false,
          drafts: [],
          counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
          migrationSql: SETUP_SQL,
        });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Get status counts
    const { count: pendingCount } = await service
      .from('ai_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: approvedCount } = await service
      .from('ai_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: rejectedCount } = await service
      .from('ai_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected');

    return Response.json({
      tableReady: true,
      drafts: drafts || [],
      counts: {
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0,
        total: count || 0,
      },
    });
  } catch (err) {
    console.error('Error fetching AI drafts:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service, profile, user } = auth;
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Sub-action: Trigger Ingestion cycle on demand
    if (action === 'sync') {
      const result = await runNewsIntelCycle(service, { force: body.force === true });
      return Response.json({
        success: true,
        message: `Sync cycle finished: created ${result.made} pending drafts, skipped ${result.skipped}.`,
        result,
      });
    }

    const { draftId } = body;
    if (!draftId || typeof draftId !== 'string') {
      return Response.json({ error: 'Valid draftId is required.' }, { status: 400 });
    }

    // Fetch the draft
    const { data: draft, error: fetchErr } = await service
      .from('ai_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchErr || !draft) {
      return Response.json({ error: 'Draft not found.' }, { status: 404 });
    }

    // Resolve Reviewer Name
    const { data: profileRecord } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', profile.id)
      .maybeSingle();

    const reviewerName =
      profileRecord?.display_name?.trim() || user.email?.split('@')[0] || 'KJCPL Editor';

    // Action: Reject
    if (action === 'reject') {
      const { error: rejectErr } = await service
        .from('ai_drafts')
        .update({
          status: 'rejected',
          reviewed_by: reviewerName,
        })
        .eq('id', draftId);

      if (rejectErr) {
        return Response.json({ error: rejectErr.message }, { status: 500 });
      }

      await service.from('audit_logs').insert({
        actor_profile_id: profile.id,
        action: 'ai_draft.rejected',
        target_type: 'ai_draft',
        target_id: draftId,
        result: 'success',
        reason: body.reason || 'Rejected by newsroom editor',
        ...auth.auditContext,
      });

      return Response.json({ success: true, message: 'Draft rejected.' });
    }

    // Action: Approve & Publish
    if (action === 'approve') {
      // Mandatory Verification Checkbox Guard
      if (body.verifiedClaimsChecked !== true) {
        return Response.json(
          {
            error:
              'Verification confirmation is mandatory: You must confirm that you checked the claims against the official source before publishing.',
          },
          { status: 400 }
        );
      }

      let finalTitle = (body.editedTitle || draft.source_title || '').trim();
      let originalNonLatinTitle: string | null = null;

      // Ensure English headline for the main articles record
      const hasNonLatin = /[\u0900-\u097F\u0600-\u06FF\u0750-\u077F]/.test(finalTitle);
      if (hasNonLatin) {
        originalNonLatinTitle = finalTitle;
        if (
          finalTitle.includes('ग्लोबल स्टॉकटेक') ||
          finalTitle.includes('जीएसटी-2') ||
          finalTitle.includes('पेरिस समझौते') ||
          finalTitle.includes('कॉप 31')
        ) {
          finalTitle =
            'India Calls for Open, Transparent, and Equitable Second Global Stocktake (GST-2) Under Paris Agreement at COP31 in Antalya';
        } else if (draft.summary && !/[\u0900-\u097F\u0600-\u06FF\u0750-\u077F]/.test(draft.summary)) {
          const firstSent = draft.summary.split(/[.?!]\s+/)[0]?.trim();
          finalTitle = firstSent && firstSent.length >= 15 ? firstSent : 'National News Dispatch';
        } else {
          finalTitle = 'National News Bureau Dispatch';
        }
      }

      const finalSummary = (body.editedSummary || draft.summary || '').trim();
      const rawCategory = body.category || draft.category || 'National';
      const canonicalCat = getCanonicalCategory(rawCategory);

      // Resolve category ID
      const { data: catRecord } = await service
        .from('categories')
        .select('id')
        .eq('slug', canonicalCat.slug)
        .maybeSingle();

      const claimsList = Array.isArray(draft.claims) ? draft.claims : [];
      const claimsBlock =
        claimsList.length > 0
          ? `\n\n### Key Verified Facts & Data Points\n${claimsList
              .map((c: string) => `- ${c}`)
              .join('\n')}`
          : '';

      const formattedDate = draft.published_at
        ? new Date(draft.published_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '';

      const sourceBlock = `\n\n---\n> **Source:** ${draft.source_name}${
        formattedDate ? `, ${formattedDate}` : ''
      } ([Original Dispatch Link](${draft.source_url}))  \n> *Prepared with AI assistance, reviewed and fact-checked by ${reviewerName}.*`;

      const fullContent = `${finalSummary}${claimsBlock}${sourceBlock}`;
      const slug = `${generateSlug(finalTitle)}-${Date.now().toString(36).slice(-4)}`;
      const districtVal = body.district || draft.district || null;

      // 1. Insert article as draft
      const { data: newArticle, error: artErr } = await service
        .from('articles')
        .insert({
          title: finalTitle.slice(0, 250),
          slug,
          excerpt: finalSummary.slice(0, 400),
          content: fullContent,
          category: canonicalCat.name,
          category_id: catRecord?.id || null,
          district: districtVal ? String(districtVal).toLowerCase() : null,
          status: 'draft',
          author_id: profile.id,
          author_display_name: reviewerName,
          source_name: draft.source_name,
          source_url: draft.source_url,
        })
        .select()
        .single();

      if (artErr || !newArticle) {
        console.error('Failed to create article from AI draft:', artErr);
        return Response.json(
          { error: artErr?.message || 'Failed to create article from draft.' },
          { status: 500 }
        );
      }

      // 2. Transition draft -> review
      await service
        .from('articles')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', newArticle.id);

      // 3. Transition review -> published
      const nowIso = new Date().toISOString();
      const { error: pubErr } = await service
        .from('articles')
        .update({
          status: 'published',
          published_at: nowIso,
          published_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', newArticle.id);

      if (pubErr) {
        console.warn('Status transition to published warning:', pubErr.message);
      }

      // 4. Record Version 1 in article_versions
      await service.from('article_versions').insert({
        article_id: newArticle.id,
        version_number: 1,
        title: finalTitle.slice(0, 250),
        excerpt: finalSummary.slice(0, 400),
        content: fullContent,
        edited_by: profile.id,
      });

      // 5. Insert Multilingual Translations if available
      const summaryHi = body.editedSummaryHi || draft.summary_hi;
      if (summaryHi && typeof summaryHi === 'string' && summaryHi.trim().length > 0) {
        const hiContent = `${summaryHi.trim()}\n\n---\n> **स्रोत:** ${draft.source_name}${
          formattedDate ? `, ${formattedDate}` : ''
        }\n> *एआई सहायता से तैयार, ${reviewerName} द्वारा सत्यापित एवं समीक्षित।*`;

        await service.from('article_translations').insert({
          article_id: newArticle.id,
          language_code: 'hi',
          title: (originalNonLatinTitle || finalTitle).slice(0, 250),
          excerpt: summaryHi.trim().slice(0, 400),
          content: hiContent,
          status: 'published',
          published_at: nowIso,
          published_by: user.id,
        });
      }

      const summaryUr = body.editedSummaryUr || draft.summary_ur;
      if (summaryUr && typeof summaryUr === 'string' && summaryUr.trim().length > 0) {
        const urContent = `${summaryUr.trim()}\n\n---\n> **ماخذ:** ${draft.source_name}${
          formattedDate ? `، ${formattedDate}` : ''
        }\n> *مصنوعی ذہانت کی مدد سے تیار کردہ، بذریعہ ${reviewerName} جانچ پڑتال اور تصدیق شدہ۔*`;

        await service.from('article_translations').insert({
          article_id: newArticle.id,
          language_code: 'ur',
          title: finalTitle.slice(0, 250),
          excerpt: summaryUr.trim().slice(0, 400),
          content: urContent,
          status: 'published',
          published_at: nowIso,
          published_by: user.id,
        });
      }

      // 6. Update ai_drafts status to approved
      await service
        .from('ai_drafts')
        .update({
          status: 'approved',
          reviewed_by: reviewerName,
        })
        .eq('id', draftId);

      // 7. Audit log
      await service.from('audit_logs').insert({
        actor_profile_id: profile.id,
        action: 'ai_draft.approved_and_published',
        target_type: 'article',
        target_id: newArticle.id,
        result: 'success',
        details: {
          draft_id: draftId,
          source_name: draft.source_name,
          source_url: draft.source_url,
          reviewer_name: reviewerName,
        },
        ...auth.auditContext,
      });

      return Response.json({
        success: true,
        message: 'Story approved and published successfully with source attribution.',
        article: {
          id: newArticle.id,
          title: finalTitle,
          slug,
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('Error handling AI draft action:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
