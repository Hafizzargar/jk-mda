import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.KJIN_OWNER_EMAIL?.trim().toLowerCase();
const displayName = process.env.KJIN_OWNER_NAME?.trim() || 'KJIN Owner';
const redirectTo = `${process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'}/login`;

if (!supabaseUrl || !serviceRoleKey || !email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a valid KJIN_OWNER_EMAIL before running bootstrap-owner.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: owner, error: ownerError } = await supabase
  .from('profiles')
  .select('id')
  .eq('role_key', 'owner')
  .maybeSingle();

if (ownerError) throw ownerError;
if (owner) throw new Error('A KJIN Owner already exists; bootstrap is one-time only.');

const { data: invite, error: inviteError } = await supabase
  .from('employee_invites')
  .insert({ email, display_name: displayName, role_key: 'owner', reason: 'Initial Owner bootstrap invitation', invited_by: null, status: 'sending' })
  .select('id')
  .single();

if (inviteError || !invite) throw inviteError ?? new Error('Unable to create Owner invitation.');

const { data: invited, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { display_name: displayName, employee_invite_id: invite.id },
  redirectTo,
});

if (authError || !invited.user) {
  const reason = authError?.message ?? 'Auth did not return an invited user.';
  await supabase.from('employee_invites').update({ status: 'failed', failure_reason: reason }).eq('id', invite.id);
  throw authError ?? new Error(reason);
}

const { error: profileError } = await supabase
  .from('profiles')
  .update({ role: 'owner', role_key: 'owner', display_name: displayName, email })
  .eq('id', invited.user.id);

if (profileError) {
  await supabase.auth.admin.deleteUser(invited.user.id);
  await supabase.from('employee_invites').update({ status: 'failed', failure_reason: profileError.message }).eq('id', invite.id);
  throw profileError;
}

await supabase.from('employee_invites')
  .update({ auth_user_id: invited.user.id, status: 'invited' })
  .eq('id', invite.id);

await supabase.from('audit_logs').insert({
  action: 'employee.owner_bootstrapped',
  target_type: 'profile',
  target_id: invited.user.id,
  result: 'success',
  reason: 'Initial Owner bootstrap invitation',
  details: { email, invite_id: invite.id },
});

console.log(`Owner invitation sent to ${email}. The account becomes active after email confirmation.`);
