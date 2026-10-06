# KJIN Full API Security Audit

**Date:** 2026-10-06
**Scope:** Every HTTP API route, server-side action, Supabase RPC, RLS policy, and grant in the monorepo (admin app, web app, shared packages, Supabase migrations).
**Method:** Static code review of the working tree (including uncommitted changes). The pgTAP suite (44 assertions) already covers the database layer and was not rerun.
**Verdict scale:** PASS / FAIL / NEEDS HARDENING.

---

## 1. Surface inventory

### HTTP API routes (admin app — 4 total, no others exist)

| # | Endpoint | File |
|---|---|---|
| 1 | `POST /api/employees/invite` | `apps/admin/app/api/employees/invite/route.ts` |
| 2 | `POST /api/employees/operations` | `apps/admin/app/api/employees/operations/route.ts` |
| 3 | `PATCH /api/employees/[id]/status` | `apps/admin/app/api/employees/[id]/status/route.ts` |
| 4 | `PATCH /api/employees/[id]/contact` | `apps/admin/app/api/employees/[id]/contact/route.ts` |

No other `route.ts` files, no `"use server"` server actions, no `middleware.ts`, no Edge functions.

### Server-side code

- `apps/admin/lib/employee-server.ts` — shared authorization core (`authorizeEmployeeRequest`), only service-role usage in request handling (`import 'server-only'`).
- `apps/admin/scripts/bootstrap-owner.mts` — one-time CLI owner bootstrap (service role, env-gated).

### Client-side write surfaces (admin pages)

All writes go through definer RPCs (`create_article`, `transition_article_status`, `submit_article_for_review`, `current_user_*`, `list_*`, employee operations) or the 4 API routes.
**Verified: zero direct `.insert()/.update()/.delete()` calls from any client code.**

### Database RPCs granted to clients (20)

`current_user_role`, `has_permission` (+anon), `current_user_permissions`, `user_has_editor_access` (+anon), `user_has_author_access`, `list_employees`, `request_employee_invite`, `list_employee_invite_requests`, `reject_employee_invite_request`, `update_employee_basic`, `change_employee_role`, `request_employee_deletion`, `list_employee_deletion_requests`, `resolve_employee_deletion`, `set_employee_status`, `list_audit_history`, `submit_article_for_review`, `transition_article_status`, `create_article`, `claim_employee_invitation_attempt`.

---

## 2. Route-by-route classification

| Endpoint | Verdict | Summary |
|---|---|---|
| `POST /api/employees/invite` | **PASS** | Token validated, `employee.invite` permission, rank ceiling (target rank < actor rank, owner blocked), reason + field-length validation, atomic daily quota (20), audit on deny/fail/success. Minor notes: F-03, F-04. |
| `POST /api/employees/operations` | **NEEDS HARDENING** | Authz chain and RPC double-checks are correct, but raw RPC error messages are returned to the client (F-04), body fields pass to RPCs with inconsistent length validation (F-05), and no quota exists for these operations (F-03). |
| `PATCH /api/employees/[id]/status` | **NEEDS HARDENING** | Correct permission selection (`employee.disable`/`employee.enable`), rank + self + owner checks in route **and** RPC, Auth ban applied, partial failure (ban error) logged and surfaced as 502. Issues: body parsed before auth (F-08), raw error messages leaked (F-04), malformed non-UUID `:id` silently loses the audit row (F-09). |
| `PATCH /api/employees/[id]/contact` | **PASS (intentionally deferred)** | Always returns 501, performs no data change, audits the deferral. Restricted to `employee.contact.update` (owner/superadmin only). **Caveat: see F-01 — the block exists only in this route.** |
| Admin pages (`/`, `/login`, `/employees`, `/articles/*`) | **PASS** with F-02 | All reads/writes re-authorized server-side (RLS/RPC/API); page-level gating is client-side only. |
| Public web app | **PASS** | Anon client; published articles only via RLS; client-side `status='published'` filter is defense in depth, not the control. |
| `scripts/bootstrap-owner.mts` | **PASS** | One-time, fails if owner exists, service key from env, never shipped to browser. |

**No endpoint scored FAIL.**

---

## 3. Checklist verification (13 audit criteria)

