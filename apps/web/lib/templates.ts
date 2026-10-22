export type TemplateId =
  | 'classic-editorial'
  | 'modern-magazine'
  | 'minimal-focus'
  | 'breaking-wire'
  | 'bento-grid'
  | 'genz-neo-brutalist'
  | 'clean-nordic-white'
  | 'visual-stories-deck'
  | 'tech-terminal-wire'
  | 'hyperlocal-community';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  themeColor: string;
  accentBg: string;
  layoutStyle: string;
  features: string[];
}

export const AVAILABLE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'classic-editorial',
    name: 'Classic Editorial Broadsheet',
    tagline: 'Authoritative Newspaper Architecture',
    description: 'Traditional multi-column newspaper layout with refined serif headlines, structured datelines, and editorial column density inspired by global broadsheet journalism.',
    badge: 'Broadsheet Classic',
    themeColor: '#1e293b',
    accentBg: 'bg-slate-900',
    layoutStyle: 'Multi-column broadsheet with lead editorial anchor and formal dateline rules.',
    features: [
      'Refined serif headline hierarchy',
      'Multi-column editorial lead anchor',
      'Traditional dateline & byline rules',
      'Trending news digest sidebar'
    ],
  },
  {
    id: 'modern-magazine',
    name: 'Modern Visual Magazine',
    tagline: 'High-Impact Visual Storytelling',
    description: 'Dynamic digital magazine featuring immersive full-bleed imagery, modern typography, gradient category tags, and card-based visual storytelling.',
    badge: 'Dynamic Visual',
    themeColor: '#2563eb',
    accentBg: 'bg-blue-600',
    layoutStyle: 'High-contrast visual cards with floating meta badges and immersive hero spotlight.',
    features: [
      'Full-bleed immersive photo hero',
      'Gradient category pills & badges',
      'Dynamic visual magazine cards with zoom hover',
      'Editorial dispatch cards with photo backdrops'
    ],
  },
  {
    id: 'minimal-focus',
    name: 'Minimal Focus Reader',
    tagline: 'Distraction-Free Long-Form Experience',
    description: 'Substack & Medium-inspired reading layout emphasizing spacious whitespace, elegant typography, reading-time metrics, and clean uninterrupted article streams.',
    badge: 'Clean Minimalist',
    themeColor: '#0f172a',
    accentBg: 'bg-stone-900',
    layoutStyle: 'Focused single-column reading flow with generous margins and subtle dividers.',
    features: [
      'Spacious distraction-free typography',
      'Estimated read-time indicators',
      'Subtle monochromatic dividers',
      'Curated thematic dispatch list'
    ],
  },
  {
    id: 'breaking-wire',
    name: 'Breaking Newsroom Wire',
    tagline: 'High-Velocity News Desk',
    description: 'Fast-paced wire agency interface inspired by Reuters and Bloomberg with live pulsing breaking alerts, rapid-fire chronologically timestamped dispatches, and quick district filters.',
    badge: 'Live Wire Desk',
    themeColor: '#dc2626',
    accentBg: 'bg-red-600',
    layoutStyle: 'High-density two-column layout with live ticker and chronological dispatches.',
    features: [
      'Pulsing LIVE / BREAKING ticker banner',
      'Rapid-fire timestamped dispatch feed',
      'Quick-switch district & category filter tabs',
      'High-density newsroom layout'
    ],
  },
  {
    id: 'bento-grid',
    name: 'Contemporary Bento Media',
    tagline: 'Modern 2026 Modular Publication',
    description: 'Apple Newsroom and modern design-system Bento layout organizing features, investigative deep-dives, regional spotlights, and audio/quote pills into harmonious visual boxes.',
    badge: 'Bento Box UI',
    themeColor: '#0891b2',
    accentBg: 'bg-cyan-600',
    layoutStyle: 'Modular Bento Grid with varying card dimensions, visual media containers, and stat pills.',
    features: [
      'Modern modular Bento-box card grid',
      'Highlighted investigative feature block',
      'Integrated quote & audio dispatch pills',
      'Live reader popularity pulse counters'
    ],
  },
  {
    id: 'genz-neo-brutalist',
    name: 'Gen-Z Neo-Brutalist',
    tagline: 'High-Energy Pop Culture Wire',
    description: 'Vibrant Neo-Brutalist layout with heavy offset drop-shadows, electric lime & fuchsia highlights, sticker tags, emoji reaction badges, and snappy TL;DR summaries tailored for next-gen readers.',
    badge: 'Gen-Z Pop ⚡',
    themeColor: '#84cc16',
    accentBg: 'bg-lime-400',
    layoutStyle: 'Bold chunky borders, offset 3D hard shadows, playful sticker badges, and high-energy card stacks.',
    features: [
      'Chunky black borders & offset 3D shadows',
      'Sticker tags (⚡ REAL TALK, 🔥 VIRAL, 👀 MUST READ)',
      'Acid lime, electric yellow & fuchsia accent pills',
      'Snappy quick-read bullet cards'
    ],
  },
  {
    id: 'clean-nordic-white',
    name: 'Nordic Clean Paper',
    tagline: 'Pure White Ultra-Readable Journalism',
    description: 'Pristine pure white background with refined charcoal typography, airy whitespace, delicate minimal lines, and high-contrast readability inspired by Scandinavian publication design.',
    badge: 'Pure White ⚪',
    themeColor: '#0f172a',
    accentBg: 'bg-slate-900',
    layoutStyle: 'Airy pure white grid with elegant charcoal typography and soft hairline dividers.',
    features: [
      '100% crisp pure white paper background',
      'High-contrast charcoal & slate typography',
      'Generous breathable margins & spacing',
      'Refined minimal category pill indicators'
    ],
  },
  {
    id: 'visual-stories-deck',
    name: 'Reels & Visual Stories Deck',
    tagline: 'Mobile-First Visual Stories',
    description: 'Instagram and TikTok-inspired stories feed featuring interactive category story rings at the top, vertical 9:16 card aspect ratios, high-impact photo overlays, and bite-sized visual dispatches.',
    badge: 'Stories & Reels 📱',
    themeColor: '#e11d48',
    accentBg: 'bg-rose-600',
    layoutStyle: 'Vertical media story cards with glowing story bubbles and full-card image backdrops.',
    features: [
      'Story ring bubbles with glowing gradient borders',
      'Vertical 9:16 portrait visual story cards',
      'High-contrast floating glassmorphic captions',
      'Tap-friendly category spotlight carousel'
    ],
  },
  {
    id: 'tech-terminal-wire',
    name: 'Cyber Terminal Newsdesk',
    tagline: 'Retro-Futuristic Hacker Console',
    description: 'Command-line inspired newsroom terminal with monospaced typography, phosphor green & amber status indicators, CLI header bar ($ kjin-wire --live), and real-time telemetry markers.',
    badge: 'Terminal CLI 💻',
    themeColor: '#22c55e',
    accentBg: 'bg-emerald-600',
    layoutStyle: 'Monospaced dark terminal with command prompt header, status flags, and data telemetry.',
    features: [
      'Monospaced terminal typography & CLI header',
      'Phosphor matrix green & amber status indicators',
      '[STATUS: VERIFIED] security audit stamps',
      'ASCII-styled structural dividers & wire feed'
    ],
  },
  {
    id: 'hyperlocal-community',
    name: 'Hyperlocal Community Dispatch',
    tagline: 'Grassroots Citizen Journalism',
    description: 'Civic journalism hub with an interactive district quick-switcher (Srinagar, Jammu, Baramulla, Anantnag...), community quote spotlights, transit advisory bulletins, and public interest dispatches.',
    badge: 'Community Hub 🏘️',
    themeColor: '#059669',
    accentBg: 'bg-emerald-700',
    layoutStyle: 'Clean civic dashboard with district switcher pills, community quotes, and transit alerts.',
    features: [
      'Interactive J&K district pill quick-filter',
      'Civic advisory & weather/transit bulletin banner',
      '"Voices from the Valley" quote spotlight cards',
      'Grassroots local reporter byline badges'
    ],
  },
];

export function getTemplateDefinition(id?: string | null): TemplateDefinition {
  const match = AVAILABLE_TEMPLATES.find((t) => t.id === id);
  return match ?? AVAILABLE_TEMPLATES[0];
}
