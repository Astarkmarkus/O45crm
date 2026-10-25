-- ONYX45 OS: meeting formats, assignment and owner-only billing.
-- Run once after 001_initial.sql. Does not delete existing records.
alter table public.meetings add column if not exists meeting_format text not null default 'Online'
  check (meeting_format in ('Online','In person'));
alter table public.meetings add column if not exists meeting_url text;
alter table public.meetings add column if not exists assigned_to uuid references public.profiles(id);
update public.meetings set assigned_to=owner_id where assigned_to is null;
alter table public.meetings alter column assigned_to set default auth.uid();
create index if not exists meetings_assignee_idx on public.meetings(assigned_to,starts_at);
-- Read meetings you booked or meetings assigned to you; owner sees all.
drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings for select to authenticated
 using (public.is_owner() or owner_id=auth.uid() or assigned_to=auth.uid());
-- Only the owner may assign a meeting to another user or approve it.
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings for insert to authenticated
 with check (
   owner_id=auth.uid() and
   (public.is_owner() or (assigned_to=auth.uid() and status='Requested'))
 );
drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings for update to authenticated
 using (public.is_owner() or owner_id=auth.uid())
 with check (public.is_owner() or
   (owner_id=auth.uid() and (assigned_to=auth.uid() or assigned_to is null)
    and status='Requested'));
-- NOTE: update policy is row-based, so owner only should approve assignments.
-- Dedicated billed/paid amounts: never count pipeline deals or ad spend as earned revenue.
alter table public.financial_records add column if not exists invoiced_amount numeric(12,2) not null default 0 check (invoiced_amount>=0);
alter table public.financial_records add column if not exists paid_amount numeric(12,2) not null default 0 check (paid_amount>=0);
alter table public.financial_records add column if not exists invoice_date date;
alter table public.financial_records add column if not exists invoice_reference text;
create index if not exists financial_invoice_date_idx on public.financial_records(invoice_date);
