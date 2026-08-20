/**
 * The bestiary.
 *
 * **The Rescinded** are an order struck from every ledger. Nothing they hold has
 * provenance and nothing they do can be attested, so they take elixir from
 * travellers whose universes still count for something. One livery, several
 * ranks; they carry real weapons, so they fight exactly the way the player does.
 *
 * **Blightspawn** are elixir-corrupted fauna the Rescinded herd onto the roads
 * to bleed passing universes. No organisation, no weapons — innate abilities.
 *
 * Both only ever appear on the highways. Towns and the Anchor island are clean.
 */

import type { EnemySpec, WeaponAbility } from "@/lib/services/types";
import { WEAPONS_BY_ID } from "./weapons";

/** Pull an ability straight off a weapon, so an enemy wielding it fights like it. */
function wielding(weaponId: string): WeaponAbility {
  const weapon = WEAPONS_BY_ID.get(weaponId);
  if (!weapon) throw new Error(`Unknown weapon for enemy loadout: ${weaponId}`);
  return weapon.ability;
}

/** An innate blightspawn attack — no weapon behind it, just the corruption. */
function innate(
  id: string,
  name: string,
  description: string,
  power: number,
  accuracy: number,
  uses: number,
  effect?: WeaponAbility["effect"],
): WeaponAbility {
  return { id, name, description, power, accuracy, uses, effect };
}

