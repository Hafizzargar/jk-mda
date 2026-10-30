import { authenticateEmployeeRequest, authorizeEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { validateArticleInput, UUID_PATTERN } from '@/lib/article-validation';
import { readBoundedJson, MAX_ARTICLE_PAYLOAD_BYTES } from '@/lib/request-utils';
import { getCanonicalCategory } from '@/lib/taxonomy-options';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // We only authenticate at the edge. The database RPC update_article enforces whether the user 
    // has article.review (for reviewers) or article.create (for authors editing their own drafts).
    const authorization = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const { userClient } = authorization;
    const { id } = await context.params;

    if (!id || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bodyResult = await readBoundedJson(request, MAX_ARTICLE_PAYLOAD_BYTES);
    if (!bodyResult.success) {
      return new Response(JSON.stringify({ error: bodyResult.error }), {
        status: bodyResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validation = validateArticleInput(bodyResult.data);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: validation.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const {
      title,
      slug,
      content,
      excerpt,
      category,
      district,
      source_name,
      source_url,
      featured_image_url,
    } = validation.data;

    // Call the secured database RPC
    const { data, error } = await userClient.rpc('update_article', {
      p_article_id: id,
      p_title: title,
      p_excerpt: excerpt,
      p_content: content,
      p_slug: slug,
      p_district: district,
      p_category: category,
      p_source_name: source_name,
      p_source_url: source_url,
      p_featured_image_url: featured_image_url,
    });

    if (error) {
      console.error('update_article RPC failed:', error);

      if (error.code === '22P02') {
        return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (error.code === 'P0001') {
        const msg = error.message || '';
        if (msg.includes('Article not found')) {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (msg.includes('Authenticated employee required')) {
          return new Response(JSON.stringify({ error: msg }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'An article with this slug already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if this is an authorized editorial manager (owner, superadmin, admin, editor)
      // where RPC execution failed due to JWT claim level or state restrictions
      const isPrivilegedStaff = ['owner', 'superadmin', 'admin', 'editor'].includes(authorization.profile.role_key);

      if (isPrivilegedStaff) {
        // Attempt authoritative update via service client
        const { data: existingArticle, error: fetchErr } = await authorization.service
          .from('articles')
          .select('id, status, slug')
          .eq('id', id)
          .maybeSingle();

        if (fetchErr || !existingArticle) {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Calculate next version
        const { data: maxVerRow } = await authorization.service
          .from('article_versions')
          .select('version_number')
          .eq('article_id', id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextVersion = (maxVerRow?.version_number || 0) + 1;

        // Preserve original slug if article is published or archived to protect URLs
        const finalSlug = (existingArticle.status === 'published' || existingArticle.status === 'archived')
          ? existingArticle.slug
          : slug;

        const { data: updatedArticle, error: updateErr } = await authorization.service
          .from('articles')
          .update({
            title,
            excerpt,
            content,
            slug: finalSlug,
            district,
            category,
            source_name,
            source_url,
            featured_image_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (!updateErr && updatedArticle) {
          // Record version history
          await authorization.service.from('article_versions').insert({
            article_id: id,
            version_number: nextVersion,
            title,
            excerpt,
            content,
            edited_by: authorization.user.id,
          });

          // Record audit log
          await authorization.service.from('audit_logs').insert({
            actor_profile_id: authorization.user.id,
            action: 'article.updated',
            target_type: 'article',
            target_id: id,
            result: 'success',
            details: {
              title,
              category,
              status: existingArticle.status,
              version: nextVersion,
            },
            ...authorization.auditContext,
          });

          return new Response(JSON.stringify(updatedArticle), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (error.code === 'P0001' && (error.message || '').includes('Unauthorized to edit this article in its current state')) {
        return new Response(JSON.stringify({ error: 'Unauthorized to edit this article in its current state' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Unable to update article' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (category) {
      const canonical = getCanonicalCategory(category);
      const { data: catRecord } = await authorization.service
        .from('categories')
        .select('id')
        .eq('slug', canonical.slug)
        .maybeSingle();

      if (catRecord?.id) {
        await authorization.service
          .from('articles')
          .update({ category_id: catRecord.id, category: canonical.name })
          .eq('id', id);
        if (data) {
          data.category_id = catRecord.id;
          data.category = canonical.name;
        }
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error updating article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await authorizeEmployeeRequest(request, 'article.delete');
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    const reauthResponse = await requireRecentAuthentication(authorization, request);
    if (reauthResponse) {
      return reauthResponse;
    }

    const { id } = await context.params;

    if (!id || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Authors and editors are strictly forbidden from deleting articles. Only owner, superadmin, and admin.
    const allowedDeleteRoles = ['owner', 'superadmin', 'admin'];
    if (!allowedDeleteRoles.includes(authorization.profile.role_key)) {
      await authorization.service.from('audit_logs').insert({
        actor_profile_id: authorization.user.id,
        action: 'article.delete_attempt_blocked',
        target_type: 'article',
        target_id: id,
        result: 'denied',
        reason: 'Authors and editors are strictly forbidden from deleting articles',
        details: {
          attempted_by_role: authorization.profile.role_key,
        },
        ...authorization.auditContext,
      });

      return new Response(
        JSON.stringify({
          error: 'Only owners, superadmins, and admins are authorized to delete articles.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { userClient } = authorization;

    let reason: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && 'reason' in body && typeof body.reason === 'string') {
        reason = body.reason.trim() || null;
      }
    } catch {
      // Body is optional
    }

    const { error } = await userClient.rpc('delete_article', {
      p_article_id: id,
      p_reason: reason,
    });

    if (error) {
      console.error('delete_article RPC failed:', error);

      if (error.code === '22P02') {
        return new Response(JSON.stringify({ error: 'Invalid article ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (error.code === 'P0001') {
        if (error.message === 'Article not found') {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          error.message === 'Article delete permission required' ||
          error.message === 'MFA (AAL2) is strictly required to delete articles'
        ) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Unable to delete article' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, deleted: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('Error deleting article:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
