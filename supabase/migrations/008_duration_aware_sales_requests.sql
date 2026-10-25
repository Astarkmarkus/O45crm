CREATE OR REPLACE FUNCTION public.sales_finish_call(p_lead_id uuid, p_outcome text, p_notes text DEFAULT ''::text, p_followup date DEFAULT NULL::date, p_meeting_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_timezone text DEFAULT 'Europe/Stockholm'::text, p_purpose text DEFAULT 'Introductory call'::text, p_script_id uuid DEFAULT NULL::uuid, p_script_version integer DEFAULT NULL::integer, p_followup_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_duration_minutes integer DEFAULT 30)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ld public.leads%rowtype;
begin
if auth.uid() is null or public.my_role() not in ('owner','sales_partner') then raise exception 'Not authorized'; end if;
select * into ld from public.leads where id=p_lead_id for update;
if not found or (not public.is_owner() and ld.owner_id is distinct from auth.uid() and ld.assigned_to is distinct from auth.uid()) then raise exception 'Prospect not assigned'; end if;
if exists(select 1 from public.sales_suppressions where lead_id=p_lead_id) then raise exception 'Do Not Contact'; end if;
if p_outcome not in ('No Answer','Call Back','Interested','Meeting Requested','Not Interested','Do Not Contact') then raise exception 'Unsupported outcome'; end if;
if p_outcome='Call Back' and (p_followup_at is null or p_followup_at<=now() or (p_followup_at at time zone 'Europe/Stockholm')::date is distinct from p_followup) then raise exception 'Valid future follow-up date and time required'; end if;
if p_duration_minutes not in (15,30,45,60) then raise exception 'Invalid meeting duration'; end if;
if p_outcome='Meeting Requested' and (p_meeting_at is null or p_meeting_at<=now()) then raise exception 'Future meeting time required'; end if;
if p_outcome='Meeting Requested' and not public.sales_check_meeting_slot(p_meeting_at,null,p_duration_minutes,null) then raise exception 'Selected meeting time conflicts with an existing meeting or request'; end if;
if public.my_role()='sales_partner' and (p_script_id is null or not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version and service=ld.service)) then raise exception 'Approved script required'; end if;
if p_script_id is not null and not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version) then raise exception 'Script not approved'; end if;
if p_outcome='Meeting Requested' then
insert into public.sales_meeting_requests(lead_id,requested_by,proposed_at,timezone,purpose,notes,status,duration_minutes)
values(p_lead_id,auth.uid(),p_meeting_at,p_timezone,p_purpose,coalesce(p_notes,''),'requested',p_duration_minutes);
end if;
insert into public.sales_call_logs(lead_id,seller_id,script_id,script_version,outcome,notes,next_follow_up,follow_up_at)
values(p_lead_id,auth.uid(),p_script_id,p_script_version,p_outcome,coalesce(p_notes,''),p_followup,case when p_outcome='Call Back' then p_followup_at else null end);
if p_outcome='Do Not Contact' then insert into public.sales_suppressions(lead_id,created_by,reason) values(p_lead_id,auth.uid(),'Do Not Contact') on conflict(lead_id) do nothing; end if;
update public.leads set stage=case p_outcome when 'Call Back' then 'Follow-Up' when 'Interested' then 'Interested' when 'Not Interested' then 'Lost' when 'Meeting Requested' then 'Meeting Booked' else stage end,
next_follow_up=p_followup,follow_up_at=case when p_outcome='Call Back' then p_followup_at else null end,last_contacted_at=now() where id=p_lead_id;
if p_outcome='Call Back' then insert into public.tasks(title,details,due_date,created_by,assigned_to,status,priority)
values('Call back: '||coalesce(ld.company_name,'Prospect')||' · '||to_char(p_followup_at at time zone 'Europe/Stockholm','HH24:MI'),coalesce(nullif(p_notes,''),'Follow up'),p_followup,auth.uid(),auth.uid(),'To Do','Medium'); end if;
end $function$
;
revoke all on function public.sales_finish_call(uuid,text,text,date,timestamptz,text,text,uuid,integer,timestamptz,integer) from public,anon;
grant execute on function public.sales_finish_call(uuid,text,text,date,timestamptz,text,text,uuid,integer,timestamptz,integer) to authenticated;
