cd "$(dirname "$0")"
run(){ k=$1; node rec_short.js v_$k v_$k/durs.json $k > v_$k/log2.txt 2>&1 && python3 build_short.py $k final/EquityFoundry_Short_$k.mp4 >> v_$k/log2.txt 2>&1; echo "done $k" >> runall.log; }
for grp in "capcoc rate hidden dscr" "duplex strltr"; do for k in $grp; do run $k & done; wait; done
