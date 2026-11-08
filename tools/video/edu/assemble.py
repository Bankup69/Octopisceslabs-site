import json, subprocess, os, numpy as np, soundfile as sf
C=json.load(open('cfg.json')); FPS=30; os.makedirs('scenes',exist_ok=True)
with open('scenes/list.txt','w') as f:
    for i,c in enumerate(C,1):
        if os.environ.get('ONLY') and int(os.environ['ONLY'])!=i-1:
            f.write(f"file 's{i}.mp4'\n"); continue
        out=f'scenes/s{i}.mp4'; tmp=f'scenes/tmp{i}.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(FPS),'-i',f'frames/s{i}/%05d.jpg','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',tmp],check=True)
        os.rename(tmp,out); f.write(f"file 's{i}.mp4'\n")
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','scenes/list.txt','-c','copy','silent.mp4'],check=True)
SR=24000; total=sum(c['dur'] for c in C); tr=np.zeros(int((total+0.5)*SR),dtype=np.float32); t0=0; starts=[]
for i,c in enumerate(C,1):
    w,sr=sf.read(f'voice/line{i}.wav'); assert sr==SR; s=int((t0+0.2)*SR); tr[s:s+len(w)]+=w[:len(tr)-s]; starts.append(t0); t0+=c['dur']
sf.write('voice.wav',tr,SR)
os.makedirs('out',exist_ok=True)
subprocess.run(['ffmpeg','-v','error','-y','-i','silent.mp4','-i','voice.wav','-map','0:v','-map','1:a','-c:v','copy','-af','loudnorm=I=-15:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart','out/EquityFoundry_Edu_STR_5_Numbers.mp4'],check=True)
names=['Intro','1 Occupancy','2 Nightly rate','3 Average stay','4 Costs','5 Cash flow','Slow-season test','Run it in EquityFoundry','Wrap up']
def ts(t): return f"{int(t//60)}:{int(t%60):02d}"
open('out/chapters.txt','w').write('\n'.join(f"{ts(s)} {n}" for s,n in zip(starts,names)))
print('total',round(total,1)); print(open('out/chapters.txt').read())
