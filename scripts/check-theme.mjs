// ONYX45 CRM design guard. Run in CI before Vite build.
// All loaded styles must refer to centralized semantic palette tokens.
import {readFileSync} from 'node:fs';
const cssFiles=['src/style.css','src/beginner-sales.css','src/cockpit.css','src/sales.css','src/crm-refresh.css'];
const theme=readFileSync('src/crm-refresh.css','utf8');
const tokenHeaderEnd=theme.indexOf('/* ONYX45 CRM | unified Heritage Bordeaux 2.0 theme');
if(tokenHeaderEnd<0)throw Error('Canonical design token header missing');
const header=theme.slice(0,tokenHeaderEnd);
const defined=[...header.matchAll(/--o45-[\w-]+:\s*(#[0-9A-Fa-f]{6})\s*;/g)];
if(defined.length<17)throw Error('Insufficient canonical ONYX45 color tokens');
const allowed=new Set(defined.map(m=>m[1].toLowerCase()));
if(!allowed.has('#552632')||!allowed.has('#322629')||!allowed.has('#f2ebe2')||!allowed.has('#afc3cf'))throw Error('Heritage Bordeaux 2.0 core palette is incomplete');
const issues=[];
for(const file of cssFiles){
 const body=readFileSync(file,'utf8');
 for(const match of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)){
  const color=match[0].toLowerCase();
  // Semi-transparent black shadows are allowed; all opaque colors are design tokens.
  if(/^#000[0-9a-f]$/.test(color))continue;
  if(file==='src/crm-refresh.css'&&match.index<tokenHeaderEnd&&allowed.has(color))continue;
  issues.push(file+': '+color+' (use var(--o45-...) instead)');
 }
}
if(issues.length){process.stderr.write('ONYX45 theme drift detected:\n'+issues.join('\n')+'\n');process.exit(1)}
console.log('ONYX45 theme tokens verified across '+cssFiles.length+' active stylesheets.');
