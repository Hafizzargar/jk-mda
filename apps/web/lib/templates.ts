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

export interface TemplateTheme {
  id: TemplateId;
  name: string;
  isDark: boolean;
  pageBgClass: string;
  pageBgHex: string;
  headerBgClass: string;
  headerBorderClass: string;
  cardBgClass: string;
  cardBorderClass: string;
  cardHoverClass: string;
  subtleBgClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  textMutedClass: string;
  accentTextClass: string;
  accentBgClass: string;
  accentBorderClass: string;
  borderClass: string;
  borderMutedClass: string;
  fontFamilyClass: string;
  selectionClass: string;
  proseClass: string;
}

export const TEMPLATE_THEMES: Record<TemplateId, TemplateTheme> = {
  'classic-editorial': {
    id: 'classic-editorial',
    name: 'Classic Editorial Broadsheet',
    isDark: false,
    pageBgClass: 'bg-[#faf8f5]',
    pageBgHex: '#faf8f5',
    headerBgClass: 'bg-[#fdfbf7]',
    headerBorderClass: 'border-b-4 border-double border-slate-900',
    cardBgClass: 'bg-white',
    cardBorderClass: 'border border-slate-300',
    cardHoverClass: 'hover:border-slate-900 shadow-sm hover:shadow-md',
    subtleBgClass: 'bg-[#f4efe8]',
    textPrimaryClass: 'text-slate-900',
    textSecondaryClass: 'text-slate-700',
    textMutedClass: 'text-slate-500',
    accentTextClass: 'text-red-800',
    accentBgClass: 'bg-red-800 text-white',
    accentBorderClass: 'border-red-800',
    borderClass: 'border-slate-300',
    borderMutedClass: 'border-slate-200',
    fontFamilyClass: 'font-serif',
    selectionClass: 'selection:bg-amber-200 selection:text-slate-900',
    proseClass: 'prose prose-slate max-w-none',
  },
  'modern-magazine': {
    id: 'modern-magazine',
    name: 'Modern Visual Magazine',
    isDark: true,
    pageBgClass: 'bg-slate-950',
    pageBgHex: '#020617',
    headerBgClass: 'bg-slate-950/80 backdrop-blur-md',
    headerBorderClass: 'border-b border-slate-800',
    cardBgClass: 'bg-slate-900/60',
    cardBorderClass: 'border border-slate-800',
    cardHoverClass: 'hover:bg-slate-900/90 hover:border-blue-500/50 shadow-md hover:shadow-xl',
    subtleBgClass: 'bg-slate-900/40',
    textPrimaryClass: 'text-slate-100',
    textSecondaryClass: 'text-slate-300',
    textMutedClass: 'text-slate-400',
    accentTextClass: 'text-blue-400',
    accentBgClass: 'bg-blue-600 text-white',
    accentBorderClass: 'border-blue-500',
    borderClass: 'border-slate-800',
    borderMutedClass: 'border-slate-800/60',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-blue-600 selection:text-white',
    proseClass: 'prose prose-invert max-w-none',
  },
  'minimal-focus': {
    id: 'minimal-focus',
    name: 'Minimal Focus Reader',
    isDark: false,
    pageBgClass: 'bg-[#fafaf9]',
    pageBgHex: '#fafaf9',
    headerBgClass: 'bg-white/80 backdrop-blur-sm',
    headerBorderClass: 'border-b border-stone-200',
    cardBgClass: 'bg-white',
    cardBorderClass: 'border border-stone-200',
    cardHoverClass: 'hover:border-stone-400 shadow-sm hover:shadow',
    subtleBgClass: 'bg-stone-100',
    textPrimaryClass: 'text-stone-900',
    textSecondaryClass: 'text-stone-700',
    textMutedClass: 'text-stone-500',
    accentTextClass: 'text-stone-900',
    accentBgClass: 'bg-stone-900 text-white',
    accentBorderClass: 'border-stone-900',
    borderClass: 'border-stone-200',
    borderMutedClass: 'border-stone-100',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-stone-200 selection:text-stone-900',
    proseClass: 'prose prose-stone max-w-none',
  },
  'breaking-wire': {
    id: 'breaking-wire',
    name: 'Breaking Newsroom Wire',
    isDark: true,
    pageBgClass: 'bg-neutral-900',
    pageBgHex: '#171717',
    headerBgClass: 'bg-neutral-950',
    headerBorderClass: 'border-b border-neutral-800',
    cardBgClass: 'bg-neutral-950/80',
    cardBorderClass: 'border border-neutral-800',
    cardHoverClass: 'hover:border-red-500/60 shadow-md hover:shadow-xl',
    subtleBgClass: 'bg-neutral-800/40',
    textPrimaryClass: 'text-neutral-100',
    textSecondaryClass: 'text-neutral-300',
    textMutedClass: 'text-neutral-500',
    accentTextClass: 'text-red-400',
    accentBgClass: 'bg-red-600 text-white',
    accentBorderClass: 'border-red-600',
    borderClass: 'border-neutral-800',
    borderMutedClass: 'border-neutral-800/60',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-red-600 selection:text-white',
    proseClass: 'prose prose-invert max-w-none',
  },
  'bento-grid': {
    id: 'bento-grid',
    name: 'Contemporary Bento Media',
    isDark: true,
    pageBgClass: 'bg-slate-900',
    pageBgHex: '#0f172a',
    headerBgClass: 'bg-slate-950/80 backdrop-blur-md',
    headerBorderClass: 'border-b border-slate-800',
    cardBgClass: 'bg-slate-800/80',
    cardBorderClass: 'border border-slate-700/60',
    cardHoverClass: 'hover:border-cyan-500/60 shadow-lg hover:shadow-cyan-500/10',
    subtleBgClass: 'bg-slate-800/40',
    textPrimaryClass: 'text-slate-100',
    textSecondaryClass: 'text-slate-300',
    textMutedClass: 'text-slate-400',
    accentTextClass: 'text-cyan-400',
    accentBgClass: 'bg-cyan-500 text-slate-950 font-bold',
    accentBorderClass: 'border-cyan-500',
    borderClass: 'border-slate-800',
    borderMutedClass: 'border-slate-800/60',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-cyan-500 selection:text-slate-950',
    proseClass: 'prose prose-invert max-w-none',
  },
  'genz-neo-brutalist': {
    id: 'genz-neo-brutalist',
    name: 'Gen-Z Neo-Brutalist',
    isDark: false,
    pageBgClass: 'bg-[#fafaf9]',
    pageBgHex: '#fafaf9',
    headerBgClass: 'bg-[#fef08a]',
    headerBorderClass: 'border-b-4 border-black',
    cardBgClass: 'bg-white',
    cardBorderClass: 'border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    cardHoverClass: 'hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
    subtleBgClass: 'bg-lime-200',
    textPrimaryClass: 'text-black',
    textSecondaryClass: 'text-neutral-800',
    textMutedClass: 'text-neutral-600',
    accentTextClass: 'text-black',
    accentBgClass: 'bg-lime-300 text-black border border-black',
    accentBorderClass: 'border-black',
    borderClass: 'border-black',
    borderMutedClass: 'border-black/50',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-lime-300 selection:text-black',
    proseClass: 'prose prose-slate max-w-none',
  },
  'clean-nordic-white': {
    id: 'clean-nordic-white',
    name: 'Nordic Clean Paper',
    isDark: false,
    pageBgClass: 'bg-white',
    pageBgHex: '#ffffff',
    headerBgClass: 'bg-white/95 backdrop-blur-md',
    headerBorderClass: 'border-b border-neutral-200',
    cardBgClass: 'bg-white',
    cardBorderClass: 'border border-neutral-200',
    cardHoverClass: 'hover:border-neutral-400 shadow-sm hover:shadow',
    subtleBgClass: 'bg-neutral-50',
    textPrimaryClass: 'text-neutral-900',
    textSecondaryClass: 'text-neutral-700',
    textMutedClass: 'text-neutral-500',
    accentTextClass: 'text-neutral-900',
    accentBgClass: 'bg-neutral-900 text-white',
    accentBorderClass: 'border-neutral-900',
    borderClass: 'border-neutral-200',
    borderMutedClass: 'border-neutral-100',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-neutral-900 selection:text-white',
    proseClass: 'prose prose-neutral max-w-none',
  },
  'visual-stories-deck': {
    id: 'visual-stories-deck',
    name: 'Reels & Visual Stories Deck',
    isDark: true,
    pageBgClass: 'bg-[#0c0a09]',
    pageBgHex: '#0c0a09',
    headerBgClass: 'bg-[#0c0a09]/90 backdrop-blur-md',
    headerBorderClass: 'border-b border-stone-800',
    cardBgClass: 'bg-stone-900/70',
    cardBorderClass: 'border border-stone-800',
    cardHoverClass: 'hover:border-rose-500/60 shadow-lg hover:shadow-rose-500/10',
    subtleBgClass: 'bg-stone-900/40',
    textPrimaryClass: 'text-stone-100',
    textSecondaryClass: 'text-stone-300',
    textMutedClass: 'text-stone-500',
    accentTextClass: 'text-rose-400',
    accentBgClass: 'bg-rose-600 text-white',
    accentBorderClass: 'border-rose-600',
    borderClass: 'border-stone-800',
    borderMutedClass: 'border-stone-800/60',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-rose-500 selection:text-white',
    proseClass: 'prose prose-invert max-w-none',
  },
  'tech-terminal-wire': {
    id: 'tech-terminal-wire',
    name: 'Cyber Terminal Newsdesk',
    isDark: true,
    pageBgClass: 'bg-[#050805]',
    pageBgHex: '#050805',
    headerBgClass: 'bg-[#050805]',
    headerBorderClass: 'border-b border-[#14532d]',
    cardBgClass: 'bg-[#020402]',
    cardBorderClass: 'border border-[#14532d]',
    cardHoverClass: 'hover:border-[#22c55e] shadow-md shadow-[#22c55e]/10',
    subtleBgClass: 'bg-[#0a140a]',
    textPrimaryClass: 'text-[#22c55e]',
    textSecondaryClass: 'text-[#86efac]',
    textMutedClass: 'text-[#15803d]',
    accentTextClass: 'text-[#4ade80]',
    accentBgClass: 'bg-[#22c55e] text-black font-bold',
    accentBorderClass: 'border-[#22c55e]',
    borderClass: 'border-[#14532d]',
    borderMutedClass: 'border-[#14532d]/60',
    fontFamilyClass: 'font-mono',
    selectionClass: 'selection:bg-[#22c55e] selection:text-black',
    proseClass: 'prose prose-invert max-w-none font-mono',
  },
  'hyperlocal-community': {
    id: 'hyperlocal-community',
    name: 'Hyperlocal Community Dispatch',
    isDark: false,
    pageBgClass: 'bg-slate-50',
    pageBgHex: '#f8fafc',
    headerBgClass: 'bg-white',
    headerBorderClass: 'border-b border-slate-200',
    cardBgClass: 'bg-white',
    cardBorderClass: 'border border-slate-200',
    cardHoverClass: 'hover:border-emerald-500/50 shadow-sm hover:shadow-md',
    subtleBgClass: 'bg-emerald-50',
    textPrimaryClass: 'text-slate-900',
    textSecondaryClass: 'text-slate-700',
    textMutedClass: 'text-slate-500',
    accentTextClass: 'text-emerald-700',
    accentBgClass: 'bg-emerald-600 text-white',
    accentBorderClass: 'border-emerald-600',
    borderClass: 'border-slate-200',
    borderMutedClass: 'border-slate-100',
    fontFamilyClass: 'font-sans',
    selectionClass: 'selection:bg-emerald-500 selection:text-white',
    proseClass: 'prose prose-slate max-w-none',
  },
};

export function getTemplateTheme(id?: string | null): TemplateTheme {
  const match = id && id in TEMPLATE_THEMES ? TEMPLATE_THEMES[id as TemplateId] : undefined;
  return match ?? TEMPLATE_THEMES['classic-editorial'];
}

