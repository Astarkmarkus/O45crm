-- ONYX45 CRM / Nightdrive company intelligence.
-- Sourced, manually verified annual figures. No unlicensed third-party scraping.
ALTER TABLE public.leads
 ADD COLUMN IF NOT EXISTS website_url text,
 ADD COLUMN IF NOT EXISTS company_summary text,
 ADD COLUMN IF NOT EXISTS business_focus text,
 ADD COLUMN IF NOT EXISTS business_model text,
 ADD COLUMN IF NOT EXISTS revenue_latest numeric(18,2),
 ADD COLUMN IF NOT EXISTS revenue_previous numeric(18,2),
 ADD COLUMN IF NOT EXISTS financial_year integer,
 ADD COLUMN IF NOT EXISTS financial_source_url text,
 ADD COLUMN IF NOT EXISTS financial_checked_at timestamptz;

COMMENT ON COLUMN public.leads.revenue_latest IS 'Latest verified annual turnover in SEK with linked source and reporting year.';
COMMENT ON COLUMN public.leads.revenue_previous IS 'Prior financial year turnover in SEK.';
COMMENT ON COLUMN public.leads.financial_year IS 'Financial year of revenue_latest.';

CREATE OR REPLACE FUNCTION public.protect_lead_financial_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT public.is_owner() AND (
  NEW.revenue_latest IS DISTINCT FROM OLD.revenue_latest OR
  NEW.revenue_previous IS DISTINCT FROM OLD.revenue_previous OR
  NEW.financial_year IS DISTINCT FROM OLD.financial_year OR
  NEW.financial_source_url IS DISTINCT FROM OLD.financial_source_url OR
  NEW.financial_checked_at IS DISTINCT FROM OLD.financial_checked_at
 ) THEN
  RAISE EXCEPTION 'Financial details may only be edited by Owner';
 END IF;
 IF (NEW.revenue_latest IS NOT NULL OR NEW.revenue_previous IS NOT NULL)
 AND (NEW.financial_year IS NULL OR nullif(btrim(NEW.financial_source_url),'') IS NULL) THEN
  RAISE EXCEPTION 'Financial year and source URL are required for revenue figures';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_lead_financial_fields ON public.leads;
CREATE TRIGGER protect_lead_financial_fields BEFORE UPDATE ON public.leads
 FOR EACH ROW EXECUTE FUNCTION public.protect_lead_financial_fields();
