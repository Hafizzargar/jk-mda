'use client';

import { useEffect } from 'react';

const FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,600&family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
];

export function DeferredFontStylesheets() {
  useEffect(() => {
    for (const href of FONT_STYLESHEETS) {
      const alreadyLoaded = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[data-deferred-font-stylesheet]')
      ).some((link) => link.href === href);
      if (alreadyLoaded) continue;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.crossOrigin = 'anonymous';
      link.dataset.deferredFontStylesheet = 'true';
      document.head.appendChild(link);
    }
  }, []);

  return null;
}
