"""Head + body merge for the PO's modelle-4 Jazeek models (S16): the separately generated close-up head goes onto the
full-body model, then everything is baked into one clean texture with a face-first UV layout.

Usage: python3 tools/meshy/merge4.py styl|anime [--stage geo|bake] [--tris 160000] [--tex 4096] [--preview dir]

  .cache/meshy4/<style>_head_src.glb + <style>_body_src.glb  ->  .cache/meshy4/<fighter>_src.glb
  (then the usual pipeline: reduce.py <fighter> --dir meshy4, skin.py <fighter> --dir meshy4)

Steps (all scripted, Blender 4.2 as a Python module; nothing is painted by hand):
  1. align: the head is scaled so chin->nose tip and chin->nasion match the body's own head (both measured on the
     midline profile) and placed chin on chin, neck centre on neck centre;
  2. cut: one tilted plane under the chin and above the chains (higher at the back, like a collar line) - the body
     keeps everything below it (chains, pendant), the head everything above it plus a hidden overlap;
  3. neck: the head's neck is bent radially onto the body's neck right at the plane (a smooth band above it), so the
     silhouette runs through without a step; the skin colour fades to the body's along the same band;
  4. bake: decimation (face and hands protected), new UVs with the face islands enlarged, base colour and normal map
     baked from the full-resolution sources (Cycles, emission/normal bake through the original UVs).
"""
from __future__ import annotations

import argparse
import io
import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glbfast  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CACHE = os.path.join(ROOT, '.cache', 'meshy4')

# Landmarks in each file's own units (Blender axes: z up, face toward -y), measured with the midline profile
# (front-most y per height): chin = bottom of the goatee where the profile jumps back to the throat, nose = tip,
# nasion = deepest point between nose and brow.
STYLES = {
    'styl': dict(
        fighter='jazeek', body='styl_body_src.glb', head='styl_head_src.glb',
        head_lm=dict(chin=-0.635, nose=(-0.090, -0.7163), nasion=0.155),
        body_lm=dict(chin=0.668, nose=(0.758, -0.098), nasion=0.800),
        # cut plane through two midline points (y, z): the throat under the chin and the nape above the chains
        plane=((-0.010, 0.650), (0.100, 0.700)),
        # face retouch after the PO's photos (head file units): eyes (x, z), lips box, strengths
        eyes=((-0.185, 0.130), (0.190, 0.130)), lips=(-0.33, -0.24, 0.17), lip_tint=(0.78, 0.76, 0.71), eye_dark=0.86,
        facebox=(0.42, 0.30),  # |x| and top z of the face zone (just above the brows)
        brows=((-0.20, 0.245), (0.205, 0.245)), brow_dark=0.74,  # the photos' brows are darker and fuller
        skin_match=True,  # the body's skin is darker than the head's (and the photos): lift it to the head's tone
    ),
    'anime': dict(
        fighter='jazeektoon', body='anime_body_src.glb', head='anime_head_src.glb',
        head_lm=dict(chin=-0.590, nose=(-0.060, -0.7461), nasion=0.180),
        body_lm=dict(chin=0.658, nose=(0.762, -0.1353), nasion=0.810),
        plane=((-0.045, 0.640), (0.080, 0.670)),  # low at the back: the curls reach down to the nape
        eyes=((-0.180, 0.150), (0.170, 0.150)), lips=(-0.31, -0.19, 0.17), lip_tint=(0.88, 0.86, 0.82), eye_dark=0.93,
        facebox=(0.42, 0.30),
        skin_match=False,
    ),
}

ap = argparse.ArgumentParser()
ap.add_argument('style', choices=list(STYLES))
ap.add_argument('--stage', default='bake', choices=['profile', 'geo', 'bake'])
ap.add_argument('--tris', type=int, default=160000, help='triangles of the merged model')
ap.add_argument('--tex', type=int, default=4096)
ap.add_argument('--src-tris', type=int, default=2500000, help='bake source: the head sculpt decimated to this')
ap.add_argument('--preview', default=os.path.join(ROOT, 'artifacts', 'meshy4'))
ap.add_argument('--scale', type=float, default=1.0, help='extra head scale on top of the measured one')
ap.add_argument('--voxel', type=float, default=0.0016, help='remesh voxel size (model units: 1.9 = body height)')
ap.add_argument('--face-tris', type=int, default=50000, help='triangle budget of the face (skin, beard, ears) and hands')
ap.add_argument('--face-uv', type=float, default=3.6, help='texel density factor of the face islands')
ap.add_argument('--hair-uv', type=float, default=0.45, help='texel density factor of the hair islands (dark, little detail)')
ap.add_argument('--margin', type=float, default=0.0012)
ap.add_argument('--cage', type=float, default=0.006, help='bake cage extrusion (model units)')
ap.add_argument('--samples', type=int, default=4)
ap.add_argument('--quality', type=int, default=92)
ap.add_argument('--resume', action='store_true', help='reuse the joined + remeshed scene of the last run (work/<style>/remesh.blend)')
args = ap.parse_args()
C = STYLES[args.style]
WORK = os.path.join(CACHE, 'work', args.style)
os.makedirs(WORK, exist_ok=True)
os.makedirs(args.preview, exist_ok=True)
T0 = time.time()

