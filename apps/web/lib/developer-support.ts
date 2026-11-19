export interface DeveloperSupportSettings {
  show_developer_section: boolean;
  developer_name: string;
  developer_description: string;
  developer_website: string;
  support_email: string;
  support_phone: string;
  show_mail_us: boolean;
  show_call_us: boolean;
  footer_position: 'bottom' | 'column' | 'subfooter';
  show_on_mobile: boolean;
}

export const DEFAULT_DEVELOPER_SUPPORT: DeveloperSupportSettings = {
  show_developer_section: true,
  developer_name: 'KJCPL Development Team',
  developer_description: 'Website design, development, technology infrastructure and maintenance.',
  developer_website: 'https://kjcpl.site',
  support_email: 'h26412301@gmail.com',
  support_phone: '',
  show_mail_us: true,
  show_call_us: false,
  footer_position: 'bottom',
  show_on_mobile: true,
};

export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  if (!phone || !phone.trim()) return true;
  return /^[+0-9\s\-()]{7,25}$/.test(phone.trim());
}

export function validateUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return '';
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed.slice(0, 255);
}

export function sanitizeEmail(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (validateEmail(trimmed)) {
    return trimmed.slice(0, 100);
  }
  return '';
}

export function sanitizePhone(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('6005950197')) return '';
  if (validatePhone(trimmed)) {
    return trimmed.slice(0, 50);
  }
  return '';
}

export function sanitizeDeveloperSupportSettings(
  input?: Partial<DeveloperSupportSettings> | null
): DeveloperSupportSettings {
  if (!input) {
    return { ...DEFAULT_DEVELOPER_SUPPORT };
  }

  const validPositions: Array<'bottom' | 'column' | 'subfooter'> = ['bottom', 'column', 'subfooter'];
  const pos = validPositions.includes(input.footer_position as 'bottom' | 'column' | 'subfooter')
    ? (input.footer_position as 'bottom' | 'column' | 'subfooter')
    : DEFAULT_DEVELOPER_SUPPORT.footer_position;

  const phone = sanitizePhone(input.support_phone ?? DEFAULT_DEVELOPER_SUPPORT.support_phone);

  return {
    show_developer_section: input.show_developer_section !== false,
    developer_name:
      typeof input.developer_name === 'string' && input.developer_name.trim()
        ? input.developer_name.trim().slice(0, 150)
        : DEFAULT_DEVELOPER_SUPPORT.developer_name,
    developer_description:
      typeof input.developer_description === 'string' && input.developer_description.trim()
        ? input.developer_description.trim().slice(0, 500)
        : DEFAULT_DEVELOPER_SUPPORT.developer_description,
    developer_website: sanitizeUrl(input.developer_website),
    support_email: sanitizeEmail(input.support_email ?? DEFAULT_DEVELOPER_SUPPORT.support_email),
    support_phone: phone,
    show_mail_us: input.show_mail_us !== false,
    show_call_us: Boolean(input.show_call_us && phone),
    footer_position: pos,
    show_on_mobile: input.show_on_mobile !== false,
  };
}
