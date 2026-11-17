import {useEffect,useMemo,useState} from 'react';
import {supabase} from './supabase';
type Row={id:string;[key:string]:unknown};
const text=(x:unknown)=>String(x??'');
const website=(x:unknown)=>{try{const u=new URL(text(x));return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
export default function CompanyDirectory({kind,language}:{kind:'Companies'|'Contacts';language:'sv'|'en'}){
 const sv=language==='sv',table=kind==='Companies'?'companies':'contacts';
 const [rows,setRows]=useState<Row[]>([]),[companyNames,setCompanyNames]=useState<Record<string,string>>({}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const pageSize=24;
 useEffect(()=>{let active=true;setLoading(true);setError('');setPage(0);setQuery('');
  async function load(){if(!supabase)return;
   const [list,companies]=await Promise.all([supabase.from(table).select('*').order('created_at',{ascending:false}).range(0,999),supabase.from('companies').select('id,name').range(0,999)]);
   if(!active)return;
   if(list.error||companies.error){setError((list.error||companies.error)?.message||'Loading failed');setRows([])}
   else {setRows((list.data??[]) as Row[]);setCompanyNames(Object.fromEntries((companies.data??[]).map(x=>[x.id,x.name])))}
   setLoading(false);
  }
  void load();return()=>{active=false};
 },[table]);
 const filtered=useMemo(()=>rows.filter(row=>[row.name,row.website,row.industry,row.country,row.job_title,row.email,row.phone,companyNames[text(row.company_id)]].some(v=>text(v).toLocaleLowerCase().includes(query.toLocaleLowerCase()))),[rows,query,companyNames]);
 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,totalPages-1);
 return <section className="executive-directory">
  <div className="executive-directory-head"><div><small>02 / EXECUTIVE DOSSIER INDEX</small><h2>{kind==='Companies'?(sv?'Företagsregister':'Company Directory'):(sv?'Kontaktregister':'Contact Directory')}</h2><p>{sv?'Befintliga Supabase-poster. Endast de uppgifter du har rätt att se.':'Existing Supabase records, subject to database permissions.'}</p></div><span>{filtered.length} {sv?'poster':'records'}</span></div>
  <label className="executive-directory-search">{sv?'Sök företag, bransch eller kontakt':'Search company, industry or contact'}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder={sv?'Sök i registret…':'Search directory…'}/></label>
  {loading?<p role="status">{sv?'Hämtar poster…':'Loading records…'}</p>:error?<p role="alert" className="error">{error}</p>:filtered.length===0?<p>{sv?'Inga matchande poster.':'No matching records.'}</p>:<div className="executive-directory-grid">{filtered.slice(current*pageSize,(current+1)*pageSize).map(row=><article key={row.id}>
   <small>{kind==='Companies'?text(row.industry)||'COMPANY':text(row.job_title)||'CONTACT'}</small>
   <h3>{text(row.name)||'—'}</h3>
   {kind==='Companies'?<><p>{text(row.country)||'—'}</p>{text(row.notes)&&<p className="executive-directory-notes">{text(row.notes).slice(0,230)}</p>}{website(row.website)&&<a href={website(row.website)||'#'} target="_blank" rel="noopener noreferrer">{sv?'Besök webbplats':'Company website'} ↗</a>}</>:<><p>{companyNames[text(row.company_id)]|| (sv?'Företag ej angivet':'Unassigned company')}</p><p>{text(row.email)||'—'}</p>{text(row.phone)&&<a href={'tel:'+text(row.phone)}>{sv?'Ring':'Call'} ↗</a>}{text(row.email)&&<a href={'mailto:'+text(row.email)}>{sv?'Skriv mejl':'Email'} ↗</a>}</>}
  </article>)}</div>}
  {totalPages>1&&<div className="executive-directory-pages"><button type="button" className="secondary" disabled={current===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>{sv?'Föregående':'Previous'}</button><span>{current+1} / {totalPages}</span><button type="button" className="secondary" disabled={current>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>{sv?'Nästa':'Next'}</button></div>}
  {rows.length>=1000&&<p className="hint">{sv?'De första 1 000 behöriga posterna visas.':'Showing the first 1,000 authorized records.'}</p>}
 </section>;
}
