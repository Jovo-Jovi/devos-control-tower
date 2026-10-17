import numpy as np, sys
from PIL import Image, ImageFilter
out = sys.argv[1]
rng = np.random.default_rng(3)

def vnoise(w, h, px, py, seed, wrap=True):
    r = np.random.default_rng(seed); g = r.random((py + 1, px + (0 if wrap else 1)))
    xs = np.linspace(0, px, w, endpoint=False); ys = np.linspace(0, py, h, endpoint=False)
    x0 = np.floor(xs).astype(int); fx = xs - x0; x1 = (x0 + 1) % g.shape[1]
    y0 = np.floor(ys).astype(int); fy = ys - y0; y1 = np.minimum(y0 + 1, py)
    sx = fx*fx*(3-2*fx); sy = fy*fy*(3-2*fy)
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
    t = a + (b-a)*sx; u = c + (d-c)*sx
    return t + (u-t)*sy[:, None]
def fbm(w, h, bx, by, octs, seed, gain=.5):
    s = np.zeros((h, w)); a = 1; n = 0
    for o in range(octs):
        s += a * vnoise(w, h, bx*2**o, by*2**o, seed+o*31); n += a; a *= gain
    return s / n

# ---------- NIGHT: full-sky starfield, star band, crimson nebula, horizon glow ----------
W, H = 2400, 1350
y = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
x = np.linspace(0, 1, W)[None, :] * np.ones((H, 1))
base = np.zeros((H, W, 3))
top = np.array([5, 5, 9.]); mid = np.array([14, 6, 9.]); hor = np.array([62, 8, 12.])
t = np.clip((y - .5) / .35, 0, 1)
base = top + (mid - top) * np.clip(y / .35, 0, 1)[..., None]
base = base + (hor - base) * (t ** 2.2)[..., None]
# diagonal star band
d = (y - (0.62 - 0.55 * x))  # band line
band = np.exp(-(d / 0.13) ** 2)
neb = fbm(W, H, 6, 4, 6, 11)
dust = fbm(W, H, 10, 6, 7, 21)
bandv = band * np.clip(neb * 1.4 - .25, 0, 1)
base += bandv[..., None] * np.array([58, 52, 66.])
base -= (band * np.clip(dust - .55, 0, 1) * 2.2)[..., None] * np.array([30, 26, 30.])
# crimson nebula wisps
red = fbm(W, H, 4, 3, 6, 99)
redm = np.clip(red - .56, 0, 1) * 2.2 * np.clip(1 - y * 1.1, 0, 1)
base += redm[..., None] * np.array([90, 12, 22.])
# stars: density higher in band
n_stars = 14000
sx = rng.random(n_stars) * W; sy = rng.random(n_stars) * H * 0.9
keep = rng.random(n_stars) < (0.35 + 0.65 * np.exp(-(((sy / H) - (0.62 - 0.55 * sx / W)) / 0.16) ** 2))
sx, sy = sx[keep], sy[keep]
mag = rng.pareto(2.6, len(sx)) * 0.25 + 0.08
mag = np.clip(mag, 0, 1.6)
temp = rng.random(len(sx))
col = np.where(temp[:, None] < .15, [255, 200, 170], np.where(temp[:, None] > .85, [190, 210, 255], [255, 250, 245])).astype(float)
star = np.zeros((H, W, 3))
ix = sx.astype(int); iy = sy.astype(int)
np.add.at(star, (iy, ix), col * (mag[:, None]))
glow = np.asarray(Image.fromarray(np.clip(star, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), float)
big = mag > .9
star2 = np.zeros((H, W, 3)); np.add.at(star2, (iy[big], ix[big]), col[big] * 2.2)
halo = np.asarray(Image.fromarray(np.clip(star2, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)), float)
img = base + star * 1.6 + glow * 3.2 + halo * 1.6
img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img).save(f'{out}/sky-night.jpg', quality=86, optimize=True, progressive=True)

# ---------- DAY: full-sky cloud layer with lighting (alpha PNG, seamless in x, 2x width for drift) ----------
CW, CH = 3200, 1100
c1 = fbm(CW, CH, 8, 3, 7, 501)
c2 = fbm(CW, CH, 24, 9, 4, 777)
yy = np.linspace(0, 1, CH)[:, None]
# perspective: clouds flatter and denser toward horizon
dens = c1 * .66 + c2 * .34
cov = 0.535 - 0.05 * yy  # more coverage lower
a = np.clip((dens - cov) / .09, 0, 1)
a = a ** 1.2
# lighting: brighter tops, shaded bottoms (sample density slightly above)
up = np.roll(dens, 6, axis=0)
shade = np.clip((dens - up) * 9, -1, 1)
r = 255 - np.clip(shade, 0, 1) * 70
g = 255 - np.clip(shade, 0, 1) * 62
b = 255 - np.clip(shade, 0, 1) * 40
warm = np.clip(yy * 1.2 - .6, 0, 1)  # warm tint near horizon
r = r - 0 * warm; g = g - 8 * warm; b = b - 22 * warm
rgba = np.dstack([r * np.ones_like(a), g * np.ones_like(a), b * np.ones_like(a), a * 235]).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(f'{out}/sky-clouds.png', optimize=True)

# day sky gradient (opaque)
DW, DH = 1600, 900
yy = np.linspace(0, 1, DH)[:, None] * np.ones((1, DW))
xx = np.linspace(-1, 1, DW)[None, :] * np.ones((DH, 1))
top = np.array([96, 150, 222.]); midc = np.array([168, 204, 240.]); hz = np.array([250, 242, 228.])
sky = top + (midc - top) * np.clip(yy / .45, 0, 1)[..., None]
sky = sky + (hz - sky) * (np.clip((yy - .45) / .3, 0, 1) ** 1.4)[..., None]
sun = np.exp(-((xx) ** 2 / .08 + (yy - .05) ** 2 / .05))
sky = sky + sun[..., None] * np.array([60, 50, 30.])
Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8)).save(f'{out}/sky-day.jpg', quality=88, optimize=True, progressive=True)
print('done')
