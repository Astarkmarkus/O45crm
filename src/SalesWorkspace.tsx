import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {supabase} from './supabase';
import type {Session} from '@supabase/supabase-js';
import './sales.css';
type R={id:string;[key:string]:unknown};
type Lang='en'|'sv';
const v=(x:unknown)=>String(x??'');
const services=['Paid Advertising','Lead Generation & Appointment Setting','End-to-End Growth Management'];
const outcomes=['No Answer','Voicemail','Wrong Contact','Not Interested','Call Back','Send Information','Interested','Meeting Requested','Meeting Booked','Do Not Contact'];
const placeholders=['company_name','contact_name','industry','contact_role','service_name','market','business_need'];
const blanks='[information not provided]';
const defaultText=`Opening
Hello {{contact_name}}, this is {{seller_name}} from ONYX45. Have I caught you at a convenient time?

Company relevance
We help businesses explore opportunities in {{service_name}}.

Discovery
How are you currently approaching this area?
What would you most like to improve?

Qualification
Would it be relevant to discuss this with the person responsible for {{service_name}}?

Objections
Not interested: Understood, thank you for your time.
Already have an agency: That makes sense. What do you value most about the current setup?
No budget: Understood, perhaps there is a better time to revisit.
Send information: Of course. What would be the best topic to include?

Meeting request
Would you be open to a brief introductory conversation to see if there is a fit?

Quality check
Confirm the agreed day, local time, time zone, email, and purpose.

Closing
Thank you for your time. Have a good day.

Do not say
Never guarantee results, imply account access, invent research, or pressure a clear refusal.`;
const svText=`Öppning
Hej {{contact_name}}, det är {{seller_name}} från ONYX45. Stör jag?

Relevans
Vi hjälper företag att utforska möjligheter inom {{service_name}}.

Behovsfrågor
Hur arbetar ni med det här i dag?
Vad skulle ni helst vilja förbättra?

Kvalificering
Vem ansvarar för frågan hos er?

Invändningar
Inte intresserad: Jag förstår, tack för din tid.
Har redan en byrå: Absolut. Vad fungerar bäst i ert nuvarande samarbete?
Ingen budget: Förstår, då kanske en annan tidpunkt passar bättre.
Skicka information: Självklart. Vad vore mest relevant att ta med?

Mötesfråga
Skulle ett kort introduktionsmöte vara intressant för att se om det finns en matchning?

Kvalitetskontroll
Bekräfta dag, klockslag, tidszon, e-postadress och mötets syfte.

Avslut
Tack för din tid. Ha en fin dag!

Säg inte
Lova inte resultat, antyd inte kontotillgång eller forskning som inte skett, och respektera ett nej.`;
const t=(language:Lang,en:string,sv:string)=>language==='sv'?sv:en;
function interpolate(template:string,data:Record<string,string>){
 return template.replace(/{{([a-z_]+)}}/g,(full,key)=> {
 if(key==='seller_name')return data.seller_name||'ONYX45';
 if(!placeholders.includes(key))return full;
 return data[key]?.trim()||blanks;
 });
}
function safeMailto(email:string,subject:string,body:string){return 'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)}
export default function SalesWorkspace({session,role,language,leads,onRefresh}:{session:Session;role:string;language:Lang;leads:R[];onRefresh:()=>Promise<void>}){
 const [playbooks,setPlaybooks]=useState<R[]>([]),[playbookIndustry,setPlaybookIndustry]=useState('E-commerce'),[playbookQuestions,setPlaybookQuestions]=useState(''),[playbookObjections,setPlaybookObjections]=useState(''),[playbookAngle,setPlaybookAngle]=useState(''),[scripts,setScripts]=useState<R[]>([]),[logs,setLogs]=useState<R[]>([]),[requests,setRequests]=useState<R[]>([]),[blocked,setBlocked]=useState<R[]>([]);
 const [selected,setSelected]=useState(''),[scriptId,setScriptId]=useState(''),[tab,setTab]=useState<'prospects'|'scripts'|'requests'>('prospects');
 const [working,setWorking]=useState(false),[feedback,setFeedback]=useState(''),[step,setStep]=useState(0);
 const [notes,setNotes]=useState(''),[outcome,setOutcome]=useState('Call Back'),[followup,setFollowup]=useState('');
 const [purpose,setPurpose]=useState('Introductory discussion'),[date,setDate]=useState(''),[timezone,setTimezone]=useState('Europe/Stockholm');
 const [editing,setEditing]=useState<R|null>(null),[service,setService]=useState(services[0]),[scriptLanguage,setScriptLanguage]=useState<Lang>(language),[title,setTitle]=useState(''),[body,setBody]=useState(''),[scriptStatus,setScriptStatus]=useState('draft');
 const [meetLink,setMeetLink]=useState(''),[emailDraft,setEmailDraft]=useState('');
 const owner=role==='owner',partner=role==='sales_partner';const lead=leads.find(x=>x.id===selected);
 const stopped=blocked.some(x=>x.lead_id===selected);
 const chosenScript=useMemo(()=>scripts.find(x=>x.id===scriptId),[scripts,scriptId]);
 const relevant=scripts.filter(x=>x.status==='published'&&x.service===lead?.service&&x.language===language);
 const fallback=scripts.find(x=>x.status==='published'&&x.language===language);
 const approvedPlaybook=playbooks.find(x=>x.industry===lead?.industry&&x.language===language&&x.status==='published');
 const prepared=interpolate(v(chosenScript?.body||fallback?.body|| (language==='sv'?svText:defaultText)),{
 company_name:v(lead?.company_name),contact_name:v(lead?.name),industry:v(lead?.industry),
 contact_role:v(lead?.contact_role),service_name:v(lead?.service),market:v(lead?.market),
 business_need:v(lead?.business_need),seller_name:v(session.user.email).split('@')[0]
 });
 const recent=logs.filter(x=>x.lead_id===selected);
 async function load(){
  if(!supabase)return;
  const [a,b,c,d,pl]=await Promise.all([
   supabase.from('sales_scripts').select('*').order('updated_at',{ascending:false}),
   supabase.from('sales_call_logs').select('*').order('created_at',{ascending:false}).limit(250),
   supabase.from('sales_meeting_requests').select('*').order('created_at',{ascending:false}).limit(250),
   supabase.from('sales_suppressions').select('*'),supabase.from('sales_industry_playbooks').select('*')]);
  setScripts((a.data||[]) as R[]);setLogs((b.data||[]) as R[]);setRequests((c.data||[]) as R[]);setBlocked((d.data||[]) as R[]);setPlaybooks((pl.data||[]) as R[]);
  for(const result of [a,b,c,d,pl])if(result.error){setFeedback(result.error.message);break;}
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(lead){const script=relevant.find(x=>x.is_default)||relevant[0]||fallback;setScriptId(v(script?.id));}},[selected,language,scripts.length]);
 useEffect(()=>{if(lead)setEmailDraft(t(language,
 `Hi ${v(lead.name)||'there'},\n\nThank you for the conversation. We would be happy to discuss how ONYX45 could support ${v(lead.company_name)||'your business'} with ${v(lead.service)||'growth services'}.\n\nIf useful, we can arrange a short introductory meeting.\n\nBest regards,\nONYX45`,
 `Hej ${v(lead.name)||'!'},\n\nTack för samtalet. Vi berättar gärna mer om hur ONYX45 kan hjälpa ${v(lead.company_name)||'ert företag'} med ${v(lead.service)||'tillväxttjänster'}.\n\nOm det passar kan vi boka ett kort introduktionsmöte.\n\nVänliga hälsningar,\nONYX45`))},[selected,language]);
 async function action(fn:()=>Promise<void>){setWorking(true);setFeedback('');try{await fn()}catch(e){setFeedback(e instanceof Error?e.message:'Action failed')}finally{setWorking(false)}}
 async function savePlaybook(){if(!supabase||!owner)return;await action(async()=>{const {error}=await supabase!.from('sales_industry_playbooks').insert({industry:playbookIndustry,language:language,approved_questions:playbookQuestions,approved_objections:playbookObjections,meeting_angle:playbookAngle,status:'published',created_by:session.user.id});if(error)throw error;setFeedback('Approved industry playbook saved');setPlaybookQuestions('');setPlaybookObjections('');setPlaybookAngle('');await load();})}
 async function saveScript(publish=false){
  if(!supabase||!owner||!title.trim()||!body.trim())throw Error('Title and script text are required');
  const status=publish?'published':scriptStatus;
  if(publish&&scripts.some(x=>x.id!==editing?.id&&x.service===service&&x.language===scriptLanguage&&x.is_default&&x.status==='published')) {
   // Do not select a second default for the same service and language
  }
  let id=editing?.id;
  if(id){const {error}=await supabase.from('sales_scripts').update({title,body,service,language:scriptLanguage,status,updated_at:new Date().toISOString(),version:Number(editing?.version||1)+(publish?1:0)}).eq('id',id);if(error)throw error;}
  else{const {data,error}=await supabase.from('sales_scripts').insert({title,body,service,language:scriptLanguage,status,created_by:session.user.id}).select('id').single();if(error)throw error;id=data.id;}
  if(publish){const version=Number(editing?.version||1)+(editing?1:0);const {error}=await supabase.from('sales_script_versions').insert({script_id:id,version,body,published_by:session.user.id});if(error)throw error;}
  setEditing(null);setFeedback(publish?'Published and saved':'Draft saved');await load();
 }
 function editScript(row?:R){setEditing(row||null);setTitle(v(row?.title));setBody(v(row?.body|| (language==='sv'?svText:defaultText)));setService(v(row?.service||services[0]));setScriptLanguage(v(row?.language||language) as Lang);setScriptStatus(v(row?.status||'draft'));}
 async function saveOutcome(e:FormEvent){e.preventDefault();if(!supabase||!lead||stopped)return;
 await action(async()=>{
  const {error}=await supabase!.from('sales_call_logs').insert({lead_id:lead.id,seller_id:session.user.id,script_id:chosenScript?.id||null,script_version:chosenScript?.version||null,outcome,notes,next_follow_up:followup||null});if(error)throw error;
  if(outcome==='Do Not Contact'){
   const {error:stopErr}=await supabase!.from('sales_suppressions').upsert({lead_id:lead.id,created_by:session.user.id,reason:'Do Not Contact'});if(stopErr)throw stopErr;
  }else if(['Call Back','Send Information'].includes(outcome)&&followup){
    const {error:taskErr}=await supabase!.from('tasks').insert({title:`Follow up: ${v(lead.company_name)}`,details:notes||outcome,due_date:followup,created_by:session.user.id,assigned_to:session.user.id,status:'To Do',priority:'Medium'});if(taskErr)throw taskErr;
  }
  const stage=outcome==='Meeting Booked'?'Meeting Booked':outcome==='Interested'?'Interested':outcome==='Not Interested'?'Lost':outcome==='Call Back'?'Follow-Up':null;
  const changes:Record<string,unknown>={next_follow_up:followup||null};
  if(stage)changes.stage=stage;
  const {error:updateError}=await supabase!.from('leads').update(changes).eq('id',lead.id);if(updateError)throw updateError;
  setFeedback('Outcome recorded in CRM');setNotes('');await load();await onRefresh();
 });
 }
 async function requestMeeting(e:FormEvent){e.preventDefault();if(!supabase||!lead||stopped||!date)return;await action(async()=>{
   const {error}=await supabase!.from('sales_meeting_requests').insert({lead_id:lead.id,requested_by:session.user.id,proposed_at:new Date(date).toISOString(),timezone,purpose,notes,meeting_url:meetLink.startsWith('https://meet.proton.me/')?meetLink:null,status:'requested'});if(error)throw error;
   setFeedback('Meeting request saved for Owner approval — not yet confirmed');await load();
 });}
 async function review(row:R,status:'accepted'|'rejected'|'reschedule'){if(!supabase||!owner)return;await action(async()=>{
  if(status==='accepted'){const {error}=await supabase!.rpc('approve_sales_meeting',{p_request:row.id,p_meeting_url:v(row.meeting_url)||null});if(error)throw error;}
  else {const {error}=await supabase!.from('sales_meeting_requests').update({status,reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;}
  await load();await onRefresh();setFeedback(status==='accepted'?'Confirmed meeting saved to CRM':'Request reviewed');
 });}
 const draftSubject=t(language,'Introductory conversation with ONYX45','Introduktionsmöte med ONYX45');
 const sections=prepared.split(/\n\s*\n/);
 const meetingRows=requests.filter(x=>owner||x.requested_by===session.user.id);
 return <div className="sales-workspace">
  <div className="sales-top"><div><small>ONYX45 / SALES ENABLEMENT</small><h2>{t(language,'Sales Workspace','Säljarbetsyta')}</h2><p>{t(language,'Approved scripts, guided calls and meeting handovers','Godkända manus, samtalsstöd och mötesöverlämning')}</p></div><button className="secondary" onClick={()=>void load()}>{t(language,'Refresh','Uppdatera')}</button></div>
  <div className="sales-tabs"><button className={tab==='prospects'?'active':''} onClick={()=>setTab('prospects')}>{t(language,'My Prospects','Mina prospekt')}</button><button className={tab==='requests'?'active':''} onClick={()=>setTab('requests')}>{t(language,'Meeting Requests','Mötesförfrågningar')}</button>{owner&&<button className={tab==='scripts'?'active':''} onClick={()=>setTab('scripts')}>{t(language,'Master Scripts','Huvudmanus')}</button>}</div>
  {feedback&&<p className="sales-feedback" role="status">{feedback}</p>}
  {tab==='scripts'&&owner?<div className="sales-two"><section className="sales-panel"><div className="sales-heading"><h3>Script Library</h3><button className="secondary" onClick={()=>editScript()}>+ New script</button></div>{scripts.map(row=><div className="sales-list-item" key={row.id}><div><strong>{v(row.title)}</strong><small>{v(row.service)} · {v(row.language)} · v{v(row.version)} · {v(row.status)}{row.meeting_url?' · Proton Meet link attached':''}</small></div><button onClick={()=>editScript(row)}>Edit</button><button onClick={()=>editScript({...row,id:'',title:v(row.title)+' (copy)',status:'draft'})}>Duplicate</button></div>)}</section><section className="sales-panel"><h3>{editing?.id?'Edit master script':'New master script'}</h3><label>Title<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Service<select value={service} onChange={e=>setService(e.target.value)}>{services.map(x=><option key={x}>{x}</option>)}</select></label><label>Language<select value={scriptLanguage} onChange={e=>setScriptLanguage(e.target.value as Lang)}><option value="en">English</option><option value="sv">Svenska</option></select></label><label>Approved template<textarea rows={19} value={body} onChange={e=>setBody(e.target.value)}/></label><div className="sales-actions"><button disabled={working} className="secondary" onClick={()=>void action(()=>saveScript())}>Save draft</button><button disabled={working} className="primary" onClick={()=>void action(()=>saveScript(true))}>Publish version</button>{editing?.id&&<button onClick={()=>void action(async()=>{const {error}=await supabase!.from('sales_scripts').update({status:'archived',is_default:false}).eq('id',editing.id);if(error)throw error;await load();})}>Archive</button>}</div><p className="hint">Placeholders: {placeholders.map(x=>'{{'+x+'}}').join(', ')}. Drafts are visible only to Owner.</p><section className="sales-playbook"><h3>Industry playbooks</h3><p className="hint">Approved questions and value angles are optional; they are never treated as verified facts about a prospect.</p><select value={playbookIndustry} onChange={e=>setPlaybookIndustry(e.target.value)}>{['E-commerce','SaaS','Professional Services','Local Services','B2B Technology','Recruitment & Staffing','Hospitality','Other'].map(x=><option key={x}>{x}</option>)}</select><label>Discovery questions<textarea value={playbookQuestions} rows={3} onChange={e=>setPlaybookQuestions(e.target.value)}/></label><label>Objection responses<textarea value={playbookObjections} rows={3} onChange={e=>setPlaybookObjections(e.target.value)}/></label><label>Meeting angle<textarea value={playbookAngle} rows={3} onChange={e=>setPlaybookAngle(e.target.value)}/></label><button disabled={working} onClick={()=>void savePlaybook()}>Publish playbook</button>{playbooks.map(x=><div key={x.id} className="sales-history">{v(x.industry)} · {v(x.language)} · {v(x.status)}</div>)}</section></section></div>:
  tab==='requests'?<section className="sales-panel"><h3>{t(language,'Meeting handovers','Mötesöverlämningar')}</h3>{meetingRows.length===0&&<p className="hint">No requests yet.</p>}{meetingRows.map(row=><div className="sales-list-item" key={row.id}><div><strong>{v(leads.find(l=>l.id===row.lead_id)?.company_name)||'Prospect'}</strong><small>{new Date(v(row.proposed_at)).toLocaleString(language==='sv'?'sv-SE':'en-GB')} · {v(row.timezone)} · {v(row.purpose)} · {v(row.status)}</small></div>{owner&&row.status==='requested'&&<div className="sales-actions"><button onClick={()=>void review(row,'accepted')}>Accept</button><button onClick={()=>void review(row,'reschedule')}>Reschedule</button><button onClick={()=>void review(row,'rejected')}>Reject</button></div>}</div>)}</section>:
  <div className="sales-two"><section className="sales-panel"><h3>{t(language,'Select prospect','Välj prospekt')}</h3>{leads.length===0&&<p className="hint">No assigned prospects yet.</p>}{leads.map(row=><button className={'sales-prospect '+(selected===row.id?'selected':'')} key={row.id} onClick={()=>{setSelected(row.id);setStep(0);setNotes('');setFeedback('')}}><strong>{v(row.company_name)||'Unnamed company'}</strong><span>{v(row.name)||'Contact missing'}</span><small>{v(row.service)} · {v(row.stage)}</small>{blocked.some(x=>x.lead_id===row.id)&&<small>DO NOT CONTACT</small>}</button>)}</section>
  {lead?<section className="sales-panel sales-detail"><div className="sales-heading"><div><h3>{v(lead.company_name)}</h3><p>{v(lead.name)} · {v(lead.email)} · {v(lead.service)}</p></div><span className="sales-step">Stage {step+1}/5</span></div>{stopped?<p className="sales-stop">Do Not Contact — outreach is disabled for this prospect.</p>:<>
  <div className="sales-actions sales-step-buttons">{['Opening','Discovery','Qualification','Objections','Meeting & Wrap-up'].map((x,i)=><button key={x} className={step===i?'active':''} onClick={()=>setStep(i)}>{i+1}. {x}</button>)}</div>
  {step===0&&<><h4>{t(language,'Prepare call','Förbered samtal')}</h4><select aria-label="Approved script" value={scriptId} onChange={e=>setScriptId(e.target.value)}><option value="">{t(language,'Built-in starter script (not owner-approved)','Startmanus (ej godkänt av Owner)')}</option>{relevant.map(x=><option key={x.id} value={x.id}>{v(x.title)} · v{v(x.version)}</option>)}</select>{partner&&!chosenScript&&<p className="hint">An Owner-approved script is required before calling. The sample below is a preview only.</p>}<pre className="sales-script">{prepared}</pre><button className="secondary" disabled={partner&&!chosenScript} onClick={()=>void navigator.clipboard.writeText(prepared)}>Copy approved script</button><button className="primary" disabled={partner&&!chosenScript} onClick={()=>setStep(1)}>Start Guided Call →</button></>}
  {step===1&&<><h4>Discovery</h4>{approvedPlaybook&&<div className="sales-script">{v(approvedPlaybook.approved_questions)}</div>}<pre className="sales-script">{sections.filter(x=>/discovery|behovsfrågor/i.test(x)).join('\n\n')||prepared}</pre><label>Call notes<textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What did you learn?"/></label><button onClick={()=>setStep(2)}>Next →</button></>}
  {step===2&&<><h4>Qualification</h4>{['Right company?','Correct decision maker?','Relevant need?','Interested in a meeting?','Timing or constraints?'].map(x=><label key={x}><input type="checkbox"/> {x}</label>)}<label>Notes<textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button onClick={()=>setStep(3)}>Next →</button></>}
  {step===3&&<><h4>Objections</h4>{approvedPlaybook&&<div className="sales-script">{v(approvedPlaybook.approved_objections)}</div>}<p className="hint">Use your approved script. A clear refusal means stop outreach.</p>{['Not interested','Already working with an agency','No current budget','Send information','Bad timing','Another decision-maker'].map(x=><details key={x}><summary>{x}</summary><p>{t(language,'Acknowledge the objection; ask only a relevant, respectful follow-up question. Do not invent business facts.','Bekräfta invändningen och ställ bara relevanta, respektfulla följdfrågor. Hitta inte på företagsfakta.')}</p></details>)}<button onClick={()=>setStep(4)}>Next →</button></>}
  {step===4&&<><h4>Wrap up / Follow-up</h4><form onSubmit={e=>void saveOutcome(e)}><label>Call outcome<select value={outcome} onChange={e=>setOutcome(e.target.value)}>{outcomes.map(x=><option key={x}>{x}</option>)}</select></label><label>Next follow-up (optional)<input type="date" value={followup} onChange={e=>setFollowup(e.target.value)}/></label><label>Notes<textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="primary" disabled={working||partner&&!chosenScript}>Save call outcome</button></form><hr/><h4>Request a meeting</h4><form onSubmit={e=>void requestMeeting(e)}><label>Proposed local date & time<input required type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Timezone<input value={timezone} onChange={e=>setTimezone(e.target.value)}/></label><label>Purpose<input value={purpose} onChange={e=>setPurpose(e.target.value)}/></label><button disabled={working||partner&&!chosenScript}>Send request to Owner (not confirmed)</button></form></>}
  <div className="sales-integrations"><h4>Proton Mail & Proton Meet</h4><p className="hint">Manual handoff only — no email or invitation is sent automatically.</p><label>Email draft<textarea rows={7} value={emailDraft} onChange={e=>setEmailDraft(e.target.value)}/></label><div className="sales-actions"><button onClick={()=>void navigator.clipboard.writeText(emailDraft)}>Copy email</button><a href={safeMailto(v(lead.email),draftSubject,emailDraft)}>Open mail app draft</a><a href="https://mail.proton.me" target="_blank" rel="noopener noreferrer">Open Proton Mail</a></div><p className="hint">Copy the draft into Proton Mail and send it yourself.</p><label>Proton Meet link (paste after creating in Proton)<input type="url" value={meetLink} onChange={e=>setMeetLink(e.target.value)} placeholder="https://meet.proton.me/..."/></label><div className="sales-actions"><a href="https://meet.proton.me/" target="_blank" rel="noopener noreferrer">Create a Proton Meet link</a>{meetLink.startsWith('https://meet.proton.me/')&&<button onClick={()=>void navigator.clipboard.writeText(meetLink)}>Copy Meet link</button>}</div></div>
  <h4>Interaction history</h4>{recent.length===0&&<p className="hint">No calls logged.</p>}{recent.map(x=><div className="sales-history" key={x.id}><strong>{v(x.outcome)}</strong><small>{new Date(v(x.created_at)).toLocaleString()}</small><p>{v(x.notes)}</p></div>)}
  </>}</section>:<section className="sales-panel sales-welcome"><h3>{t(language,'Ready for your next call','Redo för nästa samtal')}</h3><p>{t(language,'Select an assigned prospect to prepare your approved script.','Välj ett prospekt och förbered ditt godkända manus.')}</p></section>}</div>}
 </div>;
}
