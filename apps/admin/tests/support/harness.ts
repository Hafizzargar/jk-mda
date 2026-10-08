// In-memory harness replacing @supabase/supabase-js during API route tests.
// Records every call so tests can assert ordering (e.g. quota claimed only after rank checks).

type QueryFilter = { col: string; op: 'eq' | 'in' | 'lt' | 'gt'; val: unknown };
type QueryState = {
  table: string;
  action: 'select' | 'insert' | 'update';
  payload: Record<string, unknown> | null;
  filters: QueryFilter[];
  terminal: 'single' | 'maybe' | null;
  limit: number | null;
};
type SupabaseResult = { data: unknown; error: { message: string; code?: string } | null; count?: number | null };
type RecordedCall =
  | { kind: 'auth'; op: string; arg?: string }
  | { kind: 'from'; table: string; action: string; filters: QueryFilter[] }
  | { kind: 'rpc'; rpc: string; args: unknown };

export const ACTOR_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TARGET_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const INVITED_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const EXISTING_SUPERADMIN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const ROLE_RANKS: Record<string, number> = { owner: 500, superadmin: 400, admin: 300, editor: 200, author: 100 };

const ok = (data: unknown, count?: number | null): SupabaseResult => ({ data, error: null, count });
const fail = (message: string, code?: string): SupabaseResult => ({ data: null, error: { message, code } });

function matches(row: Record<string, unknown>, filter: QueryFilter): boolean {
  const value = row[filter.col];
  if (filter.op === 'eq') return value === filter.val;
  if (filter.op === 'in') return Array.isArray(filter.val) && filter.val.includes(value);
  if (filter.op === 'lt') return typeof value === 'string' && typeof filter.val === 'string' && value < filter.val;
  if (filter.op === 'gt') return typeof value === 'string' && typeof filter.val === 'string' && value > filter.val;
  return false;
}

export class Harness {
  calls: RecordedCall[] = [];
  audits: Record<string, unknown>[] = [];
  updates: { table: string; payload: Record<string, unknown>; filters: QueryFilter[] }[] = [];
  fixtures: Record<string, Record<string, unknown>[]> = {};
  actor = { id: ACTOR_ID, role_key: 'admin', status: 'active' };
  grants: string[] = [];
  getUserResult: SupabaseResult = ok({ user: { id: ACTOR_ID } });
  rpcErrors: Record<string, { message: string; code?: string }> = {};
  inviteInsert: SupabaseResult = ok({ id: 'invite-fixture-1' });
  inviteUserResult: SupabaseResult = ok({ user: { id: INVITED_USER_ID } });
  banResult: SupabaseResult = ok({});

  reset() {
    this.calls = [];
    this.audits = [];
    this.updates = [];
    this.fixtures = {
      roles: Object.entries(ROLE_RANKS).map(([role_key, hierarchy_rank]) => ({ role_key, hierarchy_rank })),
      profiles: [],
      role_permissions: [],
      employee_invites: [],
      employee_invite_requests: [],
      audit_logs: [],
    };
    this.actor = { id: ACTOR_ID, role_key: 'admin', status: 'active' };
    this.grants = [];
    this.getUserResult = ok({ user: { id: ACTOR_ID } });
    this.rpcErrors = {};
    this.inviteInsert = ok({ id: 'invite-fixture-1' });
    this.inviteUserResult = ok({ user: { id: INVITED_USER_ID } });
    this.banResult = ok({});
    this.syncActor();
  }

  syncActor() {
    const profiles = this.fixtures.profiles ?? [];
    const existing = profiles.findIndex((row) => row.id === this.actor.id);
    const actorRow = { id: this.actor.id, role_key: this.actor.role_key, status: this.actor.status, display_name: 'Test Actor' };
    if (existing >= 0) profiles[existing] = actorRow;
    else profiles.push(actorRow);
    this.fixtures.role_permissions = this.grants.map((permission_key) => ({ role_key: this.actor.role_key, permission_key }));
  }

  addProfile(row: Record<string, unknown>) {
    (this.fixtures.profiles ?? []).push(row);
  }

