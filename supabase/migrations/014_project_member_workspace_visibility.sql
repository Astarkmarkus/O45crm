-- Project members can see and work with the complete project lead pool.
-- The original role/assignment visibility remains unchanged for the main workspace.
drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select to authenticated
using ((project_id is not null and (is_owner() or on_project(project_id))) or (project_id is null and can_access_lead(id)));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
using ((project_id is not null and (is_owner() or on_project(project_id))) or (project_id is null and can_access_lead(id)))
with check ((project_id is not null and (is_owner() or on_project(project_id))) or (project_id is null and can_access_lead(id)));

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select to authenticated
using ((project_id is not null and (is_owner() or on_project(project_id))) or (project_id is null and (is_owner() or owner_id = (select auth.uid()) or assigned_to = (select auth.uid()))));
