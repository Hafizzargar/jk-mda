/**
 * Source Collector
 * Polite, rate-limited feed and portal collector with SSRF enforcement and bounded timeouts.
 * Supports RSS 2.0, Atom feeds, official portal notices, WHO updates, and YouTube channel metadata.
 */

import { validateSourceUrl } from './ssrf-guard.ts';

export interface CollectedItem {
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  sourceName: string;
  sourceAuthority: string;
}

export interface CollectionResult {
  success: boolean;
  items: CollectedItem[];
  error?: string;
  statusCode?: number;
}

const DEFAULT_USER_AGENT = 'KJIN-Editorial-Monitor/1.0 (+https://kjin.in; newsroom-monitor@kjin.in)';
const FETCH_TIMEOUT_MS = 8000;

/**
 * Fetch and extract text from an RSS / Atom feed
 */
export async function collectRssFeed(
  feedUrl: string,
  sourceName: string,
  sourceAuthority: string,
  maxItems = 15
): Promise<CollectionResult> {
  const ssrfCheck = validateSourceUrl(feedUrl);
  if (!ssrfCheck.isValid) {
    return {
      success: false,
      items: [],
      error: `SSRF Blocked: ${ssrfCheck.error}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(ssrfCheck.normalizedUrl!, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        items: [],
        statusCode: response.status,
        error: `HTTP Error: ${response.status} ${response.statusText}`,
      };
    }

    const xmlText = await response.text();
    const items = parseRssXml(xmlText, sourceName, sourceAuthority, maxItems);

    return {
      success: true,
      items,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    return {
      success: false,
      items: [],
      error: message.includes('abort') ? 'Connection timed out after 8s.' : message,
    };
  }
}

/**
 * Fetch and parse official government notices or WHO updates
 */
export async function collectOfficialPortal(
  portalUrl: string,
  sourceName: string,
  sourceAuthority: string
): Promise<CollectionResult> {
  const ssrfCheck = validateSourceUrl(portalUrl);
  if (!ssrfCheck.isValid) {
    return {
      success: false,
      items: [],
      error: `SSRF Blocked: ${ssrfCheck.error}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(ssrfCheck.normalizedUrl!, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        items: [],
        statusCode: response.status,
        error: `HTTP Error: ${response.status} ${response.statusText}`,
      };
    }

    const html = await response.text();
    const items = extractPortalNotices(html, ssrfCheck.normalizedUrl!, sourceName, sourceAuthority);

    return {
      success: true,
      items,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown network failure';
    return {
      success: false,
      items: [],
      error: message.includes('abort') ? 'Connection timed out after 8s.' : message,
    };
  }
}

/**
 * Collect owner-approved YouTube channel uploads using official public channel RSS
 * YouTube provides public channel RSS at: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 */
export async function collectApprovedYouTubeChannel(
  channelId: string,
  channelName: string,
  isOwnerApproved: boolean
): Promise<CollectionResult> {
  if (!isOwnerApproved) {
    return {
      success: false,
      items: [],
      error: 'Channel is not marked as owner-approved. Unapproved YouTube collection is disabled.',
    };
  }

  const cleanChannelId = channelId.trim();
  if (!/^[a-zA-Z0-9_-]{10,40}$/.test(cleanChannelId)) {
    return {
      success: false,
      items: [],
      error: 'Invalid YouTube Channel ID format.',
    };
  }

  const youtubeFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanChannelId}`;
  return collectRssFeed(youtubeFeedUrl, channelName, 'YouTube Channel (Owner Approved)', 10);
}

// -------------------------------------------------------------
// Pure XML / HTML Parsing Helpers
// -------------------------------------------------------------

function parseRssXml(xml: string, sourceName: string, sourceAuthority: string, maxItems: number): CollectedItem[] {
  const items: CollectedItem[] = [];

  // Match RSS <item> tags
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of itemMatches.slice(0, maxItems)) {
    const title = extractXmlTag(itemXml, 'title') || 'Untitled Report';
    const link = extractXmlTag(itemXml, 'link') || extractXmlTag(itemXml, 'guid') || '';
    const description = extractXmlTag(itemXml, 'description') || '';
    const pubDate = extractXmlTag(itemXml, 'pubDate') || new Date().toISOString();

    if (link) {
      items.push({
        title: cleanText(title),
        url: cleanUrl(link),
        publishedAt: parseDate(pubDate),
        excerpt: cleanText(description).slice(0, 400),
        sourceName,
        sourceAuthority,
      });
    }
  }

  // If no <item>, check Atom <entry> tags
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const entryXml of entryMatches.slice(0, maxItems)) {
      const title = extractXmlTag(entryXml, 'title') || 'Untitled Entry';
      let link = '';
      const hrefMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (hrefMatch) {
        link = hrefMatch[1];
      } else {
        link = extractXmlTag(entryXml, 'link') || '';
      }
      const summary = extractXmlTag(entryXml, 'summary') || extractXmlTag(entryXml, 'content') || '';
      const published = extractXmlTag(entryXml, 'published') || extractXmlTag(entryXml, 'updated') || new Date().toISOString();

      if (link) {
        items.push({
          title: cleanText(title),
          url: cleanUrl(link),
          publishedAt: parseDate(published),
          excerpt: cleanText(summary).slice(0, 400),
          sourceName,
          sourceAuthority,
        });
      }
    }
  }

  return items;
}

function extractPortalNotices(
  html: string,
  baseUrl: string,
  sourceName: string,
  sourceAuthority: string
): CollectedItem[] {
  const items: CollectedItem[] = [];
  const base = new URL(baseUrl);

  // Match links that look like notices, orders, press releases, advisories, or bulletins
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && items.length < 15) {
    const rawHref = match[1];
    const linkText = cleanText(match[2]);

    // Skip empty or tiny links
    if (!linkText || linkText.length < 12) continue;

    // Filter for terms relevant to official government announcements or notices
    const isNotice = /order|advisory|notice|circular|press|bulletin|notification|alert|traffic|highway|closure|snow|weather|dm\s+|dc\s+|disaster|accident/i.test(linkText);
    if (!isNotice) continue;

    let absoluteUrl = rawHref;
    try {
      absoluteUrl = new URL(rawHref, base).toString();
    } catch {
      continue;
    }

    items.push({
      title: linkText.slice(0, 200),
      url: absoluteUrl,
      publishedAt: new Date().toISOString(),
      excerpt: `Official update from ${sourceAuthority}: ${linkText.slice(0, 300)}`,
      sourceName,
      sourceAuthority,
    });
  }

  return items;
}

function extractXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return null;

  let val = match[1];
  // Remove CDATA wrapper if present
  val = val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  return val.trim();
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ') // Strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanUrl(url: string): string {
  return url.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim();
}

function parseDate(dateStr: string): string {
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // fallback
  }
  return new Date().toISOString();
}
