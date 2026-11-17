-- ONYX45 Executive Operations V3: additive company dossier fields.
-- No existing production rows are changed.
alter table public.leads
  add column if not exists organization_number text,
  add column if not exists company_city text,
  add column if not exists profit_latest numeric(18,2),
  add column if not exists company_data_origin text,
  add column if not exists company_verified_at timestamptz;

comment on column public.leads.profit_latest is 'Annual profit/loss in SEK for financial_year; source required';
comment on column public.leads.company_data_origin is 'Origin of dossier information, e.g. official_website, registry, internal_assessment, client_provided';
comment on column public.leads.company_verified_at is 'When dossier information was last checked against its source';

create or replace function public.protect_lead_financial_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
 if not public.is_owner() and (
   new.revenue_latest is distinct from old.revenue_latest or
   new.revenue_previous is distinct from old.revenue_previous or
   new.profit_latest is distinct from old.profit_latest or
   new.financial_year is distinct from old.financial_year or
   new.financial_source_url is distinct from old.financial_source_url or
   new.financial_checked_at is distinct from old.financial_checked_at
 ) then
   raise exception 'Financial details may only be edited by Owner';
 end if;
 if (new.revenue_latest is not null or new.revenue_previous is not null or new.profit_latest is not null)
 and (new.financial_year is null or nullif(btrim(new.financial_source_url),'') is null)
 then
   raise exception 'Financial year and source URL are required for financial figures';
 end if;
 return new;
end
$function$;
