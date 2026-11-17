# ONYX45 CRM — Executive Operations V3.0

## Delivery status — build-verified review branch

- Branch: `design/executive-operations-v3`
- Review: https://github.com/Astarkmarkus/O45crm/pull/1
- Production: `main` unchanged. **Do not merge until authenticated workflow tests pass.**
- Verified automatically: `npm run build` (TypeScript + Vite) through the `Verify Executive Operations V3` GitHub workflow.
- Verified in Supabase: migrated fields exist; migration applied; core business tables have RLS enabled; current `sales_finish_call` (11-argument overload) accepts no script while validating any supplied script.
- No production data was reset or seeded with mock records.

## Completed changes

1. Heritage Bordeaux 2.0 branding and executive operations design system. Removed lime tokens from legacy CSS.
2. Executive Overview with genuine priority counts and working quick actions; actions are constrained by role.
3. Company Dossiers in sales calling: registration number, city, business focus, B2B/B2C, website, annual turnover, prior turnover, profit/loss, reporting year and financial source.
4. Provenance editing: explicit source category and deliberate confirmation of verification; no automatic verified status on merely entering data.
5. Safer shared lead notes: confirms Supabase updates and rejects writes when the stored previous note has been changed by another editor.
6. New authorized Companies and Contacts directory views with filtering and 24-record visual pagination.
7. Owner-only Reports: live KPIs, seven-day call activity, invoice and paid totals, and payment-date-based six-month graph.
8. Swedish and English form labels and common status translations with unchanged database enum values.
9. Removed 500-record truncation in the main CRM fetching by fetching in deterministic pages (maximum 10,000 records per table).
10. Optional approved sales scripts: script display remains contextual; Supabase's current 11-argument call RPC no longer forces a script for Sales Partners, but checks published script validity if one is supplied.
11. Existing calendar, tasks, projects, meeting approvals, Supabase Auth and RLS have not been removed.

## Database migrations

- `011_executive_dossier_fields.sql`: additive company metadata + Owner-only profit/finance field edits.
- `012_optional_sales_script_v3.sql`: current `sales_finish_call` RPC adjusted for optional script, with published-script validation preserved.
- Existing `leads`, `companies`, `contacts` and `activity_log` rows are preserved.

## Verification still required before production

Authenticated end-to-end tests are **not** covered by a successful TypeScript/Vite build. Test with an Owner and an actual Sales Partner account:

- RLS and role-specific navigation; assigned vs unassigned leads.
- Company/profile edit, refresh, source verification, concurrent note edits.
- Call outcomes including No Answer, Call Back + local time, Interested, Book Meeting and Do Not Contact.
- Meeting request approval and 15/30/45/60-minute time collisions.
- Calendar day/week navigation across DST boundaries and employee filters.
- Project/Task assignment, completion approval and deadline extension.
- Finance entry audit, paid date reporting and authorized data visibility.
- Real browser accessibility, keyboard interactions, desktop/mobile responsiveness.
- Review retention policy, lawful basis and export/deletion handling with the responsible data controller.

## Security review status

- Live Supabase public tables checked: RLS enabled for `leads`, `companies`, `contacts`, `meetings`, `sales_call_logs`, `sales_suppressions`.
- SQL grants checked: SECURITY DEFINER functions were not executable by `anon`, while intended authenticated RPCs remain callable.
- Security-advisor warnings regarding executable SECURITY DEFINER RPCs require per-function review. Blanket revocation would break existing authorized workflows.
- No service-role keys or actual customer data added to repository.

## Known limitations

- Direct Allabolag data integration is not configured; financial information must be entered with a verified source. This system does not scrape Allabolag.
- The older 10-argument sales call RPC overload remains in the database; the frontend calls the updated 11-argument overload.
- Company and Contact directories show at most the first 1,000 authorized records per table; the main lead pipeline supports paged retrieval beyond 500.
- Legacy secondary text may still be English in Swedish mode; high-use forms and the new V3 modules are bilingual.
- Full account-authenticated functional, GDPR and accessibility testing is outstanding. No production deployment has been performed.

**Release gate:** Authenticated acceptance tests and Owner review, then merge PR #1 to `main` and verify the Pages deployment.
