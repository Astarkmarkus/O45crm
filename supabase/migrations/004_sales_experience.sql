-- ONYX45 OS Sales Experience: synchronized with deployed Supabase routines.
-- Idempotent/additive. Apply only in environments with prior Sales Workspace migrations.
alter table public.leads add column if not exists last_contacted_at timestamptz;
alter table public.sales_meeting_requests add column if not exists meeting_format text not null default 'Online' check(meeting_format in ('Online','In person'));
alter table public.sales_meeting_requests add column if not exists meeting_location text;
create index if not exists sales_call_logs_seller_time on public.sales_call_logs(seller_id,created_at desc);
create index if not exists leads_due_queue on public.leads(assigned_to,next_follow_up,last_contacted_at);

CREATE OR REPLACE FUNCTION public.sales_finish_call(p_lead_id uuid, p_outcome text, p_notes text DEFAULT ''::text, p_followup date DEFAULT NULL::date, p_meeting_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_timezone text DEFAULT 'Europe/Stockholm'::text, p_purpose text DEFAULT 'Introductory call'::text, p_script_id uuid DEFAULT NULL::uuid, p_script_version integer DEFAULT NULL::integer)
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
if p_outcome='Call Back' and (p_followup is null or p_followup<current_date) then raise exception 'Future follow-up required'; end if;
if p_outcome='Meeting Requested' and (p_meeting_at is null or p_meeting_at<=now()) then raise exception 'Future meeting time required'; end if;
if public.my_role()='sales_partner' and (p_script_id is null or not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version and service=ld.service)) then raise exception 'Approved script required'; end if;
if p_script_id is not null and not exists(select 1 from public.sales_scripts where id=p_script_id and status='published' and version=p_script_version) then raise exception 'Script not approved'; end if;
if p_outcome='Meeting Requested' then
insert into public.sales_meeting_requests(lead_id,requested_by,proposed_at,timezone,purpose,notes,status) values(p_lead_id,auth.uid(),p_meeting_at,p_timezone,p_purpose,coalesce(p_notes,''),'requested');
end if;
insert into public.sales_call_logs(lead_id,seller_id,script_id,script_version,outcome,notes,next_follow_up) values(p_lead_id,auth.uid(),p_script_id,p_script_version,p_outcome,coalesce(p_notes,''),p_followup);
if p_outcome='Do Not Contact' then insert into public.sales_suppressions(lead_id,created_by,reason) values(p_lead_id,auth.uid(),'Do Not Contact') on conflict(lead_id) do nothing; end if;
update public.leads set stage=case p_outcome when 'Call Back' then 'Follow-Up' when 'Interested' then 'Interested' when 'Not Interested' then 'Lost' when 'Meeting Requested' then 'Meeting Booked' else stage end, next_follow_up=p_followup,last_contacted_at=now() where id=p_lead_id;
if p_outcome='Call Back' then insert into public.tasks(title,details,due_date,created_by,assigned_to,status,priority) values('Call back: '||coalesce(ld.company_name,'Prospect'),coalesce(nullif(p_notes,''),'Follow up'),p_followup,auth.uid(),auth.uid(),'To Do','Medium'); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.sales_set_meeting_details(p_lead uuid, p_format text, p_location text DEFAULT NULL::text, p_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_format not in ('Online','In person') then raise exception 'Invalid meeting format'; end if;
 if p_format='In person' and nullif(trim(coalesce(p_location,'')),'') is null then raise exception 'Location required'; end if;
 select id into request_id from public.sales_meeting_requests where lead_id=p_lead and requested_by=auth.uid() and status='requested' order by created_at desc limit 1 for update;
 if request_id is null then raise exception 'Meeting request not found'; end if;
 update public.sales_meeting_requests set meeting_format=p_format,meeting_location=case when p_format='In person' then p_location else null end,meeting_url=case when p_format='Online' and p_url like 'https://meet.proton.me/%' then p_url else null end where id=request_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.approve_sales_meeting(p_request uuid, p_meeting_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req public.sales_meeting_requests%rowtype; ld public.leads%rowtype; mid uuid;
begin
 if not public.is_owner() then raise exception 'Owner only'; end if;
 select * into req from public.sales_meeting_requests where id=p_request for update;
 if not found or req.status<>'requested' then raise exception 'Request not awaiting review'; end if;
 select * into ld from public.leads where id=req.lead_id;
 if not found then raise exception 'Lead no longer exists'; end if;
 if exists(select 1 from public.meetings m where m.status in ('Confirmed','Requested') and m.starts_at between req.proposed_at-interval '29 minutes' and req.proposed_at+interval '29 minutes' and m.assigned_to=auth.uid()) then raise exception 'Meeting time conflicts with existing meeting'; end if;
 insert into public.meetings(title,company_name,starts_at,timezone,location,status,owner_id,assigned_to,meeting_format,meeting_url,lead_id)
 values ('ONYX45 Intro · '||coalesce(ld.company_name,'Prospect'),ld.company_name,req.proposed_at,req.timezone,
 case when req.meeting_format='In person' then req.meeting_location else 'Proton Meet' end,
 'Confirmed',auth.uid(),auth.uid(),req.meeting_format,
 case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end,req.lead_id)
 returning id into mid;
 update public.sales_meeting_requests set status='accepted',reviewed_by=auth.uid(),reviewed_at=now(),meeting_id=mid,
 meeting_url=case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end where id=p_request;
 return mid;
end $function$
;

revoke all on function public.sales_finish_call(uuid,text,text,date,timestamptz,text,text,uuid,integer) from public,anon;
grant execute on function public.sales_finish_call(uuid,text,text,date,timestamptz,text,text,uuid,integer) to authenticated;
revoke all on function public.sales_set_meeting_details(uuid,text,text,text) from public,anon;
grant execute on function public.sales_set_meeting_details(uuid,text,text,text) to authenticated;
revoke all on function public.approve_sales_meeting(uuid,text) from public,anon;
grant execute on function public.approve_sales_meeting(uuid,text) to authenticated;
