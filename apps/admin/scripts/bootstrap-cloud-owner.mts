import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uaaajvcmjivszrkzdmvu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYWFqdmNtaml2c3pya3pkbXZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDgwNDk1MCwiZXhwIjoyMTEwMzgwOTUwfQ.xi8MTh4oTapDcauwEY8p36MNpx3VikgYAztmUYc5OrQ';

const email = process.argv[2] || 'hafezzargar987@gmail.com';
const password = process.argv[3];
const displayName = 'Hafiz Zargar';

if (!password) {
  console.error('Password is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  console.log(`Bootstrapping owner account for: ${email}`);

  // 1. Insert employee invite record so the database trigger allows account creation
  const { data: invite, error: inviteErr } = await supabase
    .from('employee_invites')
    .insert({
      email,
      display_name: displayName,
      role_key: 'owner',
      reason: 'Owner initial bootstrap',
      status: 'sending',
    })
    .select('id')
    .single();

  if (inviteErr) {
    console.error('Failed to create bootstrap invite:', inviteErr);
    process.exit(1);
  }

  console.log('Created bootstrap invite ID:', invite.id);

  // 2. Create the user in auth.users
  const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      employee_invite_id: invite.id,
    },
  });

  if (userErr) {
    console.error('Failed to create auth user:', userErr);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log('Created Auth User ID:', userId);

  // 3. Ensure profile is active with owner role
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email,
      display_name: displayName,
      role: 'owner',
      role_key: 'owner',
      status: 'active',
    });

  if (profileErr) {
    console.error('Failed to update profile to active owner:', profileErr);
    process.exit(1);
  }

  // 4. Update invite status to accepted
  await supabase
    .from('employee_invites')
    .update({ status: 'accepted', auth_user_id: userId, accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  console.log('SUCCESS: Owner account created and activated successfully!');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
