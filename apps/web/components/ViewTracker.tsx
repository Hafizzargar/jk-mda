'use client';

import { useEffect } from 'react';

interface ViewTrackerProps {
  articleId: string;
}

export function ViewTracker({ articleId }: ViewTrackerProps) {
  useEffect(() => {
    // Only track views in production, or disable locally if desired
    // Fire and forget POST request to our API route
    fetch(`/api/articles/${articleId}/view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(err => {
      // Silently fail view tracking on network errors to avoid user disruption
      console.error('Failed to increment view counter', err);
    });
  }, [articleId]);

  return null; // Renders nothing
}
