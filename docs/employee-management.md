# Employee Management

## Access model

Authorization is enforced through `profiles.role_key`, explicit `role_permissions` grants, database RPC checks, and server-side Auth Admin routes. JWT user metadata is not an authorization source. The browser cannot directly insert, update, or delete profiles, employee records, permission catalogs, or audit rows.

Role order is Owner, Superadmin, Admin, Editor, Author. Managers may only invite, update, change the role of, enable, or disable employees below their own rank. Owner cannot be assigned through the employee workspace. The database also prevents modifying an Owner and permits only one Owner profile.

| Capability | Owner | Superadmin | Admin | Editor | Author |
|---|---:|---:|---:|---:|---:|
| Employee directory | Yes | Yes | Yes | Yes | Yes |
| Request invitation | Any lower/equal role except Owner | Any lower/equal role except Owner | Admin and below | Editor and below | Author |
| Send invitations | Lower roles | Lower roles | Editor/Author | No | No |
| Basic employee details | Lower roles | Lower roles | Lower roles | No | No |
| Change email/phone | Lower roles | Lower roles | No | No | No |
| Change role | Lower roles | Lower roles | No | No | No |
| Enable/disable | Lower roles | Lower roles | No | No | No |
| Request deprovisioning | Non-Owner | Non-Owner | Non-Owner | No | No |
| View deletion requests | Yes | Yes | Yes | No | No |
| Approve/reject deprovisioning | Non-Owner, not self | Non-Owner, not self | No | No | No |
| Employee audit history | Yes | Yes | Yes | No | No |
| Role/security audit history | Yes | Yes | No | No | No |

Role grants are seeded by migration. Changing the matrix requires a reviewed migration. The UI only hides unavailable operations; each database RPC and server endpoint performs its own permission and target-rank check.

## Invitation lifecycle

Public Auth signup is disabled in `supabase/config.toml`, and the Auth user trigger also rejects account creation unless the server supplies a matching invitation ID. A profile is created in `invited` state and receives its requested role only from that invitation. The account becomes `active` after email confirmation. Passwords and invitation tokens are never stored in KJIN tables.

To bootstrap the first Owner after local migrations are applied and `.env.local` contains the local Supabase URL and service-role key:

```powershell
$env:KJIN_OWNER_EMAIL = 'owner@your-domain.example'
$env:KJIN_OWNER_NAME = 'KJIN Owner'
pnpm --dir apps/admin bootstrap-owner
```

The command is one-time only. It fails if an Owner already exists. Retrieve the local invitation email from Mailpit at `http://127.0.0.1:54324`. Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

Regular invitations are sent from the Employees workspace. Employees without direct invite permission submit a request; an authorized manager sends the actual Auth invitation. Requests cannot ask for a role above the requester’s rank, and a manager cannot fulfill an invitation at or above their own rank.

## Deprovisioning and audit

Deletion approval is a soft deprovision: the profile becomes disabled and Auth sign-in is revoked. The profile and audit references remain for attribution and retention. Admin can view pending requests but only Owner/Superadmin can approve or reject; requesters cannot resolve their own request. Owner profiles cannot be targeted.

Sensitive actions produce append-only audit rows with actor, action, target, result, reason, time, and available session/request/user-agent context. IP is nullable because it is only reliable when supplied by a trusted reverse proxy. Direct table writes are unavailable to browser roles.

MFA, critical-action reauthentication, phone changes by invitation, hard deletion/anonymization retention policy, and employee MFA enforcement remain follow-up authentication/compliance work; this release does not claim those controls are complete.
