# Video pipeline (EquityFoundry how-tos and Shorts)
Voice: Kokoro `am_michael`, speed 1.05 (kokoro-onnx; model files kokoro-v1.0.onnx + voices-v1.0.bin from the kokoro-onnx releases).
Serve the app: `python3 -m http.server 8790 -d <rental-income-calculator>/www`. Needs playwright, ffmpeg, Pillow, soundfile.
- Desktop how-to (1080p): kokoro_lines.py -> rec_multi.js -> build2.py (see CLAUDE.md for the page generator, build_howto.py).
- Short (vertical, under 60s): write lines.json, kokoro_lines.py, rec_short.js <dir> <dir>/durs.json <key>, build_short.py <key> <out.mp4>.
- Paths inside scripts point at the old scratchpad; adjust D/LOGO at the top.
