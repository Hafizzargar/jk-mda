# KJIN Complete API Directory & Token Protection Audit (`api_Total.md`)

This report catalogs all 40 API and route endpoints across the **Admin Portal** (`apps/admin`) and the **Public Web Reader** (`apps/web`), classifying each by authentication requirement (Token Required vs Public No-Token).

---

## 1. Executive Summary

| Category | Count | Description |
| :--- | :---: | :--- |
| **Protected (Token Required)** | **33** | Requires Supabase JWT bearer token / HttpOnly session cookie, role verification, and/or MFA. |
| **Public (No Token Required)** | **7** | Public reader actions, web vitals, sitemaps, and job applicant submissions (protected by IP rate limiting). |
| **Total Endpoints** | **40** | Complete surface area across both applications. |

---

## 2. Master API Matrix

| S.No | App | Method | Endpoint | Token Required? | Auth / Permission Level | Purpose & Details |
| :---: | :--- | :---: | :--- | :---: | :--- | :--- |
| **1** | Admin | `GET` | `/api/analytics/views` | **Yes (Token)** | Author / Editor / Admin | Real-time traffic, page view counts, and regional corridor telemetry. |
| **2** | Admin | `GET`, `POST` | `/api/articles` | **Yes (Token)** | `article.create` / Author+ | List editorial stories (`GET`) or create a new draft (`POST`). |
| **3** | Admin | `GET`, `PATCH`, `DELETE` | `/api/articles/[id]` | **Yes (Token)** | `article.edit` / Assigned Author | Fetch story details, update contents/metadata, or delete draft. |
| **4** | Admin | `POST` | `/api/articles/[id]/archive` | **Yes (Token)** | `article.archive` / Editor+ | Archives a published or draft story from active distribution. |
| **5** | Admin | `POST` | `/api/articles/[id]/publish` | **Yes (Token)** | `article.publish` + **AAL2 MFA** | Publishes reviewed article live to the public reader website. |
| **6** | Admin | `POST` | `/api/articles/[id]/reactivate` | **Yes (Token)** | `article.review` / Editor+ | Restores an archived story back to active draft status. |
| **7** | Admin | `POST` | `/api/articles/[id]/return` | **Yes (Token)** | `article.review` / Editor+ | Rejects submitted story and returns it to author draft with feedback. |
| **8** | Admin | `POST` | `/api/articles/[id]/submit` | **Yes (Token)** | Author / Assigned User | Submits author draft into editorial review queue. |
| **9** | Admin | `POST` | `/api/auth/logout` | **No Token** | Public / Session Cleanup | Invalidates session and sets `Max-Age=0` on server HttpOnly cookies. |
| **10** | Admin | `POST` | `/api/auth/logout-all` | **Yes (Token)** | Authenticated User | Globally revokes all active refresh tokens across all user devices. |
| **11** | Admin | `POST` | `/api/auth/notify-login` | **No Token** | Fire-and-forget notification | Dispatches login security alerts and stores audit log. |
| **12** | Admin | `GET` | `/api/auth/notify-login` | **Yes (Token)** | Admin / Superadmin | Reads delivery status and recent audit log for security alerts. |
| **13** | Admin | `GET`, `POST` | `/api/careers` | **Yes (Token)** | `careers.manage` / Admin+ | Reads (`GET`) or updates (`POST`) newsroom hiring settings & job postings. |
| **14** | Admin | `POST` | `/api/employees/invite` | **Yes (Token)** | `employee.invite` + **Recent Auth** | Provisions employee account with auto/custom password & emails credentials. |
| **15** | Admin | `POST` | `/api/employees/mfa/verify` | **Yes (Token)** | Authenticated User | Validates TOTP authenticator challenge code for step-up auth (AAL2). |
| **16** | Admin | `POST` | `/api/employees/operations` | **Yes (Token)** | Role-checked RPC | Executes staff actions (change role, update display name, request invite). |
| **17** | Admin | `POST` | `/api/employees/resend-invite` | **Yes (Token)** | `employee.invite` / Superadmin | Generates fresh credentials and resends onboarding email to employee. |
| **18** | Admin | `DELETE` | `/api/employees/[id]` | **Yes (Token)** | `employee.delete` + **Recent Auth** | Permanently erases employee profile and Supabase auth credentials. |
| **19** | Admin | `PATCH` | `/api/employees/[id]/contact` | **Yes (Token)** | Superadmin / Owner | Updates verified employee email address or phone contact. |
| **20** | Admin | `PATCH` | `/api/employees/[id]/status` | **Yes (Token)** | `employee.status` / Admin+ | Blocks (disables) or unblocks (enables) employee login privileges. |
| **21** | Admin | `POST` | `/api/newsroom/draft` | **Yes (Token)** | Editorial Staff | Generates AI draft with Gemini based on verified government orders. |
| **22** | Admin | `GET`, `POST` | `/api/newsroom/events` | **Yes (Token)** | Editorial Staff | Retrieves newsroom radar events (`GET`) or logs new official alert (`POST`). |
| **23** | Admin | `POST` | `/api/newsroom/recheck` | **Yes (Token)** | Editorial Staff | Re-verifies live status of unconfirmed event against official sources. |
| **24** | Admin | `POST` | `/api/newsroom/refresh` | **Yes (Token)** | Editorial Staff | Runs automated crawler against government portals to detect new orders. |
| **25** | Admin | `GET`, `POST` | `/api/newsroom/sources` | **Yes (Token)** | Admin / Superadmin | Reads (`GET`) or registers (`POST`) verified government official sources. |
| **26** | Admin | `GET`, `PATCH` | `/api/profile` | **Yes (Token)** | Authenticated User | Reads own profile and article stats (`GET`) or updates display name (`PATCH`). |
| **27** | Admin | `GET`, `POST` | `/api/settings/ads` | **Yes (Token)** | Superadmin / Owner | Reads or updates monetization banners, ad placements, and sponsors. |
| **28** | Admin | `GET`, `POST` | `/api/settings/curation` | **Yes (Token)** | Editor / Admin | Configures homepage top stories, breaking banners, and corridor feeds. |
| **29** | Admin | `GET`, `POST` | `/api/settings/footer` | **Yes (Token)** | Superadmin / Owner (POST) | Reads (`GET`) or updates (`POST`) newsroom contact info & bureau addresses. |
| **30** | Admin | `GET`, `POST` | `/api/settings/navbar` | **Yes (Token)** | Superadmin / Owner | Configures public portal menu links, categories, and navigation hierarchy. |
| **31** | Admin | `GET`, `POST` | `/api/settings/telemetry` | **Yes (Token)** | Editor / Admin | Manages mountain highway pass status (Zojila, Mughal) & fruit market rates. |
| **32** | Admin | `POST` | `/api/settings/telemetry/ai-generate` | **Yes (Token)** | Admin / Superadmin | Uses Gemini to synthesize real-time road conditions and market commodity rates. |
| **33** | Admin | `GET`, `POST` | `/api/settings/template` | **Yes (Token)** | Superadmin / Owner (POST) | Reads active theme (`GET`) or switches live portal layout template (`POST`). |
| **34** | Admin | `POST` | `/api/upload` | **Yes (Token)** | Author / Editor / Admin | Validates MIME type/size and uploads editorial images to Supabase Storage. |
| **35** | Web | `POST` | `/api/ai/draft` | **Yes (Token)** | Internal Shared Secret / Staff | Internal bridge for AI drafting engine. |
| **36** | Web | `POST` | `/api/ai/summarize` | **No Token** | Public (Rate Limited by IP) | Generates instant 3-bullet AI summary for readers on article pages. |
| **37** | Web | `POST` | `/api/articles/[id]/view` | **No Token** | Public (Deduplicated Hash) | Records verified unique reader views with SHA-256 IP/User-Agent hashing. |
| **38** | Web | `POST` | `/api/careers/apply` | **No Token** | Public (Rate Limited by IP) | Allows public job seekers to submit employment applications and resumes. |
| **39** | Web | `POST` | `/api/newsletter/subscribe` | **No Token** | Public (Rate Limited by IP) | Enrolls readers in email newsletter editions with rate limiting. |
| **40** | Web | `GET` | `/api/sentry-example-api` | **No Token** | Diagnostic / Monitoring | Health probe to verify error tracking integration. |

