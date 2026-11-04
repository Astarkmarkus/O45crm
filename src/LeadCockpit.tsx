import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import './cockpit.css';

type Lead={id:string;[key:string]:unknown};
type Lang='sv'|'en';
const value=(x:unknown)=>String(x??'');
const safeUrl=(raw:unknown)=>{try{const u=new URL(value(raw));return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
const money=(x:unknown)=>x===null||x===undefined||x===''?null:new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:0}).format(Number(x));
const fields=['company_summary','business_focus','business_model','website_url','revenue_latest','revenue_previous','financial_year','financial_source_url'] as const;
type Field=typeof fields[number];
const buildDraft=(lead:Lead)=>Object.fromEntries(fields.map(k=>[k,value(lead[k])])) as Record<Field,string>;
export default function LeadCockpit({lead,language,owner,onRefresh}:{lead:Lead;language:Lang;owner:boolean;onRefresh:()=>Promise<void>}){
 const sv=language==='sv';
 const [note,setNote]=useState(value(lead.notes)),[savedNote,setSavedNote]=useState(value(lead.notes));
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(()=>buildDraft(lead));
 const [status,setStatus]=useState(''),[statusType,setStatusType]=useState<'success'|'error'|''>(''),[saving,setSaving]=useState(false);
 useEffect(()=>{setNote(value(lead.notes));setSavedNote(value(lead.notes));setDraft(buildDraft(lead));setStatus('');setEditing(false)},[lead.id]);
 const prior=lead.revenue_previous===null||lead.revenue_previous===undefined?null:Number(lead.revenue_previous);
 const latest=lead.revenue_latest===null||lead.revenue_latest===undefined?null:Number(lead.revenue_latest);
 const change=prior!==null&&prior>0&&latest!==null?(latest-prior)/prior*100:null;
 const link=safeUrl(lead.website_url);
 const source=safeUrl(lead.financial_source_url);
 const setField=(field:Field,next:string)=>setDraft(prev=>({...prev,[field]:next}));
 async function saveNotes(){
  if(!supabase||saving||note===savedNote)return;
  setSaving(true);setStatus('');setStatusType('');
  const {data,error}=await supabase.from('leads').update({notes:note}).eq('id',lead.id).select('id,notes').maybeSingle();
  if(error||!data||value(data.notes)!==note){setStatus((sv?'Anteckningarna sparades inte: ':'Notes were not saved: ')+(error?.message||'No confirmed database update'));setStatusType('error')}
  else {setSavedNote(note);setStatus(sv?'Anteckningarna sparade i CRM.':'Notes saved to CRM.');setStatusType('success');await onRefresh()}
  setSaving(false);
 }
 async function saveProfile(){
  if(!supabase||!owner||saving)return;
  const latestNum=draft.revenue_latest.trim()===''?null:Number(draft.revenue_latest);
  const prevNum=draft.revenue_previous.trim()===''?null:Number(draft.revenue_previous);
  const year=draft.financial_year.trim()===''?null:Number(draft.financial_year);
  if((latestNum!==null||prevNum!==null)&&(!year||year<1990||year>2100||!safeUrl(draft.financial_source_url))){
    setStatus(sv?'Ange räkenskapsår och en giltig källänk för ekonomiska siffror.':'Financial numbers require a reporting year and valid source URL.');setStatusType('error');return;
  }
  if((latestNum!==null&&!Number.isFinite(latestNum))||(prevNum!==null&&!Number.isFinite(prevNum))){
    setStatus(sv?'Ange giltiga belopp.':'Enter valid financial numbers.');setStatusType('error');return;
  }
  if(draft.website_url.trim()&&!safeUrl(draft.website_url)){setStatus(sv?'Ange en giltig webbadress inklusive https://':'Enter a valid website URL including https://');setStatusType('error');return}
  setSaving(true);setStatus('');
  const payload={company_summary:draft.company_summary||null,business_focus:draft.business_focus||null,business_model:draft.business_model||null,website_url:draft.website_url||null,revenue_latest:latestNum,revenue_previous:prevNum,financial_year:year,financial_source_url:draft.financial_source_url||null,financial_checked_at:(latestNum!==null||prevNum!==null)?new Date().toISOString():null};
  const {data,error}=await supabase.from('leads').update(payload).eq('id',lead.id).select('id').maybeSingle();
  if(error||!data){setStatus((sv?'Företagsuppgifter sparades inte: ':'Company details were not saved: ')+(error?.message||'No confirmed database update'));setStatusType('error')}
  else{setEditing(false);setStatus(sv?'Företagsuppgifterna är sparade.':'Company information saved.');setStatusType('success');await onRefresh()}
  setSaving(false);
 }
 return <div className="o45-cockpit">
  <section className="o45-brief" aria-label={sv?'Företagsinformation':'Company intelligence'}>
   <div className="o45-section-heading"><span>01 / {sv?'FÖRETAGSPROFIL':'COMPANY INTEL'}</span>{owner&&<button type="button" className="o45-quiet" onClick={()=>{setEditing(v=>!v);setDraft(buildDraft(lead))}}>{editing?(sv?'Avbryt':'Cancel'):(sv?'Redigera profil ↗':'Edit profile ↗')}</button>}</div>
   {editing?<div className="o45-company-editor">
    <label>{sv?'Vad gör företaget?':'What does the company do?'}<textarea rows={3} value={draft.company_summary} onChange={e=>setField('company_summary',e.target.value)} /></label>
    <label>{sv?'Fokus / erbjudande':'Focus / offer'}<textarea rows={2} value={draft.business_focus} onChange={e=>setField('business_focus',e.target.value)} /></label>
    <div className="o45-edit-grid"><label>{sv?'Affärsmodell':'Business model'}<select value={draft.business_model} onChange={e=>setField('business_model',e.target.value)}><option value="">{sv?'Ej verifierad':'Unknown'}</option><option value="B2B">B2B</option><option value="B2C">B2C</option><option value="B2B & B2C">B2B & B2C</option></select></label><label>{sv?'Webbplats':'Website'}<input type="url" placeholder="https://…" value={draft.website_url} onChange={e=>setField('website_url',e.target.value)}/></label></div>
    <div className="o45-edit-grid"><label>{sv?'Omsättning, senaste år (SEK)':'Latest annual revenue (SEK)'}<input type="number" step="1" value={draft.revenue_latest} onChange={e=>setField('revenue_latest',e.target.value)}/></label><label>{sv?'Omsättning, året innan (SEK)':'Prior annual revenue (SEK)'}<input type="number" step="1" value={draft.revenue_previous} onChange={e=>setField('revenue_previous',e.target.value)}/></label></div>
    <div className="o45-edit-grid"><label>{sv?'Räkenskapsår':'Financial year'}<input type="number" min="1990" max="2100" value={draft.financial_year} onChange={e=>setField('financial_year',e.target.value)}/></label><label>{sv?'Källänk (t.ex. Allabolag)':'Source URL (e.g. Allabolag)'}<input type="url" placeholder="https://…" value={draft.financial_source_url} onChange={e=>setField('financial_source_url',e.target.value)}/></label></div>
    <button className="o45-action" type="button" disabled={saving} onClick={()=>void saveProfile()}>{saving?(sv?'Sparar…':'Saving…'):(sv?'Spara företagsprofil':'Save company profile')}</button>
   </div>:<>
    <div className="o45-tags"><span>{value(lead.business_model)|| (sv?'B2B / B2C ej verifierat':'B2B / B2C unknown')}</span><span>{value(lead.industry_category)||value(lead.industry)|| (sv?'Bransch saknas':'No industry')}</span></div>
    <p className="o45-description">{value(lead.company_summary)|| (sv?'Ingen verifierad företagsbeskrivning ännu. Fyll i uppgifterna från företagets webbplats.':'No verified company description yet. Add details from the company website.')}</p>
    <div className="o45-focus"><small>{sv?'FOKUS':'BUSINESS FOCUS'}</small><p>{value(lead.business_focus)||value(lead.business_need)|| (sv?'Ingen inlagd fokusinformation.':'No business focus recorded.')}</p></div>
    <div className="o45-financial-strip">
     <div><small>{sv?'OMSÄTTNING':'REVENUE'} {value(lead.financial_year)}</small><strong>{money(lead.revenue_latest)||'—'}</strong></div>
     <div><small>{sv?'ÅRET INNAN':'PRIOR YEAR'}</small><strong>{money(lead.revenue_previous)||'—'}</strong></div>
     <div><small>{sv?'FÖRÄNDRING':'CHANGE'}</small><strong className={change===null?'':change>=0?'o45-pos':'o45-neg'}>{change===null?'—':(change>0?'+':'')+change.toFixed(1)+'%'}</strong></div>
    </div>
    <div className="o45-sources">{link?<a href={link} target="_blank" rel="noopener noreferrer">{sv?'Besök företagets webbplats ↗':'Open company website ↗'}</a>:<span>{sv?'Webbplats saknas':'No website recorded'}</span>}{source&&<a href={source} target="_blank" rel="noopener noreferrer">{sv?'Ekonomikälla ↗':'Financial source ↗'}</a>}</div>
    <small className="o45-source-note">{sv?'Ekonomiska siffror visas endast när de lagts in med källänk och räkenskapsår.':'Financial figures are displayed only when entered with a source and reporting year.'}</small>
   </>}
  </section>
  <section className="o45-notepad" aria-label={sv?'Anteckningar':'Notes'}>
   <div className="o45-section-heading"><span>02 / {sv?'ANTECKNINGAR':'NOTES'}</span><small>{note!==savedNote?(sv?'OSPARADE ÄNDRINGAR':'UNSAVED CHANGES'):(sv?'SPARAD I CRM':'SAVED IN CRM')}</small></div>
   <label className="o45-note-label" htmlFor="o45-lead-notes">{sv?'Gemensamma företagsanteckningar':'Shared company notes'}</label>
   <textarea id="o45-lead-notes" className="o45-notes-input" value={note} onChange={e=>{setNote(e.target.value);setStatus('')}} rows={9} placeholder={sv?'Skriv företagets historik, vad kunden behöver, vad som sagts…':'Company background, what the contact needs, previous conversations…'}/>
   <button type="button" className="o45-action" disabled={saving||note===savedNote} onClick={()=>void saveNotes()}>{saving?(sv?'Sparar…':'Saving…'):(sv?'Spara anteckningar':'Save notes')}</button>
   {status&&<p className={'o45-status '+statusType} role="status">{status}</p>}
   <p className="o45-hint">{sv?'Anteckningar sparas på leadet och syns för andra behöriga. Samtalslogg sparas separat.':'Notes are saved on the lead for authorized teammates. Call logs are stored separately.'}</p>
  </section>
 </div>
}
