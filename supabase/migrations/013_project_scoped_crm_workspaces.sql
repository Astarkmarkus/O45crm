-- Project-scoped CRM workspaces.
-- Existing records keep project_id NULL and remain in the Main workspace.
alter table public.leads add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.meetings add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.profiles add column if not exists active_project_id uuid references public.projects(id) on delete set null;

create index if not exists leads_project_id_idx on public.leads(project_id);
create index if not exists meetings_project_id_idx on public.meetings(project_id);
create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists profiles_active_project_id_idx on public.profiles(active_project_id);

drop policy if exists leads_read on public.leads;
create policy leads_read on public.leads for select to authenticated
using (can_access_lead(id) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert to authenticated
with check (owner_id = (select auth.uid()) and my_role() = any(array['owner'::member_role,'sales_partner'::member_role]) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
using (can_access_lead(id) and (project_id is null or is_owner() or on_project(project_id)))
with check (can_access_lead(id) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select to authenticated
using ((is_owner() or owner_id = (select auth.uid()) or assigned_to = (select auth.uid())) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings for insert to authenticated
with check (owner_id = (select auth.uid()) and (is_owner() or (assigned_to = (select auth.uid()) and status = 'Requested')) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update to authenticated
using ((is_owner() or owner_id = (select auth.uid())) and (project_id is null or is_owner() or on_project(project_id)))
with check ((is_owner() or (owner_id = (select auth.uid()) and (assigned_to = (select auth.uid()) or assigned_to is null) and status = 'Requested')) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
using ((project_id is null and (is_owner() or assigned_to = (select auth.uid()) or created_by = (select auth.uid()))) or (project_id is not null and (is_owner() or on_project(project_id))));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
with check (created_by = (select auth.uid()) and (is_owner() or assigned_to = (select auth.uid())) and (project_id is null or is_owner() or on_project(project_id)));

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
using ((project_id is null and (is_owner() or assigned_to = (select auth.uid()) or created_by = (select auth.uid()))) or (project_id is not null and (is_owner() or on_project(project_id))))
with check ((project_id is null and (is_owner() or assigned_to = (select auth.uid()) or created_by = (select auth.uid()))) or (project_id is not null and (is_owner() or on_project(project_id))));
