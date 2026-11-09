const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const L=JSON.parse(fs.readFileSync('lines.json')); const V=JSON.parse(fs.readFileSync('voice/durs.json'));
const CFG=L.map((l,i)=>({text:l[1],voice:V[i],dur:V[i]+(i==L.length-1?1.8:0.7)}));
fs.writeFileSync('cfg.json',JSON.stringify(CFG));
const FPS=30; const mode=process.argv[2];
async function page(b){const p=await b.newPage({viewport:{width:1920,height:1080}});await p.addInitScript(c=>{window.CFG=c},CFG);await p.goto('file://'+path.resolve('stage.html'));await p.waitForTimeout(300);return p}
(async()=>{const b=await chromium.launch();
if(mode==='test'){const p=await page(b);fs.mkdirSync('test',{recursive:true});const pts=process.argv.slice(3).map(s=>s.split(':').map(Number));for(const [si,pr] of pts){await p.evaluate(([s,t])=>window.render(s,t),[si,pr*CFG[si].dur]);await p.waitForTimeout(80);await p.screenshot({path:`test/s${si+1}_${Math.round(pr*100)}.png`})}await b.close();return}
fs.mkdirSync('scenes',{recursive:true});
const jobs=process.env.ONLY?[+process.env.ONLY]:CFG.map((c,i)=>i); const W=4; 
async function worker(){const p=await page(b);while(jobs.length){const si=jobs.shift();const c=CFG[si];const n=Math.ceil(c.dur*FPS);const d=`frames/s${si+1}`;fs.rmSync(d,{recursive:true,force:true});fs.mkdirSync(d,{recursive:true});
 for(let f=0;f<n;f++){await p.evaluate(([s,t])=>window.render(s,t),[si,f/FPS]);await p.screenshot({path:`${d}/${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:92})}
 console.log('frames done s'+(si+1),n)}}
await Promise.all(Array.from({length:W},worker));await b.close()})();
