-- Propagate the active lead's project through sales activity, follow-up tasks and approved meetings.
create or replace function public.can_access_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
select exists(select 1 from public.leads l where l.id=p_lead_id and (
 public.is_owner()
 or (l.project_id is not null and public.on_project(l.project_id))
 or (l.project_id is null and l.owner_id=auth.uid() and public.my_role()='sales_partner'::public.member_role)
 or (l.project_id is null and l.assigned_to=auth.uid() and public.my_role()='sales_partner'::public.member_role)
 or (l.project_id is null and public.my_role()::text=any(l.assigned_roles) and public.my_role()::text in ('sales_partner','project_manager','specialist'))
));
$function$;

create or replace function public.sales_finish_call(p_lead_id uuid,p_outcome text,p_notes text default '',p_followup date default null,p_meeting_at timestamptz default null,p_timezone text default 'Europe/Stockholm',p_purpose text default 'Introductory call',p_script_id uuid default null,p_script_version integer default null,p_followup_at timestamptz default null)
returns void language plpgsql security definer set search_path to ''
as $function$
declare ld public.leads%rowtype;
begin
 if auth.uid() is null or public.my_role() not in ('owner','sales_partner') then raise exception 'Not authorized'; end if;
 select * into ld from public.leads where id=p_lead_id for update;
 if not found or not public.can_access_lead(p_lead_id) then raise exception 'Prospect not assigned'; end if;
 if exists(select 1 from public.sales_suppressions where lead_id=p_lead_id) then raise exception 'Do Not Contact'; end if;
 if p_outcome not in ('No Answer','Call Back','Interested','Meeting Requested','Not Interested','Do Not Contact') then raise exception 'Unsupported outcome'; end if;
 if p_outcome='Call Back' and (p_followup_at is null or p_followup_at<=now() or (p_followup_at at time zone 'Europe/Stockholm')::date is distinct from p_followup) then raise exception 'Valid future follow-up date and time required'; end if;
 if p_outcome='Meeting Requested' and (p_meeting_at is null or p_meeting_at<=now()) then raise exception 'Future meeting time required'; end if;
 if p_outcome='Meeting Requested' and not public.sales_check_meeting_slot(p_meeting_at,null) then raise exception 'Selected meeting time conflicts with an existing meeting or request'; end if;
 if public.my_role()='sales_partner' and (p_script_id is null or not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version and service=ld.service)) then raise exception 'Approved script required'; end if;
 if p_script_id is not null and not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version) then raise exception 'Script not approved'; end if;
 if p_outcome='Meeting Requested' then insert into public.sales_meeting_requests(lead_id,requested_by,proposed_at,timezone,purpose,notes,status) values(p_lead_id,auth.uid(),p_meeting_at,p_timezone,p_purpose,coalesce(p_notes,''),'requested'); end if;
 insert into public.sales_call_logs(lead_id,seller_id,script_id,script_version,outcome,notes,next_follow_up,follow_up_at) values(p_lead_id,auth.uid(),p_script_id,p_script_version,p_outcome,coalesce(p_notes,''),p_followup,case when p_outcome='Call Back' then p_followup_at else null end);
 if p_outcome='Do Not Contact' then insert into public.sales_suppressions(lead_id,created_by,reason) values(p_lead_id,auth.uid(),'Do Not Contact') on conflict(lead_id) do nothing; end if;
 update public.leads set stage=case p_outcome when 'Call Back' then 'Follow-Up' when 'Interested' then 'Interested' when 'Not Interested' then 'Lost' when 'Meeting Requested' then 'Meeting Booked' else stage end,next_follow_up=p_followup,follow_up_at=case when p_outcome='Call Back' then p_followup_at else null end,last_contacted_at=now() where id=p_lead_id;
 if p_outcome='Call Back' then insert into public.tasks(title,details,due_date,created_by,assigned_to,status,priority,project_id) values('Call back: '||coalesce(ld.company_name,'Prospect')||' · '||to_char(p_followup_at at time zone 'Europe/Stockholm','HH24:MI'),coalesce(nullif(p_notes,''),'Follow up'),p_followup,auth.uid(),auth.uid(),'To Do','Medium',ld.project_id); end if;
end $function$;

