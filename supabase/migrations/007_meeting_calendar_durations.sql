-- ONYX45 OS Calendar: duration-aware meeting windows. Already applied to production Supabase.
alter table public.meetings add column if not exists duration_minutes integer not null default 30 check(duration_minutes in (15,30,45,60));
alter table public.sales_meeting_requests add column if not exists duration_minutes integer not null default 30 check(duration_minutes in (15,30,45,60));
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
 if exists(select 1 from public.meetings m where m.status in ('Confirmed','Requested') and m.starts_at<req.proposed_at+make_interval(mins=>req.duration_minutes) and m.starts_at+make_interval(mins=>m.duration_minutes)>req.proposed_at and m.assigned_to=auth.uid()) then raise exception 'Meeting time conflicts with existing meeting'; end if;
 insert into public.meetings(title,company_name,starts_at,timezone,location,status,owner_id,assigned_to,meeting_format,meeting_url,lead_id,duration_minutes)
 values ('ONYX45 Intro · '||coalesce(ld.company_name,'Prospect'),ld.company_name,req.proposed_at,req.timezone,
 case when req.meeting_format='In person' then req.meeting_location else 'Proton Meet' end,
 'Confirmed',auth.uid(),auth.uid(),req.meeting_format,
 case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end,req.lead_id,req.duration_minutes)
 returning id into mid;
 update public.sales_meeting_requests set status='accepted',reviewed_by=auth.uid(),reviewed_at=now(),meeting_id=mid,
 meeting_url=case when req.meeting_format='Online' then coalesce(nullif(p_meeting_url,''),req.meeting_url) else null end where id=p_request;
 return mid;
end $function$
;

CREATE OR REPLACE FUNCTION public.sales_check_meeting_slot(p_starts_at timestamp with time zone, p_exclude_request uuid DEFAULT NULL::uuid, p_duration_minutes integer DEFAULT 30, p_exclude_meeting uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 if p_starts_at is null or p_duration_minutes not in (15,30,45,60) then return false; end if;
 return not exists(select 1 from public.meetings m where m.status in ('Requested','Confirmed','Rescheduled') and (p_exclude_meeting is null or m.id<>p_exclude_meeting)
 and m.starts_at<p_starts_at+make_interval(mins=>p_duration_minutes)
 and m.starts_at+make_interval(mins=>m.duration_minutes)>p_starts_at)
 and not exists(select 1 from public.sales_meeting_requests r where r.status='requested' and (p_exclude_request is null or r.id<>p_exclude_request)
 and r.proposed_at<p_starts_at+make_interval(mins=>p_duration_minutes)
 and r.proposed_at+make_interval(mins=>r.duration_minutes)>p_starts_at);
end $function$
;

CREATE OR REPLACE FUNCTION public.sales_guard_meeting_conflicts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status in ('Requested','Confirmed','Rescheduled') then
 perform pg_advisory_xact_lock(918231);
 if exists(select 1 from public.meetings m where m.id is distinct from new.id and m.status in ('Requested','Confirmed','Rescheduled')
 and m.starts_at<new.starts_at+make_interval(mins=>new.duration_minutes)
 and m.starts_at+make_interval(mins=>m.duration_minutes)>new.starts_at) then
 raise exception 'Meeting time conflicts with an existing meeting'; end if;
 end if;return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.sales_guard_request_conflicts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status='requested' then
 perform pg_advisory_xact_lock(918231);
 if exists(select 1 from public.meetings m where m.status in ('Requested','Confirmed','Rescheduled')
 and m.starts_at<new.proposed_at+make_interval(mins=>new.duration_minutes)
 and m.starts_at+make_interval(mins=>m.duration_minutes)>new.proposed_at) then raise exception 'Meeting slot taken';end if;
 if exists(select 1 from public.sales_meeting_requests r where r.id is distinct from new.id and r.status='requested'
 and r.proposed_at<new.proposed_at+make_interval(mins=>new.duration_minutes)
 and r.proposed_at+make_interval(mins=>r.duration_minutes)>new.proposed_at) then raise exception 'Pending request overlaps';end if;
 end if;return new;
end $function$
;
drop trigger if exists sales_guard_meeting_slots on public.meetings;
create trigger sales_guard_meeting_slots before insert or update of starts_at,status,duration_minutes on public.meetings for each row execute function public.sales_guard_meeting_conflicts();
drop trigger if exists sales_guard_request_slots on public.sales_meeting_requests;
create trigger sales_guard_request_slots before insert or update of proposed_at,status,duration_minutes on public.sales_meeting_requests for each row execute function public.sales_guard_request_conflicts();
revoke all on function public.sales_check_meeting_slot(timestamptz,uuid,integer,uuid) from public,anon;
grant execute on function public.sales_check_meeting_slot(timestamptz,uuid,integer,uuid) to authenticated;
