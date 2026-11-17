type Row={id:string;[key:string]:unknown};
const num=(x:unknown)=>Number(x)||0;
const txt=(x:unknown)=>String(x??'');
const SEK=new Intl.NumberFormat('sv-SE',{style:'currency',currency:'SEK',maximumFractionDigits:0});
export default function Reports({leads,meetings,calls,finances,language}:{leads:Row[];meetings:Row[];calls:Row[];finances:Row[];language:'sv'|'en'}){
 const sv=language==='sv';
 const now=new Date();
 const months=Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-(5-i),1);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString(sv?'sv-SE':'en-GB',{month:'short',year:'2-digit'})}});
 const paid=months.map(m=>({label:m.label,key:m.key,amount:finances.filter(f=>txt(f.paid_at).slice(0,7)===m.key).reduce((sum,f)=>sum+num(f.paid_amount),0)}));
 const max=Math.max(1,...paid.map(x=>x.amount));
 const active=leads.filter(l=>!['Won','Lost'].includes(txt(l.stage))).length;
 const won=leads.filter(l=>l.stage==='Won').length;
 const due=leads.filter(l=>l.next_follow_up&&txt(l.next_follow_up)<new Date().toISOString().slice(0,10)&&!['Won','Lost'].includes(txt(l.stage))).length;
 const booked=meetings.filter(m=>['Confirmed','Completed'].includes(txt(m.status))).length;
 const invoiced=finances.reduce((sum,x)=>sum+num(x.invoiced_amount),0);
 const received=finances.reduce((sum,x)=>sum+num(x.paid_amount),0);
 return <section className="executive-report">
  <div className="executive-directory-head"><div><small>ONYX45 / GROWTH INTELLIGENCE</small><h2>{sv?'Operativ rapport':'Operations Report'}</h2><p>{sv?'Endast registrerade uppgifter, inga prognoser eller fiktiva siffror.':'Recorded CRM data only; no simulated forecasts.'}</p></div></div>
  <div className="executive-report-kpis">{[
   {name:sv?'Aktiva leads':'Active leads',value:String(active)},
   {name:sv?'Vunna affärer':'Won deals',value:String(won)},
   {name:sv?'Genomförda eller bekräftade möten':'Completed / confirmed meetings',value:String(booked)},
   {name:sv?'Förfallna uppföljningar':'Overdue follow-ups',value:String(due)},
   {name:sv?'Samtalsloggar senaste 7 dagarna':'Calls recorded in the last 7 days',value:String(calls.length)},
   {name:sv?'Fakturerat':'Invoiced',value:SEK.format(invoiced)},
   {name:sv?'Registrerat betalt':'Recorded paid',value:SEK.format(received)}
  ].map(k=><article key={k.name}><small>{k.name}</small><strong>{k.value}</strong></article>)}</div>
  <h3>{sv?'Registrerade inbetalningar efter betalningsdatum':'Recorded payments by payment date'}</h3>
  <div className="executive-report-chart" role="img" aria-label={sv?'Inbetalningar senaste sex månaderna':'Payments over the last six months'}>
   {paid.map(p=><div className="executive-report-month" key={p.key}><strong>{SEK.format(p.amount)}</strong><div className="executive-report-track"><span style={{height:`${p.amount>0?Math.max(4,100*p.amount/max):0}%`}}/></div><small>{p.label}</small></div>)}
  </div>
  <p className="executive-report-note">{sv?'Samtalsmåttet avser de senaste sju dagarna. Inbetalningar summeras per sparat betaldatum, inte fakturadatum. Belopp är CRM-registreringar, inte utfärdade fakturor.':'Call counts are restricted to seven days. Payments are grouped by stored payment date rather than invoice date. Values are internal CRM records, not issued invoices.'}</p>
 </section>;
}
