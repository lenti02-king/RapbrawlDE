# Fighter models

**S16 (D49): `jazeek.glb` and `jazeektoon.glb` ("Jazeek Cartoon")** are built from the product owner's modelle-4 Meshy
models (GitHub release `modelle-4`): a separately generated close-up head merged onto a full body, once in the
stylized 3D look and once anime / cel shaded. Unlike the modelle-3 models below they are *rebuilt*, not used 1:1:

| fighter | head | body | stored locally as |
|---|---|---|---|
| Jazeek | `Meshy_AI_CharacterHeadCloseUpU_1008130600…glb` (7.7M tris) | `Meshy_AI_Curly_Confidence_1008134741…glb` | `.cache/meshy4/styl_head_src.glb`, `styl_body_src.glb` |
| Jazeek Cartoon | `Meshy_AI_anime_head_cel_shaded_1008133027…glb` (4M tris) | `Meshy_AI_anime_mobile_characte_1008130706…glb` | `.cache/meshy4/anime_head_src.glb`, `anime_body_src.glb` |

```
python3 tools/meshy/merge4.py styl|anime      # -> .cache/meshy4/jazeek_src.glb | jazeektoon_src.glb (~10 min, 16 GB RAM is enough)
python3 tools/meshy/merge4.py anime --stage profile|geo   # neck ring table / merged previews without baking
python3 tools/meshy/reduce.py jazeek --dir meshy4          # 120k game copy (+ --tris 40000 --base 2048 --maps 1024 --out .cache/meshy4/jazeek_mob_src.glb)
python3 tools/meshy/skin.py jazeek --dir meshy4 --src .cache/meshy4/jazeek_std_src.glb --out public/assets/characters/jazeek.glb
```
`merge4.py`: head scaled + placed by chin / nose tip / nasion measured on both midline profiles; one tilted plane under
the chin and above the chains (lower at the nape for the anime curls) cuts both; the head's neck is bent radially onto
the body's at the plane; one closed surface (voxel remesh 1.6 mm) decimated to 160k triangles with the face and hands
on their own budget (50k); new UVs with the face islands x3.6 and the hair islands x0.45; base colour and normal map
baked (Cycles, selected-to-active) from the full-resolution sources, then ray misses filled and scalp texels inside the
hair turned into hair colour. Colour work: the stylized body's skin lifted to the head's tone; the head's neck fades
into the body's colour over 4 cm; after the PO's photos the lips are toned toward brown and the under-eyes shaded.
The previous modelle-3 Jazeek game copy is in git history (before S16).

The other fighters — `bonez.glb`, `manuellsen.glb` and `lacazette.glb` — are the product owner's **stylized mobile-game Meshy
models** (GitHub release `modelle-3`, Oct 2026, D43), used with the same mesh shapes, UVs and texture content. The
originals are 37–51 MB each and stay out of git (`.cache/` is ignored). The game renders them cel shaded
(`src/render/cel.ts`: MeshToonMaterial, no gloss, black ink outline).

| fighter | release asset | stored locally as |
|---|---|---|
| Jazeek | `Meshy_AI_Stylized_Mobile_Game__1007000320…glb` | `.cache/meshy3/jazeek_src.glb` |
| Bonez MC | `Meshy_AI_Symmetric_Stylized_Re_1007001712…glb` | `.cache/meshy3/bonez_src.glb` |
| Manuellsen | `Meshy_AI_Dashiki_Stylized_Boxe_1006205310…glb` | `.cache/meshy3/manuellsen_src.glb` |
| Lacazette | `Meshy_AI_Symmetric_Stylized_Mo_1007002413…glb` | `.cache/meshy3/lacazette_src.glb` |

Jazeek's generated trousers carried the GG monogram (a third-party trademark); `reduce.py` smooths that print to plain
fabric (RETOUCH in `tools/meshy/jazeek_cr.py`). The session-9 Clash-Royale-style models are in `.cache/meshy2/`.

Rebuild (Blender 4.2 as a Python module):

```
pip install bpy==4.2.0 pillow scipy
python3 tools/meshy/reduce.py jazeek       # game copy: 120k triangles, base colour 4K (q88), normal map 2K, no metal/roughness map
python3 tools/meshy/skin.py jazeek --src .cache/meshy3/jazeek_std_src.glb --out public/assets/characters/jazeek.glb
python3 tools/meshy/grid.py .cache/meshy3/jazeek_std_src.glb artifacts/meshy3/jazeek_std front,side 420   # landmark grids
python3 tools/meshy/jointshot.py jazeek artifacts/meshy3/jazeek_std   # skeleton drawn over the grids (check after skin.py)
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
