import json,sys,soundfile as sf
from kokoro_onnx import Kokoro
D='/tmp/claude-0/-home-claude/9747ce12-c821-5271-b46a-c30fbd8b1522/scratchpad/tts/'
k=Kokoro(D+'kokoro-v1.0.onnx',D+'voices-v1.0.bin'); out=sys.argv[1]; durs=[]
for i,(sid,_,t) in enumerate(json.load(open(sys.argv[2] if len(sys.argv)>2 else 'lines.json'))):
    t=t.replace('EquityFoundry','Equity Foundry').replace('DSCR','D S C R').replace('BRRRR','BURR')
    s,sr=k.create(t,voice='am_michael',speed=1.05,lang='en-us'); sf.write(f'{out}/line{i+1}.wav',s,sr); durs.append(len(s)/sr)
json.dump(durs,open(f'{out}/durs.json','w')); print([round(d,1) for d in durs], round(sum(durs),1))
