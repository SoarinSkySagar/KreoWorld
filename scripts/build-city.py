#!/usr/bin/env python3
"""
Generate the first city's ground layer and layout.

- Reads the Serene Village autotile sheet (Construct 3
  `Autotiles_no_inner_corners_16x16.png`) and builds edge->tile lookups by
  SAMPLING each tile's edge pixels (grass vs not), so dirt paths and pond
  shorelines are properly autotiled.
- Bakes `public/assets/maps/city1_ground.png` (grass + gravel/dirt paths +
  pond shore & water).
- Writes `src/game/maps/city1.json` (layout the Phaser scene reads: houses,
  road/pond rects, interior water cells to animate).
- Copies the animated-water strip to `public/assets/world/water_anim.png`.

Re-run after changing the layout:  python3 scripts/build-city.py
"""
from PIL import Image, ImageDraw
import json, os, random, shutil

ROOT = "/home/kxizen/work/credit-world"
SV = f"{ROOT}/assets-src/serene-village"
AUTO = Image.open(f"{SV}/Construct 3/Autotiles_no_inner_corners_16x16.png").convert("RGBA")
T = 16
PREVIEW_DIR = "/tmp/claude-1000/-home-kxizen-work-credit-world/59293585-7ad5-4ae5-aa96-d733a84660ed/scratchpad"

# --- autotile lookup via edge sampling --------------------------------------
def build_lookup(c0):
    """Map (N,E,S,W) grass-edge signature -> (col,row) tile in the sheet."""
    px = AUTO.load()
    def is_grass(x, y):
        r, g, b, a = px[x, y]
        # green (grass), not cyan/blue (water): green must dominate red AND blue.
        return a > 0 and g > r and g > b and g > 110
    m = {}
    for r in range(4):
        for c in range(4):
            bx, by = (c0 + c) * T, r * T
            # Sample the CENTRE of each edge to capture blob connectivity.
            sig = (
                is_grass(bx + 8, by + 0),   # N
                is_grass(bx + 15, by + 8),  # E
                is_grass(bx + 8, by + 15),  # S
                is_grass(bx + 0, by + 8),   # W
            )
            m.setdefault(sig, (c0 + c, r))
    return m

DIRT = build_lookup(0)    # blob terrain = grass, background = dirt
GRASS_TILE = (0, 0)

def tile_img(cr):
    c, r = cr
    return AUTO.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))

# The dirt block has NO pure-dirt tile (every tile carries a grass edge), so
# synthesise a clean gravel fill from tile (1,0) by replacing its green pixels
# with sampled tan. Used for path interiors and any missing signature.
_rng2 = random.Random(1)
def _make_clean_dirt():
    # Sample ONLY the pure-dirt left columns of tile (1,0) (its right edge holds a
    # grass comma + brown outline). Fill a fresh 16x16 from that pool so the
    # interior is uniform gravel with no grass/outline artefacts.
    src = AUTO.crop((1 * T, 0, 2 * T, T)).convert("RGBA")
    px = src.load()
    pool = []
    for y in range(T):
        for x in range(0, 9):  # left ~9 cols are clean tan + grey gravel specks
            r, g, b, a = px[x, y]
            if a > 0 and not (g > r and g > b) and max(r, g, b) >= 135:
                pool.append((r, g, b))
    out = Image.new("RGBA", (T, T))
    op = out.load()
    for y in range(T):
        for x in range(T):
            op[x, y] = (*_rng2.choice(pool), 255)
    return out
CLEAN_DIRT = _make_clean_dirt()

# --- layout ----------------------------------------------------------------
W, H = 64, 56
B = 6                              # forest-border thickness (dense, see below)
ROAD_W = 4                         # road width (doubled from before)
AVENUE = [30, 31, 32, 33]          # 4-wide main avenue
STREET_ROWS = [16, 30, 44]         # top row of each 4-tall horizontal street
BANDS = [(14, 16), (28, 30), (42, 44)]  # (house bottom row, street top row below)

roads = []
roads.append([AVENUE[0], 0, ROAD_W, H])                       # main avenue (cuts through the border: entrance/exit)
for sr in STREET_ROWS:
    roads.append([B, sr, W - 2 * B, ROAD_W])                  # horizontal streets, interior-only

