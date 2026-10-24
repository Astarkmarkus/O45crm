# ONYX45 OS

Private operating system for ONYX45. React + TypeScript + Vite frontend with Supabase authentication and PostgreSQL Row Level Security.

## Quick start
1. Run `npm install`.
2. Create a Supabase project; execute `supabase/migrations/001_initial.sql` in its SQL editor.
3. Create `.env.local` from `.env.example` and set your Supabase project URL and publishable/anon key (never a service role key).
4. Create first owner account through Supabase dashboard, then execute `UPDATE public.profiles SET role = 'owner' WHERE id = '<your-auth-user-uuid>';` securely in SQL editor.
5. Run `npm run dev`.
6. Add repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, enable GitHub Pages source GitHub Actions.

**Security:** no public signup UI. Invite users with the trusted Supabase admin dashboard, not in-browser. GitHub Pages publishes frontend bundles publicly; business records live only in Supabase under RLS. Do not store customer data or secrets in the repository. The MVP does not include production-tested multi-role security until Supabase is configured and policies are tested. See SQL migration and source code.

**Deploy:** GitHub Actions builds `dist/` at repository base `/O45crm/`. Configure a custom domain separately before switching `VITE_BASE_PATH` to `/`. GitHub Pages site publishing is a repository setting and cannot be assumed to be enabled.
