import json,sys,os,shutil,re,subprocess
src=open('edu/stage.html').read()
head=src[:src.index('const NAMES=')]; chips=src[src.index('const chipsEl='):src.index('const SC=[];')]
tail=src[src.index('let cur=-1;'):]
H=r"""
const SC=[];
const bar=(r,x,y,w,h,col,extra)=>E(r,'div',`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:14px;background:${col};${extra||''}`);
const fade=(e,q)=>{e.style.opacity=ease(q);e.style.transform=`translateY(${(1-ease(q))*24}px)`};
const pop=(e,q)=>{e.style.opacity=ease(q);e.style.transform=`scale(${.9+.1*back(q)})`};
const ROW=(r,x,y,w,a,b,c)=>E(r,'div',`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:92px;border-radius:18px;background:${CARD};color:${INK};font-size:48px;font-weight:800;padding:22px 34px;display:flex;justify-content:space-between;border-left:18px solid ${c};opacity:0`,`<span>${a}</span><span>${b}</span>`);
const CARDX=(r,x,y,w,h,html)=>E(r,'div',`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:30px;background:${CARD};color:${INK};text-align:center;padding-top:40px;opacity:0`,html);
const big=(t,s,c)=>`<div style="font-size:${s||100}px;font-weight:900;${c?'color:'+c:''}">${t}</div>`,small=(t,s)=>`<div style="font-size:${s||38}px;font-weight:800">${t}</div>`;
// equation: A op B = C
function EQ(r,y,A,B,C,op,ca){const mk=(x,w,h)=>CARDX(r,x,y,w,300,h);const a=mk(100,520,small(A[0])+big(A[1],86)),o=label(r,640,y+90,op,110,GOLD,100,'center'),b=mk(760,520,small(B[0])+big(B[1],86)),e=label(r,1300,y+90,'=',110,GOLD,100,'center'),c=E(r,'div',`position:absolute;left:1420px;top:${y}px;width:400px;height:300px;border-radius:30px;background:${GOLD};color:${INK};text-align:center;padding-top:50px;opacity:0`,small(C[0])+big(C[1],110));[o,e].forEach(x=>x.style.opacity=0);return [a,o,b,e,c]}
const eqUp=(L,p)=>L.forEach((e,i)=>pop(e,seg(p,.06+i*.13,.18+i*.13)));
"""
def build(d,names,active,endIdx,scenes,lines,outname,chap,app):
    os.makedirs(d+'/voice',exist_ok=True)
    nm="const NAMES=%s, ACTIVE=%s;\n"%(json.dumps(names),json.dumps(active))
    t=tail.replace('si!==8','si!==%d'%endIdx).replace('si===8','si===%d'%endIdx)
    t=t.replace(".replace(/Air B N B/g,'Airbnb')",".replace(/D S C R/g,'DSCR')").replace("capEl.textContent=txt.","capEl.textContent=txt.replace(/D S C R/g,'DSCR').")
    open(d+'/stage.html','w').write(head+nm+chips+H+scenes+t)
    json.dump([[a,b] for a,b in lines],open(d+'/lines.json','w'))
    for f in ['render.js','logo_keyed.png']: shutil.copy('edu_b/'+f,d+'/'+f)
    shutil.copy(app,d+'/app_base.png')
    a=open('edu_b/assemble.py').read().replace('EquityFoundry_Edu_BRRRR_Explained.mp4',outname)
    a=re.sub(r"names=\[.*\]","names="+json.dumps(chap),a); open(d+'/assemble.py','w').write(a)