TEX = ["house_red", "house_green", "house_blue"]
ROOMS = ["home", "shop", "lounge", "hall"]
COL_SETS = [[7, 13, 19, 42, 48, 54], [7, 13, 19, 42, 48, 54], [9, 16, 44, 51]]

houses, spurs = [], []
i = 0
for (bottom, sr), cols in zip(BANDS, COL_SETS):
    for left in cols:
        w = 3
        door = left + 1
        houses.append({"tex": TEX[i % len(TEX)], "left": left, "bottom": bottom,
                       "w": w, "door": door, "room": ROOMS[i % len(ROOMS)]})
        # 2-wide gravel spur from below the door down to the street.
        spurs.append([door, bottom + 1, 2, sr - (bottom + 1)])
        i += 1

# Ponds sit in the open gaps beside the avenue, clear of every street/house row.
ponds = [[22, 7, 6, 7], [35, 24, 6, 5]]

# --- geometry sanity check: fail loudly instead of baking a silent overlap ---
def _rect_overlap(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah

_house_rects = [[h["left"], h["bottom"] - 3, h["w"], 4] for h in houses]
_fixed_groups = {"roads": roads, "spurs": spurs, "ponds": ponds, "houses": _house_rects}
_errors = []
for name_a, group_a in _fixed_groups.items():
    for name_b, group_b in _fixed_groups.items():
        if name_a >= name_b:
            continue
        for ra in group_a:
            for rb in group_b:
                if _rect_overlap(ra, rb):
                    _errors.append(f"{name_a} {ra} overlaps {name_b} {rb}")
if _errors:
    raise SystemExit("Layout overlap(s) detected:\n  " + "\n  ".join(_errors))

# --- bake ground -----------------------------------------------------------
def rects_to_cells(rects):
    s = set()
    for x, y, w, h in rects:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < W and 0 <= yy < H:
                    s.add((xx, yy))
    return s

path_cells = rects_to_cells(roads + spurs)

def rounded_pond_cells(rects):
    s = set()
    for x, y, w, h in rects:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if xx in (x, x + w - 1) and yy in (y, y + h - 1):
                    continue  # drop corners so the pond reads rounded
                s.add((xx, yy))
    return s

pond_cells = rounded_pond_cells(ponds)

def sig_for(cell, region, outside_is_grass):
    x, y = cell
    def grass(nx, ny):
        if not (0 <= nx < W and 0 <= ny < H):
            return outside_is_grass
        return (nx, ny) not in region
    return (grass(x, y - 1), grass(x + 1, y), grass(x, y + 1), grass(x - 1, y))

ground = Image.new("RGBA", (W * T, H * T))
g = tile_img(GRASS_TILE)
for y in range(H):
    for x in range(W):
        ground.alpha_composite(g, (x * T, y * T))
for cell in path_cells:
    cr = DIRT.get(sig_for(cell, path_cells, True))
    img = tile_img(cr) if cr is not None else CLEAN_DIRT  # missing/interior -> clean dirt
    ground.alpha_composite(img, (cell[0] * T, cell[1] * T))

# Ponds: every water cell animates in-engine (nothing static baked into the
# water). The beach (sand+foam) is baked into the GRASS cells around the pond,
# so grass -> sand -> foam -> animated water reads cleanly and the whole surface
# waves.
SAND = (228, 202, 142, 255)
FOAM = (176, 231, 242, 255)
water_interior = [[x, y] for (x, y) in pond_cells]  # all pond cells animate
beach = Image.new("RGBA", ground.size, (0, 0, 0, 0))
bd = ImageDraw.Draw(beach)
for (x, y) in pond_cells:
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        if (x + dx, y + dy) in pond_cells:
            continue  # neighbour is also water
        nx, ny = (x + dx) * T, (y + dy) * T  # draw in the grass neighbour cell
        if dy == -1:
            bd.rectangle([nx, ny + T - 1, nx + T - 1, ny + T - 1], fill=FOAM)
            bd.rectangle([nx, ny + T - 5, nx + T - 1, ny + T - 2], fill=SAND)
        elif dy == 1:
            bd.rectangle([nx, ny, nx + T - 1, ny], fill=FOAM)
            bd.rectangle([nx, ny + 1, nx + T - 1, ny + 4], fill=SAND)
        elif dx == 1:
            bd.rectangle([nx, ny, nx, ny + T - 1], fill=FOAM)
            bd.rectangle([nx + 1, ny, nx + 4, ny + T - 1], fill=SAND)
        else:
            bd.rectangle([nx + T - 1, ny, nx + T - 1, ny + T - 1], fill=FOAM)
            bd.rectangle([nx + T - 5, ny, nx + T - 2, ny + T - 1], fill=SAND)
ground.alpha_composite(beach)

os.makedirs(f"{ROOT}/public/assets/maps", exist_ok=True)
ground.save(f"{ROOT}/public/assets/maps/city1_ground.png")

# animated water strip
shutil.copy(f"{SV}/Animated stuff/water_waves_16x16.png", f"{ROOT}/public/assets/world/water_anim.png")

# --- decor generation (deterministic; baked into json + previewed) ---------
rng = random.Random(20240815)
occ = [[False] * W for _ in range(H)]
def mark(x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < W and 0 <= yy < H:
                occ[yy][xx] = True
for r in roads + spurs + ponds:
    mark(*r)
# reserve a margin around ponds so no decor (esp. tall trees) overlaps the water
for x, y, w, h in ponds:
    mark(x - 1, y - 2, w + 2, h + 3)
# NOTE: the border band is intentionally NOT pre-marked occupied here — the
# forest-planting loop below fills it with trees and needs `occ` to still read
# free there. (Interior scatter is separately bounded to range(B, H-B) so it
# can't spill into the border regardless.)
# house footprints + their fenced yard (reserved up front so forest/scatter
# decor placed later can't land under where the fence will be drawn)
for h in houses:
    mark(h["left"], h["bottom"] - 3, h["w"], 4)
    mark(h["left"] - 1, h["bottom"] - 4, h["w"] + 2, 6)

TREES = ["tree_a", "tree_b", "tree_c"]
decor = []
def add(tex, left, bottom, w, solid, foot_h=1):
    """foot_h reserves the FULL visual footprint in occ. Trees/hedges are
    visually taller than their solid collision row, so callers must pass
    the true visual height or canopies can overlap neighbouring decor."""
    decor.append({"tex": tex, "left": left, "bottom": bottom, "w": w, "solid": solid})
    mark(left, bottom - foot_h + 1, w, foot_h)

def free(x, y, w, h):
    return all(0 <= x + i < W and 0 <= y + j < H and not occ[y + j][x + i]
               for i in range(w) for j in range(h))

def in_gate_band(x, y, margin=1):
    """True where (x,y) sits in a border cell that's actually the avenue's
    gate opening (± margin)."""
    return AVENUE[0] - margin <= x <= AVENUE[1] + margin and (y < B or y >= H - B)

# Dense forest border: fill the ENTIRE border band with trees (not just a
# thin perimeter line), skipping only the avenue's own gate opening.
for y in range(H):
    for x in range(W):
        edge = x < B or x >= W - B or y < B or y >= H - B
        if not edge or in_gate_band(x, y) or occ[y][x]:
            continue
        if x + 1 < W and free(x, y - 2, 2, 3):
            add(rng.choice(TREES), x, y, 2, True, foot_h=3)

# The camera can see further than the border is thick, so standing at the
# edge would reveal flat undecorated grass beyond the forest (the
# camera-safety padding in OverworldScene.buildGround extends the grass
# base ~24 tiles past the map so no void ever shows at any zoom/resize).
# Continue the forest, solid and tightly packed, out to near the edge of
# that padding — purely decorative (already past the collision border,
# unreachable) — except through the avenue's own sightline, kept open.
PAD_FOREST_EXTRA = 22
for y in range(-PAD_FOREST_EXTRA, H + PAD_FOREST_EXTRA, 2):
    for x in range(-PAD_FOREST_EXTRA, W + PAD_FOREST_EXTRA, 2):
        if 0 <= x < W and 0 <= y < H:
            continue  # inside the real map; handled above
        if AVENUE[0] - 1 <= x <= AVENUE[1] + 1:
            continue  # keep the avenue's sightline open into the distance
        add(rng.choice(TREES), x, y, 2, False, foot_h=3)  # solid=False: unreachable

# pond/road-adjacent flowers + interior scatter
road_mask = rects_to_cells(roads + spurs)
def near_road(x, y):
    return any((x + dx, y + dy) in road_mask for dx in (-1, 0, 1) for dy in (-1, 0, 1))

for y in range(B, H - B):
    for x in range(B, W - B):
        if occ[y][x]:
            continue
        r = rng.random()
        if near_road(x, y):
            if r < 0.22:
                add(rng.choice(["flower", "bush", "flower"]), x, y, 1, False)
            continue
        central = 22 <= x <= 41
        tree_p = 0.26 if central else 0.42
        if r < tree_p and x + 1 < W - B and y - 2 >= B and free(x, y - 2, 2, 3):
            add(rng.choice(TREES), x, y, 2, True, foot_h=3)
        elif r < tree_p + 0.10 and free(x, y - 1, 2, 2):
            add("hedge", x, y, 2, True, foot_h=2)
        elif r < tree_p + 0.28:
            add(rng.choice(["flower", "bush", "flower", "flower"]), x, y, 1, False)
        elif r < tree_p + 0.32:
            add("rock", x, y, 1, True)

# --- fenced yards: proper 9-slice (corners + oriented edges), gap at the door ---
for h in houses:
    l, w, bottom, door = h["left"], h["w"], h["bottom"], h["door"]
    fx0, fx1 = l - 1, l + w
    fy0, fy1 = bottom - 4, bottom + 1
    for x in range(fx0 + 1, fx1):
        add("fence_tm", x, fy0, 1, True)
        if x != door:
            add("fence_bm", x, fy1, 1, True)
    for y in range(fy0 + 1, fy1):
        add("fence_l", fx0, y, 1, True)
        add("fence_r", fx1, y, 1, True)
    add("fence_tl", fx0, fy0, 1, True)
    add("fence_tr", fx1, fy0, 1, True)
    add("fence_bl", fx0, fy1, 1, True)
    add("fence_br", fx1, fy1, 1, True)

# --- write layout json -----------------------------------------------------
layout = {
    "width": W, "height": H, "tile": T, "border": B,
    "avenue": AVENUE,
    "entrance": {"x": (AVENUE[0] + AVENUE[1] + 1) / 2 * T, "y": (H - B) * T},
    "houses": houses,
    "roads": roads, "spurs": spurs, "ponds": ponds,
    "waterInterior": water_interior,
    "decor": decor,
}
os.makedirs(f"{ROOT}/src/game/maps", exist_ok=True)
with open(f"{ROOT}/src/game/maps/city1.json", "w") as f:
    json.dump(layout, f, indent=0)

print(f"ground {ground.size}  houses={len(houses)}  ponds={len(ponds)}  "
      f"waterInterior={len(water_interior)}  decor={len(decor)}")

# --- full-town preview ------------------------------------------------------
PUB = f"{ROOT}/public/assets"
tex_cache = {}
def tex(name, cat="world"):
    if name not in tex_cache:
        tex_cache[name] = Image.open(f"{PUB}/{cat}/{name}.png").convert("RGBA")
    return tex_cache[name]

preview = ground.copy()
wa = Image.open(f"{PUB}/world/water_anim.png").convert("RGBA").crop((0, 0, T, T))
for x, y in water_interior:
    preview.alpha_composite(wa, (x * T, y * T))

objs = []  # (feet_y, img, x, y)
def place(tex_img, left, bottom, w):
    bx = int((left + w / 2) * T - tex_img.width / 2)
    by = (bottom + 1) * T - tex_img.height
    objs.append(((bottom + 1) * T, tex_img, bx, by))
for h in houses:
    place(tex(h["tex"]), h["left"], h["bottom"], h["w"])
for d in decor:
    place(tex(d["tex"]), d["left"], d["bottom"], d["w"])
adam = Image.open(f"{PUB}/sprites/adam_run.png").convert("RGBA").crop((18 * 16, 0, 19 * 16, 32))
ent = layout["entrance"]
objs.append((ent["y"] + 16, adam, int(ent["x"] - 8), int(ent["y"] - 16)))
for _, img, x, y in sorted(objs, key=lambda o: o[0]):
    preview.alpha_composite(img, (x, y))

preview.resize((W * T * 2, H * T * 2), Image.NEAREST).save(f"{PREVIEW_DIR}/town_full.png")