OVERLAP = 0.008  # head neck kept below the plane (hidden inside the body)
BAND = 0.028     # neck morph band above the plane
COLBAND = 0.040  # skin colour fade band above the plane
EPS = 0.0007     # head neck sits this far inside the body's neck at the plane


def log(*a):
    print(f'[merge4 {time.time() - T0:6.1f}s]', *a, flush=True)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ preview
def preview(tag, views, objs=None):
    from mathutils import Vector

    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 16
    sc.cycles.use_denoising = False
    sc.view_settings.view_transform = 'Standard'
    if objs is not None:
        for o in bpy.data.objects:
            if o.type == 'MESH':
                o.hide_render = o not in objs
    if 'cam' not in bpy.data.objects:
        sc.world = bpy.data.worlds.new('w')
        sc.world.use_nodes = True
        sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.5, 0.53, 1)
        sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
        for i, (rot, e) in enumerate([((50, 0, 30), 2.5), ((60, 0, -120), 1.0)]):
            L = bpy.data.objects.new(f'sun{i}', bpy.data.lights.new(f'sun{i}', 'SUN'))
            L.data.energy = e
            L.rotation_euler = [math.radians(v) for v in rot]
            sc.collection.objects.link(L)
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        cam.data.type = 'ORTHO'
    cam = bpy.data.objects['cam']
    sc.camera = cam
    out = []
    for name, yaw, zc, scale, w, h in views:
        sc.render.resolution_x, sc.render.resolution_y = w, h
        cam.data.ortho_scale = scale
        a = math.radians(yaw)
        cam.location = (math.sin(a) * 5, -math.cos(a) * 5, zc)
        cam.rotation_euler = (Vector((0, 0, zc)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = os.path.join(args.preview, f'{args.style}_{tag}_{name}.png')
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        out.append(f)
    log('preview', tag, len(out), 'views')
    return out


VIEWS = [('full', 0, 0.0, 2.0, 600, 1000), ('front', 0, 0.74, 0.34, 800, 800), ('q3', 35, 0.74, 0.34, 800, 800),
         ('side', 90, 0.74, 0.34, 800, 800), ('back', 180, 0.74, 0.34, 800, 800), ('neck', 60, 0.68, 0.16, 800, 800)]
BLEND = os.path.join(WORK, 'remesh.blend')
RESUME = args.resume and os.path.exists(BLEND) and args.stage == 'bake'
if RESUME:
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    high, low = bpy.data.objects['high'], bpy.data.objects['low']
    import gc  # noqa: E402

    log('resumed from', BLEND, len(high.data.polygons), 'source tris,', len(low.data.polygons), 'remeshed faces')
else:
    # ------------------------------------------------------------------ load
    bpos, bnor, buv, btri, bimg, _ = glbfast.arrays(os.path.join(CACHE, C['body']))
    hpos, hnor, huv, htri, himg, _ = glbfast.arrays(os.path.join(CACHE, C['head']))
    log('body', len(bpos), 'verts', len(btri), 'tris; head', len(hpos), 'verts', len(htri), 'tris')

    # ------------------------------------------------------------------ 1. align
    hl, bl = C['head_lm'], C['body_lm']
    s_nose = (bl['nose'][0] - bl['chin']) / (hl['nose'][0] - hl['chin'])
    s_nas = (bl['nasion'] - bl['chin']) / (hl['nasion'] - hl['chin'])
    s = 0.5 * (s_nose + s_nas) * args.scale
    log('scale from nose', round(s_nose, 4), 'nasion', round(s_nas, 4), '->', round(s, 4))
    (fy, fz), (by, bz) = C['plane']
    n = np.array([0.0, -(bz - fz), (by - fy)])  # plane normal: up and toward the face's back-tilt
    n /= np.linalg.norm(n)
    if n[2] < 0:
        n = -n
    p0 = np.array([0.0, fy, fz])


    def height(p):
        return (p - p0) @ n


    hp = hpos * s
    hp[:, 2] += bl['chin'] - hl['chin'] * s


    def ring(p, h0=-0.002, h1=0.002, rmax=0.095):
        """Points of p in a thin slab around the plane, near the neck axis."""
        h = height(p)
        m = (h > h0) & (h < h1)
        q = p[m]
        q = q[np.hypot(q[:, 0], q[:, 1] - (fy + by) / 2) < rmax * 1.6]
        return q


    def centre(q):
        return np.array([(q[:, 0].min() + q[:, 0].max()) / 2, (q[:, 1].min() + q[:, 1].max()) / 2])


    qb = ring(bpos)
    qh = ring(hp)
    cb, ch = centre(qb), centre(qh)
    hp[:, 0] += cb[0] - ch[0]
    hp[:, 1] += cb[1] - ch[1]
    log('neck centre body', cb.round(4), 'head', ch.round(4), '-> head shifted', (cb - ch).round(4))

    # plane basis (u along x, v in the plane toward the back) for polar coordinates around the neck axis
    u_ax = np.array([1.0, 0, 0])
    v_ax = np.cross(n, u_ax)
    c3 = p0 + n * 0  # axis point: neck centre projected into the plane
    c3 = np.array([cb[0], cb[1], fz + (cb[1] - fy) * (bz - fz) / (by - fy)])


    def polar(p):
        d = p - c3
        h = d @ n
        a = np.arctan2(d @ v_ax, d @ u_ax)
        r = np.hypot(d @ u_ax, d @ v_ax)
        return h, a, r


    NB = 96


    def radius_profile(p, h0, h1, rmax):
        h, a, r = polar(p)
        m = (h > h0) & (h < h1) & (r < rmax)
        bins = ((a[m] + np.pi) / (2 * np.pi) * NB).astype(int) % NB
        R = np.full(NB, np.nan)
        for i in range(NB):
            rr = r[m][bins == i]
            if len(rr):
                R[i] = np.median(rr)  # the neck is one tube: every point sits at its radius (stray curls/chain links don't count)
        # fill gaps circularly
        idx = np.arange(NB)
        ok = ~np.isnan(R)
        R = np.interp(idx, np.r_[idx[ok] - NB, idx[ok], idx[ok] + NB], np.r_[R[ok], R[ok], R[ok]])
        # light circular smoothing
        k = np.array([1, 2, 3, 2, 1], float)
        k /= k.sum()
        R = np.convolve(np.r_[R[-2:], R, R[:2]], k, 'valid')
        return R


    Rb = radius_profile(bpos, -0.003, 0.0, 0.09)
    Rh = radius_profile(hp, -0.002, 0.002, 0.09)
    log('neck radius body', round(float(Rb.min()), 4), '..', round(float(Rb.max()), 4), ' head', round(float(Rh.min()), 4), '..', round(float(Rh.max()), 4))
    if args.stage == 'profile':
        for k in range(0, NB, 4):
            print(f'  {k * 360 / NB - 180:7.1f} deg  body {Rb[k]:.4f}  head {Rh[k]:.4f}  factor {(Rb[k] - EPS) / Rh[k]:.3f}')
        sys.exit(0)

    # ------------------------------------------------------------------ 2. cut
    # head: keep triangles whose vertices are all above -OVERLAP (the hidden overlap ends under the body's neck surface)
    hh, ha, hr = polar(hp)
    keep_v = hh > -OVERLAP
    keep_t = keep_v[htri].all(1)
    # 3. neck morph: radial scale toward the body's neck at the plane
    f = np.clip((Rb - EPS) / Rh, 0.9, 1.1)
    ai = (ha + np.pi) / (2 * np.pi) * NB - 0.5
    i0 = np.floor(ai).astype(int) % NB
    fr = ai - np.floor(ai)
    fa = f[i0] * (1 - fr) + f[(i0 + 1) % NB] * fr
    Rh_a = Rh[i0] * (1 - fr) + Rh[(i0 + 1) % NB] * fr
    w = 1 - smoothstep(0.0, BAND, hh)
    w *= hr < Rh_a * 1.35  # only the neck surface, not the jaw/beard that overhangs it
    scale_r = 1 + (fa - 1) * w
    d = hp - c3
    radial = d - np.outer(d @ n, n)
    hp = hp + radial * (scale_r - 1)[:, None]
    log('neck morph: factor range', round(float(f.min()), 3), '..', round(float(f.max()), 3))
    hcol_w = 1 - smoothstep(0.0, COLBAND, hh)  # colour fade weight (1 at the plane)

    used = np.unique(htri[keep_t])
    remap = np.full(len(hp), -1, np.int64)
    remap[used] = np.arange(len(used))
    H_pos, H_uv, H_nor, H_w = hp[used], huv[used], hnor[used], hcol_w[used]
    H_tri = remap[htri[keep_t]]
    log('head kept', len(H_tri), 'of', len(htri), 'tris')

    # body: everything above the plane near the neck axis goes (old head and hair); exact bisect for a clean rim
    bh, ba, br = polar(bpos)
    tc = bpos[btri].mean(1)
    th, ta, tr = polar(tc)
    rm_t = (th > 0.004) & ((tr < 0.13) | (tc[:, 2] > bz + 0.01))
    keep_bt = ~rm_t
    usedb = np.unique(btri[keep_bt])
    remapb = np.full(len(bpos), -1, np.int64)
    remapb[usedb] = np.arange(len(usedb))
    B_pos, B_uv, B_nor = bpos[usedb], buv[usedb], bnor[usedb]
    B_tri = remapb[btri[keep_bt]]
    log('body kept', len(B_tri), 'of', len(btri), 'tris')

    bpy.ops.wm.read_factory_settings(use_empty=True)
    body = glbfast.build('body', B_pos, B_tri, B_uv, B_nor)
    head = glbfast.build('head', H_pos, H_tri, H_uv)  # smooth normals from the dense mesh (Meshy's are the same, saves GBs)
    # exact rim on the body: bisect at the plane and drop what is left above it near the neck
    bm = bmesh.new()
    bm.from_mesh(body.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=tuple(c3), plane_no=tuple(n), clear_outer=False, clear_inner=False)
    kill = []
    for fa_ in bm.faces:
        cc = fa_.calc_center_median()
        dd = np.array(cc) - c3
        hh_ = dd @ n
        rr_ = math.hypot(dd @ u_ax, dd @ v_ax)
        if hh_ > 1e-5 and rr_ < 0.13:
            kill.append(fa_)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()
    log('body bisected, removed', len(kill), 'slivers above the plane')

    # ------------------------------------------------------------------ colours: seam fade, body skin, face retouch
    def tex_np(data):
        return np.asarray(Image.open(io.BytesIO(data)).convert('RGB')).astype(np.float32)


    TB, TH = tex_np(bimg['base']), tex_np(himg['base'])


    def sample(T, uvs):
        Hh, Ww, _ = T.shape
        return T[np.clip((uvs[:, 1] * Hh).astype(int), 0, Hh - 1), np.clip((uvs[:, 0] * Ww).astype(int), 0, Ww - 1)]


    def skinlike(c):
        r, g, b = c[..., 0], c[..., 1], c[..., 2]
        return (r > g) & (g > b * 0.95) & (r - b > 25) & (r < 250) & (r > 60) & (g < r * 0.80) & (b < r * 0.68)


    def lin(c):
        c = np.asarray(c, float) / 255.0
        return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


    bh2, _, br2 = polar(B_pos)
    mb = (bh2 > -0.012) & (bh2 < 0.0) & (br2 < 0.085)
    cbs = sample(TB, B_uv[mb])
    cbs = cbs[skinlike(cbs)]
    hh2, _, hr2 = polar(H_pos)
    mh = (hh2 > 0.0) & (hh2 < 0.012) & (hr2 < 0.085)
    chs = sample(TH, H_uv[mh])
    chs = chs[skinlike(chs)]
    Cb, Ch = np.median(cbs, 0), np.median(chs, 0)
    log('seam skin body', Cb.round(1), 'head', Ch.round(1), f'({len(cbs)}/{len(chs)} samples)')

    body_tex = TB
    if C['skin_match']:
        # lift the body's skin (arms, hands, neck, shoulders) to the head's tone - texel mask = skin colour AND a texel of
        # a triangle outside the trousers/shoes (their tan print has skin-like ratios)
        from PIL import ImageDraw, ImageFilter

        Hh, Ww, _ = TB.shape
        tc_b = B_pos[B_tri].mean(1)
        upper = ~((np.abs(tc_b[:, 0]) < 0.30) & (tc_b[:, 2] < 0.36))
        mimg = Image.new('L', (Ww, Hh), 0)
        dr = ImageDraw.Draw(mimg)
        uvt = B_uv[B_tri[upper]] * [Ww, Hh]
        for t in uvt:
            dr.polygon([tuple(t[0]), tuple(t[1]), tuple(t[2])], fill=255)
        geo = np.asarray(mimg.filter(ImageFilter.MaxFilter(5))) > 0
        sk = skinlike(TB) & geo
        skm = np.asarray(Image.fromarray((sk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)[..., None] / 255
        g_skin = Ch / np.maximum(Cb, 1)
        body_tex = np.clip(TB * (1 + (g_skin - 1) * skm), 0, 255)
        Cb = Cb * g_skin
        log('body skin lifted by', g_skin.round(3), 'on', int(sk.sum()), 'texels')
    bpath = os.path.join(WORK, 'body_base.jpg')
    Image.fromarray(body_tex.astype(np.uint8)).save(bpath, quality=95)
    bimg = dict(bimg, base=open(bpath, 'rb').read())

    # per-vertex colour multiplier on the head (linear light): seam fade x lips x under-eye shadow
    gain = lin(Cb) / np.maximum(lin(Ch), 1e-4)
    Hsrc = hpos[used]  # head file units for the face landmarks
    tint = np.ones((len(H_pos), 3))
    tint *= 1 + (gain[None, :] - 1) * H_w[:, None]
    z0, z1, xh = C['lips']
    cz = (z0 + z1) / 2
    lipbox = np.exp(-(((Hsrc[:, 2] - cz) / ((z1 - z0) * 0.62)) ** 4 + (Hsrc[:, 0] / xh) ** 4)) * (Hsrc[:, 1] < -0.45)
    hc = sample(TH, H_uv)
    pink = smoothstep(0.02, 0.10, (hc[:, 2] - hc[:, 1]) / np.maximum(hc[:, 0], 1) + 0.12 - (hc[:, 1] / np.maximum(hc[:, 0], 1) - 0.62))
    lipw = lipbox * np.clip(pink, 0.35, 1.0)
    tint *= 1 + (lin(np.array(C['lip_tint']) * 255)[None, :] - 1) * lipw[:, None]
    eyew = np.zeros(len(H_pos))
    for ex, ez in C['eyes']:
        # crescent under each eye: a soft ellipse centred 0.075 below the eye, narrower toward the nose
        dx = (Hsrc[:, 0] - ex) / 0.115
        dz = (Hsrc[:, 2] - (ez - 0.072)) / 0.042
        eyew = np.maximum(eyew, np.exp(-(dx ** 2 + dz ** 2) ** 1.6) * (Hsrc[:, 1] < -0.40))
    dark = float(lin(C['eye_dark'] * 255) / lin(255))
    tint *= 1 + (np.array([dark, dark * 0.985, dark * 0.99]) - 1)[None, :] * eyew[:, None]
    browsw = np.zeros(len(H_pos))
    for bx, bz in C.get('brows', ()):
        # a soft band along each brow: the skin between the sculpted hairs darkens too, so the brow reads fuller
        dx = (Hsrc[:, 0] - bx) / 0.135
        dz = (Hsrc[:, 2] - bz + 0.02 * ((Hsrc[:, 0] - bx) / 0.135) ** 2) / 0.030  # arched: the ends sit lower
        browsw = np.maximum(browsw, np.exp(-(dx ** 2 + dz ** 2) ** 2) * (Hsrc[:, 1] < -0.40))
    if C.get('brows'):
        bd = float(lin(C['brow_dark'] * 255) / lin(255))
        tint *= 1 + (np.array([bd, bd * 0.97, bd * 0.97]) - 1)[None, :] * browsw[:, None]
    log('retouch: lips', int((lipw > 0.3).sum()), 'verts, under-eye', int((eyew > 0.3).sum()), 'verts, brows', int((browsw > 0.3).sum()),
        'verts, seam gain', gain.round(3))
    ca = head.data.color_attributes.new('tint', 'FLOAT_COLOR', 'POINT')
    ca.data.foreach_set('color', np.c_[tint, np.ones(len(tint))].astype(np.float32).ravel())
    cb_ = body.data.color_attributes.new('tint', 'FLOAT_COLOR', 'POINT')
    cb_.data.foreach_set('color', np.ones(len(body.data.vertices) * 4, np.float32))


    def material(name, imgs):
        """Principled (with the source normal map, for the normal bake) + emission of base colour x tint (colour bake)."""
        mat = glbfast.material(name, imgs, WORK)
        nt = mat.node_tree
        tex = [nd for nd in nt.nodes if nd.type == 'TEX_IMAGE' and nd.image.colorspace_settings.name == 'sRGB'][0]
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.uv_map = 'UVMap'
        for nd in nt.nodes:
            if nd.type == 'TEX_IMAGE':
                nt.links.new(uvn.outputs['UV'], nd.inputs['Vector'])
        nm = [nd for nd in nt.nodes if nd.type == 'NORMAL_MAP']
        if nm:
            nm[0].uv_map = 'UVMap'
        bsdf = nt.nodes['Principled BSDF']
        at = nt.nodes.new('ShaderNodeVertexColor')
        at.layer_name = 'tint'
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        nt.links.new(tex.outputs['Color'], mix.inputs['A'])
        nt.links.new(at.outputs['Color'], mix.inputs['B'])
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(mix.outputs['Result'], em.inputs['Color'])
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(bsdf.outputs['BSDF'], add.inputs[0])
        nt.links.new(em.outputs['Emission'], add.inputs[1])
        out = nt.nodes['Material Output']
        nt.links.new(add.outputs['Shader'], out.inputs['Surface'])
        mat['bsdf'] = bsdf.name
        return mat


    body.data.materials.append(material('body', bimg))
    head.data.materials.append(material('head', himg))

    # protection class as a point attribute (survives the bake-source decimation and the join): 1 = face skin, beard,
    # ears (head vertices that are not hair) and hands - they get their own triangle budget and enlarged UV islands
    # hair = dark AND outside the face zone (brows, lashes, moustache and goatee are dark too but belong to the face)
    fx, fz = C['facebox']
    facezone = (np.abs(Hsrc[:, 0]) < fx) & (Hsrc[:, 2] < fz) & (Hsrc[:, 1] < -0.30)
    hair_h = (hc.max(1) < 70) & ~facezone
    lower_face = facezone
    pa = head.data.attributes.new('prot', 'FLOAT', 'POINT')
    pa.data.foreach_set('value', np.where(~hair_h | lower_face, 2.0, 3.0).astype(np.float32))  # 3 = hair
    bp_ = np.empty(len(body.data.vertices) * 3)
    body.data.vertices.foreach_get('co', bp_)
    pa = body.data.attributes.new('prot', 'FLOAT', 'POINT')
    pa.data.foreach_set('value', np.where(np.abs(bp_[0::3]) > 0.40, 1.0, 0.0).astype(np.float32))
    del hh2, hr2, mh, H_tri, H_w, B_tri, tint, lipw, eyew, browsw, lipbox, pink, hair_h, lower_face, bp_, keep_v, keep_t, used, remap, hh, ha, hr, w, scale_r, radial, d, fa, fr, i0, ai, Rh_a, hcol_w, hpos, hp, hnor, huv, htri, bpos, bnor, buv, btri, TH, TB, body_tex, hc, Hsrc, H_pos, H_uv, H_nor, B_pos, B_uv, B_nor
    import gc  # noqa: E402

    gc.collect()
    # the bake source does not need 7.7M triangles (detail lives in the textures): ~2.5M keeps every UV seam and silhouette
    if len(head.data.polygons) > args.src_tris:
        for o in bpy.data.objects:
            o.select_set(o is head)
        bpy.context.view_layer.objects.active = head
        dm = head.modifiers.new('dec', 'DECIMATE')
        dm.ratio = args.src_tris / len(head.data.polygons)
        dm.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier='dec')
        log('bake source head decimated ->', len(head.data.polygons), 'tris')


    if args.stage == 'geo':
        preview('geo', VIEWS)
        sys.exit(0)

    # ------------------------------------------------------------------ 4. low-poly: one closed surface
    for o in bpy.data.objects:
        o.select_set(o in (body, head))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    high = body
    high.name = 'high'
    high.data.name = 'high'
    low_me = high.data.copy()
    low = bpy.data.objects.new('low', low_me)
    bpy.context.scene.collection.objects.link(low)
    for a_ in list(low_me.color_attributes):
        low_me.color_attributes.remove(a_)
    while low_me.uv_layers:
        low_me.uv_layers.remove(low_me.uv_layers[0])
    low_me.materials.clear()
    rm = low.modifiers.new('vox', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = args.voxel
    rm.adaptivity = 0.0
    bpy.context.view_layer.objects.active = low
    for o in bpy.data.objects:
        o.select_set(o is low)
    bpy.ops.object.modifier_apply(modifier='vox')
    log('voxel remesh', args.voxel, '->', len(low.data.polygons), 'faces')
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    log('saved', BLEND)

# protection weights: face (head skin + beard + ears, not hair) and hands keep their density
from scipy.spatial import cKDTree  # noqa: E402

hp_all = np.empty(len(high.data.vertices) * 3, np.float32)
high.data.vertices.foreach_get('co', hp_all)
hp_all = hp_all.reshape(-1, 3)
prot = np.empty(len(high.data.vertices), np.float32)
high.data.attributes['prot'].data.foreach_get('value', prot)
face_v = (prot > 1.5) & (prot < 2.5)
hands_v = (prot > 0.5) & (prot < 1.5)
hair_v = prot > 2.5
lv = np.empty(len(low.data.vertices) * 3)
low.data.vertices.foreach_get('co', lv)
lv = lv.reshape(-1, 3)
tree = cKDTree(hp_all)
_, nn = tree.query(lv, k=1, workers=-1)
wprot = (face_v[nn] | hands_v[nn]).astype(np.float32)
vg = low.vertex_groups.new(name='protect')
vg.add(np.nonzero(wprot > 0.5)[0].tolist(), 1.0, 'REPLACE')


def decimate(target, freeze_protected):
    """Collapse decimation where the frozen part keeps every vertex (Blender skips edges whose two vertices both
    have weight 0 in the modifier's group): two passes give the face/hands and the rest their own budgets."""
    now = len(low.data.polygons)
    dm = low.modifiers.new('dec', 'DECIMATE')
    dm.decimate_type = 'COLLAPSE'
    dm.ratio = min(1.0, target / max(1, now))
    dm.use_collapse_triangulate = True
    dm.vertex_group = 'protect'
    dm.invert_vertex_group = freeze_protected
    bpy.ops.object.modifier_apply(modifier='dec')
    return len(low.data.polygons)


bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.object.mode_set(mode='OBJECT')
me = low.data
pv = np.empty(len(me.polygons) * 3, np.int64)
me.polygons.foreach_get('vertices', pv)
tri_prot = wprot[pv.reshape(-1, 3)].min(1) > 0.5
n_prot = int(tri_prot.sum())
n1 = decimate(n_prot + (args.tris - args.face_tris), True)
log('pass 1 (rest ->', args.tris - args.face_tris, '):', n1, 'tris')
n2 = decimate(args.tris, False)
log('pass 2 (face + hands ->', args.face_tris, '):', n2, 'tris')
low.vertex_groups.clear()
log('decimated ->', len(low.data.polygons), 'tris (protected verts', int(wprot.sum()), ', protected tris before', n_prot, ')')

# ------------------------------------------------------------------ 5. UVs: angle-based islands, face islands enlarged
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
me = low.data
nf = len(me.polygons)
fc = np.empty(nf * 3)
me.polygons.foreach_get('center', fc)
fc = fc.reshape(-1, 3)
_, fnn = tree.query(fc, k=1, workers=-1)
fclass = np.where(face_v[fnn], 2, np.where(hands_v[fnn], 1, np.where(hair_v[fnn], 3, 0)))
bm = bmesh.new()
bm.from_mesh(me)
uvl = bm.loops.layers.uv.active
bm.faces.ensure_lookup_table()
parent = list(range(nf))


def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i


for e in bm.edges:
    if len(e.link_faces) != 2:
        continue
    f1, f2 = e.link_faces
    same = True
    for v in e.verts:
        l1 = [l for l in f1.loops if l.vert is v][0][uvl].uv
        l2 = [l for l in f2.loops if l.vert is v][0][uvl].uv
        if (l1 - l2).length > 1e-6:
            same = False
            break
    if same:
        a_, b_ = find(f1.index), find(f2.index)
        if a_ != b_:
            parent[a_] = b_
roots = np.array([find(i) for i in range(nf)])
FACTOR = {2: args.face_uv, 1: 1.4, 0: 1.0, 3: args.hair_uv}
nscaled = 0
for r in np.unique(roots):
    fs = np.nonzero(roots == r)[0]
    cls = np.bincount(fclass[fs], minlength=4).argmax()
    k = FACTOR[int(cls)]
    if k == 1.0:
        continue
    loops = [l for fi in fs for l in bm.faces[fi].loops]
    cu = sum((l[uvl].uv for l in loops), start=type(loops[0][uvl].uv)((0, 0))) / len(loops)
    for l in loops:
        l[uvl].uv = cu + (l[uvl].uv - cu) * k
    nscaled += 1
bm.to_mesh(me)
bm.free()
log('uv islands', len(np.unique(roots)), 'enlarged', nscaled)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=args.margin, shape_method='CONVEX')
bpy.ops.object.mode_set(mode='OBJECT')
log('uv packed')
del tree, hp_all, prot, face_v, hands_v, hair_v, lv, nn, wprot
gc.collect()

# ------------------------------------------------------------------ 6. bake colour + normal from the full-resolution sources
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = args.samples
sc.view_settings.view_transform = 'Standard'
bk = sc.render.bake
bk.use_selected_to_active = True
bk.cage_extrusion = args.cage
bk.max_ray_distance = args.cage * 2.5
bk.margin = 16
bk.margin_type = 'EXTEND'
lm = bpy.data.materials.new('jazeek')
lm.use_nodes = True
low.data.materials.append(lm)
target = lm.node_tree.nodes.new('ShaderNodeTexImage')
lm.node_tree.nodes.active = target
for o in bpy.data.objects:
    o.select_set(o in (high, low))
bpy.context.view_layer.objects.active = low


def uv_masks(size):
    """Texel masks (row 0 = top) of every face and of the hair faces of the low mesh."""
    from PIL import ImageDraw

    me = low.data
    uv = np.empty(len(me.loops) * 2, np.float32)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 3, 2) * size
    uv[..., 1] = size - uv[..., 1]
    m_all, m_hair = Image.new('L', (size, size), 0), Image.new('L', (size, size), 0)
    d_all, d_hair = ImageDraw.Draw(m_all), ImageDraw.Draw(m_hair)
    for i, t in enumerate(uv):
        pts = [tuple(t[0]), tuple(t[1]), tuple(t[2])]
        d_all.polygon(pts, fill=255)
        if fclass[i] == 3:
            d_hair.polygon(pts, fill=255)
    return np.asarray(m_all) > 0, np.asarray(m_hair) > 0


def cleanup(a):
    """Baked colour fixes: (1) ray misses (pure black texels inside the islands) filled from their neighbours;
    (2) in the hair, skin-coloured texels (rays that reached the scalp between the sculpted curls - the game copy's
    hair is one closed surface) turned into the hair colour."""
    from scipy import ndimage

    m_all, m_hair = uv_masks(a.shape[0])
    f = a.astype(np.float32)
    miss = (f.max(2) < 4) & m_all
    n_miss = int(miss.sum())
    valid = ~miss & m_all
    for _ in range(40):
        if not miss.any():
            break
        w = ndimage.uniform_filter(valid.astype(np.float32), 5)
        acc = np.stack([ndimage.uniform_filter(f[..., c] * valid, 5) for c in range(3)], -1)
        grow = miss & (w > 0.05)
        f[grow] = acc[grow] / w[grow, None]
        valid |= grow
        miss &= ~grow
    lum = f @ np.array([0.3, 0.59, 0.11], np.float32)
    hair_dark = m_hair & (lum < 45) & valid
    # the hair's own median, pulled toward a neutral dark brown (the sculpt's darkest texels lean purple)
    hcol = 0.5 * (np.median(f[hair_dark], 0) if hair_dark.sum() > 100 else 0) + 0.5 * np.array([30, 22, 19], np.float32)
    skin = (f[..., 0] - f[..., 2] > 25) & (lum > 55)
    wgt = smoothstep(55, 100, lum) * skin * ndimage.binary_dilation(m_hair, iterations=2)
    wgt = ndimage.gaussian_filter(wgt.astype(np.float32), 1.0)
    shade = np.clip(0.75 + lum / 400, 0.75, 1.15)[..., None]
    f = f * (1 - wgt[..., None]) + (hcol[None, None, :] * shade) * wgt[..., None]
    log('cleanup: ray misses filled', n_miss, '- hair colour', hcol.round(1), 'hair texels recoloured', int((wgt > 0.5).sum()))
    return np.clip(f, 0, 255).astype(np.uint8)


def bake(kind, name, noncolor):
    im = bpy.data.images.new(name, args.tex, args.tex, alpha=False)
    im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    target.image = im
    t = time.time()
    if kind == 'NORMAL':
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
    else:
        bpy.ops.object.bake(type='EMIT')
    px = np.empty(args.tex * args.tex * 4, np.float32)
    im.pixels.foreach_get(px)
    a = (np.clip(px.reshape(args.tex, args.tex, 4)[::-1, :, :3], 0, 1) * 255 + 0.5).astype(np.uint8)
    if kind == 'EMIT':
        a = cleanup(a)
    path = os.path.join(WORK, f'{name}.jpg')
    Image.fromarray(a).save(path, quality=args.quality, subsampling=0, optimize=True)
    log('baked', kind, f'{time.time() - t:.0f}s ->', path, f'{os.path.getsize(path) / 1e6:.1f} MB')
    return path


base_path = bake('EMIT', 'bake_base', False)
norm_path = bake('NORMAL', 'bake_normal', True)

# ------------------------------------------------------------------ 7. game material + export
nt = lm.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0
bsdf.inputs['Metallic'].default_value = 0.0
tb = nt.nodes.new('ShaderNodeTexImage')
tb.image = bpy.data.images.load(base_path)
nt.links.new(tb.outputs['Color'], bsdf.inputs['Base Color'])
tn = nt.nodes.new('ShaderNodeTexImage')
tn.image = bpy.data.images.load(norm_path)
tn.image.colorspace_settings.name = 'Non-Color'
nmap = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tn.outputs['Color'], nmap.inputs['Color'])
nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
nt.nodes.remove(target)
me = low.data
me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
for o in bpy.data.objects:
    o.select_set(o is low)
bpy.context.view_layer.objects.active = low
if args.preview:
    high.hide_render = True
    preview('final', VIEWS, objs=[low])
OUT = os.path.join(CACHE, f"{C['fighter']}_src.glb")
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
                          export_tangents=False, export_materials='EXPORT', export_image_format='AUTO', export_yup=True,
                          export_apply=False)
log('wrote', OUT, f'{os.path.getsize(OUT) / 1e6:.1f} MB', len(me.polygons), 'tris')
