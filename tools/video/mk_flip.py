from gen_edu import *
S=r"""
// 0 hook
SC.push({init(r){this.big=label(r,0,230,'70%',330,GOLD,1920,'center');this.t=label(r,0,590,'The fix-and-flip offer rule',72,'#fff',1920,'center');this.s=label(r,0,700,'and where it can fool you',50,'#9aa7d0',1920,'center');[this.t,this.s].forEach(e=>e.style.opacity=0)},
 up(p){this.big.style.transform=`scale(${back(seg(p,0,.15))})`;fade(this.t,seg(p,.12,.25));fade(this.s,seg(p,.28,.4))}});
// 1 ARV and repairs
SC.push({init(r){label(r,100,140,'1  Estimate the numbers',80,GOLD);this.a=CARDX(r,120,300,800,420,small('After-repair value',44)+big('$285,000',110)+small('what it sells for once fixed',36));this.b=CARDX(r,1000,300,800,420,small('Repairs',44)+big('$40,000',110)+small('your rehab budget',36))},
 up(p){pop(this.a,seg(p,.05,.2));pop(this.b,seg(p,.4,.55))}});
// 2 the rule
SC.push({init(r){label(r,100,140,'2  Apply the rule',80,GOLD);const it=[['After-repair value','$285,000','#60a5fa'],['× 70%','$199,500',GOLD],['− Repairs','-$40,000',RED],['Max offer','$159,500',GREEN]];this.r=it.map((x,i)=>ROW(r,300,290+i*130,1320,x[0],x[1],x[2]))},
 up(p){this.r.forEach((e,i)=>fade(e,seg(p,.06+i*.18,.2+i*.18)))}});
// 3 what the rule ignores
SC.push({init(r){label(r,100,140,'3  What the rule ignores',80,GOLD);this.a=CARDX(r,100,300,560,440,small('Holding costs',44)+big('$11,030',100)+small('6 months of loan, taxes, insurance, utilities',32));this.b=CARDX(r,690,300,560,440,small('Selling costs',44)+big('$19,950',100)+small('7% of the sale price',32));this.c=CARDX(r,1280,300,540,440,small('Cash you need',44)+big('$74,430',100)+small('at a $180,000 offer',32))},
 up(p){pop(this.a,seg(p,.06,.2));pop(this.b,seg(p,.3,.44));pop(this.c,seg(p,.62,.78))}});
// 4 test offers
SC.push({init(r){label(r,100,140,'4  Test your offer',80,GOLD);const col=(x,o,pr,roi,c)=>CARDX(r,x,290,540,470,small('Offer',42)+big(o,92)+small('Profit',42)+big(pr,100,c)+small(roi+' return',38));this.a=col(100,'$159,500','$50,481','70.7%','#0f9d6e');this.b=col(690,'$180,000','$29,059','39.0%','#0f9d6e');this.c=col(1280,'$200,000','$8,160','10.6%','#dc2626');this.n=label(r,0,790,'Closing costs held at $5,400 in each case',38,'#9aa7d0',1920,'center');this.n.style.opacity=0},
 up(p){pop(this.a,seg(p,.06,.2));pop(this.b,seg(p,.3,.44));pop(this.c,seg(p,.55,.7));fade(this.n,seg(p,.75,.88))}});
// 5 value risk
SC.push({init(r){label(r,100,140,'5  Test the sale price',80,GOLD);this.a=CARDX(r,120,290,800,480,small('Sells for',44)+big('$285,000',100)+small('Profit at a $180,000 offer',40)+big('$29,059',100,'#0f9d6e'));this.b=CARDX(r,1000,290,800,480,small('Sells for',44)+big('$255,000',100)+small('Profit at a $180,000 offer',40)+big('$1,159',100,'#dc2626'));this.n=label(r,0,800,'The 70% rule max offer drops to $138,500',46,GOLD,1920,'center');this.n.style.opacity=0},
 up(p){pop(this.a,seg(p,.05,.2));pop(this.b,seg(p,.4,.55));fade(this.n,seg(p,.75,.9))}});
// 6 tool
SC.push({init(r){this.im=E(r,'img',`position:absolute;left:60px;top:170px;height:690px;border-radius:20px;border:4px solid ${GOLD};opacity:0`);this.im.src='app_base.png';this.li=['Price, repairs, sale value','70% rule max offer','Holding and selling costs','Profit and return'].map((t,i)=>E(r,'div',`position:absolute;left:1300px;top:${300+i*130}px;background:${CARD};color:${INK};font-size:38px;font-weight:800;padding:20px 30px;border-radius:20px;white-space:nowrap;opacity:0`,t))},
 up(p){this.im.style.opacity=ease(seg(p,.04,.2));this.im.style.transform=`scale(${.95+.05*ease(seg(p,.04,.3))})`;this.li.forEach((c,i)=>{const q=seg(p,.25+i*.15,.38+i*.15);c.style.opacity=ease(q);c.style.transform=`translateX(${(1-back(q))*80}px)`})}});
// 7 end
SC.push({init(r){this.lg=E(r,'img',`position:absolute;left:470px;top:70px;width:980px`);this.lg.src='logo_keyed.png';this.a=label(r,0,650,'Forge better deals.',96,'#fff',1920,'center');this.b=label(r,0,775,'octopisceslabs.com/rental-calc',64,GOLD,1920,'center')},
 up(p){this.lg.style.opacity=ease(seg(p,0,.12));this.a.style.opacity=ease(seg(p,.1,.25));this.b.style.opacity=ease(seg(p,.2,.35))}});
"""
L=[("s1","How much should you offer on a fix and flip? Investors use a quick filter called the seventy percent rule. Here's how it works, and where it can fool you."),
("s2","Step one, estimate the numbers. The after repair value is what the house will sell for once it's fixed. Here that's two hundred eighty five thousand dollars, and the repairs will cost forty thousand."),
("s3","Step two, apply the rule. Multiply the after repair value by seventy percent. That's one hundred ninety nine thousand five hundred. Subtract the repairs, forty thousand, and your maximum offer is one hundred fifty nine thousand five hundred dollars."),
("s4","Step three, remember what the rule ignores. Six months of loan payments, taxes, insurance and utilities add about eleven thousand dollars. Selling costs, at seven percent, add nearly twenty thousand. The rule is a shortcut. It doesn't show your real profit."),
("s5","Step four, test your offer. At one hundred fifty nine thousand five hundred, profit is about fifty thousand dollars. At one hundred eighty thousand, about twenty nine thousand. At two hundred thousand, only about eight thousand. Every extra dollar you pay comes straight out of your profit."),
("s6","Step five, test the sale price. If the house only sells for two hundred fifty five thousand, a one hundred eighty thousand dollar offer leaves about one thousand dollars of profit. And the rule's maximum offer drops to one hundred thirty eight thousand five hundred. Always test a lower sale price."),
("s7","Equity Foundry runs the rule and your real profit together. Enter the price, the repairs, and the sale value, and watch profit and return update as you type."),
("s8","Run your own deal at octo pie sees labs dot com slash rental calc. Forge better deals.")]
build('edu_f',['Estimate','The rule','Hidden costs','Test offers','Sale price'],[-1,0,1,2,3,4,-1,-1],7,S,L,'EquityFoundry_Edu_70_Percent_Rule.mp4',['Intro','1 Estimate the numbers','2 Apply the rule','3 What the rule ignores','4 Test your offer','5 Test the sale price','Run it in EquityFoundry','Wrap up'],'edu_b/app_flip.png')
