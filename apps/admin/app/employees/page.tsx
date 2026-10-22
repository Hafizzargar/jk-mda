'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authRoles, type AuthRole } from '@kjin/auth';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';

type Employee = {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  role_key: AuthRole;
  status: 'invited' | 'active' | 'disabled';
  created_at: string;
  can_manage: boolean;
};

type InviteRequest = {
  id: string;
  email: string;
  display_name: string;
  requested_role: AuthRole;
  reason: string;
  requester_name: string | null;
  created_at: string;
};

type DeletionRequest = {
  id: string;
  target_profile_id: string;
  target_name: string | null;
  target_role: AuthRole;
  requester_name: string | null;
  reason: string;
  created_at: string;
};

type AuditEvent = {
  id: number;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  result: 'success' | 'denied' | 'failure';
  reason: string;
  details: Record<string, unknown>;
  session_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const roleRank: Record<AuthRole, number> = {
  owner: 500,
  superadmin: 400,
  admin: 300,
  editor: 200,
  author: 100,
};

const tabs = [
  { id: 'all', label: 'All employees' },
  { id: 'add', label: 'Add employee' },
  { id: 'active', label: 'Active' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'deletion', label: 'Pending deletion' },
  { id: 'audit', label: 'Audit history' },
] as const;

type TabId = (typeof tabs)[number]['id'];

type ActionModal =
  | {
      type: 'change-role';
      employee: Employee;
      nextRole: AuthRole;
    }
  | {
      type: 'update-name';
      employee: Employee;
      name: string;
    }
  | {
      type: 'change-status';
      employee: Employee;
      nextStatus: 'active' | 'disabled';
    }
  | {
      type: 'request-deletion';
      employee: Employee;
    }
  | {
      type: 'resolve-deletion';
      request: DeletionRequest;
      decision: 'approved' | 'rejected';
    }
  | {
      type: 'approve-invite-request';
      request: InviteRequest;
    }
  | {
      type: 'reject-invite-request';
      request: InviteRequest;
    }
  | {
      type: 'resend-invite';
      employee: Employee;
    }
  | null;

export default function EmployeesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [inviteRequests, setInviteRequests] = useState<InviteRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [status, setStatus] = useState('Loading employee workspace...');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // In-page feedback and modal state (replaces archaic window.prompt)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [modalReason, setModalReason] = useState('');
  const [modalName, setModalName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const openModal = (modal: ActionModal) => {
    setActionModal(modal);
    setModalReason('');
    setModalError(null);
    if (modal?.type === 'update-name') {
      setModalName(modal.employee.display_name || '');
    }
  };

  const closeModal = () => {
    setActionModal(null);
    setModalReason('');
    setModalError(null);
  };

  const can = (permission: string) => permissions.includes(permission);
  const runEmployeeOperation = async (operation: string, values: Record<string, unknown>) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return { error: error?.message ?? 'Sign-in required.' };

    const response = await fetch('/api/employees/operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ operation, ...values }),
    });
    const result = (await response.json()) as { error?: string; data?: unknown; code?: string };
    if (!response.ok && response.status === 403 && (result.code === 'reauth_required' || result.error?.includes('Recent authentication'))) {
      window.location.href = '/mfa/challenge?reauth=true&next=/employees';
      return { error: 'Recent authentication required. Redirecting to MFA verification...' };
    }
    return response.ok ? { data: result.data } : { error: result.error ?? 'Employee operation failed.' };
  };

  const assignableRoles = useMemo(
    () => authRoles.filter((candidate) => candidate !== 'owner' && role !== null && roleRank[candidate] < roleRank[role]),
    [role]
  );

  const loadWorkspace = async () => {
    setIsLoading(true);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      setStatus('Sign in with an active employee account to view this workspace.');
      setIsLoading(false);
      return;
    }

    // 1. Check user role first
    const { data: roleData, error: roleError } = await supabase.rpc('current_user_role');
    if (roleError || !roleData) {
      setStatus(roleError?.message ?? 'No valid role found.');
      setIsLoading(false);
      return;
    }

    const sessionUserRole = roleData as AuthRole;
    setRole(sessionUserRole);

    // 2. Enforce MFA check before querying protected RPCs
    const mfaRequired = requiresMfa(sessionUserRole);
    if (mfaRequired) {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel !== 'aal2') {
        setStatus('Two-Factor Authentication (AAL2) is required to view the employee directory.');
        setIsLoading(false);
        if (aalData?.nextLevel === 'aal2') {
          window.location.href = '/mfa/challenge?next=/employees';
          return;
        } else {
          window.location.href = '/mfa/enroll';
          return;
        }
      }
    }

    // 3. Now that MFA is verified (AAL2), load permissions and employee directory
    const [permissionResult, employeesResult] = await Promise.all([
      supabase.rpc('current_user_permissions'),
      supabase.rpc('list_employees'),
    ]);

    if (permissionResult.error || employeesResult.error) {
      setStatus(employeesResult.error?.message ?? permissionResult.error?.message ?? 'Unable to load employee data.');
      setIsLoading(false);
      return;
    }

    setPermissions((permissionResult.data as string[] | null) ?? []);
    setEmployees((employeesResult.data as Employee[] | null) ?? []);

    const optionalLoads: Promise<void>[] = [];
    if ((permissionResult.data as string[] | null)?.includes('employee.invite.review')) {
      optionalLoads.push(
        (async () => {
          const { data } = await supabase.rpc('list_employee_invite_requests');
          setInviteRequests((data as InviteRequest[] | null) ?? []);
        })()
      );
    }
    if ((permissionResult.data as string[] | null)?.includes('employee.deletion.view')) {
      optionalLoads.push(
        (async () => {
          const { data } = await supabase.rpc('list_employee_deletion_requests');
          setDeletionRequests((data as DeletionRequest[] | null) ?? []);
        })()
      );
    }
    if (
      (permissionResult.data as string[] | null)?.includes('employee.audit.read') ||
      (permissionResult.data as string[] | null)?.includes('employee.audit.security.read')
    ) {
      optionalLoads.push(
        (async () => {
          const { data } = await supabase.rpc('list_audit_history');
          setAuditEvents((data as AuditEvent[] | null) ?? []);
        })()
      );
    }

    await Promise.all(optionalLoads);
    setStatus('Employee data is current.');
    setIsLoading(false);
  };

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitInviteRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setIsSubmitting(true);
    const form = new FormData(formElement);
    const { error } = await runEmployeeOperation('request-invite', {
      email: String(form.get('email') ?? ''),
      display_name: String(form.get('display_name') ?? ''),
      role_key: String(form.get('role_key') ?? ''),
      reason: String(form.get('reason') ?? ''),
    });
    if (error) {
      setFeedback({ type: 'error', message: `Request failed: ${error}` });
    } else {
      setFeedback({ type: 'success', message: 'Invitation request submitted for review.' });
      formElement.reset();
    }
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setIsSubmitting(true);
    const form = new FormData(formElement);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/employees/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email: form.get('email'),
        display_name: form.get('display_name'),
        role_key: form.get('role_key'),
        reason: form.get('reason'),
      }),
    });
    const result = (await response.json()) as { error?: string; temporary_password?: string; email_sent?: boolean; code?: string };
    if (response.ok) {
      const emailNotice = result.email_sent ? 'Invitation email sent to employee.' : 'Invitation created.';
      const pwdNotice = result.temporary_password ? ` Initial password: ${result.temporary_password}` : '';
      setFeedback({ type: 'success', message: `${emailNotice}${pwdNotice}` });
      formElement.reset();
    } else {
      if (response.status === 403 && (result.code === 'reauth_required' || result.error?.includes('Recent authentication'))) {
        setFeedback({ type: 'error', message: 'Recent authentication required for security. Redirecting to MFA verification...' });
        window.location.href = '/mfa/challenge?reauth=true&next=/employees';
        return;
      }
      setFeedback({ type: 'error', message: `Invitation failed: ${result.error ?? 'Unknown error.'}` });
    }
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const handleModalConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    const reason = modalReason.trim();
    if (!reason) {
      setModalError('A reason is required.');
      return;
    }
    if (reason.length > 1000) {
      setModalError('Reason cannot exceed 1000 characters.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (actionModal.type === 'change-role') {
        const { error } = await runEmployeeOperation('change-role', {
          target_id: actionModal.employee.id,
          role_key: actionModal.nextRole,
          reason,
        });
        if (error) {
          setModalError(error);
          setIsSubmitting(false);
          return;
        }
        setFeedback({
          type: 'success',
          message: `Role for ${actionModal.employee.display_name || actionModal.employee.email} changed to ${actionModal.nextRole}.`,
        });
      } else if (actionModal.type === 'update-name') {
        const newName = modalName.trim();
        if (!newName) {
          setModalError('Display name is required.');
          setIsSubmitting(false);
          return;
        }
        const { error } = await runEmployeeOperation('update-basic', {
          target_id: actionModal.employee.id,
          display_name: newName,
          reason,
        });
        if (error) {
          setModalError(error);
          setIsSubmitting(false);
          return;
        }
        setFeedback({
          type: 'success',
          message: `Display name updated to "${newName}".`,
        });
      } else if (actionModal.type === 'change-status') {
        const { data } = await supabase.auth.getSession();
        const response = await fetch(`/api/employees/${actionModal.employee.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
          },
          body: JSON.stringify({ status: actionModal.nextStatus, reason }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          setModalError(result.error ?? 'Status update failed.');
          setIsSubmitting(false);
          return;
        }
        setFeedback({
          type: 'success',
          message: `Employee ${actionModal.employee.display_name || actionModal.employee.email} ${actionModal.nextStatus}.`,
        });
      } else if (actionModal.type === 'request-deletion') {
        const { error } = await runEmployeeOperation('request-deletion', {
          target_id: actionModal.employee.id,
          reason,
        });
        if (error) {
          setModalError(error);
          setIsSubmitting(false);
          return;
        }
        setFeedback({
          type: 'success',
          message: 'Deprovisioning request submitted for review.',
        });
      } else if (actionModal.type === 'resolve-deletion') {
        const { error } = await runEmployeeOperation('resolve-deletion', {
          request_id: actionModal.request.id,
          decision: actionModal.decision,
          reason,
        });
        if (error) {
          setModalError(error);
          setIsSubmitting(false);
          return;
        }
        if (actionModal.decision === 'approved') {
          const { data } = await supabase.auth.getSession();
          const response = await fetch(`/api/employees/${actionModal.request.target_profile_id}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
            },
            body: JSON.stringify({ status: 'disabled', reason }),
          });
          if (!response.ok) {
            const result = (await response.json()) as { error?: string };
            setFeedback({
              type: 'error',
              message: `Profile deprovisioned, but Auth revocation failed: ${result.error ?? 'Unknown error.'}`,
            });
            closeModal();
            setIsSubmitting(false);
            await loadWorkspace();
            return;
          }
        }
        setFeedback({
          type: 'success',
          message: `Deprovisioning request ${actionModal.decision}.`,
        });
      } else if (actionModal.type === 'approve-invite-request') {
        const { data } = await supabase.auth.getSession();
        const response = await fetch('/api/employees/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
          },
          body: JSON.stringify({ request_id: actionModal.request.id, reason }),
        });
        const result = (await response.json()) as { error?: string; temporary_password?: string; email_sent?: boolean; code?: string };
        if (!response.ok) {
          if (response.status === 403 && (result.code === 'reauth_required' || result.error?.includes('Recent authentication'))) {
            window.location.href = '/mfa/challenge?reauth=true&next=/employees';
            return;
          }
          setModalError(result.error ?? 'Invitation approval failed.');
          setIsSubmitting(false);
          return;
        }
        const emailNotice = result.email_sent ? 'Invitation email sent.' : 'Invitation created.';
        const pwdNotice = result.temporary_password ? ` Initial password: ${result.temporary_password}` : '';
        setFeedback({ type: 'success', message: `${emailNotice}${pwdNotice}` });
      } else if (actionModal.type === 'reject-invite-request') {
        const { error } = await runEmployeeOperation('reject-invite-request', {
          request_id: actionModal.request.id,
          reason,
        });
        if (error) {
          setModalError(error);
          setIsSubmitting(false);
          return;
        }
        setFeedback({ type: 'success', message: 'Invitation request declined.' });
      } else if (actionModal.type === 'resend-invite') {
        const { data } = await supabase.auth.getSession();
        const response = await fetch('/api/employees/resend-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
          },
          body: JSON.stringify({ employee_id: actionModal.employee.id, reason }),
        });
        const result = (await response.json()) as { error?: string; temporary_password?: string; email_sent?: boolean };
        if (!response.ok) {
          if (response.status === 403 && result.error?.includes('Recent authentication')) {
            window.location.href = '/mfa/challenge?reauth=true&next=/employees';
            return;
          }
          setModalError(result.error ?? 'Resending invitation failed.');
          setIsSubmitting(false);
          return;
        }
        const emailNotice = result.email_sent ? 'Invitation email resent.' : 'Invitation credentials refreshed.';
        const pwdNotice = result.temporary_password ? ` Initial password: ${result.temporary_password}` : '';
        setFeedback({ type: 'success', message: `${emailNotice}${pwdNotice}` });
      }

      closeModal();
      setIsSubmitting(false);
      await loadWorkspace();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Unexpected operation failure.');
      setIsSubmitting(false);
    }
  };

  const visibleEmployees = employees.filter((employee) => {
    // Subordinates (superadmin, admin, editor, author) cannot view the system owner
    if (role !== 'owner' && employee.role_key === 'owner') return false;
    if (activeTab === 'active') return employee.status === 'active';
    if (activeTab === 'disabled') return employee.status === 'disabled';
    return true;
  });

  const tabCount = (tab: TabId) => {
    const accessible = role === 'owner' ? employees : employees.filter((e) => e.role_key !== 'owner');
    if (tab === 'all') return accessible.length;
    if (tab === 'active') return accessible.filter((employee) => employee.status === 'active').length;
    if (tab === 'disabled') return accessible.filter((employee) => employee.status === 'disabled').length;
    if (tab === 'deletion') return deletionRequests.length;
    return null;
  };

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <Link href="/" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">KJIN newsroom</Link>
            <h1 className="mt-2 text-3xl font-bold">Employees</h1>
            <p className="mt-2 text-sm text-slate-400">Role: {role ?? 'checking access'}</p>
          </div>
          <div className="flex items-center gap-3">
            {role && ['owner', 'superadmin', 'admin'].includes(role) ? (
              <Link
                href="/templates"
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/20"
              >
                Website Templates
              </Link>
            ) : null}
            <button type="button" onClick={() => void loadWorkspace()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-500">
              Refresh
            </button>
          </div>
        </header>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 flex items-center justify-between rounded-xl border p-4 shadow-lg ${
              feedback.type === 'success'
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                : 'border-red-500/50 bg-red-950/60 text-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {feedback.type === 'success' ? '✓' : '!'}
              </span>
              <p className="font-medium">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {status.includes('Employee directory access is required') || status.includes('Two-Factor Authentication') ? (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-200 shadow-lg">
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-xl">
                🔐
              </span>
              <div>
                <p className="font-bold text-amber-100 text-base">Two-Factor Authentication (2FA) Required</p>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Your account role as <strong>{role || 'Owner'}</strong> requires TOTP Two-Factor verification (AAL2) to view and manage the employee directory.
                </p>
              </div>
            </div>
            <Link
              href="/mfa/challenge?next=/employees"
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition whitespace-nowrap shadow-md shadow-amber-500/20"
            >
              Verify 2FA Code →
            </Link>
          </div>
        ) : (
          <div role="status" className="mb-6 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {status}
          </div>
        )}

        <nav aria-label="Employee sections" className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${activeTab === tab.id ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              {tab.label}{tabCount(tab.id) !== null ? ` (${tabCount(tab.id)})` : ''}
            </button>
          ))}
        </nav>

        {isLoading ? <p className="py-12 text-center text-slate-400">Loading employee records...</p> : null}

        {!isLoading && can('employee.contact.update') ? (
          <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Login email and phone changes are paused until target verification and recent reauthentication are available.
          </p>
        ) : null}

        {!isLoading && activeTab === 'add' ? (
          <section className="grid gap-8 lg:grid-cols-2">
            {can('employee.invite') ? (
              <form onSubmit={sendInvite} className="space-y-5 border-b border-slate-800 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <div>
                  <h2 className="text-xl font-semibold">Invite employee</h2>
                  <p className="mt-1 text-sm text-slate-400">Invites are limited to roles below your own.</p>
                </div>
                <label className="block text-sm text-slate-300">Name
                  <input name="display_name" required maxLength={120} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <label className="block text-sm text-slate-300">Work email
                  <input name="email" type="email" required className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <label className="block text-sm text-slate-300">Role
                  <select name="role_key" required className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">
                    {assignableRoles.map((assignableRole) => <option key={assignableRole} value={assignableRole}>{assignableRole}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">Reason for invitation
                  <textarea name="reason" required rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <button disabled={isSubmitting || assignableRoles.length === 0} className="rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50">
                  Send invitation
                </button>
              </form>
            ) : (
              <form onSubmit={submitInviteRequest} className="space-y-5 border-b border-slate-800 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <div>
                  <h2 className="text-xl font-semibold">Request an employee invitation</h2>
                  <p className="mt-1 text-sm text-slate-400">An administrator must review and send the invitation.</p>
                </div>
                <label className="block text-sm text-slate-300">Name
                  <input name="display_name" required maxLength={120} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <label className="block text-sm text-slate-300">Work email
                  <input name="email" type="email" required className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <label className="block text-sm text-slate-300">Requested role
                  <select name="role_key" required className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white">
                    {authRoles.filter((item) => item !== 'owner' && role !== null && roleRank[item] <= roleRank[role]).map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">Reason
                  <textarea name="reason" required rows={3} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white" />
                </label>
                <button disabled={isSubmitting} className="rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-50">
                  Submit request
                </button>
              </form>
            )}

            {can('employee.invite.review') ? (
              <div>
                <h2 className="text-xl font-semibold">Invitation requests</h2>
                {inviteRequests.length === 0 ? <p className="mt-4 text-sm text-slate-400">No pending requests.</p> : (
                  <ul className="mt-4 divide-y divide-slate-800">
                    {inviteRequests.map((request) => (
                      <li key={request.id} className="py-4">
                        <p className="font-medium">{request.display_name} <span className="text-slate-400">({request.requested_role})</span></p>
                        <p className="mt-1 text-sm text-slate-300">{request.email}</p>
                        <p className="mt-1 text-sm text-slate-400">Requested by {request.requester_name ?? 'Former employee'}: {request.reason}</p>
                        <div className="mt-3 flex gap-2">
                          <button disabled={isSubmitting || !role || roleRank[request.requested_role] >= roleRank[role]} onClick={() => openModal({ type: 'approve-invite-request', request })} className="rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Send invite</button>
                          <button disabled={isSubmitting} onClick={() => openModal({ type: 'reject-invite-request', request })} className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-red-400 disabled:opacity-50">Decline</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {!isLoading && ['all', 'active', 'disabled'].includes(activeTab) ? (
          <section>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase text-slate-400">
                    <th className="px-3 py-3">Employee</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-slate-800 align-top">
                      <td className="px-3 py-4">
                        <p className="font-medium">{employee.display_name || 'Unnamed employee'}</p>
                        <p className="mt-1 text-slate-400">{employee.email ?? 'Contact details restricted'}</p>
                        {employee.phone ? <p className="mt-1 text-slate-500">{employee.phone}</p> : null}
                      </td>
                      <td className="px-3 py-4 capitalize">{employee.role_key}</td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2.5">
                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                              employee.status === 'active'
                                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : employee.status === 'disabled'
                                ? 'border border-red-500/30 bg-red-500/10 text-red-300'
                                : 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                employee.status === 'active'
                                  ? 'bg-emerald-400'
                                  : employee.status === 'disabled'
                                  ? 'bg-red-400'
                                  : 'bg-cyan-400'
                              }`}
                            />
                            {employee.status.replace('_', ' ')}
                          </span>

                          {/* Interactive Toggle Switch (Active <-> Disabled) */}
                          {employee.can_manage &&
                          (employee.status === 'active' || employee.status === 'disabled') &&
                          ((employee.status === 'active' && can('employee.disable')) ||
                            (employee.status === 'disabled' && can('employee.enable'))) ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={employee.status === 'active'}
                              disabled={isSubmitting}
                              onClick={() =>
                                openModal({
                                  type: 'change-status',
                                  employee,
                                  nextStatus: employee.status === 'active' ? 'disabled' : 'active',
                                })
                              }
                              title={
                                employee.status === 'active'
                                  ? `Disable ${employee.display_name || employee.email} (blocks login)`
                                  : `Enable ${employee.display_name || employee.email} (allows login)`
                              }
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${
                                employee.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-700 hover:bg-slate-600'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  employee.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-400">{new Date(employee.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          {employee.can_manage && can('employee.basic.update') ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => openModal({ type: 'update-name', employee, name: employee.display_name })}
                              className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:border-cyan-400"
                            >
                              Edit name
                            </button>
                          ) : null}
                          {employee.can_manage && can('employee.role.change') ? (
                            <select
                              aria-label={`Change role for ${employee.display_name}`}
                              value={employee.role_key}
                              disabled={isSubmitting}
                              onChange={(event) => {
                                const nextRole = event.target.value as AuthRole;
                                if (nextRole !== employee.role_key) {
                                  openModal({
                                    type: 'change-role',
                                    employee,
                                    nextRole,
                                  });
                                }
                              }}
                              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 capitalize cursor-pointer hover:border-cyan-400 focus:border-cyan-400"
                            >
                              {[...new Set([employee.role_key, ...assignableRoles])].map((item) => (
                                <option key={item} value={item}>{item}</option>
                              ))}
                            </select>
                          ) : null}
                          {deletionRequests.some((req) => req.target_profile_id === employee.id) ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('deletion')}
                              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                              title="A deprovisioning request is already pending. Click to review in Pending deletion."
                            >
                              <span>⏳</span> Pending deletion
                            </button>
                          ) : employee.can_manage && can('employee.deletion.request') && employee.status !== 'disabled' ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => openModal({ type: 'request-deletion', employee })}
                              className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-red-200 hover:bg-red-500/10"
                            >
                              Request deletion
                            </button>
                          ) : null}
                          {(role === 'owner' || (employee.can_manage && can('employee.invite'))) && employee.status === 'invited' ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => openModal({ type: 'resend-invite', employee })}
                              className="rounded-md border border-cyan-500/50 px-2.5 py-1.5 text-cyan-200 hover:bg-cyan-500/10"
                            >
                              Resend invite
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleEmployees.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">No employees in this view.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!isLoading && activeTab === 'deletion' ? (
          <section>
            {deletionRequests.length === 0 ? <p className="py-10 text-center text-slate-400">No pending deletion requests.</p> : (
              <ul className="divide-y divide-slate-800">
                {deletionRequests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
                    <div>
                      <h2 className="font-semibold">{request.target_name ?? 'Unknown employee'} <span className="font-normal capitalize text-slate-400">({request.target_role})</span></h2>
                      <p className="mt-1 text-sm text-slate-400">Requested by {request.requester_name ?? 'Former employee'} on {new Date(request.created_at).toLocaleString()}</p>
                      <p className="mt-2 text-sm text-slate-200">{request.reason}</p>
                    </div>
                    {can('employee.deletion.resolve') ? (
                      <div className="flex gap-2">
                        <button disabled={isSubmitting} onClick={() => openModal({ type: 'resolve-deletion', request, decision: 'approved' })} className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve deprovisioning</button>
                        <button disabled={isSubmitting} onClick={() => openModal({ type: 'resolve-deletion', request, decision: 'rejected' })} className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-slate-500 disabled:opacity-50">Reject</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {!isLoading && activeTab === 'audit' ? (
          <section className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-slate-700 text-xs uppercase text-slate-400"><th className="px-3 py-3">When</th><th className="px-3 py-3">Who</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Target</th><th className="px-3 py-3">Result</th><th className="px-3 py-3">Context</th><th className="px-3 py-3">Reason</th></tr></thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id} className="border-b border-slate-800 align-top">
                    <td className="whitespace-nowrap px-3 py-4 text-slate-400">{new Date(event.created_at).toLocaleString()}</td>
                    <td className="px-3 py-4">{event.actor_name}</td>
                    <td className="px-3 py-4">{event.action}</td>
                    <td className="px-3 py-4 text-slate-400">{event.target_type}{event.target_id ? ` · ${event.target_id.slice(0, 8)}` : ''}</td>
                    <td className="px-3 py-4 capitalize">{event.result}</td>
                    <td className="px-3 py-4 text-slate-400" title={event.user_agent ?? undefined}>
                      {event.ip_address ?? 'IP unavailable'}
                      {event.session_id ? <p className="mt-1 text-xs">Session {event.session_id.slice(0, 8)}</p> : null}
                      {event.request_id ? <p className="mt-1 text-xs">Request {event.request_id.slice(0, 12)}</p> : null}
                    </td>
                    <td className="max-w-xs px-3 py-4 text-slate-400">{event.reason || '—'}</td>
                  </tr>
                ))}
                {auditEvents.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">No audit events recorded.</td></tr> : null}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {actionModal.type === 'change-role' && 'Change Employee Role'}
                  {actionModal.type === 'update-name' && 'Update Employee Name'}
                  {actionModal.type === 'change-status' && (actionModal.nextStatus === 'disabled' ? 'Disable Employee' : 'Enable Employee')}
                  {actionModal.type === 'request-deletion' && 'Request Deprovisioning'}
                  {actionModal.type === 'resolve-deletion' && (actionModal.decision === 'approved' ? 'Approve Deprovisioning' : 'Reject Deprovisioning')}
                  {actionModal.type === 'approve-invite-request' && 'Approve Invitation Request'}
                  {actionModal.type === 'reject-invite-request' && 'Decline Invitation Request'}
                  {actionModal.type === 'resend-invite' && 'Resend Employee Invitation'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {actionModal.type === 'change-role' && (
                    <>Change role of <strong className="text-white">{actionModal.employee.display_name || actionModal.employee.email}</strong> from <span className="capitalize text-slate-300">{actionModal.employee.role_key}</span> to <span className="font-semibold capitalize text-cyan-400">{actionModal.nextRole}</span>.</>
                  )}
                  {actionModal.type === 'update-name' && `Updating details for ${actionModal.employee.email}.`}
                  {actionModal.type === 'change-status' && (
                    actionModal.nextStatus === 'disabled' ? (
                      <>Disabling this account will revoke their sessions and <strong className="text-white">block them from logging in</strong> to KJIN ({actionModal.employee.display_name || actionModal.employee.email}).</>
                    ) : (
                      <>Enabling this account will remove the login block and <strong className="text-white">allow them to log in</strong> again ({actionModal.employee.display_name || actionModal.employee.email}).</>
                    )
                  )}
                  {actionModal.type === 'request-deletion' && `Submit a formal deprovisioning request for ${actionModal.employee.display_name || actionModal.employee.email}.`}
                  {actionModal.type === 'resolve-deletion' && `${actionModal.decision === 'approved' ? 'Approve and disable account for' : 'Reject request for'} ${actionModal.request.target_name || 'this employee'}.`}
                  {actionModal.type === 'approve-invite-request' && `Send invitation to ${actionModal.request.display_name} (${actionModal.request.email}) as ${actionModal.request.requested_role}.`}
                  {actionModal.type === 'reject-invite-request' && `Decline invitation request for ${actionModal.request.display_name} (${actionModal.request.email}).`}
                  {actionModal.type === 'resend-invite' && (
                    <>Resend invitation email and fresh login credentials to <strong className="text-white">{actionModal.employee.display_name || actionModal.employee.email}</strong> (<span className="text-slate-300">{actionModal.employee.email}</span>)?</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalConfirm} className="mt-5 space-y-4">
              {actionModal.type === 'update-name' && (
                <label className="block text-sm text-slate-300">
                  Display name
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="e.g. John Doe"
                  />
                </label>
              )}

              <label className="block text-sm text-slate-300">
                Reason <span className="text-xs text-slate-500">(Required for audit trail)</span>
                <textarea
                  required
                  rows={3}
                  maxLength={1000}
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  placeholder="Explain why this action is being taken..."
                />
              </label>

              {modalError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                  <p>{modalError}</p>
                  {modalError.toLowerCase().includes('already pending') ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeModal();
                        setActiveTab('deletion');
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 underline hover:text-cyan-200"
                    >
                      View in Pending deletion tab →
                    </button>
                  ) : null}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    actionModal.type === 'request-deletion' ||
                    (actionModal.type === 'resolve-deletion' && actionModal.decision === 'approved') ||
                    (actionModal.type === 'change-status' && actionModal.nextStatus === 'disabled')
                      ? 'bg-red-500 text-white hover:bg-red-400'
                      : (actionModal.type === 'change-status' && actionModal.nextStatus === 'active')
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                  }`}
                >
                  {isSubmitting
                    ? 'Processing...'
                    : actionModal.type === 'change-status'
                    ? actionModal.nextStatus === 'disabled'
                      ? 'Confirm & Disable'
                      : 'Confirm & Enable'
                    : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
