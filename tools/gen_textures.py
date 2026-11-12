"""Procedural, seamless 1K PBR texture generator for VOID.

Outputs <name>_albedo.jpg plus <name>_{normal,roughness[,metallic]}.png to public/textures.
Normal maps use the OpenGL / three.js convention (+Y = up in UV space).

Usage (from repo root):
    pip install -r tools/requirements.txt
    python tools/gen_textures.py [outdir] [set_name ...]
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

N = 1024
OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/textures'
ONLY = set(sys.argv[2:])

Y, X = np.mgrid[0:N, 0:N].astype(np.float32)
FX = np.fft.fftfreq(N)[None, :]
FY = np.fft.fftfreq(N)[:, None]


# ---------------------------------------------------------------- helpers
def noise(seed, beta=2.0, ax=1.0, ay=1.0, lo=0.0, hi=0.5):
    """Periodic (tileable) spectral noise, z-scored. ax/ay > 1 squash frequencies on that axis (stretch features)."""
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((N, N))
    f = np.sqrt((FX * ax) ** 2 + (FY * ay) ** 2)
    f[0, 0] = 1.0
    amp = 1.0 / f ** (beta * 0.5)
    amp[(f < lo) | (f > hi)] = 0.0
    amp[0, 0] = 0.0
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    return ((r - r.mean()) / (r.std() + 1e-8)).astype(np.float32)


def blur(a, sigma):
    f2 = FX ** 2 + FY ** 2
    g = np.exp(-2 * (np.pi ** 2) * (sigma ** 2) * f2)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g)).astype(np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def wrapd(a, c):
    """Periodic signed distance on the texture torus."""
    d = a - c
    return (d + N / 2) % N - N / 2


def sd_round_rect(cx, cy, hw, hh, r):
    dx = np.abs(wrapd(X, cx)) - (hw - r)
    dy = np.abs(wrapd(Y, cy)) - (hh - r)
    out = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2)
    ins = np.minimum(np.maximum(dx, dy), 0)
    return out + ins - r


def sd_circle(cx, cy, r):
    return np.sqrt(wrapd(X, cx) ** 2 + wrapd(Y, cy) ** 2) - r


def groove_lines(coord, period, width, offset=0.0):
    """0 at line centre -> 1 away from it, periodic lines every `period` px."""
    d = np.abs(((coord - offset) % period) - period / 2)
    d = period / 2 - d
    return smoothstep(width * 0.5, width * 0.5 + 2.5, d)


def to_normal(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx = -dx * strength
    ny = dy * strength  # rows go down, UV v goes up => +Y green-up
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return Image.fromarray(np.clip((n * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')


def rgb(a):
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB')


def gray(a):
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'L')


def mix(a, b, t):
    t = t[..., None] if (np.ndim(t) == 2 and np.ndim(a) == 3) else t
    return a * (1 - t) + b * t


def col(c):
    return np.array(c, np.float32)[None, None, :]


def save(name, albedo, height, nstrength, rough, metal=None):
    if ONLY and name not in ONLY:
        return
    os.makedirs(OUT, exist_ok=True)
    rgb(albedo).save(f'{OUT}/{name}_albedo.jpg', quality=92, subsampling=0, optimize=True)
    to_normal(height, nstrength).save(f'{OUT}/{name}_normal.png', optimize=True)
    gray(rough).save(f'{OUT}/{name}_roughness.png', optimize=True)
    if metal is not None:
        gray(metal).save(f'{OUT}/{name}_metallic.png', optimize=True)
    print('wrote', name)


def text_mask(items, font_px):
    """Render stencil text/labels into a float mask. items: (x, y, text)."""
    img = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=font_px)
    except TypeError:
        font = ImageFont.load_default()
    for x, y, t in items:
        d.text((x, y), t, fill=255, font=font)
    return np.asarray(img, np.float32) / 255.0


def rect_mask(x0, y0, x1, y1, soft=1.0):
    return smoothstep(-soft, soft, -sd_round_rect((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0.0))


# ---------------------------------------------------------------- 1. arch_panel
def arch_panel():
    # White hull panels (symmetry-modular-corridor / seating-shuttle-cabin): 2m panels, staggered seams,
    # chamfered inset sub-panels, vent slots, fasteners and small grey stencil labels.
    h = np.zeros((N, N), np.float32)
    seam = np.minimum(groove_lines(X, 512, 6), 1.0)
    left = (X % 1024) < 512
    hseam = np.where(left, groove_lines(Y, 1024, 6, offset=320 - 512), groove_lines(Y, 1024, 6, offset=704 - 512))
    hseam = np.minimum(hseam, groove_lines(Y, 1024, 6, offset=-512 + 0))  # top/bottom edge line
    seams = np.minimum(seam, hseam)
    h += (seams - 1.0) * 1.2

    # Chamfered inset per panel
    inset = np.zeros_like(h)
    panels = [(256, 672, 212, 312), (256, 160, 212, 120), (768, 352, 212, 312), (768, 864, 212, 120)]
    for cx, cy, hw, hh in panels:
        d = sd_round_rect(cx, cy, hw, hh, 22)
        inset = np.maximum(inset, smoothstep(2, -10, d))
    h -= inset * 0.35

    # Vent slot bank (bottom-left) & small grille (right)
    vent = np.zeros_like(h)
    for i in range(7):
        vent = np.maximum(vent, smoothstep(1.5, -1.5, sd_round_rect(256, 870 + i * 18, 120, 5, 5)))
    for i in range(5):
        vent = np.maximum(vent, smoothstep(1.5, -1.5, sd_round_rect(930 - i * 0, 560 + i * 16, 36, 4, 4)))
    h -= vent * 0.9

    # Fasteners at panel corners
    bolts = np.zeros_like(h)
    # Seam rows: left column at y=320 & y=0, right column at y=704 & y=0
    for (x0, x1, rows) in ((0, 512, (0, 320)), (512, 1024, (0, 704))):
        for ry in rows:
            for cy in (ry + 18, ry - 18):
                for cx in (x0 + 18, x1 - 18):
                    bolts = np.maximum(bolts, smoothstep(1.2, -1.2, sd_circle(cx, cy % N, 6)))
    h += bolts * 0.45

    # Labels / stencil text (grey ink, no height)
    ink = text_mask([(560, 40, 'HIR.SYS'), (560, 72, 'SEC-07 / 001'), (60, 360, '02'), (582, 760, 'LOAD 400KG'),
                     (60, 400, 'VNT-A')], 22)
    lab = rect_mask(560, 112, 700, 120) + rect_mask(60, 438, 150, 446)
    for i in range(14):
        lab += rect_mask(830 + i * 9, 40, 834 + i * 9, 40 + (28 if i % 3 else 40))  # barcode
    lab = np.clip(lab, 0, 1)
    ink = np.clip(ink + lab, 0, 1)

    mott = noise(11, 2.4) * 0.012 + noise(12, 1.0, lo=0.05) * 0.006
    ao = blur(np.minimum(seams, 1 - vent * 0.8) - 1.0, 3.0)  # negative near grooves
    base = 0.90 + mott + ao * 0.25 - inset * 0.015
    albedo = np.repeat(base[..., None], 3, -1) * col([0.985, 0.99, 1.0])
    albedo = mix(albedo, col([0.33, 0.35, 0.38]), ink * 0.85)
    albedo = mix(albedo, col([0.16, 0.17, 0.19]), vent)
    albedo = mix(albedo, col([0.62, 0.64, 0.67]), bolts)

    smudge = noise(13, 2.6)
    rough = 0.40 + smudge * 0.05 + (1 - seams) * 0.30 + vent * 0.15 + ink * 0.08 - bolts * 0.15
    metal = np.clip(0.04 + vent * 0.85 + bolts * 0.9, 0, 1)
    h += noise(14, 3.0) * 0.004 + noise(15, 0.6, lo=0.15) * 0.003
    save('arch_panel', albedo, h, 9.0, np.clip(rough, 0.05, 1), metal)


# ---------------------------------------------------------------- 2. mech_armor
def mech_armor():
    # Glossy ceramic armour plate (boss-white-katana-mech / chassis-orange-optic-android). UVs span 0..1 per face,
    # so the design reads as one plate: bevelled rim, angular seam, stencil block, fasteners and chipped edges.
    ex = np.minimum(X, N - 1 - X)
    ey = np.minimum(Y, N - 1 - Y)
    edge = np.minimum(ex, ey)
    rim = smoothstep(4, 46, edge)
    h = rim * 1.0 - (1 - smoothstep(0, 6, edge)) * 0.4

    # Angular seam: horizontal at 0.6, kinks diagonally up to the right
    yl = np.where(X < 600, 610.0, 610.0 - (X - 600) * 0.75)
    yl = np.maximum(yl, 300)
    s1 = smoothstep(3, 6, np.abs(Y - yl))
    s2 = np.where(Y > yl, smoothstep(3, 6, np.abs(X - 360)), 1.0)
    seams = np.minimum(s1, s2)
    seams = np.where(edge < 50, 1.0, seams)
    h -= (1 - seams) * 0.8
    # slightly raised lower-right plate
    raised = smoothstep(0, 8, Y - yl - 6) * smoothstep(0, 8, X - 366) * smoothstep(0, 10, edge - 50)
    h += raised * 0.25

    bolts = np.zeros_like(h)
    for cx, cy in ((80, 80), (944, 80), (80, 944), (944, 944), (410, 700), (410, 940)):
        bolts = np.maximum(bolts, smoothstep(1.2, -1.2, sd_circle(cx, cy, 11)))
    h += bolts * 0.5

    ink = text_mask([(450, 690, 'HIR-00'), (450, 760, 'UNIT 001'), (450, 820, 'CERAMIC / C-7')], 44)
    ink[:, :] = np.maximum(ink, text_mask([(90, 120, '01')], 120))
    ticks = np.zeros_like(h)
    for i in range(9):
        ticks = np.maximum(ticks, rect_mask(450 + i * 22, 890, 460 + i * 22, 890 + (34 if i % 4 == 0 else 20)))
    ink = np.clip(ink + ticks, 0, 1)

    # Edge wear: chips exposing bare metal near rim and seams
    wearzone = (1 - smoothstep(30, 90, edge)) + (1 - smoothstep(4, 24, np.abs(Y - yl))) * 0.7
    chips = smoothstep(0.9, 1.3, noise(21, 2.6, lo=0.004)) * smoothstep(0.35, 0.9, wearzone)
    h -= chips * 0.15

    mott = noise(22, 2.3) * 0.015
    grime = blur(seams - 1.0, 4.0)
    base = 0.90 + mott + grime * 0.35 - (1 - rim) * 0.05
    albedo = np.repeat(base[..., None], 3, -1)
    albedo = mix(albedo, col([0.15, 0.15, 0.17]), ink * 0.9)
    albedo = mix(albedo, col([0.58, 0.59, 0.60]), chips)
    albedo = mix(albedo, col([0.30, 0.31, 0.33]), bolts)

    rough = 0.30 + noise(23, 2.5) * 0.04 + (1 - seams) * 0.35 + ink * 0.10 + chips * 0.05
    metal = np.clip(chips * 0.95 + bolts * 0.9 + (1 - seams) * 0.3, 0, 1)
    h += noise(24, 3.2) * 0.003
    save('mech_armor', albedo, h, 6.0, np.clip(rough, 0.05, 1), metal)


# ---------------------------------------------------------------- 3. dark_titanium
def dark_titanium():
    # Brushed dark titanium panels: 4x2 grid, per-panel tone/brush direction, hex fasteners, heat-tint hints.
    pw, ph = 256, 512
    sx = groove_lines(X, pw, 5)
    sy = groove_lines(Y, ph, 5)
    seams = np.minimum(sx, sy)
    pi = (X // pw).astype(int) + 4 * (Y // ph).astype(int)
    rng = np.random.default_rng(31)
    tone = rng.uniform(-0.025, 0.025, 8)[pi]
    brushH = noise(32, 1.6, ax=0.04, ay=1.0)
    brushV = noise(33, 1.6, ax=1.0, ay=0.04)
    vertical = np.isin(pi, [1, 4, 6])
    brush = np.where(vertical, brushV, brushH)

    bolts = np.zeros_like(X)
    for bx in range(4):
        for by in range(2):
            for ox, oy in ((18, 18), (pw - 18, 18), (18, ph - 18), (pw - 18, ph - 18)):
                bolts = np.maximum(bolts, smoothstep(1.2, -1.2, sd_circle(bx * pw + ox, by * ph + oy, 6.5)))
    h = (seams - 1) * 1.0 + bolts * 0.4 + brush * 0.012 + noise(34, 2.8) * 0.01
    ink = text_mask([(530, 548, 'Ti-6Al-4V'), (24, 980, 'HIR')], 20)

    tint = smoothstep(1.4, 2.4, noise(35, 2.8))
    base = 0.25 + tone + brush * 0.018 + blur(seams - 1, 3) * 0.2
    albedo = np.repeat(base[..., None], 3, -1) * col([0.96, 0.98, 1.03])
    albedo = mix(albedo, col([0.26, 0.24, 0.32]), tint * 0.5)
    albedo = mix(albedo, col([0.55, 0.56, 0.58]), ink * 0.5)
    albedo = mix(albedo, col([0.42, 0.43, 0.45]), bolts)
    rough = 0.30 + brush * 0.035 + tone * 1.5 + (1 - seams) * 0.35 + noise(36, 2.4) * 0.03
    metal = np.clip(0.92 - (1 - seams) * 0.5 - ink * 0.6, 0, 1)
    save('dark_titanium', albedo, h, 7.0, np.clip(rough, 0.05, 1), metal)


# ---------------------------------------------------------------- 4. marble_tile
def marble_tile():
    # Large-format polished white stone tiles (shuttle cabin / gallery / observation floors) with soft veining.
    seams = np.minimum(groove_lines(X, 512, 3), groove_lines(Y, 512, 3))
    warp = noise(41, 2.2) * 2.0
    v1 = 1 - np.abs(np.sin((X * 0.004 + Y * 0.0062) * 2 * np.pi * 1.0 + warp * 1.6 + noise(42, 1.8) * 0.8))
    veins = smoothstep(0.86, 0.995, v1) * smoothstep(-0.6, 0.8, noise(43, 2.0))
    fine = smoothstep(0.93, 0.998, 1 - np.abs(np.sin(noise(44, 1.6) * 3.0))) * 0.5
    pi = (X // 512).astype(int) + 2 * (Y // 512).astype(int)
    tone = np.random.default_rng(45).uniform(-0.012, 0.012, 4)[pi]
    cloud = noise(46, 2.6) * 0.012
    base = 0.93 + tone + cloud - veins * 0.22 - fine * 0.06
    albedo = np.repeat(base[..., None], 3, -1) * col([0.995, 0.997, 1.0])
    albedo = mix(albedo, col([0.62, 0.64, 0.66]), 1 - seams)
    h = (seams - 1) * 0.5 - veins * 0.02 + noise(47, 3.0) * 0.002
    rough = 0.10 + noise(48, 2.4) * 0.025 + veins * 0.06 + (1 - seams) * 0.6
    save('marble_tile', albedo, h, 5.0, np.clip(rough, 0.03, 1))


# ---------------------------------------------------------------- 5. brutalist_concrete
def brutalist_concrete():
    # Pale off-form concrete (geometry-vaulted-concrete-arches / scale-buttress-megalith): 2m x 1m pour panels,
    # form-tie holes, board grain, mottling, pores and vertical weathering streaks.
    seams = np.minimum(groove_lines(X, 512, 3), groove_lines(Y, 256, 3))
    ties = np.zeros_like(X)
    tie_rim = np.zeros_like(X)
    for px in range(2):
        for py in range(4):
            for ox in (128, 384):
                d = sd_circle(px * 512 + ox, py * 256 + 128, 8)
                ties = np.maximum(ties, smoothstep(1.0, -1.0, d))
                tie_rim = np.maximum(tie_rim, smoothstep(10, 0, d) * (1 - smoothstep(1.0, -1.0, d)))
    grain = noise(51, 1.8, ax=0.05, ay=1.0)
    mott = noise(52, 2.0) * 0.6 + noise(53, 1.2, lo=0.02) * 0.4
    pores_n = noise(54, 0.0, lo=0.15)
    pores = smoothstep(2.6, 3.2, pores_n)
    streak = noise(55, 1.4, ax=1.0, ay=0.03)
    stain = smoothstep(0.2, 1.8, streak) * smoothstep(-0.8, 0.8, noise(56, 2.4))
    # streaks hanging below tie holes
    drip = np.zeros_like(X)
    for px in range(2):
        for py in range(4):
            for ox in (128, 384):
                cx, cy = px * 512 + ox, py * 256 + 128
                dx = np.abs(wrapd(X, cx))
                dy = wrapd(Y, cy)
                drip = np.maximum(drip, smoothstep(10, 2, dx) * smoothstep(0, 8, dy) * smoothstep(120, 0, dy))
    drip = blur(drip, 2.0) * (0.6 + 0.4 * smoothstep(-1, 1, streak))

    base = 0.60 + mott * 0.035 + grain * 0.01 - stain * 0.07 - drip * 0.10 - pores * 0.18 + blur(seams - 1, 2) * 0.12
    albedo = np.repeat(base[..., None], 3, -1) * col([1.0, 0.995, 0.985])
    albedo = mix(albedo, col([0.18, 0.18, 0.19]), ties)
    h = (seams - 1) * 0.6 - ties * 1.0 - tie_rim * 0.05 + grain * 0.025 + mott * 0.02 - pores * 0.25 + noise(57, 2.9) * 0.01
    rough = 0.88 + mott * 0.02 - stain * 0.04 + pores * 0.05
    save('brutalist_concrete', albedo, h, 6.0, np.clip(rough, 0.05, 1))


# ---------------------------------------------------------------- 6. runner_tread
def runner_tread():
    # Safety-orange ribbed runner (palette-skybridge-corridor / kinetic-curved-concourse). Seamless across both axes.
    ribs = 40
    ph = (X / N) * ribs * 2 * np.pi
    rib = 0.5 + 0.5 * np.cos(ph)
    rib = smoothstep(0.15, 0.6, rib)
    wear = smoothstep(0.4, 1.8, noise(61, 2.0, ax=1.0, ay=0.25))
    scuff = smoothstep(1.6, 2.6, noise(62, 1.3, ax=0.3, ay=1.0))
    mott = noise(63, 2.4) * 0.02
    o = col([0.95, 0.38, 0.09])
    albedo = o * (0.86 + rib[..., None] * 0.14 + mott[..., None])
    albedo = mix(albedo, col([1.0, 0.52, 0.22]), wear * 0.25 * rib)
    albedo = mix(albedo, col([0.40, 0.18, 0.08]), scuff * 0.25)
    h = rib * 0.6 - scuff * 0.05 + noise(64, 3.0) * 0.006
    rough = 0.48 - rib * 0.08 + wear * 0.06 + scuff * 0.1 + noise(65, 2.6) * 0.03
    save('runner_tread', albedo, h, 4.0, np.clip(rough, 0.05, 1))


# ---------------------------------------------------------------- 7. void_sand
def void_sand():
    # Pale wind-rippled dune sand (weathering-rusted-snow-pillars / silhouette-white-dune-spires).
    warp = noise(71, 3.0, hi=0.012) * 1.0 + noise(72, 2.0, hi=0.03) * 0.12
    k = 13
    ph = (Y / N) * k * 2 * np.pi + (X / N) * 2 * np.pi * 2 + warp * 2.2
    s = np.sin(ph)
    ripple = s + 0.32 * np.sin(2 * ph + 0.9)  # asymmetric crest (steep lee face)
    fineph = (Y / N) * 61 * 2 * np.pi + (X / N) * 2 * np.pi * 5 + warp * 4.0 + noise(73, 2.5, hi=0.05) * 0.5
    fine = np.sin(fineph) * 0.18
    dune = noise(74, 3.0, hi=0.01) * 0.8
    grains = noise(75, 0.0, lo=0.2)
    h = ripple * 1.0 + fine * 0.6 + dune * 0.5 + grains * 0.006
    shade = blur(ripple, 2.0)
    base = col([0.84, 0.80, 0.73])
    albedo = base * (0.93 + shade[..., None] * 0.06 + noise(76, 2.4)[..., None] * 0.025)
    albedo = mix(albedo, col([0.70, 0.62, 0.52]), smoothstep(0.5, 2.0, noise(77, 2.8)) * 0.35)
    sparkle = smoothstep(3.0, 3.6, grains)
    albedo = mix(albedo, col([0.97, 0.96, 0.94]), sparkle)
    albedo = mix(albedo, col([0.38, 0.34, 0.30]), smoothstep(3.0, 3.8, -grains) * 0.7)
    rough = 0.90 + noise(78, 2.0) * 0.03 - sparkle * 0.4
    save('void_sand', albedo, h, 6.0, np.clip(rough, 0.05, 1))


# ---------------------------------------------------------------- 8. void_causeway
def void_causeway():
    # Wet obsidian flagstones (threshold-neon-void-portal floor) with chipped bevels, cracks and mirror puddles.
    row = (Y // 256).astype(int)
    xo = X + np.where(row % 2 == 1, 256, 0)
    jitter = noise(81, 2.2) * 2.5
    gx = groove_lines(xo + jitter, 512, 7)
    gy = groove_lines(Y + jitter, 256, 7)
    joint = np.minimum(gx, gy)
    dx = np.abs(((xo + jitter) % 512) - 256)
    dy = np.abs(((Y + jitter) % 256) - 128)
    edge = np.minimum(256 - dx, 128 - dy)
    chip = noise(82, 1.4, lo=0.01) * 6
    bevel = smoothstep(4, 22 + chip, edge)
    bi = ((xo // 512).astype(int) % 2) + 2 * (row % 4)
    tone = np.random.default_rng(83).uniform(-0.03, 0.03, 8)[bi]
    crackn = np.abs(noise(84, 2.0))
    cracks = (1 - smoothstep(0.0, 0.035, crackn)) * smoothstep(0.6, 1.4, noise(85, 2.4))
    puddle = smoothstep(1.0, 1.5, noise(86, 3.2) + noise(87, 1.8) * 0.12) * bevel
    h = bevel * 1.0 + noise(88, 2.2) * 0.03 + noise(89, 0.8, lo=0.1) * 0.01 - cracks * 0.15
    h = np.where(puddle > 0.5, np.maximum(h, 1.0 + 0.0), h)
    base = 0.16 + tone + noise(90, 2.4) * 0.018 - cracks * 0.06
    albedo = np.repeat(base[..., None], 3, -1) * col([0.94, 0.98, 1.06])
    albedo = mix(albedo, col([0.07, 0.075, 0.09]), 1 - joint)
    albedo = albedo * (1 - puddle[..., None] * 0.18)
    rough = 0.55 + noise(91, 2.2) * 0.06 + (1 - joint) * 0.35 + cracks * 0.2
    rough = mix(rough, 0.04, puddle)
    metal = np.clip(0.02 + puddle * 0.0, 0, 1)
    save('void_causeway', albedo, h, 6.0, np.clip(rough, 0.02, 1), metal)


# ---------------------------------------------------------------- 9. crimson_monolith
def crimson_monolith():
    # Smooth matte monolith skin (colossus-crimson-wedge-shore); fine horizontal strata, two shallow pour joints.
    strata = noise(101, 1.6, ax=0.02, ay=1.0)
    joints = groove_lines(Y, 512, 3, offset=0)
    large = noise(102, 3.2)
    base = 0.90 + large * 0.025 + strata * 0.012 + blur(joints - 1, 2) * 0.1
    albedo = np.repeat(base[..., None], 3, -1)
    h = strata * 0.02 + large * 0.02 + (joints - 1) * 0.35 + noise(103, 2.8) * 0.006
    rough = 0.62 + noise(104, 2.4) * 0.04 + (1 - joints) * 0.2
    save('crimson_monolith', albedo, h, 6.0, np.clip(rough, 0.05, 1))


# ---------------------------------------------------------------- 10. rusted_corten (NEW)
def rusted_corten():
    # Weathering steel slabs (weathering-rusted-snow-pillars-11): 1m plates, weld beads, streaks, flaking & pitting.
    vs = groove_lines(X, 256, 4)
    hs = groove_lines(Y, 512, 4, offset=128)
    seams = np.minimum(vs, hs)
    weld = (1 - smoothstep(2, 7, np.abs(wrapd(Y, 640)))) * smoothstep(0, 3, np.abs(wrapd(X, 0)) - 2)
    streak = noise(111, 1.4, ax=1.0, ay=0.03)
    big = noise(112, 2.4)
    flake = smoothstep(0.6, 1.2, noise(113, 1.8, lo=0.01))
    pits = smoothstep(2.4, 3.0, noise(114, 0.0, lo=0.18))
    t = np.clip(0.5 + big * 0.22 + streak * 0.12, 0, 1)
    dark = col([0.20, 0.10, 0.055])
    mid = col([0.45, 0.21, 0.08])
    hi = col([0.66, 0.35, 0.13])
    albedo = mix(dark, mid, smoothstep(0.0, 0.55, t))
    albedo = mix(albedo, hi, smoothstep(0.55, 1.0, t))
    albedo = mix(albedo, col([0.75, 0.45, 0.18]), flake * 0.35)
    albedo = mix(albedo, col([0.12, 0.07, 0.05]), pits * 0.8)
    albedo = mix(albedo, col([0.14, 0.08, 0.05]), (1 - seams) * 0.8)
    albedo = albedo * (1 + blur(seams - 1, 4)[..., None] * 0.4)
    h = (seams - 1) * 0.7 + weld * 0.4 + flake * 0.12 - pits * 0.3 + noise(115, 2.0) * 0.05 + streak * 0.01
    rough = 0.82 + noise(116, 2.2) * 0.05 + pits * 0.08 - flake * 0.05
    metal = np.clip(0.05 + smoothstep(2.0, 2.6, noise(117, 2.2)) * 0.6, 0, 1)
    save('rusted_corten', albedo, h, 6.0, np.clip(rough, 0.05, 1), metal)


for fn in (arch_panel, mech_armor, dark_titanium, marble_tile, brutalist_concrete, runner_tread,
           void_sand, void_causeway, crimson_monolith, rusted_corten):
    fn()
