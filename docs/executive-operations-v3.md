# ONYX45 CRM — Executive Operations V3.0

## Implementation status (review branch)

This branch deliberately does not auto-deploy to GitHub Pages. The existing `main` production website and Supabase data have not been reset or replaced.

### Implemented
- Heritage Bordeaux 2.0 palette applied globally via `src/executive.css`.
- Original vintage executive / espionage-inspired operational design; no copied game assets.
- Editorial headings and modern functional text; unchanged core React, Vite and Supabase architecture.
- Executive Overview priority panel with values from authorized CRM queries, including calls/prospects, overdue follow-ups, upcoming meetings and open tasks.
- Working dashboard shortcuts into existing Sales Workspace, lead creation, meeting creation and task creation.
- Company Dossiers naming and consistent color treatment for existing card roster and full lead cockpit.
- Scripts and industry playbooks remain available but optional during call logging.
- Shared lead note updates use a previous-value condition to flag concurrent edits instead of overwriting unseen changes.
- A build-only GitHub Actions workflow checks TypeScript and production assets without deploying.

### Existing functionality preserved
- Supabase Auth and RLS.
- Lead roles, call outcomes, suppression, follow-up timestamps, meeting conflict checks.
- Project management, team settings, KPI history, invoices, pipeline, script library and industry playbooks.
- Existing database records; no schema migration or data deletion in this branch.

### Review gates before merge/deploy
- Log in with Owner and Sales Partner accounts; check menus and record isolation.
- Edit and save a note; reload; verify the persisted text.
- Open same lead in two sessions; verify a concurrent note conflict is rejected.
- Test Call Back with valid date/time and Confirm/Do Not Contact behavior.
- Try an existing occupied meeting timeslot and verify conflict handling.
- Verify all quick-action forms save after Supabase confirms a row.
- Check calendar month/week navigation and mobile touch operation.
- Check Swedish and English content; not all legacy labels are fully translated.
- Test keyboard focus, contrast, reduced motion and small screens.
- Review existing Supabase security-advisor warnings for exposed SECURITY DEFINER RPCs individually before changing access.

### Outstanding from the broader V3 specification
- Full company dossier: organization number, location, profit/loss and documented verification provenance need additional schema/design work and verified source integration.
- True client-side pagination beyond the existing query limit; additional filtering and large-data performance testing.
- Complete standalone Companies/Contacts/Reports modules would require scope and permissions design; do not add dead navigation.
- Formal automated signed-in integration tests and real browser accessibility/performance checks.
- A complete audit of all current GDPR retention/export flows.

### Deployment
To deploy after review, merge this branch to `main`; the existing GitHub Pages workflow runs on `main` pushes. Do not merge before signing off the manual testing checklist.
