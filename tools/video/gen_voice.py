import json,sys,numpy as np,soundfile as sf
from kokoro_onnx import Kokoro
D='/tmp/claude-0/-home-claude/9747ce12-c821-5271-b46a-c30fbd8b1522/scratchpad/tts/'
k=Kokoro(D+'kokoro-v1.0.onnx',D+'voices-v1.0.bin'); key=sys.argv[1]; out=f'v_{key}'; SR=24000
def g(t,sp=1.05): return k.create(t,voice='am_michael',speed=sp,lang='en-us')[0]
def trim(x):
    i=np.where(abs(x)>0.01)[0]; return x[i[0]:i[-1]+1]
z=lambda ms:np.zeros(int(SR*ms/1000),dtype=np.float32)
def rs(t): return t.replace('EquityFoundry','Equity Foundry').replace('Equity Foundry','Equity Foundry').replace('DSCR','D S C R').replace('BRRRR','BURR')
def synth(t):
    t=rs(t)
    if 'Airbnb' not in t: return g(t)
    parts=[]; pieces=t.split('Airbnb'); 
    for i,pc in enumerate(pieces):
        pc=pc.strip()
        if i==0: pre=(pc+' Air').strip()
        else: pre=None
        if i==0: parts+= [trim(g(pre)),z(10),trim(g('bee en bee',1.15))]
        else:
            # text after Airbnb continues
            if pc: parts+=[z(60),trim(g(pc))]
            if i<len(pieces)-1: parts+=[z(60),trim(g('Air')),z(10),trim(g('bee en bee',1.15))]
    return np.concatenate(parts)
lines=json.load(open('lines.json'))[key]['lines']; d=[]
for i,(a,t) in enumerate(lines):
    s=synth(t); sf.write(f'{out}/line{i+1}.wav',s,SR); d.append(len(s)/SR)
json.dump(d,open(f'{out}/durs.json','w')); print(key,[round(x,1) for x in d],round(sum(d),1))
