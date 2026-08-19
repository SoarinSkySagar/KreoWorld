#!/usr/bin/env python3
"""
Regenerate public/assets/** from the raw LimeZu packs in assets-src/.

Cuts specific 16px tiles/objects out of the Serene Village (exterior) and Modern
Interiors (interiors + characters) sheets. The (col,row,w,h) tuples below are the
exact tile coordinates chosen for this game — edit them here, then re-run:

    python3 scripts/extract-assets.py

Requires Pillow (`pip install pillow`) and the packs unzipped under assets-src/
(see assets-src/README.md). Regenerated PNGs are committed; the raw packs are not.
"""
from PIL import Image
import os, shutil

SRC = "/home/kxizen/work/credit-world/assets-src"
PUB = "/home/kxizen/work/credit-world/public/assets"
T = 16

sv = Image.open(f"{SRC}/serene-village/Serene_Village_16x16.png").convert("RGBA")
rb = Image.open(f"{SRC}/modern-interiors/Interiors_free/16x16/Room_Builder_free_16x16.png").convert("RGBA")
it = Image.open(f"{SRC}/modern-interiors/Interiors_free/16x16/Interiors_free_16x16.png").convert("RGBA")

def cut(sheet, c, r, w, h, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    sheet.crop((c * T, r * T, (c + w) * T, (r + h) * T)).save(dest)

# --- world tiles & objects (Serene Village) ---
world = {
    "grass":          (sv, 4, 1, 1, 1),
    "path":           (sv, 17, 5, 1, 1),
    "tree_a":         (sv, 9, 12, 2, 3),
    "tree_b":         (sv, 15, 12, 2, 3),
    "tree_c":         (sv, 9, 15, 2, 3),
    "hedge":          (sv, 9, 9, 2, 2),
    "house_red":      (sv, 3, 21, 3, 4),
    "house_red_wide": (sv, 6, 21, 4, 4),
    "house_green":    (sv, 0, 29, 3, 4),
    "house_blue":     (sv, 0, 37, 3, 4),
    "flower":         (sv, 2, 12, 1, 1),
    "bush":           (sv, 6, 12, 1, 1),
    "rock":           (sv, 0, 17, 1, 1),
    # Fence 9-slice (proper garden-pen art: corners + oriented edges, connected).
    "fence_tl":       (sv, 4, 15, 1, 1),
    "fence_tm":       (sv, 5, 15, 1, 1),
    "fence_tr":       (sv, 6, 15, 1, 1),
    "fence_l":        (sv, 4, 16, 1, 1),
    "fence_r":        (sv, 6, 16, 1, 1),
    "fence_bl":       (sv, 4, 17, 1, 1),
    "fence_bm":       (sv, 5, 17, 1, 1),
    "fence_br":       (sv, 6, 17, 1, 1),
    # Bridge deck (island/pump map): both tile cleanly repeated in their axis.
    "bridge_h":       (sv, 10, 4, 1, 1),
    "bridge_v":       (sv, 13, 4, 1, 1),
    # Plain static water tile (padding backdrop behind the animated pond/moat sprites).
    "water":          (sv, 12, 1, 1, 1),
}
for name, (sh, c, r, w, h) in world.items():
    cut(sh, c, r, w, h, f"{PUB}/world/{name}.png")

# --- interior tiles & furniture (Modern Interiors) ---
interior = {
    "floor_cream": (rb, 12, 7, 1, 1),
    "floor_wood":  (rb, 12, 13, 1, 1),
    "floor_gray":  (rb, 12, 11, 1, 1),
    "wall_top":    (rb, 1, 11, 1, 1),
    "wall_base":   (rb, 1, 12, 1, 1),
    "bed":         (it, 3, 60, 2, 3),
    "sofa":        (it, 3, 76, 3, 2),
    "chair":       (it, 6, 52, 1, 2),
    "stools":      (it, 12, 54, 2, 1),
    "rug":         (it, 6, 44, 3, 3),
    "shelf":       (it, 10, 68, 3, 3),
    "counter":     (it, 2, 30, 4, 2),
    "tv":          (it, 11, 39, 3, 2),
    "plant":       (it, 13, 44, 2, 3),
    "dresser":     (it, 0, 45, 2, 2),
}
for name, (sh, c, r, w, h) in interior.items():
    cut(sh, c, r, w, h, f"{PUB}/interior/{name}.png")

# --- character spritesheets (copy whole strips) ---
os.makedirs(f"{PUB}/sprites", exist_ok=True)
shutil.copy(f"{SRC}/modern-interiors/Characters_free/Adam_run_16x16.png", f"{PUB}/sprites/adam_run.png")

# NPCs only ever stand still, so their 4-frame idle strip is enough.
npcs = ["Alex", "Amelia", "Bob"]
for who in npcs:
    shutil.copy(
        f"{SRC}/modern-interiors/Characters_free/{who}_idle_16x16.png",
        f"{PUB}/sprites/{who.lower()}_idle.png",
    )

print("world:", len(world), "interior:", len(interior), "+ adam_run.png +", len(npcs), "npc idles")
# report sizes for sanity
for name in ["tree_a", "house_red", "house_blue"]:
    print(name, Image.open(f"{PUB}/world/{name}.png").size)
for name in ["bed", "rug", "shelf"]:
    print(name, Image.open(f"{PUB}/interior/{name}.png").size)

# --- battlers (Fantasy Battlers) ---------------------------------------------
# Static front-facing battle sprites, 48x48..96x96. Each numbered file has a `b`
# recolour; the game treats the two palettes as two elemental variants of the
# same creature, so 11 sprites supply 22 enemies. Copied verbatim — they are
# already trimmed and transparent; BattleScene scales them at draw time.
battlers = {
    "01": "cinderchick", "02": "hatchet_rook", "03": "unwrit",
    "04": "mireburrow", "05": "bulwark_toad", "06": "duskwing",
    "07": "cutthroat", "08": "marshal", "09": "warden",
    "10": "ledger_rat", "11": "null_engine",
}
os.makedirs(f"{PUB}/battlers", exist_ok=True)
for num, name in battlers.items():
    for suffix, palette in (("", "a"), ("b", "b")):
        im = Image.open(f"{SRC}/fantasy-battlers/Original size/{num}{suffix}.png").convert("RGBA")
        # Trim the transparent padding. The pack pads every battler out to a
        # square frame, which makes the sprite's bounding box much taller than
        # the art: it throws off feet-anchored placement (the overworld "!"
        # floats above empty space) and makes height-normalised scaling
        # inconsistent between creatures. Crop to the opaque pixels so height
        # means the same thing for all of them.
        box = im.getbbox()
        if box:
            im = im.crop(box)
        im.save(f"{PUB}/battlers/{name}_{palette}.png")

# --- weapon icons (RPG Arsenal) ----------------------------------------------
# 32x32 icons, one per weapon NFT. The numbers are the pack's own file indices —
# hand-picked so each weapon class reads distinctly at HUD size. Keep the key
# names in sync with `src/game/combat/weapons.ts`; nothing else resolves them.
weapon_icons = {
    # folder      icon number -> asset key. Numbers were chosen by sampling each
    # icon's dominant hue so a weapon's art matches its element (see
    # `src/game/combat/weapons.ts`); nothing else resolves these keys.
    "swords": {
        "49": "wpn_sword_ember", "50": "wpn_sword_tide", "51": "wpn_sword_null",
        "52": "wpn_sword_loam", "39": "wpn_sword_gale",
    },
    "axes": {"94": "wpn_axe_ember", "107": "wpn_axe_loam", "95": "wpn_axe_null"},
    "staffs": {
        "69": "wpn_staff_tide", "78": "wpn_staff_ember",
        "79": "wpn_staff_null", "74": "wpn_staff_gale",
    },
    "tridents": {"125": "wpn_trident_tide", "127": "wpn_trident_loam", "117": "wpn_trident_gale"},
    "fans": {"116": "wpn_fan_gale", "114": "wpn_fan_ember"},
    "slingshots": {"141": "wpn_sling_loam", "143": "wpn_sling_null"},
}
os.makedirs(f"{PUB}/weapons", exist_ok=True)
missing = []
for folder, icons in weapon_icons.items():
    for num, key in icons.items():
        src_path = f"{SRC}/rpg-arsenal/Icons_no_background/{folder}/rpg_icons{num}.png"
        if not os.path.exists(src_path):
            missing.append(src_path)
            continue
        shutil.copy(src_path, f"{PUB}/weapons/{key}.png")
if missing:
    raise SystemExit("missing weapon icons:\n  " + "\n  ".join(missing))

print("battlers:", len(battlers) * 2, "weapon icons:", sum(len(v) for v in weapon_icons.values()))
