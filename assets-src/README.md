# assets-src — raw art packs (NOT committed, NOT served)

Drop each downloaded pack here in its **own folder, unmodified**:

```
assets-src/
  serene-village/       <- unzip the Serene Village pack here as-is
  modern-interiors/     <- unzip the Modern Interiors pack here as-is
```

## Rules

- **Keep packs separate. Do not merge them into one folder.** They share generic
  filenames and would collide, and keeping them intact preserves licenses,
  docs, and the ability to update to a newer pack version.
- **This whole folder is gitignored** (see `.gitignore`). These are free LimeZu
  packs — free to *use* in the game, but the pack itself shouldn't be re-committed
  as-is (and it's large). This is your local source of truth only; only the
  extracted files you actually use get committed, under `public/assets/`.
- **Nothing here is loaded by the game.** Next.js only serves files under
  `public/`. Phaser loads from `public/assets/**` at runtime.

## Flow: from a pack to the running game

1. Author maps in **Tiled** using the tilesets from these packs.
2. Export/copy only the files you actually use into `public/assets/`:
   - tileset PNGs -> `public/assets/tilesets/`
   - character/NPC spritesheets -> `public/assets/sprites/`
   - Tiled map JSON exports -> `public/assets/maps/`
3. Phaser loads them by URL, e.g. `this.load.image('serene-village',
   '/assets/tilesets/serene-village.png')`.

Keep the extracted filenames kebab-case and prefixed by pack when ambiguous
(`serene-village-exterior.png`, `modern-interiors-room.png`) so the two packs
never clash in `public/assets/`.
