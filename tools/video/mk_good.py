from gen_edu import *
S=r"""
// 0 hook
SC.push({init(r){this.h=house(r,120,230,260);this.t=label(r,440,230,'Is this rental a good deal?',92,GOLD);this.s=label(r,440,370,'$250,000 house · $2,400 / month rent',54,'#fff');this.w=['Cash flow','Cap rate','Cash-on-cash','DSCR','1% rule'].map((t,i)=>E(r,'div',`position:absolute;left:${110+i*350}px;top:640px;width:320px;text-align:center;padding:18px 0;border-radius:40px;background:${CARD};color:${INK};font-size:42px;font-weight:800;opacity:0`,t))},
 up(p){this.h.style.transform=`scale(${back(seg(p,0,.15))})`;fade(this.t,seg(p,.08,.2));fade(this.s,seg(p,.2,.32));this.w.forEach((e,i)=>fade(e,seg(p,.4+i*.1,.52+i*.1)))}});
// 1 cash flow
SC.push({init(r){label(r,100,140,'1  Cash flow',80,GOLD);const it=[['Rent per year','$28,800','#60a5fa'],['Vacancy and operating costs','-$8,920',RED],['Net operating income','$19,880',GOLD],['Mortgage payments','-$14,593',RED],['Cash flow','$5,287 / year',GREEN]];this.r=it.map((x,i)=>ROW(r,160,260+i*118,1100,x[0],x[1],x[2]));this.f=CARDX(r,1330,360,500,330,small('Per month',40)+big('$441',130,'#0f9d6e'))},
 up(p){this.r.forEach((e,i)=>fade(e,seg(p,.06+i*.14,.18+i*.14)));pop(this.f,seg(p,.74,.9))}});
// 2 cap rate
SC.push({init(r){label(r,100,140,'2  Cap rate',80,GOLD);this.q=EQ(r,330,['Net operating income','$19,880'],['Purchase price','$250,000'],['Cap rate','7.95%'],'÷');this.n=label(r,0,720,'How the property performs, no matter how you finance it',46,'#c9d2f0',1920,'center');this.n.style.opacity=0},
 up(p){eqUp(this.q,p);fade(this.n,seg(p,.75,.9))}});
// 3 cash on cash
SC.push({init(r){label(r,100,140,'3  Cash-on-cash return',80,GOLD);this.q=EQ(r,330,['Yearly cash flow','$5,287'],['Cash you put in','$70,000'],['Cash-on-cash','7.55%'],'÷');this.n=label(r,0,720,'$62,500 down payment + $7,500 closing costs',46,'#c9d2f0',1920,'center');this.n.style.opacity=0},
 up(p){eqUp(this.q,p);fade(this.n,seg(p,.75,.9))}});
// 4 DSCR
SC.push({init(r){label(r,100,140,'4  DSCR',80,GOLD);this.q=EQ(r,260,['Net operating income','$19,880'],['Mortgage payments','$14,593'],['DSCR','1.36×'],'÷');const W=1400,X=260,mx=2;this.W=W;this.X=X;this.mx=mx;bar(r,X,640,W,50,GREY);this.f=bar(r,X,640,0,50,GREEN);this.m=bar(r,X+W*1.25/mx-3,615,6,100,'#fff');this.ml=label(r,X+W*1.25/mx-250,725,'Many lenders want about 1.25',40,'#c9d2f0',500,'center');this.ml.style.opacity=0},
 up(p){eqUp(this.q,p);this.f.style.width=(this.W*1.36/this.mx*ease(seg(p,.6,.85)))+'px';fade(this.ml,seg(p,.8,.92))}});
// 5 1% rule
SC.push({init(r){label(r,100,140,'5  The 1% rule',80,GOLD);this.q=EQ(r,260,['Monthly rent','$2,400'],['Purchase price','$250,000'],['Rent ÷ price','0.96%'],'÷');const W=1400,X=260;this.W=W;bar(r,X,640,W,50,GREY);this.f=bar(r,X,640,0,50,'#fbbf24');this.m=bar(r,X+W*1/1.5-3,615,6,100,'#fff');this.ml=label(r,X+W/1.5-150,725,'1% target',40,'#c9d2f0',300,'center');this.n=label(r,0,790,'Just under, but this house still cash flows $441 a month',44,GOLD,1920,'center');this.n.style.opacity=0;this.ml.style.opacity=0},
 up(p){eqUp(this.q,p);this.f.style.width=(this.W*.96/1.5*ease(seg(p,.5,.75)))+'px';fade(this.ml,seg(p,.7,.8));fade(this.n,seg(p,.8,.92))}});
// 6 scorecard
SC.push({init(r){label(r,100,140,'All five together',80,GOLD);const it=[['Cash flow','$441 / month',GREEN],['Cap rate','7.95%','#60a5fa'],['Cash-on-cash','7.55%',GOLD],['DSCR','1.36×','#c084fc'],['1% rule','0.96%','#fbbf24']];this.r=it.map((x,i)=>ROW(r,300,260+i*112,1320,x[0],x[1],x[2]))},
 up(p){this.r.forEach((e,i)=>fade(e,seg(p,.06+i*.14,.18+i*.14)))}});
// 7 tool
SC.push({init(r){this.im=E(r,'img',`position:absolute;left:60px;top:170px;height:690px;border-radius:20px;border:4px solid ${GOLD};opacity:0`);this.im.src='app_base.png';this.li=['Price, rent and costs','Cash flow and cap rate','Cash-on-cash and DSCR','The 1% rule'].map((t,i)=>E(r,'div',`position:absolute;left:1300px;top:${300+i*130}px;background:${CARD};color:${INK};font-size:38px;font-weight:800;padding:20px 30px;border-radius:20px;white-space:nowrap;opacity:0`,t))},
 up(p){this.im.style.opacity=ease(seg(p,.04,.2));this.im.style.transform=`scale(${.95+.05*ease(seg(p,.04,.3))})`;this.li.forEach((c,i)=>{const q=seg(p,.25+i*.15,.38+i*.15);c.style.opacity=ease(q);c.style.transform=`translateX(${(1-back(q))*80}px)`})}});
// 8 end
SC.push({init(r){this.lg=E(r,'img',`position:absolute;left:470px;top:70px;width:980px`);this.lg.src='logo_keyed.png';this.a=label(r,0,650,'Forge better deals.',96,'#fff',1920,'center');this.b=label(r,0,775,'octopisceslabs.com/rental-calc',64,GOLD,1920,'center')},
 up(p){this.lg.style.opacity=ease(seg(p,0,.12));this.a.style.opacity=ease(seg(p,.1,.25));this.b.style.opacity=ease(seg(p,.2,.35))}});
"""
L=[("s1","Is this rental a good deal? One number can't tell you. Here are the five that can, using an example: a two hundred fifty thousand dollar house renting for twenty four hundred a month."),
("s2","Number one, cash flow. A year of rent is twenty eight thousand eight hundred. Take out vacancy and operating costs, and net operating income is about nineteen thousand nine hundred. The mortgage takes about fourteen thousand six hundred. What's left is cash flow: five thousand two hundred eighty seven a year, or four hundred forty one dollars a month."),
("s3","Number two, cap rate. That's net operating income divided by the purchase price. Nineteen thousand nine hundred over two hundred fifty thousand is seven point nine five percent. It shows how the property performs, no matter how you finance it."),
("s4","Number three, cash on cash return. That's your yearly cash flow divided by the cash you actually put in. Five thousand two hundred eighty seven over seventy thousand is seven point five five percent. This one shows how hard your own money is working."),
("s5","Number four, D S C R, the debt service coverage ratio. That's net operating income divided by your mortgage payments. Here it's one point three six. Many lenders want about one point two five or higher, so this deal clears that bar."),
("s6","Number five, the one percent rule. Monthly rent divided by price. Twenty four hundred over two hundred fifty thousand is zero point nine six percent, just under one percent. But this house still cash flows. The rule is a quick filter, not a verdict."),
("s7","So is it a good deal? No single number decides it. Cash flow, cap rate, cash on cash, D S C R, and the one percent rule each tell part of the story. Look at all five together, and test what happens if rent or rates change."),
("s8","Equity Foundry shows all five at once. Enter the price, the rent, and your costs, and every number updates as you type."),
("s9","Run your own deal at octo pie sees labs dot com slash rental calc. Forge better deals.")]
build('edu_g',['Cash flow','Cap rate','Cash-on-cash','DSCR','1% rule'],[-1,0,1,2,3,4,-1,-1,-1],8,S,L,'EquityFoundry_Edu_Good_Deal_5_Numbers.mp4',['Intro','1 Cash flow','2 Cap rate','3 Cash-on-cash','4 DSCR','5 The 1% rule','All five together','Run it in EquityFoundry','Wrap up'],'edu_b/app_ltr.png')
