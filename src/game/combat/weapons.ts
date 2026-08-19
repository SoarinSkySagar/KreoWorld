/**
 * The weapon catalogue. Characters have no innate powers — a weapon NFT is the
 * only thing that grants an ability, so this file is effectively the game's
 * move list.
 *
 * `iconKey` matches a file under `public/assets/weapons/` produced by
 * `scripts/extract-assets.py`; the two must be edited together.
 */

import type { WeaponClass, WeaponNFT } from "@/lib/services/types";

/**
 * What a class *is*, as opposed to what an element does. Element is the
 * effectiveness multiplier; class is the role — how hard it hits, how often it
 * connects, how fast it lets you move. Keeping the second axis off the
 * multiplier is what stops damage swinging 4x/0.25x.
 */
export const CLASS_PROFILE: Record<
  WeaponClass,
  { attack: number; speed: number; accuracy: number; role: string }
> = {
  sword: { attack: 1.0, speed: 1.0, accuracy: 1.0, role: "balanced" },
  axe: { attack: 1.3, speed: 0.8, accuracy: 0.85, role: "heavy" },
  staff: { attack: 0.85, speed: 1.0, accuracy: 1.0, role: "ability-led" },
  trident: { attack: 1.0, speed: 1.1, accuracy: 0.95, role: "repeating" },
  fan: { attack: 0.75, speed: 1.35, accuracy: 1.0, role: "defensive" },
  slingshot: { attack: 0.7, speed: 1.2, accuracy: 1.0, role: "unerring" },
};

