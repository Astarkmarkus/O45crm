-- ONYX45 OS — first-stage tenant-private schema
create extension if not exists pgcrypto;
create type public.member_role as enum ('owner','sales_partner','project_manager','specialist');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, display_name text, role public.member_role not null default 'sales_partner',
 created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email,display_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create function public.is_owner() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role='owner');
$$;
create function public.my_role() returns public.member_role language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id = auth.uid();
$$;
create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null, website text, country text, industry text,
 notes text, owner_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete set null,
 name text not null, job_title text, email text, phone text, notes text,
 owner_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create table public.leads (
 id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete set null,
 contact_id uuid references public.contacts(id) on delete set null,
 name text not null, company_name text, email text, service text,
 stage text not null default 'New Prospect' check(stage in ('New Prospect','Researching','Contacted','Follow-Up','Interested','Meeting Booked','Meeting Completed','Proposal Sent','Negotiation','Won','Lost')),
 priority text not null default 'Medium' check(priority in ('Low','Medium','High')),
 notes text, next_follow_up date, owner_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), name text not null,
 client_name text not null, service text not null, status text not null default 'Planned'
 check(status in ('Planned','Awaiting Payment','Onboarding','Active','Waiting for Client','At Risk','Completed','Cancelled')),
 scope text, start_date date, end_date date, owner_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.project_members (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(project_id,user_id)
);
create function public.on_project(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.projects where id=p and owner_id=auth.uid())
 or exists(select 1 from public.project_members where project_id=p and user_id=auth.uid());
$$;
create table public.tasks (
 id uuid primary key default gen_random_uuid(), title text not null, details text, due_date date,
 status text not null default 'To Do' check(status in ('To Do','In Progress','Done')),
 priority text not null default 'Medium' check(priority in ('Low','Medium','High')),
 project_id uuid references public.projects(id) on delete cascade,
 assigned_to uuid not null default auth.uid() references public.profiles(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.meetings (
 id uuid primary key default gen_random_uuid(), title text not null, company_name text,
 starts_at timestamptz not null, timezone text not null default 'Europe/Stockholm',
 location text, status text not null default 'Requested'
 check(status in ('Requested','Confirmed','Completed','Cancelled','No-Show','Rescheduled')),
 owner_id uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.financial_records (
 id uuid primary key default gen_random_uuid(), project_id uuid not null unique references public.projects(id) on delete cascade,
 fee numeric(12,2) not null default 0, currency text not null default 'SEK',
 specialist_cost numeric(12,2) not null default 0, other_cost numeric(12,2) not null default 0,
 invoice_status text not null default 'Draft', created_at timestamptz not null default now()
);
create index leads_owner_idx on public.leads(owner_id);
create index tasks_assignee_idx on public.tasks(assigned_to);
create index projects_owner_idx on public.projects(owner_id);
create index meetings_owner_idx on public.meetings(owner_id);
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.financial_records enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_owner());
create policy profiles_owner_update on public.profiles for update to authenticated using(public.is_owner()) with check(public.is_owner());
create policy companies_read on public.companies for select to authenticated using(public.is_owner() or owner_id=auth.uid());
create policy companies_insert on public.companies for insert to authenticated with check(owner_id=auth.uid() and public.my_role() in ('owner','sales_partner'));
create policy companies_update on public.companies for update to authenticated using(public.is_owner() or owner_id=auth.uid()) with check(public.is_owner() or owner_id=auth.uid());
create policy contacts_read on public.contacts for select to authenticated using(public.is_owner() or owner_id=auth.uid());
create policy contacts_insert on public.contacts for insert to authenticated with check(owner_id=auth.uid() and public.my_role() in ('owner','sales_partner'));
create policy contacts_update on public.contacts for update to authenticated using(public.is_owner() or owner_id=auth.uid()) with check(public.is_owner() or owner_id=auth.uid());
create policy leads_read on public.leads for select to authenticated using(public.is_owner() or owner_id=auth.uid());
create policy leads_insert on public.leads for insert to authenticated with check(owner_id=auth.uid() and public.my_role() in ('owner','sales_partner'));
create policy leads_update on public.leads for update to authenticated using(public.is_owner() or owner_id=auth.uid()) with check(public.is_owner() or owner_id=auth.uid());
create policy projects_read on public.projects for select to authenticated using(public.is_owner() or public.on_project(id));
create policy projects_insert on public.projects for insert to authenticated with check(public.is_owner() and owner_id=auth.uid());
create policy projects_update on public.projects for update to authenticated using(public.is_owner() or (owner_id=auth.uid() and public.my_role()='project_manager')) with check(public.is_owner() or (owner_id=auth.uid() and public.my_role()='project_manager'));
create policy members_read on public.project_members for select to authenticated using(public.is_owner() or user_id=auth.uid());
create policy members_write on public.project_members for all to authenticated using(public.is_owner()) with check(public.is_owner());
create policy tasks_read on public.tasks for select to authenticated using(public.is_owner() or assigned_to=auth.uid() or created_by=auth.uid() or (project_id is not null and public.on_project(project_id)));
create policy tasks_insert on public.tasks for insert to authenticated with check(created_by=auth.uid() and (public.is_owner() or assigned_to=auth.uid() or (project_id is not null and public.on_project(project_id))));
create policy tasks_update on public.tasks for update to authenticated using(public.is_owner() or assigned_to=auth.uid() or created_by=auth.uid()) with check(public.is_owner() or assigned_to=auth.uid() or created_by=auth.uid());
create policy meetings_read on public.meetings for select to authenticated using(public.is_owner() or owner_id=auth.uid());
create policy meetings_insert on public.meetings for insert to authenticated with check(owner_id=auth.uid());
create policy meetings_update on public.meetings for update to authenticated using(public.is_owner() or owner_id=auth.uid()) with check(public.is_owner() or owner_id=auth.uid());
create policy finances_owner on public.financial_records for all to authenticated using(public.is_owner()) with check(public.is_owner());
-- Do not add client-side role changes or grant privileges on trusted functions to anonymous users.
