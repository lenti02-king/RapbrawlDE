# Fighter models

`jazeek.glb` and `bonez.glb` are the product owner's **textured Clash-Royale-style Meshy models**, used 1:1 (same mesh
shapes, same UVs, same texture content). The originals are 69–72 MB each and stay out of git (`.cache/` is ignored);
the product owner published them as a GitHub release of this repository.

| fighter | stored locally as |
|---|---|
| Jazeek | `.cache/meshy2/jazeek_src.glb` |
| Bonez MC | `.cache/meshy2/bonez_src.glb` |

Rebuild (Blender 4.2 as a Python module):

```
pip install bpy==4.2.0 pillow scipy
python3 tools/meshy/reduce.py jazeek       # game copy: 120k triangles, base colour 8K->4K, maps 4K->2K -> .cache/meshy2/jazeek_std_src.glb
python3 tools/meshy/skin.py jazeek --src .cache/meshy2/jazeek_std_src.glb --out public/assets/characters/jazeek.glb
python3 tools/meshy/skin.py jazeek --out public/test-models/jazeek_cr.glb   # optional: the untouched original, rigged (compare with ?glb=jazeek:test-models/jazeek_cr.glb)
```

What the tools do:
- `reduce.py` — collapse decimation (UV islands are separate geometry, so every seam survives) and Lanczos downscaling
  from the original JPEG bytes; maps that are already small enough keep their original bytes. No repainting, no baking.
- `skin.py` — never re-exports the model through Blender. It computes bone-heat weights on a watertight helper copy,
  transfers them to every vertex and **appends** JOINTS_0/WEIGHTS_0, inverse bind matrices, joint nodes and a skin to
  the original GLB (the existing JSON objects and binary data are kept byte for byte). Joints are placed from the
  landmarks in `tools/meshy/<id>_cr.py`, measured on the original mesh, so the reduced copy gets the identical skeleton.
  The sculpted hands are open; finger and thumb bones let the game curl them into fists at runtime (`rb_fist`).
- glTF extras tell the game to fit the model to the fighter's gameplay height (`rb_fit`) and to offset the head pitch
  (`rb_head_pitch`).

Why not ship the originals: 8K textures need ≈340 MB of GPU memory each (two fighters ≈1 GB with the maps), the files
exceed the Artifact's 15 MB per-file limit, and the download would be ~150 MB. In-engine side-by-side renders show no
visible difference at gameplay distance.

Licence: depends on the product owner's Meshy plan (free-plan generations are CC BY 4.0 and must credit Meshy; paid
plans grant ownership) — verify before release. Both models depict real people at the product owner's request;
name/likeness rights must be cleared before release. Bonez's generated tracksuit carries a green crocodile emblem —
check it against registered marks before release. See `<id>.credits.json`.

Older pipelines kept for reference: `tools/meshy/build.py` (the earlier untextured sculpts, painted by rules),
`tools/cartoon/` (metaball fighters) and `tools/characters/` (MakeHuman-based realistic fighters).
