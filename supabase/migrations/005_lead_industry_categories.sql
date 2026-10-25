-- ONYX45 lead industry category selection for approved playbooks.
-- Preserve detailed industry description; add a separate editable category.
alter table public.leads add column if not exists industry_category text;
update public.leads set industry_category=case
when lower(coalesce(industry,'')) ~ 'saas|edtech|mjukvara|software|plattform|wms|lms' then 'SaaS'
when lower(coalesce(industry,'')) ~ 'rekryter|recruit|staffing|bemann|executive search' then 'Recruitment & Staffing'
when lower(coalesce(industry,'')) ~ 'e-commerce|ecommerce|e-handel|webbshop|online retail|retail' then 'E-commerce'
when lower(coalesce(industry,'')) ~ 'hotell|hotel|spa|konferens|hospitality|turism|besöksnäring|temapark|bröllop' then 'Hospitality'
when lower(coalesce(industry,'')) ~ 'hudvård|hårvård|kosmetik|skönhet|parfym|kroppsvård|hemdoft|doftljus|personlig vård' then 'Beauty & Personal Care'
when lower(coalesce(industry,'')) ~ 'livsmedel|food|dryck|snacks|glass|restaurang|beverage' then 'Food & Beverage'
when lower(coalesce(industry,'')) ~ 'it-konsult|systemutveckling|digital transformation|automation|affärsapplikationer|erp|microsoft|teknik' then 'B2B Technology'
when lower(coalesce(industry,'')) ~ 'professionell|konsult|utbildning|rådgivning|professional' then 'Professional Services'
when lower(coalesce(industry,'')) ~ 'lokal|local|tvätt|rengöring|hantverk' then 'Local Services'
else 'Other' end
where industry_category is null and industry is not null and btrim(industry)<>'';
