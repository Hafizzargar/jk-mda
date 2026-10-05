# System architecture

KJIN is designed as a monorepo with two delivery apps:

- Public website for readers
- Admin portal for journalists and editors

The platform will use Next.js for the apps, Supabase for Postgres, Auth, Storage, and Edge Functions, and shared packages for validation, types, UI, and database contracts.