export const ENEMIES: EnemySpec[] = [
  // --- Blightspawn ------------------------------------------------------------
  {
    id: "enemy-cinderchick",
    name: "Cinderchick",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:cinderchick_a",
    element: "fire",
    level: 5,
    maxHp: 44,
    attack: 26,
    defense: 14,
    speed: 13,
    elixirReward: 35,
    spawnWeight: 61,
    taunt: "A Cinderchick puffs up in the road, trailing hot ash.",
    abilities: [
      innate("ab-peck", "Ash Peck", "Quick, hot, and mostly noise.", 30, 95, 15),
      innate("ab-scald", "Scald", "A thin burn that keeps burning.", 24, 100, 10, {
        kind: "bleed",
        damage: 4,
        turns: 3,
      }),
    ],
  },
  {
    id: "enemy-cinderchick-void",
    name: "Palechick",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:cinderchick_b",
    element: "void",
    level: 6,
    maxHp: 48,
    attack: 28,
    defense: 15,
    speed: 14,
    elixirReward: 42,
    spawnWeight: 50,
    taunt: "A Palechick watches you with eyes that record nothing.",
    abilities: [
      innate("ab-blankpeck", "Blank Peck", "Leaves no mark worth attesting.", 32, 95, 15, {
        kind: "pierce",
      }),
      innate("ab-fade", "Fade", "Takes the edge off whatever you swing next.", 20, 100, 8, {
        kind: "weaken",
        factor: 0.8,
        turns: 3,
      }),
    ],
  },
  {
    id: "enemy-hatchet-rook",
    name: "Hatchet Rook",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:hatchet_rook_a",
    element: "earth",
    level: 9,
    maxHp: 66,
    attack: 38,
    defense: 20,
    speed: 11,
    elixirReward: 70,
    spawnWeight: 27,
    taunt: "A Hatchet Rook drags its stolen blade across the gravel.",
    abilities: [
      innate("ab-chop", "Scavenged Chop", "It found that hatchet. It kept it.", 48, 82, 10),
      innate("ab-hoard", "Hoard Guard", "Curls around its sack and takes the hit.", 22, 100, 8, {
        kind: "guard",
        amount: 0.5,
      }),
    ],
  },
  {
    id: "enemy-mireburrow",
    name: "Mireburrow",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:mireburrow_b",
    element: "water",
    level: 8,
    maxHp: 72,
    attack: 32,
    defense: 24,
    speed: 8,
    elixirReward: 60,
    spawnWeight: 33,
    taunt: "A Mireburrow surfaces from the ditch, dripping something that is not water.",
    abilities: [
      innate("ab-sluice", "Sluice", "Slow, sodden, and it takes some of you with it.", 36, 92, 12, {
        kind: "drain",
        ratio: 0.4,
      }),
      innate("ab-silt", "Silt Spray", "Two mouthfuls of grit.", 34, 88, 10, { kind: "multi", hits: 2 }),
    ],
  },
  {
    id: "enemy-bulwark-toad",
    name: "Bulwark Toad",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:bulwark_toad_a",
    element: "earth",
    level: 11,
    maxHp: 96,
    attack: 34,
    defense: 34,
    speed: 7,
    elixirReward: 95,
    spawnWeight: 19,
    taunt: "A Bulwark Toad settles onto the road and declines to move.",
    abilities: [
      innate("ab-shellslam", "Shell Slam", "All of it, at once, slowly.", 58, 80, 8),
      innate("ab-carapace", "Carapace", "Nothing gets through for a while.", 18, 100, 10, {
        kind: "guard",
        amount: 0.65,
      }),
    ],
  },
  {
    id: "enemy-duskwing",
    name: "Duskwing",
    title: "Blightspawn",
    faction: "blightspawn",
    spriteKey: "battler:duskwing_a",
    element: "air",
    level: 12,
    maxHp: 78,
    attack: 44,
    defense: 22,
    speed: 19,
    elixirReward: 110,
    spawnWeight: 16,
    taunt: "A Duskwing drops out of the treeline before you hear it.",
    abilities: [
      innate("ab-shear", "Shear", "Three passes, none of them announced.", 52, 90, 10, {
        kind: "multi",
        hits: 3,
      }),
      innate("ab-leech", "Nightleech", "It is feeding, not fighting.", 40, 94, 8, {
        kind: "drain",
        ratio: 0.5,
      }),
    ],
  },

  // --- The Rescinded ----------------------------------------------------------
  {
    id: "enemy-ledger-rat",
    name: "Ledger Rat",
    title: "Rescinded Whelp",
    faction: "rescinded",
    spriteKey: "battler:ledger_rat_b",
    element: "void",
    level: 7,
    maxHp: 52,
    attack: 30,
    defense: 16,
    speed: 15,
    elixirReward: 55,
    spawnWeight: 41,
    taunt: '"You keep receipts. How quaint." — a Ledger Rat, waving its sigil.',
    abilities: [wielding("wpn-nullshot"), wielding("wpn-pebblecast")],
  },
  {
    id: "enemy-cutthroat",
    name: "Rescinded Cutthroat",
    title: "The Rescinded",
    faction: "rescinded",
    spriteKey: "battler:cutthroat_b",
    element: "fire",
    level: 13,
    maxHp: 88,
    attack: 48,
    defense: 26,
    speed: 17,
    elixirReward: 140,
    spawnWeight: 14,
    taunt: '"Nothing you carry is written down out here."',
    abilities: [wielding("wpn-emberfang"), wielding("wpn-galewhisper")],
  },
  {
    id: "enemy-marshal",
    name: "Rescinded Marshal",
    title: "The Rescinded",
    faction: "rescinded",
    spriteKey: "battler:marshal_b",
    element: "water",
    level: 15,
    maxHp: 108,
    attack: 52,
    defense: 34,
    speed: 13,
    elixirReward: 190,
    spawnWeight: 10,
    taunt: '"Hand over the elixir. There will be no record either way."',
    abilities: [wielding("wpn-tidecleaver"), wielding("wpn-zephyrrod")],
  },
  {
    id: "enemy-warden",
    name: "Rescinded Warden",
    title: "The Rescinded",
    faction: "rescinded",
    spriteKey: "battler:warden_b",
    element: "void",
    level: 18,
    maxHp: 126,
    attack: 60,
    defense: 38,
    speed: 14,
    elixirReward: 260,
    spawnWeight: 7,
    taunt: '"We were unwritten. Now we do the unwriting."',
    abilities: [wielding("wpn-nullrift"), wielding("wpn-hollowstaff")],
  },
  {
    id: "enemy-gilded-warden",
    name: "Gilded Warden",
    title: "Rescinded Elite",
    faction: "rescinded",
    spriteKey: "battler:warden_a",
    element: "earth",
    level: 21,
    maxHp: 148,
    attack: 66,
    defense: 44,
    speed: 12,
    elixirReward: 340,
    spawnWeight: 5,
    taunt: '"Gold is the only ledger that never argues."',
    abilities: [wielding("wpn-stonecleave"), wielding("wpn-voidreaver")],
  },
  {
    id: "enemy-null-engine",
    name: "Null Engine",
    title: "Rescinded Construct",
    faction: "rescinded",
    spriteKey: "battler:null_engine_a",
    element: "air",
    level: 24,
    maxHp: 172,
    attack: 70,
    defense: 48,
    speed: 10,
    elixirReward: 420,
    spawnWeight: 3,
    taunt: "The Null Engine grinds to a halt in front of you. Its face is a screen of static.",
    abilities: [wielding("wpn-skypike"), wielding("wpn-deepfork"), wielding("wpn-stormfan")],
  },
  {
    id: "enemy-unwrit",
    name: "The Unwrit",
    title: "Warlord of the Rescinded",
    faction: "rescinded",
    spriteKey: "battler:unwrit_b",
    element: "void",
    level: 28,
    maxHp: 210,
    attack: 78,
    defense: 52,
    speed: 15,
    elixirReward: 600,
    spawnWeight: 2,
    taunt: '"Every universe I have taken is still not enough to make one of mine."',
    abilities: [wielding("wpn-voidreaver"), wielding("wpn-nullrift"), wielding("wpn-hollowstaff")],
  },
];

export const ENEMIES_BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

/** Every battler texture the game must preload, derived from the roster itself. */
export const BATTLER_KEYS = Array.from(new Set(ENEMIES.map((e) => e.spriteKey)));