---

## 3. GitHub Push & Repository Protection Guide

Before pushing this repository to GitHub, verify that all sensitive credentials and secrets are protected:

### 1. Files That MUST NOT Be Pushed to GitHub (Already in `.gitignore`)
* `.env`, `.env.local`, `.env.production`, `.env.*`
* `node_modules`
* `.next` build caches
* `coverage` & `*.log`
* `supabase/.temp` & `supabase/.branches`

### 2. Secrets That Must Remain Private
| Secret Variable | Safe Location | Never In Git |
| :--- | :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only environment variable | **STRICTLY FORBIDDEN** in public repo. Grants full bypass of Row Level Security. |
| `DATABASE_URL` / `POSTGRES_PASSWORD` | Cloud hosting platform (e.g. Vercel) | Database admin credentials. |
| `SMTP_PASS` / `SMTP_USER` | Server environment | Email dispatch credentials. |
| `GEMINI_API_KEY` | Server environment | Google AI quota credentials. |
| `REAUTH_JWT_SECRET` | Server environment | Admin re-authentication token signer. |

### 3. Safe Public Environment Variables
The following are safe to bundle in client builds (`NEXT_PUBLIC_*`):
* `NEXT_PUBLIC_SUPABASE_URL` (Public project endpoint)
* `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Public anonymous key, guarded by Postgres RLS policies)
* `NEXT_PUBLIC_SITE_URL` (Canonical domain, e.g. `https://kjin.in`)
* `NEXT_PUBLIC_ADMIN_URL` (Canonical admin portal domain, e.g. `https://admin.kjin.in`)

### 4. Recommended GitHub Repository Settings
1. **Branch Protection Rule on `main` / `master`:**
   * Require pull request reviews before merging.
   * Require status checks to pass (`pnpm -r typecheck`, `pnpm -r test`).
   * Do not allow force pushes (`git push --force`).
2. **GitHub Secret Scanning:**
   * Enable GitHub Secret Scanning and Push Protection to automatically block accidental commits containing API keys.
3. **Pre-push Verification Command:**
   ```bash
   git status
   git diff --staged
   ```
   Ensure no `.env` or credential files appear in the staged files list before running `git commit` and `git push`.
