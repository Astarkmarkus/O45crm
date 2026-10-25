-- ONYX45 OS operations v3. Apply after 002_operations.sql.
-- Owner-only delete on projects and financial entries.
create policy projects_owner_delete on public.projects for delete to authenticated using (public.is_owner());
create policy finance_owner_delete on public.financial_records for delete to authenticated using (public.is_owner());
-- Task assignees may mark work done or request an extension.
alter table public.tasks add column if not exists extension_requested_until date;
alter table public.tasks add column if not exists extension_reason text;
-- Tighten task updates: authorization remains RLS. Column privileges restrict non-owner updates.
revoke update on public.tasks from authenticated;
grant update (status,extension_requested_until,extension_reason) on public.tasks to authenticated;
-- Owner updates of all fields must use trusted server RPC below.
create or replace function public.owner_update_task(
 p_task_id uuid,p_title text,p_details text,p_due_date date,p_priority text,p_status text,p_assigned_to uuid
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Not authorized'; end if;
 update public.tasks set title=p_title,details=p_details,due_date=p_due_date,priority=p_priority,status=p_status,assigned_to=p_assigned_to
 where id=p_task_id;
end $$;
revoke all on function public.owner_update_task(uuid,text,text,date,text,text,uuid) from public;
grant execute on function public.owner_update_task(uuid,text,text,date,text,text,uuid) to authenticated;
-- Owner may assign tasks using existing INSERT RLS policy, which must be adjusted.
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
 with check (created_by=auth.uid() and (public.is_owner() or assigned_to=auth.uid()));
-- Deleting a project cascades related financial entries, members and tasks.
