# Print joint paths from an animprobe recording around a frame: python3 scripts/probepath.py rec.json fighter frame [joint ..]
import json, sys
rec = json.load(open(sys.argv[1]))
k = int(sys.argv[2]) - 1
f0 = int(sys.argv[3])
joints = sys.argv[4:] or ['hips', 'haL', 'haR']
idx = {r['f']: i for i, r in enumerate(rec)}
for f in range(f0 - 6, f0 + 5):
    if f not in idx: continue
    F = rec[idx[f]]['F'][k]
    rel = lambda j: [round(F['P'][j][i] - (F['R'][i] if j == 'hips' else F['P']['hips'][i]), 3) for i in range(3)]
    print(f, F['key'][:16].ljust(16), 'mf', str(F['mf']).ljust(3), 'hs', str(F['hs']).ljust(2), ' '.join(f"{j}{rel(j)}" for j in joints))
