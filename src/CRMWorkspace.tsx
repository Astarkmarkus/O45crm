import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';

type Row={id:string;[key:string]:unknown};
const val=(x:unknown)=>String(x??'');
const money=(v:unknown)=>v==null||v===''?'—':new Intl.NumberFormat('sv-SE',{maximumFractionDigits:0}).format(Number(v))+' kr';
const link=(v:unknown)=>{try{const u=new URL(val(v));return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
const stages=['New Prospect','Researching','Contacted','Follow-Up','Interested','Meeting Booked','Meeting Completed','Proposal Sent','Negotiation','Won','Lost'];
export default function CRMWorkspace({leads,language,onEdit,onBook,onRefresh}:{leads:Row[];language:'sv'|'en';onEdit:(item:Row)=>void;onBook:()=>void;onRefresh:()=>Promise<void>}){
 const sv=language==='sv';
 const [search,setSearch]=useState(''),[stageFilter,setStageFilter]=useState('all'),[sort,setSort]=useState('company'),[limit,setLimit]=useState(40),[selectedId,setSelectedId]=useState('');
 const [notes,setNotes]=useState(''),[savedNotes,setSavedNotes]=useState(''),[savedOriginal,setSavedOriginal]=useState<string|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failure,setFailure]=useState('');
 const filtered=useMemo(()=>leads.filter(l=>(stageFilter==='all'||val(l.stage)===stageFilter)&&[l.company_name,l.name,l.email,l.phone,l.industry,l.industry_category,l.company_summary,l.business_focus,l.notes].some(x=>val(x).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).sort((a,b)=>sort==='recent'?val(b.created_at).localeCompare(val(a.created_at)):sort==='priority'?({High:0,Medium:1,Low:2}[val(a.priority) as 'High'|'Medium'|'Low']??3)-({High:0,Medium:1,Low:2}[val(b.priority) as 'High'|'Medium'|'Low']??3):val(a.company_name).localeCompare(val(b.company_name),'sv')),[leads,search,stageFilter,sort]);
 const selected=leads.find(l=>l.id===selectedId)||filtered[0]||null;
 useEffect(()=>{if(selected&&!selectedId)setSelectedId(selected.id)},[selected?.id,selectedId]);
 useEffect(()=>{setNotes(val(selected?.notes));setSavedNotes(val(selected?.notes));setSavedOriginal(selected?.notes==null?null:val(selected.notes));setFailure('');setNotice('')},[selected?.id]);
 const originalNote=savedOriginal;
 const dirty=notes!==savedNotes;
 const selectedWebsite=link(selected?.website_url);
 const source=link(selected?.financial_source_url);
 const activate=(item:Row)=>{if(item.id===selectedId)return;if(dirty&&!window.confirm(sv?'Anteckningarna är inte sparade. Byt företag ändå?':'You have unsaved notes. Switch company anyway?'))return;setSelectedId(item.id);setNotice('');setFailure('')};
 async function saveNotes(){
  if(!supabase||!selected||busy||!dirty)return;
  setBusy(true);setFailure('');setNotice('');
  const q=supabase.from('leads').update({notes}).eq('id',selected.id);
  const {data,error}=await (originalNote===null?q.is('notes',null):q.eq('notes',originalNote)).select('id,notes').maybeSingle();
  if(error||!data||val(data.notes)!==notes)setFailure(error?.message||(sv?'Anteckningen kunde inte sparas. Någon annan kan ha ändrat den. Uppdatera och jämför innan du försöker igen.':'Could not save notes. Someone may have changed the record. Refresh and compare.'));
  else {setSavedNotes(notes);setSavedOriginal(notes);setNotice(sv?'Anteckning sparad i Supabase.':'Notes saved in Supabase.');try{await onRefresh()}catch{}}
  setBusy(false);
 }
 async function saveStage(next:string){
  if(!supabase||!selected||busy||next===val(selected.stage))return;
  setBusy(true);setFailure('');setNotice('');
  const q=supabase.from('leads').update({stage:next}).eq('id',selected.id);
  const {data,error}=await (selected.stage==null?q.is('stage',null):q.eq('stage',selected.stage)).select('id,stage').maybeSingle();
  if(error||!data||data.stage!==next)setFailure(error?.message||(sv?'Status kunde inte sparas. Uppdatera listan och försök igen.':'Stage could not be saved. Refresh and retry.'));
  else {setNotice(sv?'Status uppdaterad.':'Stage updated.');try{await onRefresh()}catch{}}
  setBusy(false);
 }
 return <section className="crm-workspace" aria-label={sv?'CRM och prospekt':'CRM and prospects'}>
  <div className="crm-roster">
   <div className="crm-roster-head"><div><span>ONYX45 / CRM</span><h2>{sv?'Prospekt':'Prospects'} <em>{filtered.length}</em></h2></div><span className="crm-roster-dot"/></div>
   <label className="crm-search-label">{sv?'Sök företag eller kontakt':'Search company or contact'}<input type="search" placeholder={sv?'Företag, person, anteckning…':'Company, person, note…'} value={search} onChange={e=>{setSearch(e.target.value);setLimit(40)}}/></label>
   <div className="crm-filters"><label>{sv?'Status':'Stage'}<select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">{sv?'Alla statusar':'All stages'}</option>{stages.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>{sv?'Sortering':'Sort by'}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="company">{sv?'Företagsnamn':'Company name'}</option><option value="recent">{sv?'Nyast':'Newest'}</option><option value="priority">{sv?'Prioritet':'Priority'}</option></select></label></div>
   <div className="crm-list" role="list" aria-label={sv?'Företagslista':'Company list'}>{filtered.slice(0,limit).map(l=><button type="button" role="listitem" key={l.id} className={'crm-list-item'+(selected?.id===l.id?' active':'')} onClick={()=>activate(l)} aria-current={selected?.id===l.id?'true':undefined}><div className="crm-list-item-top"><strong>{val(l.company_name)||val(l.name)||(sv?'Namnlöst företag':'Unnamed company')}</strong><span className={'crm-priority '+val(l.priority).toLowerCase()}>{val(l.priority)||'—'}</span></div><div className="crm-list-sub">{val(l.name)|| (sv?'Ingen kontakt':'No contact')} <span>·</span> {val(l.stage)||'New'}</div><p>{val(l.notes).trim()?(val(l.notes).replace(/\s+/g,' ').slice(0,105)):(val(l.company_summary)||val(l.business_need)||(sv?'Ingen anteckning':'No notes')).slice(0,105)}</p></button>)}{filtered.length===0&&<p className="crm-empty">{sv?'Inga matchande prospekt.':'No matching prospects.'}</p>}</div>
   {filtered.length>limit&&<button className="crm-more" type="button" onClick={()=>setLimit(n=>n+40)}>{sv?'Visa fler':'Show more'} ({filtered.length-limit})</button>}
  </div>
  <div className="crm-inspector">
  {!selected?<div className="crm-empty">{sv?'Välj ett prospekt för att se information.':'Select a prospect for details.'}</div>:<>
   <div className="crm-detail-head"><div><span>{val(selected.industry_category)||val(selected.industry)||(sv?'BRANSCH EJ ANGIVEN':'INDUSTRY UNKNOWN')}</span><h2>{val(selected.company_name)||(sv?'Företag ej angivet':'Company unknown')}</h2><p>{val(selected.name)||'—'}{val(selected.contact_role)?' · '+val(selected.contact_role):''}</p></div><button type="button" className="crm-edit-btn" onClick={()=>onEdit(selected)}>{sv?'Redigera företag':'Edit company'} <span>↗</span></button></div>
   <div className="crm-action-row">{val(selected.phone)&&<a className="crm-main-action" href={'tel:'+val(selected.phone)}>{sv?'Ring kontakt':'Call contact'} ↗</a>}{val(selected.email)&&<a href={'mailto:'+val(selected.email)}>E-post ↗</a>}{selectedWebsite&&<a href={selectedWebsite} target="_blank" rel="noopener noreferrer">{sv?'Webbplats':'Website'} ↗</a>}<button type="button" onClick={onBook}>{sv?'Boka möte':'Book meeting'} +</button></div>
   <div className="crm-info-grid">
    <div><span>{sv?'Affärsmodell':'Business model'}</span><strong>{val(selected.business_model)||'—'}</strong></div>
    <div><span>{sv?'Omsättning':'Revenue'} {val(selected.financial_year)}</span><strong>{money(selected.revenue_latest)}</strong></div>
    <div><span>{sv?'Resultat':'Profit / loss'}</span><strong>{money(selected.profit_latest)}</strong></div>
    <div><span>{sv?'Ort':'City'}</span><strong>{val(selected.company_city)||'—'}</strong></div>
   </div>
   <div className="crm-details-bottom">
    <div className="crm-company-section"><h3>{sv?'Om företaget':'About the company'}</h3><p>{val(selected.company_summary)||val(selected.business_focus)||val(selected.business_need)||(sv?'Ingen företagsbeskrivning inlagd ännu.':'No company description recorded yet.')}</p>{Boolean(selected.business_focus&&selected.company_summary)&&<p><strong>{sv?'Fokus:':'Focus:'}</strong> {val(selected.business_focus)}</p>}<div className="crm-minor-facts"><span>{sv?'Org.nr':'Reg. no.'}: {val(selected.organization_number)||'—'}</span><span>{sv?'Ansvar':'Assignment'}: {Array.isArray(selected.assigned_roles)?selected.assigned_roles.join(', ')||'—':'—'}</span></div>{source&&<a className="crm-source-link" href={source} target="_blank" rel="noopener noreferrer">{sv?'Källa för ekonomiska uppgifter':'Financial source'} ↗</a>}</div>
    <div className="crm-notes-section"><div className="crm-notes-heading"><h3>{sv?'Anteckningar':'Notes'}</h3><span className={dirty?'unsaved':''}>{dirty?(sv?'Ej sparat':'Unsaved'):(sv?'Synkat':'Synced')}</span></div><textarea aria-label={sv?'Företagsanteckningar':'Company notes'} value={notes} onChange={e=>{setNotes(e.target.value);setNotice('');setFailure('')}} placeholder={sv?'Anteckningar, behov, tidigare samtal och nästa steg…':'Notes, customer needs, previous calls and next steps…'} rows={7}/><button type="button" className="crm-save-notes" disabled={!dirty||busy} onClick={()=>void saveNotes()}>{busy?(sv?'Sparar…':'Saving…'):(sv?'Spara anteckningar':'Save notes')}</button></div>
   </div>
   <div className="crm-detail-footer"><label>{sv?'Pipeline-status':'Pipeline stage'}<select disabled={busy} value={val(selected.stage)||'New Prospect'} onChange={e=>void saveStage(e.target.value)}>{stages.map(stage=><option key={stage} value={stage}>{stage}</option>)}</select></label><div>{sv?'Nästa uppföljning':'Next follow-up'}: <strong>{val(selected.follow_up_at)?new Date(val(selected.follow_up_at)).toLocaleString(sv?'sv-SE':'en-GB',{dateStyle:'medium',timeStyle:'short'}):val(selected.next_follow_up)||'—'}</strong></div></div>
   {notice&&<p className="crm-feedback success" role="status">{notice}</p>}{failure&&<p className="crm-feedback error" role="alert">{failure}</p>}
  </>}
  </div>
 </section>;
}
