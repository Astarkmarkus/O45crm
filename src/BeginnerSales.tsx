import {useEffect,useMemo,useState,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {supabase} from './supabase';
import './beginner-sales.css';
import {industryCategory} from './industry';
type Row={id:string;[key:string]:unknown};
type Lang='en'|'sv';
const str=(x:unknown)=>String(x??'');
const labels={
 en:{home:'My Sales Day',prospects:'My Prospects',meetings:'My Meetings',followups:'Follow-Ups',next:'Call Next Prospect',save:'Save Outcome',done:'Next Prospect',noanswer:'No Answer',callback:'Call Back',interested:'Interested',book:'Book Meeting',not:'Not Interested',stop:'Do Not Contact',notes:'Call notes',date:'Follow-up date',request:'Request meeting',more:'Call guidance',onboard:'1. Open a prospect. 2. Read the script. 3. Save an outcome. 4. Continue.',empty:'No eligible prospects assigned to you.',saved:'Outcome saved.',pending:'Meeting request saved for Owner review — not confirmed.',today:'Today’s follow-ups',upcoming:'Upcoming meetings',assigned:'Assigned prospects'},
 sv:{home:'Min säljdag',prospects:'Mina prospekt',meetings:'Mina möten',followups:'Uppföljningar',next:'Ring nästa prospekt',save:'Spara resultat',done:'Nästa prospekt',noanswer:'Inget svar',callback:'Ring tillbaka',interested:'Intresserad',book:'Boka möte',not:'Inte intresserad',stop:'Kontakta inte',notes:'Samtalsanteckningar',date:'Datum för uppföljning',request:'Skicka mötesförfrågan',more:'Samtalsstöd',onboard:'1. Öppna ett prospekt. 2. Läs manuset. 3. Spara resultatet. 4. Fortsätt.',empty:'Du har inga tilldelade prospekt att ringa.',saved:'Resultatet är sparat.',pending:'Mötesförfrågan sparad för Owner att granska – ännu inte bekräftad.',today:'Dagens uppföljningar',upcoming:'Kommande möten',assigned:'Tilldelade prospekt'}
};
const replaceApproved=(source:string,lead:Row,seller:string)=>source.replace(/{{([a-z_]+)}}/g,(all,key)=>{
 const fields:Record<string,string>={company_name:str(lead.company_name),contact_name:str(lead.name),industry:str(lead.industry),contact_role:str(lead.contact_role),service_name:str(lead.service),market:str(lead.market),business_need:str(lead.business_need),seller_name:seller};
 return Object.prototype.hasOwnProperty.call(fields,key)?fields[key]||'[not provided]':all;
});
export default function BeginnerSales({session,role,language,leads,onRefresh}:{session:Session;role:string;language:Lang;leads:Row[];onRefresh:()=>Promise<void>}){
 const L=labels[language],uid=session.user.id;
 const [page,setPage]=useState<'day'|'prospects'|'meetings'|'followups'>('day');
 const [queueOpen,setQueueOpen]=useState(false),[queueSearch,setQueueSearch]=useState(''),[queueFilter,setQueueFilter]=useState<'all'|'followup'|'high'>('all'),[selected,setSelected]=useState(''),[completed,setCompleted]=useState<string[]>([]),[skipped,setSkipped]=useState<string[]>([]);
 const [scripts,setScripts]=useState<Row[]>([]),[playbooks,setPlaybooks]=useState<Row[]>([]),[blocked,setBlocked]=useState<string[]>([]),[meetings,setMeetings]=useState<Row[]>([]),[callLogs,setCallLogs]=useState<Row[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[intro,setIntro]=useState(()=>localStorage.getItem('o45_sales_intro')!=='done');
 const [meetingDuration,setMeetingDuration]=useState(30),[slotState,setSlotState]=useState<'idle'|'checking'|'free'|'busy'|'error'>('idle'),[meetingFormat,setMeetingFormat]=useState<'Online'|'In person'>('Online'),[meetingLocation,setMeetingLocation]=useState(''),[meetingLink,setMeetingLink]=useState(''),[outcome,setOutcome]=useState(''),[notes,setNotes]=useState(''),[followup,setFollowup]=useState(''),[meetDate,setMeetDate]=useState(''),[purpose,setPurpose]=useState('Introductory call'),[timezone,setTimezone]=useState('Europe/Stockholm');
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'});
 const eligible=useMemo(()=>leads.filter(x=>{
 const dueDate=str(x.next_follow_up);
 const handledToday=callLogs.some(log=>log.lead_id===x.id&&new Date(str(log.created_at)).toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'})===new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'}));
 return (role==='owner'||x.owner_id===uid||x.assigned_to===uid||(Array.isArray(x.assigned_roles)&&x.assigned_roles.includes(role)))&&!blocked.includes(x.id)&&!completed.includes(x.id)&&!['Won','Lost'].includes(str(x.stage))&&(!dueDate||dueDate<=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'}))&&!handledToday;
 }),[leads,role,uid,blocked,completed,callLogs]);
 const priority=(x:Row)=>({High:0,Medium:1,Low:2}[str(x.priority) as 'High'|'Medium'|'Low']??3);
 const available=useMemo(()=>[...eligible].sort((a,b)=>{
 const dueA=Boolean(a.next_follow_up),dueB=Boolean(b.next_follow_up);
 if(dueA!==dueB)return dueA?-1:1;
 if(dueA&&dueB&&a.next_follow_up!==b.next_follow_up)return str(a.next_follow_up).localeCompare(str(b.next_follow_up));
 return priority(a)-priority(b)||str(a.last_contacted_at||a.created_at).localeCompare(str(b.last_contacted_at||b.created_at))||a.id.localeCompare(b.id);
 }),[eligible]);
 const queue=available.filter(x=>!skipped.includes(x.id));
 const drawerLeads=queue.filter(x=>(queueFilter==='all'||(queueFilter==='followup'&&Boolean(x.next_follow_up))||(queueFilter==='high'&&x.priority==='High'))&&[x.company_name,x.name,x.service].some(y=>str(y).toLowerCase().includes(queueSearch.toLowerCase())));
 useEffect(()=>{if(!queueOpen)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setQueueOpen(false)};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[queueOpen]);
 const lead=leads.find(x=>x.id===selected&&(role==='owner'||x.owner_id===uid||x.assigned_to===uid||(Array.isArray(x.assigned_roles)&&x.assigned_roles.includes(role))));
 const matching=scripts.find(x=>x.status==='published'&&x.language===language&&x.service===lead?.service&&x.is_default)
 ||scripts.find(x=>x.status==='published'&&x.language===language&&x.service===lead?.service)
 ||null;
 const playbook=playbooks.find(x=>x.status==='published'&&x.language===language&&x.industry===(str(lead?.industry_category)||industryCategory(lead?.industry)));
 const script=lead&&matching?replaceApproved(str(matching.body),lead,str(session.user.email).split('@')[0]):'';
 const followupLabel=(row:Row)=>row.follow_up_at?new Date(str(row.follow_up_at)).toLocaleString(language==='sv'?'sv-SE':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Stockholm'}):str(row.next_follow_up);
 const due=queue.filter(x=>x.next_follow_up&&str(x.next_follow_up)<=today);
 const upcoming=meetings.filter(x=>x.starts_at&&new Date(str(x.starts_at)).getTime()>=Date.now()&&x.status!=='Cancelled').sort((a,b)=>str(a.starts_at).localeCompare(str(b.starts_at)));
 const [lastSaved,setLastSaved]=useState(false);
 useEffect(()=>{if(outcome!=='Meeting Requested'||!meetDate||!supabase){setSlotState('idle');return}
 const candidate=new Date(meetDate);
 if(!Number.isFinite(candidate.getTime())||candidate.getTime()<=Date.now()){setSlotState('idle');return}
 let disposed=false;setSlotState('checking');
 void supabase.rpc('sales_check_meeting_slot',{p_starts_at:candidate.toISOString(),p_duration_minutes:meetingDuration}).then(({data,error})=>{if(!disposed)setSlotState(error?'error':data?'free':'busy')});
 return()=>{disposed=true};
 },[outcome,meetDate,meetingDuration]);
 const todayCalls=callLogs.filter(x=>new Date(str(x.created_at)).toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'})===today);
 const todayMeetings=todayCalls.filter(x=>x.outcome==='Meeting Requested').length;
 async function reload(){
  if(!supabase)return;
  setLoading(true);setError('');
  const [a,b,c,d,e]=await Promise.all([
   supabase.from('sales_scripts').select('id,service,language,status,body,is_default,version').eq('status','published'),
   supabase.from('sales_industry_playbooks').select('industry,language,status,approved_questions,approved_objections,meeting_angle').eq('status','published'),
   supabase.from('sales_suppressions').select('lead_id'),
   supabase.from('meetings').select('id,title,starts_at,status,meeting_url').order('starts_at',{ascending:true}).limit(100),
   supabase.from('sales_call_logs').select('id,lead_id,outcome,created_at').eq('seller_id',uid).gte('created_at',new Date(Date.now()-48*60*60*1000).toISOString()).order('created_at',{ascending:false}).limit(5000)
  ]);
  const err=[a,b,c,d,e].find(x=>x.error)?.error;
  if(err)setError(err.message);
  else{setScripts((a.data||[]) as Row[]);setPlaybooks((b.data||[]).map((x,index)=>({...x,id:String(index)})) as Row[]);setBlocked((c.data||[]).map(x=>str(x.lead_id)));setMeetings((d.data||[]) as Row[]);setCallLogs((e.data||[]) as Row[]);}
  setLoading(false);
 }
 useEffect(()=>{void reload()},[uid]);
 function open(row:Row){setQueueOpen(false);setSelected(row.id);setPage('prospects');setOutcome('');setNotes('');setFollowup('');setMeetDate('');setMeetingDuration(30);setSlotState('idle');setMeetingLocation('');setMeetingLink('');setSuccess('');setError('');setLastSaved(false);}
 function next(){const candidate=queue.find(x=>x.id!==selected);if(candidate)open(candidate);else{setSelected('');setPage('day');setSuccess('');setLastSaved(false)}}
 async function save(e:FormEvent){
  e.preventDefault();if(!supabase||!lead||!outcome||saving||lastSaved)return;
  if(outcome==='Call Back'&&(!followup||new Date(followup).getTime()<=Date.now())){setError(L.date+' required');return}
  if(outcome==='Meeting Requested'&&meetingFormat==='In person'&&!meetingLocation.trim()){setError('Meeting location required');return}
  if(outcome==='Meeting Requested'&&slotState!=='free'){setError(language==='sv'?'Välj en ledig mötestid.':'Choose an available meeting time.');return}
  if(outcome==='Meeting Requested'&&!meetDate){setError('Meeting date and time required');return}
  if(outcome==='Do Not Contact'&&!window.confirm(language==='sv'?'Bekräfta att prospektet inte får kontaktas igen?':'Confirm that this prospect should not be contacted again?'))return;
  setSaving(true);setError('');setSuccess('');
  try{
   const savedLeadId=lead.id;
   const {error:saveError}=await supabase.rpc('sales_finish_call',{
    p_lead_id:savedLeadId,p_outcome:outcome,p_notes:notes,p_followup:outcome==='Call Back'?followup.slice(0,10):null,p_followup_at:outcome==='Call Back'?new Date(followup).toISOString():null,
    p_meeting_at:outcome==='Meeting Requested'?new Date(meetDate).toISOString():null,
    p_timezone:timezone,p_purpose:purpose,p_duration_minutes:meetingDuration,p_script_id:matching?.id||null,
    p_script_version:matching?.version||null
   });
   if(saveError)throw saveError;
   if(outcome==='Meeting Requested'){
    const {error:detailsError}=await supabase.rpc('sales_set_meeting_details',{p_lead:savedLeadId,p_format:meetingFormat,p_location:meetingFormat==='In person'?meetingLocation:null,p_url:meetingFormat==='Online'?meetingLink:null});
    if(detailsError)throw new Error('Meeting request saved, but its location or link could not be updated. Check My Meetings before retrying: '+detailsError.message);
   }
   setCompleted(ids=>ids.includes(savedLeadId)?ids:[...ids,savedLeadId]);
   if(outcome==='Do Not Contact')setBlocked(ids=>ids.includes(savedLeadId)?ids:[...ids,savedLeadId]);
   setLastSaved(true);setSuccess(outcome==='Meeting Requested'?L.pending:L.saved);
   await onRefresh();await reload();
  }catch(err){setError(err instanceof Error?err.message:'Save failed — review the records before retrying.')}finally{setSaving(false)}
 }
 const buttons:[string,string][]=[['No Answer',L.noanswer],['Call Back',L.callback],['Interested',L.interested],['Meeting Requested',L.book],['Not Interested',L.not]];
 return <div className="bs-root">
  <header className="bs-header"><div><small>ONYX45 / SALES</small><h2>{L.home}</h2><p>{language==='sv'?'Boka möten, utan krångliga verktyg.':'Book meetings without complicated tools.'}</p></div><button className="secondary" disabled={loading} onClick={()=>void reload()}>↻ {language==='sv'?'Uppdatera':'Refresh'}</button></header>
  <nav className="bs-navigation" aria-label="Sales views">{([['day',L.home],['prospects',L.prospects],['meetings',L.meetings],['followups',L.followups]] as const).map(([key,label])=><button key={key} className={page===key?'active':''} onClick={()=>{setPage(key);if(key!=='prospects')setSelected('')}}>{label}</button>)}</nav>
  {intro&&<div className="bs-onboard"><div><strong>{language==='sv'?'Välkommen! Så börjar du':'Welcome! Here is how to start'}</strong><p>{L.onboard}</p></div><button onClick={()=>{localStorage.setItem('o45_sales_intro','done');setIntro(false)}}>{language==='sv'?'Jag förstår':'Got it'}</button></div>}
  {error&&<p className="bs-error" role="alert">{error}</p>}
  {success&&<p className="bs-success" role="status">{success}</p>}
  {loading?<div className="bs-empty" role="status">{language==='sv'?'Hämtar dina prospekt…':'Loading your prospects…'}</div>:
  page==='day'?<><div className="bs-stats"><div><small>{L.today}</small><strong>{due.length}</strong></div><div><small>{L.assigned}</small><strong>{available.length}</strong></div><div><small>{L.upcoming}</small><strong>{upcoming.length}</strong></div><div><small>{language==='sv'?'Samtal registrerade idag':'Calls saved today'}</small><strong>{todayCalls.length}</strong></div><div><small>{language==='sv'?'Mötesförslag idag':'Meeting requests today'}</small><strong>{todayMeetings}</strong></div></div><button className="bs-hero-action" disabled={!queue.length} onClick={()=>queue.length&&open(due[0]||queue[0])}>{L.next} →</button>{!available.length&&<p className="bs-empty">{L.empty}</p>}<section className="bs-summary"><h3>{L.today}</h3>{due.length?due.slice(0,5).map(x=><button key={x.id} onClick={()=>open(x)}>{str(x.company_name)} <span>{followupLabel(x)}</span></button>):<p>{language==='sv'?'Inga uppföljningar i dag.':'Nothing due today.'}</p>}</section></>:
  page==='meetings'?<section className="bs-summary"><h3>{L.upcoming}</h3>{upcoming.length?upcoming.map(m=><div key={m.id} className="bs-meeting"><strong>{str(m.title)}</strong><span>{new Date(str(m.starts_at)).toLocaleString(language==='sv'?'sv-SE':'en-GB')}</span>{str(m.meeting_url).startsWith('https://')&&<a target="_blank" rel="noopener noreferrer" href={str(m.meeting_url)}>Join meeting</a>}</div>):<p>{language==='sv'?'Inga kommande möten.':'No upcoming meetings.'}</p>}</section>:
  page==='followups'?<section className="bs-summary"><h3>{L.followups}</h3>{available.filter(x=>x.next_follow_up).sort((a,b)=>str(a.next_follow_up).localeCompare(str(b.next_follow_up))).map(x=><button key={x.id} onClick={()=>open(x)}>{str(x.company_name)} <span>{followupLabel(x)}</span></button>)}</section>:
  !lead?<section className="bs-focus"><div className="bs-focus-icon">☎</div><h3>{language==='sv'?'Redo för nästa samtal':'Ready for your next call'}</h3><p>{language==='sv'?'Ditt nästa prioriterade prospekt är redo. Öppna ett samtal eller välj i kön.':'Your next prioritized prospect is ready. Start a call or choose from the queue.'}</p><div className="bs-focus-actions"><button className="bs-hero-action" disabled={!queue.length} onClick={()=>queue.length&&open(due[0]||queue[0])}>{L.next} →</button><button className="bs-queue-button" onClick={()=>setQueueOpen(true)}>{language==='sv'?'Öppna prospektkö':'Open prospect queue'} ({queue.length})</button></div>{!queue.length&&<p className="bs-empty">{L.empty}</p>}</section>:
  <div className="bs-call">
   <div className="bs-prospect-head"><div><button className="bs-back" onClick={()=>{setSelected('');setSuccess('');setLastSaved(false)}}>← {L.prospects}</button><h3>{str(lead.company_name)}</h3><p>{str(lead.name)||'Contact not set'} · {str(lead.contact_role)||'Role not set'}</p><p>{str(lead.industry)||'Industry not set'} · {str(lead.service)}</p>{Boolean(lead.phone)&&<a href={'tel:'+str(lead.phone)}>{str(lead.phone)}</a>}</div>{Boolean(lead.phone)&&<a className="bs-call-button" href={'tel:'+str(lead.phone)}>{language==='sv'?'Ring':'Call'} ↗</a>}</div>
   <div className="bs-skip-row"><button className="bs-queue-button" onClick={()=>setQueueOpen(true)}>{language==='sv'?'Prospektkö':'Queue'} ({queue.length})</button><button className="secondary" onClick={()=>{const nextLead=queue.find(x=>x.id!==lead.id);setSkipped(ids=>[...ids,lead.id]);if(nextLead)open(nextLead);else{setSelected('');setPage('day')}}}>{language==='sv'?'Hoppa över tillfälligt':'Skip for now'} →</button></div><div className="bs-work-columns"><section className="bs-script-panel"><h4>{language==='sv'?'Ditt samtalsmanus':'Your calling script'}</h4>{matching?<><div className="bs-script">{script}</div></>:<p className="bs-empty">{language==='sv'?'Inget publicerat manus matchar tjänsten och språket. Be Owner publicera ett manus innan du ringer.':'No approved script matches this service and language. Ask Owner to publish one before calling.'}</p>}
</section><aside className="bs-playbook-panel"><div className="bs-playbook-header"><small>ONYX45 / INDUSTRY PLAYBOOK</small><h4>{language==='sv'?'Samtalsstöd':'Call guidance'}</h4><p>{str(lead.industry_category)||industryCategory(lead.industry)||'Uncategorized'}</p></div>{playbook?<><p className="bs-playbook-available">{language==='sv'?'Godkänd playbook kopplad':'Approved playbook connected'} · {language.toUpperCase()}</p><details open><summary>{language==='sv'?'Behovsfrågor':'Discovery questions'}</summary><p>{str(playbook.approved_questions)||'No additional questions.'}</p></details><details><summary>{language==='sv'?'Invändningar':'Common objections'}</summary><p>{str(playbook.approved_objections)||'No additional objection answers.'}</p></details><details><summary>{language==='sv'?'Mötesfråga':'Meeting booking wording'}</summary><p>{str(playbook.meeting_angle)||'Refer to the master script.'}</p></details></>:<div className="bs-playbook-empty">{language==='sv'?'Ingen godkänd playbook finns för den här kategorin och språket. Använd huvudmanuset.':'No approved playbook for this category and language. Use the master script.'}</div>}</aside>
   <section className="bs-outcome-panel"><h4>{language==='sv'?'Hur gick samtalet?':'How did the call go?'}</h4>{lastSaved?<><p className="bs-success">{success||L.saved}</p><button className="bs-hero-action" onClick={next}>{L.done} →</button></>:<form onSubmit={e=>void save(e)}><div className="bs-outcomes">{buttons.map(([key,label])=><button type="button" aria-pressed={outcome===key} className={outcome===key?'chosen':''} key={key} onClick={()=>{setOutcome(key);setError('')}}>{label}</button>)}</div><button className="bs-dnc" type="button" aria-pressed={outcome==='Do Not Contact'} onClick={()=>setOutcome('Do Not Contact')}>{L.stop}</button>
   {outcome==='Call Back'&&<label>{language==='sv'?'Datum och tid för återuppringning':'Callback date and time'}<input type="datetime-local" required min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={followup} onClick={e=>{try{e.currentTarget.showPicker()}catch{}}} onChange={e=>setFollowup(e.target.value)}/><span className="bs-hint">{language==='sv'?'Sparas i uppföljningar och Tasks.':'Saved in follow-ups and tasks.'}</span></label>}
   {outcome==='Meeting Requested'&&<><label>{language==='sv'?'Föreslagen mötestid':'Proposed meeting time'}<input type="datetime-local" required value={meetDate} onClick={e=>{try{e.currentTarget.showPicker()}catch{}}} onChange={e=>setMeetDate(e.target.value)}/></label><label>{language==='sv'?'Möteslängd':'Meeting duration'}<select value={meetingDuration} onChange={e=>setMeetingDuration(Number(e.target.value))}>{[15,30,45,60].map(n=><option key={n} value={n}>{n} min</option>)}</select></label>{meetDate&&<div className={'bs-slot-status bs-slot-'+slotState} role="status">{slotState==='checking'?(language==='sv'?'Kontrollerar mötestiden…':'Checking availability…'):slotState==='busy'?(language==='sv'?'Tiden är redan upptagen – välj en annan.':'That slot is already taken — choose another.'):slotState==='free'?(language==='sv'?'Tiden är preliminärt ledig.':'Slot appears available.'):slotState==='error'?(language==='sv'?'Kunde inte kontrollera tillgänglighet.':'Could not check availability.'):(language==='sv'?'Välj en framtida tid.':'Choose a future time.')}</div>}<label>{language==='sv'?'Syfte':'Purpose'}<input value={purpose} onChange={e=>setPurpose(e.target.value)}/></label><label>{language==='sv'?'Tidszon':'Time zone'}<input value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label>{language==='sv'?'Mötestyp':'Meeting format'}<select value={meetingFormat} onChange={e=>setMeetingFormat(e.target.value as 'Online'|'In person')}><option>Online</option><option>In person</option></select></label>{meetingFormat==='In person'?<label>{language==='sv'?'Plats':'Location'}<input value={meetingLocation} onChange={e=>setMeetingLocation(e.target.value)} required/></label>:<label>Proton Meet URL (optional)<input type="url" placeholder="https://meet.proton.me/…" value={meetingLink} onChange={e=>setMeetingLink(e.target.value)}/><a href="https://meet.proton.me/" target="_blank" rel="noopener noreferrer">Create Meet link ↗</a></label>}<p className="bs-hint">{language==='sv'?'Ägaren måste godkänna mötet först.':'Owner must approve the meeting first.'}</p></>}
   <label>{L.notes}<textarea value={notes} rows={4} onChange={e=>setNotes(e.target.value)} placeholder={language==='sv'?'Kort sammanfattning':'Short summary'}/></label><button className="bs-hero-action" type="submit" disabled={!matching||!outcome||saving||(outcome==='Meeting Requested'&&slotState!=='free')}>{saving?'Saving…':L.save}</button></form>}
   <details><summary>{language==='sv'?'Senaste aktiviteter':'Recent interactions'}</summary>{callLogs.filter(x=>x.lead_id===lead.id).slice(0,8).map(x=><p key={x.id}>{str(x.outcome)} · {new Date(str(x.created_at)).toLocaleString()}</p>)}</details>
   </section></div></div>}
 {queueOpen&&<div className="bs-queue-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setQueueOpen(false)}}><aside className="bs-queue-drawer" role="dialog" aria-modal="true" aria-label={language==='sv'?'Prospektkö':'Prospect queue'}><div className="bs-queue-top"><div><small>ONYX45 / SALES</small><h3>{language==='sv'?'Prospektkö':'Prospect queue'} <span>{queue.length}</span></h3></div><button aria-label={language==='sv'?'Stäng kön':'Close queue'} onClick={()=>setQueueOpen(false)}>✕</button></div><input autoFocus aria-label={language==='sv'?'Sök prospekt':'Search prospects'} placeholder={language==='sv'?'Sök företag eller kontakt…':'Search company or contact…'} value={queueSearch} onChange={e=>setQueueSearch(e.target.value)}/><div className="bs-queue-filters"><button className={queueFilter==='all'?'active':''} onClick={()=>setQueueFilter('all')}>{language==='sv'?'Alla':'All'}</button><button className={queueFilter==='followup'?'active':''} onClick={()=>setQueueFilter('followup')}>{language==='sv'?'Uppföljningar':'Follow-ups'}</button><button className={queueFilter==='high'?'active':''} onClick={()=>setQueueFilter('high')}>{language==='sv'?'Hög prioritet':'High priority'}</button></div><div className="bs-queue-items">{drawerLeads.length?drawerLeads.map((x,i)=><button key={x.id} className={x.id===selected?'selected':''} onClick={()=>open(x)}><span className="bs-queue-index">{i+1}</span><span><strong>{str(x.company_name)||'Company missing'}</strong><small>{str(x.name)||'Contact missing'} · {str(x.service)}</small>{Boolean(x.next_follow_up)&&<small className="bs-queue-due">{language==='sv'?'Uppföljning':'Follow-up'}: {followupLabel(x)}</small>}</span>{x.priority==='High'&&<span className="bs-queue-high">HIGH</span>}</button>):<p className="bs-empty">{language==='sv'?'Inga prospekt matchar filtren.':'No prospects match these filters.'}</p>}</div><p className="bs-queue-footer">{language==='sv'?'Prospekt som inte är redo för kontakt visas inte i kön.':'Prospects not ready for contact are excluded from this queue.'}</p></aside></div>}
 </div>;
}
