# Running KJIN Locally

This document explains how to run, access, and manage the **KJIN Admin Portal** and **Public Website** on your local machine.

---

## 1. Quick Launch (One-Click)

Convenience Windows batch scripts are available in the repository root:

| Script | Purpose |
| :--- | :--- |
| **[`start-all.bat`](file:///c:/Users/hafez/Desktop/websites/kjin/start-all.bat)** | **Recommended.** Checks and starts Supabase, then launches both Admin and Web in separate terminal windows. |
| **[`start-admin.bat`](file:///c:/Users/hafez/Desktop/websites/kjin/start-admin.bat)** | Launches only the Admin Portal on port 3001. |
| **[`start-web.bat`](file:///c:/Users/hafez/Desktop/websites/kjin/start-web.bat)** | Launches only the Public Website on port 3000. |

To use them: simply **double-click** the file in Windows File Explorer or run it from your terminal.

---

## 2. Terminal Commands

From the project root:

```bash
# Run BOTH Admin (port 3001) and Web (port 3000) concurrently in one terminal:
pnpm dev

# Or run them individually:
pnpm dev:admin    # http://localhost:3001
pnpm dev:web      # http://localhost:3000
```

---

## 3. Local Application URLs

| Service | Local URL | Description |
| :--- | :--- | :--- |
| **Admin Portal** | [http://localhost:3001/](http://localhost:3001/) | Newsroom editorial & staff management dashboard |
| **Public Website** | [http://localhost:3000/](http://localhost:3000/) | Public-facing reader portal & article reader |
| **Supabase Studio** | [http://localhost:54323/](http://localhost:54323/) | Local database dashboard & table viewer |
| **Local Mailpit/Inbucket** | [http://localhost:54324/](http://localhost:54324/) | Local email testing inbox |

---

## 4. Default Owner Credentials

- **Email**: `hafezzargar987@gmail.com`
- **Password**: `Hafiz7865#`
- **Role**: `owner`
- **Two-Factor Authentication**: TOTP MFA via Google Authenticator.
- **Security Window**: High-privilege actions (like inviting staff or modifying roles) require recent MFA verification within the last 15 minutes. If prompted, enter your current 6-digit TOTP code.

---

## 5. Quality Checks & Verification

Run these commands anytime to ensure code health:

```bash
# Run all automated tests:
pnpm test

# Test Admin application only:
npm test --workspace=@kjin/admin

# TypeScript typecheck for Admin:
npm run typecheck --workspace=@kjin/admin

# Full repository typecheck:
pnpm typecheck
```

---

## 6. Managing the Local Supabase Database

```bash
# Start local database containers:
supabase start

# Check status of local database services:
supabase status

# Stop local database containers:
supabase stop
```