| Criterion | Result | Evidence |
|---|---|---|
| Missing authentication | ✅ none | All 4 routes call `authorizeEmployeeRequest`; token verified via `auth.getUser(token)` (`employee-server.ts:46`). |
| Missing permission checks | ✅ none | Route checks `role_permissions` (`employee-server.ts:87`); every DB RPC re-checks `has_permission` — double enforcement. |
| IDOR / resource scope | ✅ none | Rank/ownership enforced in routes (`status/route.ts:26`, `invite/route.ts:97`) **and** in RPCs (`set_employee_status`, `change_employee_role`, `update_employee_basic`, `resolve_employee_deletion`). Self and owner always protected. |
| Unsafe service-role usage | ✅ none | Service key only in `employee-server.ts` (server-only, post-authz) and the bootstrap CLI; never referenced with a `NEXT_PUBLIC_` name; grep clean. |
| Direct DB writes bypassing authorization | ✅ none | Client code performs no table writes; profiles/roles/permissions/invite/audit tables are `revoke`d from `anon, authenticated`. |
| Insecure RPCs | ✅ none | All `security definer` + `set search_path = ''`; execute revoked from `public`, granted to `authenticated` only (`migration …140000:1119-1146`). `write_audit_event` is revoked and **never granted to clients** — audit events cannot be forged. |
| RLS gaps | ✅ none found | profiles (with column-level grants excluding `email`/`phone`/`display_name`), roles/permissions/role_permissions, employee tables, audit_logs, articles all covered; later migrations replace earlier permissive drafts. |
| Privilege escalation | ✅ none | Rank ceilings at both layers; owner assignment blocked everywhere; single-owner partial unique index; invite quota claimed atomically with advisory lock (migration …160000). |
| Unsafe status transitions | ✅ none | Transition-matrix trigger + `kjin.allow_*` config gates; `article.publish` limited to owner/superadmin (migration …150000) and enforced inside `transition_article_status` **and** the update trigger; direct UPDATE blocked even for Owner (pgTAP asserted). |
| Sensitive data exposure | ⚠️ partial | Contacts masked in `list_employees` unless `employee.contacts.view`; but raw internal error strings are returned by 3 routes — **F-04**. |
| Input validation | ⚠️ partial | Invite route validates format + lengths; RPC validation inconsistent — **F-05**. |
| Rate limits | ⚠️ partial | Invitation quotas only (20/day sends, 10/day requests); no quotas on status/role/deletion operations — **F-03**. |
| 401/403 semantics | ✅ correct | Missing token → 401, invalid token → 401, inactive/absent profile → 403, missing permission → 403, unconfigured server → 503. Minor ordering issue **F-08**. |

---

## 4. Findings (prioritized)

### F-01 — HIGH — Contact-change block is app-layer only
The 501 deferral (`contact/route.ts`) is bypassable: any authenticated session can call Supabase Auth's own `PUT /auth/v1/user` (SDK `auth.updateUser`) to change email/phone directly, and the `sync_profile_contact_from_auth` trigger (migration …140000:692-710) then propagates it into `profiles`. `config.toml` sets only `enable_signup = false` — no `secure_email_change` / phone-change policy is declared.
**Close during the MFA/reauth phase:** explicitly configure secure email change (both-address OTP), disable or gate phone changes, and add an auth-side hook or verification step that preserves the "blocked until verification + recent reauthentication" rule.

### F-02 — MEDIUM — No server-side session gating
There is no `middleware.ts`; every admin page is `'use client'` with client-side session checks. Data stays protected by RLS/RPC/API, so this is defense-in-depth, not a breach path — but unauthenticated users can load admin page shells and probe routes.
**Recommendation:** add `middleware.ts` validating the Supabase session and redirecting to `/login`, keeping RLS as the authoritative layer.

### F-03 — MEDIUM — Rate limiting incomplete; audit-flood vector
Only invitations are quota-limited (atomic, DB-side). Status changes, role changes, deletions, and update-basic have no quota. Additionally, every denied call inserts an `audit_logs` row (`employee-server.ts:75,95`, `operations/route.ts:74`), so any active session can flood the append-only audit table (storage exhaustion / signal drowning) with no throttle.
**Recommendation:** per-actor DB quotas (same pattern as `claim_employee_invitation_attempt`) for status/role/deletion operations, plus HTTP-layer throttling (middleware or gateway) for the API routes.

### F-04 — MEDIUM — Raw internal error messages returned to clients
`invite/route.ts:176` returns the auth failure verbatim, `operations/route.ts:84` returns Postgres exception text, `status/route.ts:46,64` return RPC and ban error text. These can expose schema, function names, and internal state.
**Recommendation:** map to stable client messages; log the detail to `audit_logs` only.

### F-05 — MEDIUM — Inconsistent server-side length validation
`request_employee_invite` enforces caps (email ≤254, name 1–120, reason ≤1000), but `update_employee_basic` (display_name, reason), `change_employee_role` (reason), `reject_employee_invite_request` (reason), `resolve_employee_deletion` (reason), and `set_employee_status` (reason) have no length caps.
**Recommendation:** one migration adding uniform `length()` checks to every mutating RPC.

