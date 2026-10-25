export const industryCategories=['E-commerce','SaaS','Professional Services','Local Services','B2B Technology','Recruitment & Staffing','Hospitality','Beauty & Personal Care','Food & Beverage','Other'] as const;
export function industryCategory(value:unknown):string {
 const s=String(value??'').toLocaleLowerCase('sv').trim();
 if(!s)return '';
 if(/saas|edtech|mjukvara|software|plattform|wms|lms/.test(s))return 'SaaS';
 if(/rekryter|recruit|staffing|bemann|executive search/.test(s))return 'Recruitment & Staffing';
 if(/e-commerce|ecommerce|e-handel|webbshop|online retail|retail/.test(s))return 'E-commerce';
 if(/hotell|hotel|spa|konferens|hospitality|turism|besöksnäring|temapark|bröllop/.test(s))return 'Hospitality';
 if(/hudvård|hårvård|kosmetik|skönhet|parfym|kroppsvård|hemdoft|doftljus|personlig vård/.test(s))return 'Beauty & Personal Care';
 if(/livsmedel|food|dryck|snacks|glass|restaurang|beverage/.test(s))return 'Food & Beverage';
 if(/it-konsult|systemutveckling|digital transformation|automation|affärsapplikationer|erp|microsoft|teknik/.test(s))return 'B2B Technology';
 if(/professionell|konsult|utbildning|rådgivning|professional/.test(s))return 'Professional Services';
 if(/lokal|local|tvätt|rengöring|hantverk/.test(s))return 'Local Services';
 return industryCategories.find(c=>c.toLocaleLowerCase('sv')===s)||'Other';
}