create or replace function public.sales_finish_call(p_lead_id uuid,p_outcome text,p_notes text default '',p_followup date default null,p_meeting_at timestamptz default null,p_timezone text default 'Europe/Stockholm',p_purpose text default 'Introductory call',p_script_id uuid default null,p_script_version integer default null,p_followup_at timestamptz default null,p_duration_minutes integer default 30)
returns void language plpgsql security definer set search_path to ''
as $function$
declare ld public.leads%rowtype;
begin
 if auth.uid() is null or public.my_role() not in ('owner','sales_partner') then raise exception 'Not authorized'; end if;
 select * into ld from public.leads where id=p_lead_id for update;
 if not found or not public.can_access_lead(p_lead_id) then raise exception 'Prospect not assigned to your role'; end if;
 if exists(select 1 from public.sales_suppressions where lead_id=p_lead_id) then raise exception 'Do Not Contact'; end if;
 if p_outcome not in ('No Answer','Call Back','Interested','Meeting Requested','Not Interested','Do Not Contact') then raise exception 'Unsupported outcome'; end if;
 if p_outcome='Call Back' and (p_followup_at is null or p_followup_at<=now() or (p_followup_at at time zone 'Europe/Stockholm')::date is distinct from p_followup) then raise exception 'Valid future follow-up date and time required'; end if;
 if p_duration_minutes not in (15,30,45,60) then raise exception 'Invalid meeting duration'; end if;
 if p_outcome='Meeting Requested' and (p_meeting_at is null or p_meeting_at<=now()) then raise exception 'Future meeting time required'; end if;
 if p_outcome='Meeting Requested' and not public.sales_check_meeting_slot(p_meeting_at,null,p_duration_minutes,null) then raise exception 'Selected meeting time conflicts with an existing meeting or request'; end if;
 if p_script_id is not null and not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version) then raise exception 'Script not approved'; end if;
 if p_outcome='Meeting Requested' then insert into public.sales_meeting_requests(lead_id,requested_by,proposed_at,timezone,purpose,notes,status,duration_minutes) values(p_lead_id,auth.uid(),p_meeting_at,p_timezone,p_purpose,coalesce(p_notes,''),'requested',p_duration_minutes); end if;
 insert into public.sales_call_logs(lead_id,seller_id,script_id,script_version,outcome,notes,next_follow_up,follow_up_at) values(p_lead_id,auth.uid(),p_script_id,p_script_version,p_outcome,coalesce(p_notes,''),p_followup,case when p_outcome='Call Back' then p_followup_at else null end);
 if p_outcome='Do Not Contact' then insert into public.sales_suppressions(lead_id,created_by,reason) values(p_lead_id,auth.uid(),'Do Not Contact') on conflict(lead_id) do nothing; end if;
 update public.leads set stage=case p_outcome when 'Call Back' then 'Follow-Up' when 'Interested' then 'Interested' when 'Not Interested' then 'Lost' when 'Meeting Requested' then 'Meeting Booked' else stage end,next_follow_up=p_followup,follow_up_at=case when p_outcome='Call Back' then p_followup_at else null end,last_contacted_at=now() where id=p_lead_id;
 if p_outcome='Call Back' then insert into public.tasks(title,details,due_date,created_by,assigned_to,status,priority,project_id) values('Call back: '||coalesce(ld.company_name,'Prospect')||' · '||to_char(p_followup_at at time zone 'Europe/Stockholm','HH24:MI'),coalesce(nullif(p_notes,''),'Follow up'),p_followup,auth.uid(),auth.uid(),'To Do','Medium',ld.project_id); end if;
end $function$;

create or replace function public.approve_sales_meeting(p_request uuid,p_meeting_url text default null)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare req public.sales_meeting_requests%rowtype; ld public.leads%rowtype; mid uuid;
begin
 if not public.is_owner() then raise exception 'Owner only'; end if;
 select * into req from public.sales_meeting_requests where id=p_request for update;
 if not found or req.status<>'requested' then raise exception 'Request not awaiting review'; end if;
 select * into ld from public.leads where id=req.lead_id;
 if not found then raise exception 'Lead no longer exists'; end if;
 if exists(select 1 from public.meetings m where m.status in ('Confirmed','Requested') and m.starts_at<req.proposed_at+make_interval(mins=>req.duration_minutes) and m.starts_at+make_interval(mins=>m.duration_minutes)>req.proposed_at and m.assigned_to=auth.uid()) then raise exception 'Meeting time conflicts with existing meeting'; end if;
 insert into public.meetings(title,company_name,starts_at,timezone,location,status,owner_id,assigned_to,meeting_format,meeting_url,lead_id,duration_minutes,project_id)
 values('ONYX45 Intro · '||coalesce(ld.company_name,'Prospect'),ld.company_name,req.proposed_at,req.timezone,case when req.meeting_format='In person' then req.meeting_location else 'Proton Meet' end,'Confirmed',auth.uid(),auth.uid(),req.meeting_format,case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end,req.lead_id,req.duration_minutes,ld.project_id)
 returning id into mid;
 update public.sales_meeting_requests set status='accepted',reviewed_by=auth.uid(),reviewed_at=now(),meeting_id=mid,meeting_url=case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end where id=p_request;
 return mid;
end $function$;
