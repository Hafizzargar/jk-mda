/**
 * Event & Official Government Response Matcher
 * Links detected event candidates with authorized government notices, orders, and advisories.
 * Distinguishes confirmed relevance from possible matches, missing updates, and failed checks.
 */

import type { EventCategory } from './district-classifier.ts';
import type { CollectedItem } from './source-collector.ts';

export type MatchStatus =
  | 'confirmed_relevant'
  | 'possible_match'
  | 'no_official_update'
  | 'check_failed';

export interface EventCandidateForMatching {
  id?: string;
  headline: string;
  summary: string;
  districtSlug?: string | null;
  division?: string | null;
  eventCategory: EventCategory;
  eventDate: string | Date;
}

export interface MatchedResponseResult {
  matchStatus: MatchStatus;
  authorityName: string;
  documentTitle: string | null;
  documentUrl: string | null;
  publishedAt: string | null;
  responseType: 'order' | 'advisory' | 'public_notice' | 'press_release' | 'police_statement' | 'traffic_advisory' | 'disaster_alert' | 'none';
  matchExplanation: string;
  extractedTextExcerpt: string | null;
}

/**
 * Evaluates candidate official notices against an event
 */
export function matchEventWithOfficialResponses(
  event: EventCandidateForMatching,
  availableOfficialNotices: CollectedItem[],
  isSourceFailed = false,
  sourceFailureReason?: string
): MatchedResponseResult {
  // If the official source was offline, unreachable, or timed out:
  if (isSourceFailed) {
    return {
      matchStatus: 'check_failed',
      authorityName: 'Official Government Portal',
      documentTitle: null,
      documentUrl: null,
      publishedAt: null,
      responseType: 'none',
      matchExplanation: `Source check failed: ${sourceFailureReason || 'Official authority portal was unreachable or timed out during the check.'}`,
      extractedTextExcerpt: null,
    };
  }

  // If no notices are available in the checked source
  if (!availableOfficialNotices || availableOfficialNotices.length === 0) {
    return {
      matchStatus: 'no_official_update',
      authorityName: 'Official Sources Checked',
      documentTitle: null,
      documentUrl: null,
      publishedAt: null,
      responseType: 'none',
      matchExplanation: 'No matching official update found in the sources checked.',
      extractedTextExcerpt: null,
    };
  }

  const eventDistrict = event.districtSlug ? event.districtSlug.toLowerCase() : null;
  const eventDateMs = new Date(event.eventDate).getTime();

  let bestMatch: {
    item: CollectedItem;
    score: number;
    matchType: 'confirmed_relevant' | 'possible_match';
    responseType: MatchedResponseResult['responseType'];
    explanation: string;
  } | null = null;

  for (const notice of availableOfficialNotices) {
    const noticeText = `${notice.title} ${notice.excerpt}`.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // Routine administrative filter: if the notice is about staff transfers, promotions, seniority, or routine meetings,
    // it cannot be confirmed as an emergency/incident response.
    const isRoutineAdmin = /transfer|posting|promotion|seniority|gazetted officer|leave|joining|meeting agenda/i.test(noticeText);

    // 1. Time proximity check (within 72 hours)
    const noticeDateMs = new Date(notice.publishedAt).getTime();
    const diffHours = Math.abs(eventDateMs - noticeDateMs) / (1000 * 60 * 60);
    if (!isNaN(diffHours) && diffHours <= 72) {
      score += 20;
      reasons.push('published within 72 hours of the event');
    }

    // 2. District & Location alignment
    const matchesDistrict = eventDistrict && noticeText.includes(eventDistrict);
    if (matchesDistrict) {
      score += 30;
      reasons.push(`mentions district (${eventDistrict})`);
    }

    // 3. Category & Action Entity alignment (requires specific action match, not just department names)
    let responseType: MatchedResponseResult['responseType'] = 'public_notice';
    let hasDirectActionMatch = false;

    if (event.eventCategory === 'road_closures') {
      if (/traffic (suspended|halted|blocked|diverted)|road closure|nh-44 (blocked|closed)|shooting stones|landslide clearance/i.test(noticeText)) {
        score += 45;
        hasDirectActionMatch = true;
        responseType = 'traffic_advisory';
        reasons.push('direct highway/traffic closure advisory');
      } else if (noticeText.includes('traffic') || noticeText.includes('highway')) {
        score += 15;
        reasons.push('general traffic mention');
      }
    } else if (event.eventCategory === 'weather_disaster') {
      if (/avalanche (warning|threat)|flash flood (alert|warning)|snowfall alert|cloudburst/i.test(noticeText)) {
        score += 45;
        hasDirectActionMatch = true;
        responseType = 'disaster_alert';
        reasons.push('severe weather / disaster warning');
      } else if (noticeText.includes('weather') || noticeText.includes('rain') || noticeText.includes('snow')) {
        score += 20;
        reasons.push('general weather mention');
      }
    } else if (event.eventCategory === 'accidents' || event.eventCategory === 'public_safety') {
      if (/road accident|injured in accident|vehicle (plunged|skidded)|rescue operation|fir registered|casualty/i.test(noticeText)) {
        score += 45;
        hasDirectActionMatch = true;
        responseType = 'police_statement';
        reasons.push('incident / accident police report');
      } else if (noticeText.includes('police') && !isRoutineAdmin) {
        score += 10;
        reasons.push('police agency source');
      }
    } else if (event.eventCategory === 'school_closures') {
      if (/schools? (closed|shut)|classes? suspended|winter vacation order|institutions? closed/i.test(noticeText)) {
        score += 50;
        hasDirectActionMatch = true;
        responseType = 'order';
        reasons.push('explicit school closure order');
      } else if (noticeText.includes('school') || noticeText.includes('education')) {
        score += 15;
        reasons.push('general education mention');
      }
    } else {
      if (/order|directive|prohibitory order|public notice/i.test(noticeText) && !isRoutineAdmin) {
        score += 25;
        responseType = 'order';
        reasons.push('administrative directive matched');
      }
    }

    // Routine administrative notice penalty
    if (isRoutineAdmin) {
      score = Math.min(score, 35);
      reasons.push('routine administrative list / transfer notice');
    }

    // Strict threshold: Confirmed Relevant requires BOTH high score (>= 75), district match, AND direct action match!
    if (score >= 75 && matchesDistrict && hasDirectActionMatch && !isRoutineAdmin) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          item: notice,
          score,
          matchType: 'confirmed_relevant',
          responseType,
          explanation: `Confirmed Relevant: Official update matches event location and subject (${reasons.join(', ')}).`,
        };
      }
    } else if (score >= 35) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          item: notice,
          score,
          matchType: 'possible_match',
          responseType,
          explanation: `Possible Match (Needs Verification): Notice shares proximate timing or regional context (${reasons.join(', ')}).`,
        };
      }
    }
  }

  if (bestMatch) {
    return {
      matchStatus: bestMatch.matchType,
      authorityName: bestMatch.item.sourceAuthority,
      documentTitle: bestMatch.item.title,
      documentUrl: bestMatch.item.url,
      publishedAt: bestMatch.item.publishedAt,
      responseType: bestMatch.responseType,
      matchExplanation: bestMatch.explanation,
      extractedTextExcerpt: bestMatch.item.excerpt,
    };
  }

  return {
    matchStatus: 'no_official_update',
    authorityName: 'Official Sources Checked',
    documentTitle: null,
    documentUrl: null,
    publishedAt: null,
    responseType: 'none',
    matchExplanation: 'No matching official update found in the sources checked.',
    extractedTextExcerpt: null,
  };
}
