import numpy as np
from PIL import Image, ImageFilter
import sys
out = sys.argv[1]
W, H = 1360, 680
rng = np.random.default_rng(42)

def value_noise(w, h, px, py, seed):
    """Smooth value noise, periodic in x with period px cells (seamless horizontally)."""
    r = np.random.default_rng(seed)
    grid = r.random((py + 1, px))
    xs = np.linspace(0, px, w, endpoint=False)
    ys = np.linspace(0, py, h, endpoint=False)
    x0 = np.floor(xs).astype(int); fx = xs - x0; x1 = (x0 + 1) % px
    y0 = np.floor(ys).astype(int); fy = ys - y0; y1 = np.minimum(y0 + 1, py)
    sx = fx * fx * (3 - 2 * fx); sy = fy * fy * (3 - 2 * fy)
    a = grid[y0][:, x0]; b = grid[y0][:, x1]; c = grid[y1][:, x0]; d = grid[y1][:, x1]
    top = a + (b - a) * sx[None, :]; bot = c + (d - c) * sx[None, :]
    return top + (bot - top) * sy[:, None]

def fbm(w, h, base, octaves, seed, aspect=0.5, gain=0.5):
    tot = np.zeros((h, w)); amp = 1.0; norm = 0
    for o in range(octaves):
        p = base * 2 ** o
        tot += amp * value_noise(w, h, p, max(1, int(p * aspect)), seed + o * 101)
        norm += amp; amp *= gain
    return tot / norm

def warp_fbm(seed, base, octaves):
    # domain warp via two fbm fields for more natural continents
    q = fbm(W, H, base, 4, seed + 7)
    n = fbm(W, H, base, octaves, seed)
    shift = ((q - 0.5) * 120).astype(int)
    idx = (np.arange(W)[None, :] + shift) % W
    return np.take_along_axis(n, idx, axis=1)

lat = np.abs(np.linspace(-1, 1, H))[:, None] * np.ones((1, W))
h = warp_fbm(1, 6, 8)
h = (h - h.min()) / (h.max() - h.min())
moist = fbm(W, H, 5, 5, 77) * 0.8 + (1 - lat) * 0.35
sea = 0.535

def lerp(a, b, t): return a + (b - a) * np.clip(t, 0, 1)[..., None]
C = lambda hexs: np.array([int(hexs[i:i+2], 16) for i in (1, 3, 5)], float)

img = np.zeros((H, W, 3))
ocean_t = np.clip((h - 0.25) / (sea - 0.25), 0, 1)
ocean = lerp(C('#071d3d'), C('#2a6aa6'), ocean_t ** 1.6)
land_t = np.clip((h - sea) / (1 - sea), 0, 1)
low = lerp(C('#3e6a33'), C('#76804a'), land_t * 1.6)
desert = lerp(C('#c9a96e'), C('#a8865a'), land_t)
land = lerp(desert, low, np.clip((moist - 0.38) * 4, 0, 1))
land = lerp(land, C('#7f756a'), np.clip((land_t - 0.45) * 3, 0, 1))
land = lerp(land, C('#f2f4f6'), np.clip((land_t - 0.78) * 6, 0, 1))
coast = np.clip((h - sea) / 0.012, 0, 1)
img = lerp(ocean, land, coast)
ice_n = fbm(W, H, 8, 4, 303)
ice = np.clip((lat - 0.84 + (ice_n - 0.5) * 0.25) * 10, 0, 1)
img = lerp(img, C('#eef3f7'), ice)
Image.fromarray(img.astype(np.uint8)).save(f'{out}/planet-land.png', optimize=True)

# clouds: stretched horizontally, alpha
cl = fbm(W, H, 7, 7, 909, aspect=1.3)
cl2 = fbm(W, H, 20, 4, 515, aspect=1.6)
c = cl * 0.75 + cl2 * 0.25
alpha = np.clip((c - 0.52) / 0.16, 0, 1) ** 1.5
alpha *= 0.92
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(f'{out}/planet-clouds.png', optimize=True)

# night lights: only on land, clustered near coasts and in moist lowlands
cityn = fbm(W, H, 48, 3, 1212, aspect=0.5)
cluster = fbm(W, H, 10, 3, 4545)
on_land = (h > sea + 0.004) & (lat < 0.78)
near_coast = np.clip(1 - (h - sea) / 0.12, 0, 1)
dens = np.clip((cluster - 0.45) * 3, 0, 1) * (0.4 + 0.6 * near_coast)
spark = rng.random((H, W))
lit = on_land & (spark < dens * 0.09 + np.clip((cityn - 0.62) * 0.6, 0, 0.2) * dens)
la = np.zeros((H, W)); la[lit] = 1.0
la_img = Image.fromarray((la * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
la = np.asarray(la_img, float) / 255
la = np.clip(la * 2.2, 0, 1)
lrgba = np.zeros((H, W, 4), np.uint8)
lrgba[..., 0] = 255; lrgba[..., 1] = 196; lrgba[..., 2] = 128
lrgba[..., 3] = (la * 255).astype(np.uint8)
Image.fromarray(lrgba, 'RGBA').save(f'{out}/planet-lights.png', optimize=True)

# spherical displacement map for a 340 px disc showing 340 px of strip (half the 680 px turn)
S = 340; R = S / 2; SCALE = 200.0
yy, xx = np.mgrid[0:S, 0:S] + 0.5
nx = (xx - R) / R; ny = (yy - R) / R
inside = nx ** 2 + ny ** 2 < 1
phi = np.arcsin(np.clip(ny, -1, 1))
cosphi = np.cos(phi)
lam = np.arcsin(np.clip(nx / np.maximum(cosphi, 1e-6), -1, 1))
sx = (2 * lam / np.pi) * R; sy = (2 * phi / np.pi) * R
dx = np.where(inside, sx - nx * R, 0); dy = np.where(inside, sy - ny * R, 0)
print('max displacement px', np.abs(dx).max(), np.abs(dy).max())
m = np.zeros((S, S, 3), np.uint8)
m[..., 0] = np.clip(np.round((0.5 + dx / SCALE) * 255), 0, 255)
m[..., 1] = np.clip(np.round((0.5 + dy / SCALE) * 255), 0, 255)
m[..., 2] = 128
Image.fromarray(m).save(f'{out}/planet-sphere-map.png', optimize=True)
