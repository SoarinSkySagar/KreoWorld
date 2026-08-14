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

# --- character spritesheet (copy whole strip) ---
os.makedirs(f"{PUB}/sprites", exist_ok=True)
shutil.copy(f"{SRC}/modern-interiors/Characters_free/Adam_run_16x16.png", f"{PUB}/sprites/adam_run.png")

print("world:", len(world), "interior:", len(interior), "+ adam_run.png")
# report sizes for sanity
for name in ["tree_a", "house_red", "house_blue"]:
    print(name, Image.open(f"{PUB}/world/{name}.png").size)
for name in ["bed", "rug", "shelf"]:
    print(name, Image.open(f"{PUB}/interior/{name}.png").size)
