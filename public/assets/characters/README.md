# Fighter models

`jazeek.glb` and `bonez.glb` are built by `tools/meshy/build.py` (Blender 4.2 as a Python module) from two untextured
Meshy AI sculpts supplied by the product owner:

| fighter | source sculpt (product owner) | stored locally as |
|---|---|---|
| Jazeek | `Meshy_AI_Diamond_Confidence_1004121028_generate.glb` | `.cache/meshy/jazeek_src.glb` |
| Bonez MC | `Meshy_AI_Golden_Hour_Stare_1004121036_generate.glb` | `.cache/meshy/bonez_src.glb` |

The sources are 15–24 MB and stay out of git (`.cache/` is ignored); put them back there to rebuild:

```
pip install bpy==4.2.0 pillow scipy
python3 tools/meshy/preview.py jazeek      # quick painted previews -> artifacts/meshy/
python3 tools/meshy/build.py jazeek        # ~1.5 min on CPU -> public/assets/characters/jazeek.glb
python3 tools/meshy/build.py bonez
```

What the pipeline adds (all original work): colours/materials per region (`tools/meshy/<id>.py`: skin, face, eyes,
brows, beard/stubble, hair, clothes, chains, tattoos), baked ambient occlusion, a 50k-triangle low poly (face and hands
protected), UVs, 2048 px albedo + normal map, roughness/metal map, Mixamo-named skeleton with bone-heat weights, and
fists (the sculpts have open hands). GLB extras tell the game to fit the model to the fighter's gameplay height
(`rb_fit`) and to offset the head pitch (`rb_head_pitch`).

Licence: depends on the product owner's Meshy plan (free-plan generations are CC BY 4.0 and must credit Meshy; paid
plans grant ownership) — verify before release. Both models depict real people at the product owner's request;
name/likeness rights must be cleared before release. See `<id>.credits.json`.

Older pipelines kept for reference: `tools/cartoon/` (Clash-Royale-style metaball fighters) and `tools/characters/`
(MakeHuman-based realistic fighters).
