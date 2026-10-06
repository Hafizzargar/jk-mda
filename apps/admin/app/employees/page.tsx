'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authRoles, type AuthRole } from '@kjin/auth';
import { supabase } from '@/lib/supabase';

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

export default function EmployeesPage() {
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
    const result = (await response.json()) as { error?: string; data?: unknown };
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

    const [roleResult, permissionResult, employeesResult] = await Promise.all([
      supabase.rpc('current_user_role'),
      supabase.rpc('current_user_permissions'),
      supabase.rpc('list_employees'),
    ]);

    if (roleResult.error || permissionResult.error || employeesResult.error) {
      setStatus(employeesResult.error?.message ?? permissionResult.error?.message ?? roleResult.error?.message ?? 'Unable to load employee data.');
      setIsLoading(false);
      return;
    }

    setRole((roleResult.data as AuthRole | null) ?? null);
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
  }, []);

  const submitInviteRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const { error } = await runEmployeeOperation('request-invite', {
      email: String(form.get('email') ?? ''),
      display_name: String(form.get('display_name') ?? ''),
      role_key: String(form.get('role_key') ?? ''),
      reason: String(form.get('reason') ?? ''),
    });
    setStatus(error ? `Request failed: ${error}` : 'Invitation request submitted for review.');
    if (!error) event.currentTarget.reset();
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
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
    const result = (await response.json()) as { error?: string };
    setStatus(response.ok ? 'Invitation sent. The employee will activate after accepting it.' : `Invitation failed: ${result.error ?? 'Unknown error.'}`);
    if (response.ok) event.currentTarget.reset();
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const inviteFromRequest = async (requestId: string) => {
    const reason = window.prompt('Reason for approving this invitation request:');
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/employees/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ request_id: requestId, reason: reason.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    setStatus(response.ok ? 'Invitation sent from the employee request.' : `Invitation failed: ${result.error ?? 'Unknown error.'}`);
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const rejectInviteRequest = async (requestId: string) => {
    const reason = window.prompt('Reason for declining this request:');
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { error } = await runEmployeeOperation('reject-invite-request', {
      request_id: requestId,
      reason: reason.trim(),
    });
    setStatus(error ? `Unable to reject request: ${error}` : 'Invitation request declined.');
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const changeRole = async (employee: Employee, nextRole: AuthRole) => {
    const reason = window.prompt(`Reason for changing ${employee.display_name || employee.email}'s role:`);
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { error } = await runEmployeeOperation('change-role', {
      target_id: employee.id,
      role_key: nextRole,
      reason: reason.trim(),
    });
    setStatus(error ? `Role change failed: ${error}` : 'Employee role updated.');
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const updateBasicDetails = async (employee: Employee) => {
    const displayName = window.prompt('Employee display name:', employee.display_name);
    if (displayName === null || !displayName.trim()) return;
    const reason = window.prompt('Reason for this name change:');
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { error } = await runEmployeeOperation('update-basic', {
      target_id: employee.id,
      display_name: displayName.trim(),
      reason: reason.trim(),
    });
    setStatus(error ? `Update failed: ${error}` : 'Employee details updated.');
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const updateContact = async (employee: Employee) => {
    const email = window.prompt('Employee email:', employee.email ?? '');
    if (email === null) return;
    const phone = window.prompt('Employee phone:', employee.phone ?? '');
    if (phone === null) return;
    const reason = window.prompt('Reason for this contact change:');
    if (!reason?.trim()) return;
    const { data } = await supabase.auth.getSession();
    setIsSubmitting(true);
    const response = await fetch(`/api/employees/${employee.id}/contact`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ email, phone, reason: reason.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    setStatus(response.ok ? 'Contact update submitted to Supabase Auth.' : `Contact update failed: ${result.error ?? 'Unknown error.'}`);
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const updateEmployeeStatus = async (employee: Employee, nextStatus: 'active' | 'disabled') => {
    const reason = window.prompt(`Reason for ${nextStatus === 'disabled' ? 'disabling' : 'enabling'} this employee:`);
    if (!reason?.trim()) return;
    const { data } = await supabase.auth.getSession();
    setIsSubmitting(true);
    const response = await fetch(`/api/employees/${employee.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ status: nextStatus, reason: reason.trim() }),
    });
    const result = (await response.json()) as { error?: string };
    setStatus(response.ok ? `Employee ${nextStatus}.` : `Status change failed: ${result.error ?? 'Unknown error.'}`);
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const requestDeletion = async (employee: Employee) => {
    const reason = window.prompt(`Reason for requesting deprovisioning of ${employee.display_name || employee.email}:`);
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { error } = await runEmployeeOperation('request-deletion', {
      target_id: employee.id,
      reason: reason.trim(),
    });
    setStatus(error ? `Deletion request failed: ${error}` : 'Deletion request submitted for review.');
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const resolveDeletion = async (request: DeletionRequest, decision: 'approved' | 'rejected') => {
    const reason = window.prompt(`Reason for ${decision === 'approved' ? 'approving' : 'rejecting'} this request:`);
    if (!reason?.trim()) return;
    setIsSubmitting(true);
    const { error } = await runEmployeeOperation('resolve-deletion', {
      request_id: request.id,
      decision,
      reason: reason.trim(),
    });
    if (!error && decision === 'approved') {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/employees/${request.target_profile_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
        },
        body: JSON.stringify({ status: 'disabled', reason: reason.trim() }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        setStatus(`Profile deprovisioned, but Auth sign-in revocation failed: ${result.error ?? 'Unknown error.'}`);
        setIsSubmitting(false);
        await loadWorkspace();
        return;
      }
    }
    setStatus(error ? `Deletion decision failed: ${error}` : `Deletion request ${decision}.`);
    setIsSubmitting(false);
    await loadWorkspace();
  };

  const visibleEmployees = employees.filter((employee) => {
    if (activeTab === 'active') return employee.status === 'active';
    if (activeTab === 'disabled') return employee.status === 'disabled';
    return true;
  });

  const tabCount = (tab: TabId) => {
    if (tab === 'all') return employees.length;
    if (tab === 'active') return employees.filter((employee) => employee.status === 'active').length;
    if (tab === 'disabled') return employees.filter((employee) => employee.status === 'disabled').length;
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
          <button type="button" onClick={() => void loadWorkspace()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-500">
            Refresh
          </button>
        </header>

        <div role="status" className="mb-6 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          {status}
        </div>

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
                          <button disabled={isSubmitting || !role || roleRank[request.requested_role] >= roleRank[role]} onClick={() => void inviteFromRequest(request.id)} className="rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Send invite</button>
                          <button disabled={isSubmitting} onClick={() => void rejectInviteRequest(request.id)} className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-red-400 disabled:opacity-50">Decline</button>
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
                      <td className="px-3 py-4 capitalize">{employee.status.replace('_', ' ')}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-400">{new Date(employee.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          {employee.can_manage && can('employee.basic.update') ? <button type="button" disabled={isSubmitting} onClick={() => void updateBasicDetails(employee)} className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:border-cyan-400">Edit name</button> : null}
                          {employee.can_manage && can('employee.contact.update') ? <button type="button" disabled={isSubmitting} onClick={() => void updateContact(employee)} className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:border-cyan-400">Change contact</button> : null}
                          {employee.can_manage && can('employee.role.change') ? (
                            <select aria-label={`Change role for ${employee.display_name}`} value={employee.role_key} disabled={isSubmitting} onChange={(event) => void changeRole(employee, event.target.value as AuthRole)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 capitalize">
                              {[...new Set([employee.role_key, ...assignableRoles])].map((item) => <option key={item} value={item}>{item}</option>)}
                            </select>
                          ) : null}
                          {employee.can_manage && can('employee.disable') && employee.status === 'active' ? <button type="button" disabled={isSubmitting} onClick={() => void updateEmployeeStatus(employee, 'disabled')} className="rounded-md border border-amber-500/50 px-2.5 py-1.5 text-amber-200 hover:bg-amber-500/10">Disable</button> : null}
                          {employee.can_manage && can('employee.enable') && employee.status === 'disabled' ? <button type="button" disabled={isSubmitting} onClick={() => void updateEmployeeStatus(employee, 'active')} className="rounded-md border border-emerald-500/50 px-2.5 py-1.5 text-emerald-200 hover:bg-emerald-500/10">Enable</button> : null}
                          {employee.can_manage && can('employee.deletion.request') && employee.status !== 'disabled' ? <button type="button" disabled={isSubmitting} onClick={() => void requestDeletion(employee)} className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-red-200 hover:bg-red-500/10">Request deletion</button> : null}
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
                        <button disabled={isSubmitting} onClick={() => void resolveDeletion(request, 'approved')} className="rounded-md bg-red-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve deprovisioning</button>
                        <button disabled={isSubmitting} onClick={() => void resolveDeletion(request, 'rejected')} className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-slate-500 disabled:opacity-50">Reject</button>
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
    </main>
  );
}
