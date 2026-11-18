import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const userMail = 'h26412301@gmail.com';

// 1. Update footer_contact
const { data: current } = await supabase.from('site_settings').select('value').eq('key', 'footer_contact').single();
const updatedFooter = {
  ...(current?.value || {}),
  email_editorial: userMail,
  email_careers: userMail,
  email_press: userMail,
  email_grievance: userMail,
};

const { error: footerErr } = await supabase.from('site_settings').upsert({
  key: 'footer_contact',
  value: updatedFooter,
  description: 'Footer Bureau and Direct Communications contact info',
  updated_at: new Date().toISOString(),
});

console.log('Update footer_contact result:', footerErr ? `Error: ${footerErr.message}` : 'SUCCESS');

// 2. Update developer_support
const { data: devCurrent } = await supabase.from('site_settings').select('value').eq('key', 'developer_support').single();
const updatedDev = {
  ...(devCurrent?.value || {}),
  support_email: userMail,
};

const { error: devErr } = await supabase.from('site_settings').upsert({
  key: 'developer_support',
  value: updatedDev,
  description: 'Developer Attribution and Technical Support Settings',
  updated_at: new Date().toISOString(),
});

console.log('Update developer_support result:', devErr ? `Error: ${devErr.message}` : 'SUCCESS');