  createClient(_key: string, _options?: unknown) {
    const recordAuth = (op: string, arg?: string) => this.calls.push({ kind: 'auth', op, arg });
    const runRpc = (name: string, args: unknown): SupabaseResult => {
      this.calls.push({ kind: 'rpc', rpc: name, args });
      const scripted = this.rpcErrors[name];
      if (scripted) return fail(scripted.message, scripted.code);
      if (name === 'has_permission') {
        const key = (args as { p_permission_key: string }).p_permission_key;
        return ok(this.grants.includes(key));
      }
      return ok(null);
    };
    const from = (table: string) => {
      const state: QueryState = { table, action: 'select', payload: null, filters: [], terminal: null, limit: null };
      const finish = (): SupabaseResult => {
        this.calls.push({ kind: 'from', table, action: state.action, filters: [...state.filters] });
        if (state.action === 'insert') {
          if (table === 'audit_logs' && state.payload) {
            this.audits.push(state.payload);
            return ok(null);
          }
          if (table === 'employee_invites') return this.inviteInsert;
          return ok(state.payload);
        }
        if (state.action === 'update') {
          this.updates.push({ table, payload: state.payload ?? {}, filters: [...state.filters] });
          return ok(null);
        }
        let rows = (this.fixtures[table] ?? []).filter((row) => state.filters.every((filter) => matches(row, filter)));
        const totalCount = rows.length;
        if (state.limit != null) rows = rows.slice(0, state.limit);
        if (state.terminal === 'single') return rows[0] ? ok(rows[0], totalCount) : fail('JSON object requested, multiple (or no) rows returned', 'PGRST116');
        if (state.terminal === 'maybe') return ok(rows[0] ?? null, totalCount);
        return ok(rows, totalCount);
      };
      const builder: Record<string, unknown> = {
        select(columns?: string, options?: { count?: string; head?: boolean }) {
          if (options?.head) {
            state.terminal = 'maybe';
          }
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          state.action = 'insert';
          state.payload = payload;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          state.action = 'update';
          state.payload = payload;
          return builder;
        },
        eq(col: string, val: unknown) {
          state.filters.push({ col, op: 'eq', val });
          return builder;
        },
        in(col: string, val: unknown) {
          state.filters.push({ col, op: 'in', val });
          return builder;
        },
        lt(col: string, val: unknown) {
          state.filters.push({ col, op: 'lt', val });
          return builder;
        },
        gt(col: string, val: unknown) {
          state.filters.push({ col, op: 'gt', val });
          return builder;
        },
        limit(count: number) {
          state.limit = count;
          return builder;
        },
        single() {
          state.terminal = 'single';
          return builder;
        },
        maybeSingle() {
          state.terminal = 'maybe';
          return builder;
        },
        then(onFulfilled: unknown, onRejected: unknown) {
          return Promise.resolve(finish()).then(onFulfilled as never, onRejected as never);
        },
      };
      return builder;
    };
    return {
      auth: {
        getUser: async (token: string) => {
          recordAuth('getUser', token);
          return this.getUserResult;
        },
        admin: {
          inviteUserByEmail: async (email: string) => {
            recordAuth('inviteUserByEmail', email);
            return this.inviteUserResult;
          },
          updateUserById: async (id: string) => {
            recordAuth('updateUserById', id);
            return this.banResult;
          },
          deleteUser: async (id: string) => {
            recordAuth('deleteUser', id);
            return ok({});
          },
        },
        mfa: {
          verify: async (params: { factorId: string; challengeId: string; code: string }) => {
            recordAuth('mfa.verify', params.code);
            if (params.code === '000000') return ok({ session: { access_token: 'new-token' } });
            return fail('Invalid code');
          },
          listFactors: async () => {
            return ok({ all: [], totp: [{ id: 'fact-123', status: 'verified' }] });
          }
        },
      },
      from,
      rpc: async (name: string, args: unknown) => runRpc(name, args),
    };
  }
}

let activeHarness: Harness | null = null;

export function setHarness(harness: Harness) {
  activeHarness = harness;
}

export function getHarness(): Harness {
  if (!activeHarness) throw new Error('No harness configured. Call setHarness() before importing routes.');
  return activeHarness;
}