export const WEAPONS: WeaponNFT[] = [
  // --- swords: balanced, bleed ------------------------------------------------
  {
    id: "wpn-emberfang",
    name: "Emberfang",
    weaponClass: "sword",
    element: "fire",
    rarity: "rare",
    attack: 34,
    iconKey: "wpn_sword_ember",
    ability: {
      id: "ab-emberfang",
      name: "Cinder Cut",
      description: "A burning slash that leaves the wound smouldering.",
      power: 46,
      accuracy: 95,
      uses: 12,
      effect: { kind: "bleed", damage: 5, turns: 3 },
    },
  },
  {
    id: "wpn-tidecleaver",
    name: "Tidecleaver",
    weaponClass: "sword",
    element: "water",
    rarity: "epic",
    attack: 41,
    iconKey: "wpn_sword_tide",
    ability: {
      id: "ab-tidecleaver",
      name: "Undertow",
      description: "Drags the strike back, taking some of the blow with it.",
      power: 44,
      accuracy: 95,
      uses: 10,
      effect: { kind: "drain", ratio: 0.35 },
    },
  },
  {
    id: "wpn-nullrift",
    name: "Null Rift",
    weaponClass: "sword",
    element: "void",
    rarity: "legendary",
    attack: 52,
    iconKey: "wpn_sword_null",
    ability: {
      id: "ab-nullrift",
      name: "Unwrite",
      description: "Cuts through resistance the way a rescindment cuts a ledger.",
      power: 55,
      accuracy: 90,
      uses: 6,
      effect: { kind: "pierce" },
    },
  },
  {
    id: "wpn-loamedge",
    name: "Loam Edge",
    weaponClass: "sword",
    element: "earth",
    rarity: "common",
    attack: 24,
    iconKey: "wpn_sword_loam",
    ability: {
      id: "ab-loamedge",
      name: "Root Slash",
      description: "Heavy, honest, and always lands where you aimed it.",
      power: 38,
      accuracy: 100,
      uses: 15,
    },
  },
  {
    id: "wpn-galewhisper",
    name: "Gale Whisper",
    weaponClass: "sword",
    element: "air",
    rarity: "rare",
    attack: 30,
    iconKey: "wpn_sword_gale",
    ability: {
      id: "ab-galewhisper",
      name: "Split Wind",
      description: "Two cuts before the air notices the first.",
      power: 42,
      accuracy: 92,
      uses: 12,
      effect: { kind: "multi", hits: 2 },
    },
  },

  // --- axes: heavy, all-in ----------------------------------------------------
  {
    id: "wpn-pyreheader",
    name: "Pyreheader",
    weaponClass: "axe",
    element: "fire",
    rarity: "epic",
    attack: 55,
    iconKey: "wpn_axe_ember",
    ability: {
      id: "ab-pyreheader",
      name: "Furnace Swing",
      description: "Everything you have, in one arc. If it connects.",
      power: 78,
      accuracy: 72,
      uses: 6,
      effect: { kind: "bleed", damage: 7, turns: 2 },
    },
  },
  {
    id: "wpn-stonecleave",
    name: "Stonecleave",
    weaponClass: "axe",
    element: "earth",
    rarity: "rare",
    attack: 47,
    iconKey: "wpn_axe_loam",
    ability: {
      id: "ab-stonecleave",
      name: "Fault Line",
      description: "Splits the ground under them and their footing with it.",
      power: 66,
      accuracy: 78,
      uses: 8,
      effect: { kind: "weaken", factor: 0.75, turns: 3 },
    },
  },
  {
    id: "wpn-voidreaver",
    name: "Voidreaver",
    weaponClass: "axe",
    element: "void",
    rarity: "legendary",
    attack: 61,
    iconKey: "wpn_axe_null",
    ability: {
      id: "ab-voidreaver",
      name: "Erasure",
      description: "There is no guard against a thing that was never recorded.",
      power: 84,
      accuracy: 70,
      uses: 4,
      effect: { kind: "pierce" },
    },
  },

  // --- staffs: ability-led ----------------------------------------------------
  {
    id: "wpn-tidewarden",
    name: "Tidewarden",
    weaponClass: "staff",
    element: "water",
    rarity: "rare",
    attack: 26,
    iconKey: "wpn_staff_tide",
    ability: {
      id: "ab-tidewarden",
      name: "Siphon",
      description: "Takes their elixir and gives it to you. Most of it.",
      power: 34,
      accuracy: 96,
      uses: 12,
      effect: { kind: "drain", ratio: 0.6 },
    },
  },
  {
    id: "wpn-emberbrand",
    name: "Emberbrand",
    weaponClass: "staff",
    element: "fire",
    rarity: "common",
    attack: 21,
    iconKey: "wpn_staff_ember",
    ability: {
      id: "ab-emberbrand",
      name: "Slow Burn",
      description: "Small now. Considerably less small in three turns.",
      power: 26,
      accuracy: 100,
      uses: 15,
      effect: { kind: "bleed", damage: 9, turns: 4 },
    },
  },
  {
    id: "wpn-hollowstaff",
    name: "Hollow Staff",
    weaponClass: "staff",
    element: "void",
    rarity: "epic",
    attack: 29,
    iconKey: "wpn_staff_null",
    ability: {
      id: "ab-hollowstaff",
      name: "Rescind",
      description: "Strikes the strength out of them rather than the life.",
      power: 30,
      accuracy: 100,
      uses: 10,
      effect: { kind: "weaken", factor: 0.6, turns: 4 },
    },
  },
  {
    id: "wpn-zephyrrod",
    name: "Zephyr Rod",
    weaponClass: "staff",
    element: "air",
    rarity: "rare",
    attack: 25,
    iconKey: "wpn_staff_gale",
    ability: {
      id: "ab-zephyrrod",
      name: "Updraft",
      description: "Lifts you out of the way of whatever comes next.",
      power: 32,
      accuracy: 98,
      uses: 12,
      effect: { kind: "guard", amount: 0.5 },
    },
  },

  // --- tridents: repeating ----------------------------------------------------
  {
    id: "wpn-deepfork",
    name: "Deepfork",
    weaponClass: "trident",
    element: "water",
    rarity: "epic",
    attack: 38,
    iconKey: "wpn_trident_tide",
    ability: {
      id: "ab-deepfork",
      name: "Threefold Tide",
      description: "Three shallow wounds beat one they can brace for.",
      power: 54,
      accuracy: 90,
      uses: 8,
      effect: { kind: "multi", hits: 3 },
    },
  },
  {
    id: "wpn-terrafork",
    name: "Terrafork",
    weaponClass: "trident",
    element: "earth",
    rarity: "common",
    attack: 28,
    iconKey: "wpn_trident_loam",
    ability: {
      id: "ab-terrafork",
      name: "Furrow",
      description: "Two turns of the earth, one after the other.",
      power: 40,
      accuracy: 92,
      uses: 14,
      effect: { kind: "multi", hits: 2 },
    },
  },
  {
    id: "wpn-skypike",
    name: "Skypike",
    weaponClass: "trident",
    element: "air",
    rarity: "rare",
    attack: 33,
    iconKey: "wpn_trident_gale",
    ability: {
      id: "ab-skypike",
      name: "Thin Air",
      description: "Finds the gap in armour that armour does not know it has.",
      power: 48,
      accuracy: 88,
      uses: 10,
      effect: { kind: "pierce" },
    },
  },

  // --- fans: defensive, always first ------------------------------------------
  {
    id: "wpn-stormfan",
    name: "Stormfan",
    weaponClass: "fan",
    element: "air",
    rarity: "epic",
    attack: 22,
    iconKey: "wpn_fan_gale",
    ability: {
      id: "ab-stormfan",
      name: "Ward Gust",
      description: "You move first, and what lands on you lands softly.",
      power: 28,
      accuracy: 100,
      uses: 14,
      effect: { kind: "guard", amount: 0.6 },
    },
  },
  {
    id: "wpn-cinderfan",
    name: "Cinderfan",
    weaponClass: "fan",
    element: "fire",
    rarity: "rare",
    attack: 24,
    iconKey: "wpn_fan_ember",
    ability: {
      id: "ab-cinderfan",
      name: "Fan the Flames",
      description: "Feeds on the burn already there, and gives some back.",
      power: 30,
      accuracy: 100,
      uses: 12,
      effect: { kind: "drain", ratio: 0.45 },
    },
  },

  // --- slingshots: unerring chip ----------------------------------------------
  {
    id: "wpn-pebblecast",
    name: "Pebblecast",
    weaponClass: "slingshot",
    element: "earth",
    rarity: "common",
    attack: 18,
    iconKey: "wpn_sling_loam",
    ability: {
      id: "ab-pebblecast",
      name: "Sure Shot",
      description: "It will never be impressive. It will never miss.",
      power: 24,
      accuracy: 100,
      uses: 20,
    },
  },
  {
    id: "wpn-nullshot",
    name: "Nullshot",
    weaponClass: "slingshot",
    element: "void",
    rarity: "rare",
    attack: 23,
    iconKey: "wpn_sling_null",
    ability: {
      id: "ab-nullshot",
      name: "Blank Round",
      description: "Small, certain, and it does not care what you are resistant to.",
      power: 26,
      accuracy: 100,
      uses: 16,
      effect: { kind: "pierce" },
    },
  },
];

export const WEAPONS_BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));

/** Every icon key the game must preload. */
export const WEAPON_ICON_KEYS = Array.from(new Set(WEAPONS.map((w) => w.iconKey)));
