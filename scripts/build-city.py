#!/usr/bin/env python3
"""
Generate all starter maps' ground layers and layouts: three standalone cities
plus the central hub ("the Pump").

- Reads the Serene Village autotile sheet (Construct 3
  `Autotiles_no_inner_corners_16x16.png`) and builds edge->tile lookups by
  SAMPLING each tile's edge pixels (grass vs not), so dirt paths, pond
  shorelines and the pump's island shoreline are properly autotiled.
- For each map, bakes `public/assets/maps/{name}_ground.png` and writes
  `src/game/maps/{name}.json` (layout the Phaser scene reads: houses,
  road/pond rects, gates, decor).
- Copies the animated-water strip to `public/assets/world/water_anim.png`.

The three cities share the exact same house/street/pond/forest/fence
GENERATION LOGIC (see `build_city()`); only the exit-gate configuration, RNG
seed, and a couple of small layout knobs (house columns, pond rects) differ
per city, so each looks distinct while staying mechanically identical. The
pump (`build_pump()`) reuses the same autotile/beach/decor primitives but has
entirely different geometry (island + moat, no forest border).

Re-run after changing any layout:  python3 scripts/build-city.py
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
WATER_TILE = (8, 0)       # pure water fill on the same autotile sheet

def tile_img(cr):
    c, r = cr
    return AUTO.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))

def rects_to_cells(rects, W, H):
    s = set()
    for x, y, w, h in rects:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < W and 0 <= yy < H:
                    s.add((xx, yy))
    return s

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

SAND = (228, 202, 142, 255)
FOAM = (176, 231, 242, 255)
TEX = ["house_red", "house_green", "house_blue"]
ROOMS = ["home", "shop", "lounge", "hall"]
TREES = ["tree_a", "tree_b", "tree_c"]

PUB = f"{ROOT}/public/assets"
_tex_cache = {}
def load_tex(name, cat="world"):
    key = (cat, name)
    if key not in _tex_cache:
        _tex_cache[key] = Image.open(f"{PUB}/{cat}/{name}.png").convert("RGBA")
    return _tex_cache[key]


def build_city(cfg):
    """Generate one city from a config dict. See the bottom of this file for
    the three configs actually used. Fixed geometry (map size, border
    thickness, road width, street rows, band rows) is intentionally SHARED
    across all cities so the same overlap-safe skeleton is reused; only exit
    gates, house columns, pond rects, and RNG seed vary per city (`cfg`)."""
    name = cfg["name"]
    rng = random.Random(cfg["seed"])

    W, H = 64, 56
    B = 6                              # forest-border thickness
    ROAD_W = 4
    AVENUE = [30, 31, 32, 33]          # vertical connector columns (N-S)
    STREET_ROWS = [16, 30, 44]         # top row of each horizontal street
    BANDS = [(14, 16), (28, 30), (42, 44)]  # (house bottom row, street top row)

    avenue_ends = cfg["avenue_ends"]          # subset of {"N","S"}
    extra_street = cfg.get("extra_street")    # None or {"index": 0..2, "ends": {"W","E"}}
    primary_gate_side = cfg["primary_gate"]   # which gate the player spawns at

    # --- gates (generic N/S/E/W openings, drives collision + forest skip) --
    gates = []
    if "N" in avenue_ends:
        gates.append({"side": "N", "start": AVENUE[0], "length": ROAD_W})
    if "S" in avenue_ends:
        gates.append({"side": "S", "start": AVENUE[0], "length": ROAD_W})
    if extra_street:
        sr = STREET_ROWS[extra_street["index"]]
        if "W" in extra_street["ends"]:
            gates.append({"side": "W", "start": sr, "length": ROAD_W})
        if "E" in extra_street["ends"]:
            gates.append({"side": "E", "start": sr, "length": ROAD_W})

    # --- roads: vertical avenue (only reaches the border on its open ends) +
    # horizontal streets (the chosen extra_street reaches the border on its
    # configured side(s); all others stop short at the forest, as before) ----
    avenue_y0 = 0 if "N" in avenue_ends else B
    avenue_y1 = H if "S" in avenue_ends else H - B
    roads = [[AVENUE[0], avenue_y0, ROAD_W, avenue_y1 - avenue_y0]]
    for idx, sr in enumerate(STREET_ROWS):
        ext = extra_street if extra_street and extra_street["index"] == idx else None
        x0 = 0 if ext and "W" in ext["ends"] else B
        x1 = W if ext and "E" in ext["ends"] else W - B
        roads.append([x0, sr, x1 - x0, ROAD_W])

    house_cols = cfg["col_sets"]
    houses, spurs = [], []
    i = 0
    for (bottom, sr), cols in zip(BANDS, house_cols):
        for left in cols:
            w = 3
            door = left + 1
            houses.append({"tex": TEX[i % len(TEX)], "left": left, "bottom": bottom,
                           "w": w, "door": door, "room": ROOMS[i % len(ROOMS)]})
            spurs.append([door, bottom + 1, 2, sr - (bottom + 1)])  # door -> street
            i += 1

    ponds = cfg["ponds"]

    # --- geometry sanity check: fail loudly instead of baking a silent overlap
    def _rect_overlap(a, b):
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah

    _house_rects = [[h["left"], h["bottom"] - 3, h["w"], 4] for h in houses]
    _fixed_groups = {"roads": roads, "spurs": spurs, "ponds": ponds, "houses": _house_rects}
    _errors = []
    for na, ga in _fixed_groups.items():
        for nb, gb in _fixed_groups.items():
            if na >= nb:
                continue
            for ra in ga:
                for rb in gb:
                    if _rect_overlap(ra, rb):
                        _errors.append(f"[{name}] {na} {ra} overlaps {nb} {rb}")
    if _errors:
        raise SystemExit("Layout overlap(s) detected:\n  " + "\n  ".join(_errors))

    # --- bake ground ---------------------------------------------------------
    path_cells = rects_to_cells(roads + spurs, W, H)

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
        img = tile_img(cr) if cr is not None else CLEAN_DIRT
        ground.alpha_composite(img, (cell[0] * T, cell[1] * T))

    # Ponds: every water cell animates in-engine; the beach (sand+foam) bakes
    # into the surrounding GRASS cells, so grass->sand->foam->water reads clean.
    water_interior = [[x, y] for (x, y) in pond_cells]
    beach = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beach)
    for (x, y) in pond_cells:
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            if (x + dx, y + dy) in pond_cells:
                continue
            nx, ny = (x + dx) * T, (y + dy) * T
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

    os.makedirs(f"{PUB}/maps", exist_ok=True)
    ground.save(f"{PUB}/maps/{name}_ground.png")

    # --- decor generation (deterministic; baked into json + previewed) ------
    occ = [[False] * W for _ in range(H)]
    def mark(x, y, w, h):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < W and 0 <= yy < H:
                    occ[yy][xx] = True
    for r in roads + spurs + ponds:
        mark(*r)
    for x, y, w, h in ponds:
        mark(x - 1, y - 2, w + 2, h + 3)  # keep decor (esp. tall trees) off the water
    for h in houses:
        mark(h["left"], h["bottom"] - 3, h["w"], 4)
        mark(h["left"] - 1, h["bottom"] - 4, h["w"] + 2, 6)  # + fenced yard footprint

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
        """True where (x,y) sits in a border cell that's actually a gate
        opening (± margin), for ANY configured gate on the matching side."""
        for gt in gates:
            s0, s1 = gt["start"] - margin, gt["start"] + gt["length"] - 1 + margin
            if gt["side"] == "N" and y < B and s0 <= x <= s1:
                return True
            if gt["side"] == "S" and y >= H - B and s0 <= x <= s1:
                return True
            if gt["side"] == "W" and x < B and s0 <= y <= s1:
                return True
            if gt["side"] == "E" and x >= W - B and s0 <= y <= s1:
                return True
        return False

    # Dense forest border: fill the ENTIRE border band with trees (not just a
    # thin perimeter line), skipping only the configured gate openings.
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
    # unreachable) — except through each gate's own sightline, kept open.
    def in_pad_gate_sightline(x, y):
        for gt in gates:
            s0, s1 = gt["start"] - 1, gt["start"] + gt["length"]
            if gt["side"] in ("N", "S") and s0 <= x <= s1:
                return True
            if gt["side"] in ("E", "W") and s0 <= y <= s1:
                return True
        return False

    PAD_FOREST_EXTRA = 22
    for y in range(-PAD_FOREST_EXTRA, H + PAD_FOREST_EXTRA, 2):
        for x in range(-PAD_FOREST_EXTRA, W + PAD_FOREST_EXTRA, 2):
            if 0 <= x < W and 0 <= y < H:
                continue  # inside the real map; handled above
            if in_pad_gate_sightline(x, y):
                continue
            add(rng.choice(TREES), x, y, 2, False, foot_h=3)  # solid=False: unreachable

    # pond/road-adjacent flowers + interior scatter
    road_mask = rects_to_cells(roads + spurs, W, H)
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

    # fenced yards: proper 9-slice (corners + oriented edges), gap at the door
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

    # --- entrance: spawn just inside the primary gate ------------------------
    pg = next(gt for gt in gates if gt["side"] == primary_gate_side)
    center = pg["start"] + pg["length"] / 2
    if pg["side"] == "S":
        entrance = {"x": center * T, "y": (H - B) * T}
    elif pg["side"] == "N":
        entrance = {"x": center * T, "y": B * T}
    elif pg["side"] == "W":
        entrance = {"x": B * T, "y": center * T}
    else:  # "E"
        entrance = {"x": (W - B) * T, "y": center * T}

    # --- write layout json ----------------------------------------------------
    layout = {
        "width": W, "height": H, "tile": T, "border": B, "backdrop": "grass",
        "entranceSide": primary_gate_side,
        "gates": gates,
        "entrance": entrance,
        "houses": houses,
        "roads": roads, "spurs": spurs, "ponds": ponds,
        "waterInterior": water_interior,
        "decor": decor,
    }
    os.makedirs(f"{ROOT}/src/game/maps", exist_ok=True)
    with open(f"{ROOT}/src/game/maps/{name}.json", "w") as f:
        json.dump(layout, f, indent=0)

    print(f"[{name}] ground {ground.size}  houses={len(houses)}  ponds={len(ponds)}  "
          f"waterInterior={len(water_interior)}  decor={len(decor)}  gates={gates}")

    save_preview(name, ground, water_interior, houses, decor, entrance, W, H)


def build_pump(cfg):
    """Generate the central hub ('the Pump'): a small island surrounded by
    water, reached by three wooden bridges (N/W/E — no south exit), with one
    large building at its centre and flowers as the only decor.

    Reuses the same autotile/beach/decor primitives as build_city(), but with
    entirely different geometry: there is no forest border here — water
    itself blocks every non-gate direction (matching how pond cells already
    double as solid collision), so no separate ring-collision logic is
    needed beyond the generic N/S/E/W `gates` carving OverworldScene already
    supports for the cities. No fences anywhere (bridges are walkway-only)."""
    name = cfg["name"]
    rng = random.Random(cfg["seed"])
    W, H, B = cfg["W"], cfg["H"], cfg["B"]
    cx, cy = cfg["center"]
    rx, ry = cfg["island_radii"]
    bw = cfg.get("bridge_width", 2)

    def in_island(x, y):
        return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

    island_cells = {(x, y) for y in range(H) for x in range(W) if in_island(x, y)}

    # One large building, centred on the island.
    b_left, b_bottom, b_w, b_h = cx - 2, cy + 2, 4, 4
    houses = [{"tex": "house_red_wide", "left": b_left, "bottom": b_bottom,
               "w": b_w, "door": b_left + 1, "room": "pump"}]
    building_rect = [b_left, b_bottom - b_h + 1, b_w, b_h]

    # Bridges: bw-wide strips from the border straight to the island edge,
    # found by scanning for the island boundary along each bridge's axis
    # (rather than hand-computing it — the overlap bug from the cities'
    # hand-picked ponds is exactly the mistake this avoids).
    def island_edge(span, axis, want_min):
        vals = []
        for f in span:
            for v in range(H if axis == "x" else W):
                cell = (f, v) if axis == "x" else (v, f)
                if cell in island_cells:
                    vals.append(v)
        return (min(vals) if want_min else max(vals)) if vals else None

    n_span = range(cx - bw // 2, cx - bw // 2 + bw)
    n_edge = island_edge(n_span, "x", want_min=True)
    bridge_n = [n_span[0], B, bw, n_edge - B]

    ew_span = range(cy - bw // 2, cy - bw // 2 + bw)
    w_edge = island_edge(ew_span, "y", want_min=True)
    bridge_w_side = [B, ew_span[0], w_edge - B, bw]
    e_edge = island_edge(ew_span, "y", want_min=False)
    bridge_e_side = [e_edge + 1, ew_span[0], (W - B) - (e_edge + 1), bw]
    bridges = [bridge_n, bridge_w_side, bridge_e_side]

    gates = [
        {"side": "N", "start": n_span[0], "length": bw},
        {"side": "W", "start": ew_span[0], "length": bw},
        {"side": "E", "start": ew_span[0], "length": bw},
    ]

    def _rect_overlap(a, b):
        ax, ay, aw, ah = a
        bx, by, bw2, bh = b
        return ax < bx + bw2 and bx < ax + aw and ay < by + bh and by < ay + ah
    for br in bridges:
        if _rect_overlap(br, building_rect):
            raise SystemExit(f"[{name}] bridge {br} overlaps building {building_rect}")

    bridge_v_cells = rects_to_cells([bridge_n], W, H)
    bridge_h_cells = rects_to_cells([bridge_w_side, bridge_e_side], W, H)
    bridge_cells = bridge_v_cells | bridge_h_cells

    # --- bake ground: water everywhere, island = grass, bridges = plank ------
    ground = Image.new("RGBA", (W * T, H * T))
    water_tile, grass_tile = tile_img(WATER_TILE), tile_img(GRASS_TILE)
    for y in range(H):
        for x in range(W):
            ground.alpha_composite(water_tile, (x * T, y * T))
    for (x, y) in island_cells:
        ground.alpha_composite(grass_tile, (x * T, y * T))
    bridge_v_tex, bridge_h_tex = load_tex("bridge_v"), load_tex("bridge_h")
    for (x, y) in bridge_v_cells:
        ground.alpha_composite(bridge_v_tex, (x * T, y * T))
    for (x, y) in bridge_h_cells:
        ground.alpha_composite(bridge_h_tex, (x * T, y * T))

    # Beach (sand+foam) on every island edge that faces open water (not a
    # bridge landing) — same technique as pond shorelines, mirrored: painted
    # onto the island cell itself rather than a water neighbour, since here
    # the LAND is the small shape and water is the background.
    beach = Image.new("RGBA", ground.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(beach)
    for (x, y) in island_cells:
        X, Y = x * T, y * T
        for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
            nb = (x + dx, y + dy)
            if nb in island_cells or nb in bridge_cells:
                continue
            if dy == -1:
                bd.rectangle([X, Y, X + T - 1, Y], fill=FOAM)
                bd.rectangle([X, Y + 1, X + T - 1, Y + 4], fill=SAND)
            elif dy == 1:
                bd.rectangle([X, Y + T - 1, X + T - 1, Y + T - 1], fill=FOAM)
                bd.rectangle([X, Y + T - 5, X + T - 1, Y + T - 2], fill=SAND)
            elif dx == -1:
                bd.rectangle([X, Y, X, Y + T - 1], fill=FOAM)
                bd.rectangle([X + 1, Y, X + 4, Y + T - 1], fill=SAND)
            else:
                bd.rectangle([X + T - 1, Y, X + T - 1, Y + T - 1], fill=FOAM)
                bd.rectangle([X + T - 5, Y, X + T - 2, Y + T - 1], fill=SAND)
    ground.alpha_composite(beach)

    os.makedirs(f"{PUB}/maps", exist_ok=True)
    ground.save(f"{PUB}/maps/{name}_ground.png")

    # Every non-island, non-bridge cell in the real map animates (the whole
    # moat waves). The padding beyond the map relies on the static "water"
    # backdrop tileSprite instead (see OverworldScene.buildGround) — no
    # individual sprites needed out there since it's uniform, unlike the
    # cities' forest padding which needed distinct tree images.
    water_interior = [[x, y] for y in range(H) for x in range(W)
                       if (x, y) not in island_cells and (x, y) not in bridge_cells]

    # --- decor: flowers only, no trees/hedges/rocks, scattered on the island -
    occ = [[False] * W for _ in range(H)]
    def mark(x, y, w, h):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < W and 0 <= yy < H:
                    occ[yy][xx] = True
    mark(*building_rect)

    decor = []
    def add(tex, left, bottom, w, solid):
        decor.append({"tex": tex, "left": left, "bottom": bottom, "w": w, "solid": solid})
        mark(left, bottom, w, 1)

    for (x, y) in sorted(island_cells):
        if occ[y][x] or (x, y) in bridge_cells:
            continue
        # keep a flower-free margin right at each bridge landing
        if any((x + dx, y + dy) in bridge_cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            continue
        if rng.random() < 0.55:
            add(rng.choice(["flower", "bush"]), x, y, 1, False)

    # --- entrance: spawn just inside the primary gate -------------------------
    pg = next(gt for gt in gates if gt["side"] == cfg["primary_gate"])
    center = pg["start"] + pg["length"] / 2
    if pg["side"] == "N":
        entrance = {"x": center * T, "y": B * T}
    elif pg["side"] == "W":
        entrance = {"x": B * T, "y": center * T}
    else:  # "E"
        entrance = {"x": (W - B) * T, "y": center * T}

    layout = {
        "width": W, "height": H, "tile": T, "border": B, "backdrop": "water",
        "entranceSide": cfg["primary_gate"],
        "gates": gates,
        "entrance": entrance,
        "houses": houses,
        "roads": [], "spurs": bridges, "ponds": [],
        "waterInterior": water_interior,
        "decor": decor,
    }
    os.makedirs(f"{ROOT}/src/game/maps", exist_ok=True)
    with open(f"{ROOT}/src/game/maps/{name}.json", "w") as f:
        json.dump(layout, f, indent=0)

    print(f"[{name}] ground {ground.size}  island={len(island_cells)}  bridgeCells={len(bridge_cells)}  "
          f"waterInterior={len(water_interior)}  decor={len(decor)}  gates={gates}")

    save_preview(name, ground, water_interior, houses, decor, entrance, W, H)


def save_preview(name, ground, water_interior, houses, decor, entrance, W, H):
    """Composite a 2x preview PNG for visual verification (same data the
    engine renders, so this is a reliable stand-in for a live screenshot)."""
    preview = ground.copy()
    wa = load_tex("water_anim").crop((0, 0, T, T))
    for x, y in water_interior:
        preview.alpha_composite(wa, (x * T, y * T))
    objs = []
    def place(img, left, bottom, w):
        bx = int((left + w / 2) * T - img.width / 2)
        by = (bottom + 1) * T - img.height
        objs.append(((bottom + 1) * T, img, bx, by))
    for h in houses:
        place(load_tex(h["tex"]), h["left"], h["bottom"], h["w"])
    for d in decor:
        place(load_tex(d["tex"]), d["left"], d["bottom"], d["w"])
    adam = load_tex("adam_run", cat="sprites").crop((18 * 16, 0, 19 * 16, 32))
    objs.append((entrance["y"] + 16, adam, int(entrance["x"] - 8), int(entrance["y"] - 16)))
    for _, img, x, y in sorted(objs, key=lambda o: o[0]):
        preview.alpha_composite(img, (x, y))
    preview.resize((W * T * 2, H * T * 2), Image.NEAREST).save(f"{PREVIEW_DIR}/{name}_preview.png")


# animated water strip (shared by all cities)
shutil.copy(f"{SV}/Animated stuff/water_waves_16x16.png", f"{PUB}/world/water_anim.png")

# --- the three starter cities ------------------------------------------------
# Shared skeleton (map size / bands / streets) is identical; each city differs
# in exit sides, RNG seed, house-column offsets, and pond placement, so they're
# visually distinguishable while staying mechanically the same.

build_city({
    "name": "town-main",
    "seed": 20240815,
    "avenue_ends": set(),                              # vertical avenue stays internal-only
    "extra_street": {"index": 1, "ends": {"W", "E"}},   # middle street reaches both side borders
    "primary_gate": "W",
    "col_sets": [[7, 13, 19, 42, 48, 54], [7, 13, 19, 42, 48, 54], [9, 16, 44, 51]],
    "ponds": [[22, 7, 6, 7], [35, 24, 6, 5]],
})

build_city({
    "name": "town-b",
    "seed": 776655,
    "avenue_ends": {"S"},                               # south exit only
    "extra_street": {"index": 1, "ends": {"E"}},         # middle street reaches the east border
    "primary_gate": "S",
    "col_sets": [[6, 12, 18, 43, 49, 55], [8, 14, 20, 45, 51, 57], [10, 17, 46, 53]],
    "ponds": [[23, 7, 6, 7], [36, 24, 6, 5]],
})

build_city({
    "name": "town-c",
    "seed": 334488,
    "avenue_ends": {"S"},                               # south exit only
    "extra_street": {"index": 1, "ends": {"W"}},         # middle street reaches the west border
    "primary_gate": "S",
    "col_sets": [[8, 14, 20, 41, 47, 53], [6, 12, 18, 43, 49, 55], [11, 18, 45, 52]],
    "ponds": [[24, 7, 5, 7], [36, 24, 6, 5]],
})

# --- the central hub ("the Pump") ---------------------------------------------
build_pump({
    "name": "pump",
    "seed": 99001,
    "W": 36, "H": 32, "B": 5,
    "center": (18, 16),
    "island_radii": (6, 5),
    "bridge_width": 2,
    "primary_gate": "N",
})