### F-06 — MEDIUM — "Exactly one Second Superadmin" is not enforced
Product hierarchy requires exactly one owner (**enforced**: partial unique index `idx_profiles_single_owner`) and exactly one second superadmin (**not enforced** — any number of `superadmin` rows are possible). Only invite-rank checks stand in the way.
**Recommendation:** partial unique index on `role_key = 'superadmin'` if the invariant is real; otherwise update WORK-DONE.md to drop it.

### F-07 — LOW — Audit IP addresses are never recorded
`audit_logs.ip_address` exists and the UI renders it ("IP unavailable"), but neither the routes (no `x-forwarded-for` capture) nor `write_audit_event` populate it.
**Recommendation:** capture `x-forwarded-for` in `authorizeEmployeeRequest` and pass it through; extend `write_audit_event` with a `p_ip` parameter (set from `request.headers` GUC like `user-agent`).

### F-08 — LOW — Authorization ordering in handlers
`status/route.ts` parses and validates the body before authenticating (unauthenticated + malformed body → 400 instead of 401); `operations/route.ts` validates `operation` before authenticating. This lets unauthenticated callers fingerprint endpoints. Keep the logic, just call `authorizeEmployeeRequest` first (the status route can parse the body first only to pick which permission to request, but should return 401 before any 400 validation).

### F-09 — LOW — Malformed `:id` silently drops audit rows
`target_id` is `uuid`; a non-UUID path param makes the `audit_logs.insert` fail while the error is ignored (`status/route.ts:36,54`, `contact/route.ts:18`), so denied requests with garbage IDs leave no trace (the contact route then still returns 501).
**Recommendation:** validate `id` as UUID first and return 400 before any audit write.

### F-10 — LOW — No security headers
Both `next.config.mjs` files set only `reactStrictMode`. No CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS.
**Recommendation:** add a headers block (or middleware) — especially for the admin app.

### F-11 — LOW — Migration hygiene hurts auditability
`20261006140000_employee_permissions_and_audit.sql` (1,146 lines) re-defines the same functions multiple times (`request_employee_invite` at 368 and again in …160000; `prevent_audit_log_mutation` at 679 and 1060; `current_user_role`/`has_permission` at 209/223, 783/794, 1088/1092; duplicated `raise` guards at 507-508, 588-589). Last definition wins, so the file reads safely today, but reviewers can easily audit a superseded version.
**Recommendation:** one canonical definition per function per migration; superseding goes in a new migration file.

### F-12 — INFO — No automated tests for the HTTP layer
The 44 pgTAP assertions cover DB/RLS/RPC only. The 4 API routes (auth → permission → rank → response) have no route-level tests.
**Recommendation:** add integration tests (Vitest + route handlers or a running Next server) asserting 401 without token, 403 without permission, rank-ceiling denials, and 429 on quota.

### F-13 — INFO — Production auth settings must mirror (and exceed) local
`config.toml` (`enable_signup = false`) governs local only. Hosted Supabase must be verified for: signup disabled, confirmations on, secure email/phone change (ties into F-01), MFA policy (next phase), and a correct redirect allow-list.

---

## 5. Confirmed-good controls (do not regress)

- Bearer-token auth with server-side `getUser()` validation; no cookie-based CSRF surface.
- Service role isolated behind `import 'server-only'` and permission checks; env secrets gitignored (`.env.local` untracked, `.env.example` names only).
- Defense in depth: every sensitive action is checked at route **and** database layer.
- Rank matrix (`owner 500 … author 100`) enforced symmetrically in routes and RPCs; owner untargetable and unassignable.
- `article.publish` owner/superadmin only, enforced in RPC **and** trigger.
- Invite quotas atomic (advisory xact lock), pending-request uniqueness, single-owner index.
- Audit trail append-only (trigger), denial-audited at both layers, `write_audit_event` not client-callable.
- Uninvited signups blocked at the `auth.users` insert trigger; `enable_signup = false`.

## 6. Assumptions and limitations

- Static review only; no live exploitation or traffic shaping was performed.
- Hosted (production) Supabase settings are outside this repo and were not inspected.
- Working tree includes uncommitted changes (invite route, migration …140000, test file modified; migration …160000 untracked) — findings reflect their current content.
- No dependency vulnerability scan was run (`pnpm audit` suggested as a cheap follow-up).

## 7. Next steps (ordered)

1. MFA/TOTP + critical-action reauthentication — fold in **F-01** (auth-side contact-change enforcement) and **F-03** (quotas for critical operations).
2. **F-02** middleware session gating + **F-10** security headers (small, independent).
3. **F-04/F-05/F-08/F-09** hardening pass on routes + one validation migration.
4. **F-06** decision (enforce or drop the single-superadmin invariant).
5. Route-level test suite (**F-12**).




