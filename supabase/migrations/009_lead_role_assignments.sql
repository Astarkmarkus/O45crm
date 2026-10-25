-- Shared role-based lead assignment; keep individual assigned_to for backwards compatibility.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_roles text[] NOT NULL DEFAULT '{}'::text[];
CREATE OR REPLACE FUNCTION public.can_access_lead(p_lead_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.leads l WHERE l.id=p_lead_id AND (
  public.is_owner() OR
  (l.owner_id=auth.uid() AND public.my_role()='sales_partner'::public.member_role) OR
  (l.assigned_to=auth.uid() AND public.my_role()='sales_partner'::public.member_role) OR
  (public.my_role()::text=ANY(l.assigned_roles) AND public.my_role()::text IN ('sales_partner','project_manager','specialist'))
 ));
$$;
REVOKE ALL ON FUNCTION public.can_access_lead(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.can_access_lead(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.protect_lead_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT public.is_owner() AND (new.assigned_roles IS DISTINCT FROM old.assigned_roles OR new.assigned_to IS DISTINCT FROM old.assigned_to OR new.owner_id IS DISTINCT FROM old.owner_id) THEN
 RAISE EXCEPTION 'Only an Owner can change lead assignments';
 END IF;
 IF new.assigned_roles && ARRAY['owner','disabled']::text[] OR EXISTS(SELECT 1 FROM unnest(new.assigned_roles) x WHERE x NOT IN ('sales_partner','project_manager','specialist')) THEN
 RAISE EXCEPTION 'Invalid assigned role';
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS protect_lead_assignment ON public.leads;
CREATE TRIGGER protect_lead_assignment BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.protect_lead_assignment();
DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads FOR SELECT TO authenticated USING (public.can_access_lead(id));
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (public.can_access_lead(id)) WITH CHECK (public.can_access_lead(id));
DROP POLICY IF EXISTS sales_calls_insert ON public.sales_call_logs;
CREATE POLICY sales_calls_insert ON public.sales_call_logs FOR INSERT TO authenticated WITH CHECK (seller_id=auth.uid() AND public.my_role() IN ('owner','sales_partner') AND public.can_access_lead(lead_id));
DROP POLICY IF EXISTS sales_calls_read ON public.sales_call_logs;
CREATE POLICY sales_calls_read ON public.sales_call_logs FOR SELECT TO authenticated USING (public.is_owner() OR (seller_id=auth.uid() AND public.can_access_lead(lead_id)));
DROP POLICY IF EXISTS sales_requests_insert ON public.sales_meeting_requests;
CREATE POLICY sales_requests_insert ON public.sales_meeting_requests FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND public.my_role() IN ('owner','sales_partner') AND public.can_access_lead(lead_id));
DROP POLICY IF EXISTS sales_suppressions_insert ON public.sales_suppressions;
CREATE POLICY sales_suppressions_insert ON public.sales_suppressions FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.my_role() IN ('owner','sales_partner') AND public.can_access_lead(lead_id));
DROP POLICY IF EXISTS sales_suppressions_read ON public.sales_suppressions;
CREATE POLICY sales_suppressions_read ON public.sales_suppressions FOR SELECT TO authenticated USING (public.is_owner() OR public.can_access_lead(lead_id));
-- sales_finish_call is updated in production to invoke can_access_lead for authorization.
