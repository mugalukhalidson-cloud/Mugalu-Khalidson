/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VehicleUpgradeLevels {
  engine: number;     // 1 to 4
  tires: number;      // 1 to 4
  thruster: number;   // 1 to 4
  suspension: number; // 1 to 4
}

export interface VehicleCustomizationPreset {
  id: string;
  name: string;
  vehicleId: string;
  colorHex: number;
  finishType: 'matte' | 'gloss' | 'metallic' | 'weathered';
  trimColorHex: number;
  decal: 'none' | 'hazard' | 'chevrons' | 'flames' | 'skull';
  upgrades: VehicleUpgradeLevels;
  createdAt: number;
}

export interface CatalogVehicle {
  id: string;
  name: string;
  description: string;
  archetype: 'balanced' | 'heavy' | 'speed' | 'agile' | 'elite';
  unlockLevel: number;
  costScrap: number;
  baseMaxSpeed: number; // km/h
  baseAccel: number;
  baseBoostMultiplier: number;
  baseJumpForce: number;
  defaultColorHex: number;
}

export const VEHICLE_CATALOG: CatalogVehicle[] = [
  {
    id: 'scrap_buggy',
    name: 'Scrap Buggy',
    description: 'Balanced desert junkyard racer with durable welded chassis and nimble handling.',
    archetype: 'balanced',
    unlockLevel: 1,
    costScrap: 0,
    baseMaxSpeed: 100,
    baseAccel: 1.0,
    baseBoostMultiplier: 1.35,
    baseJumpForce: 1.0,
    defaultColorHex: 0xd97706,
  },
  {
    id: 'rust_rammer',
    name: 'Rust Rammer',
    description: 'Heavy armored brute with a fortified bull-bar. Demolishes junk crates with ease.',
    archetype: 'heavy',
    unlockLevel: 2,
    costScrap: 120,
    baseMaxSpeed: 108,
    baseAccel: 0.88,
    baseBoostMultiplier: 1.25,
    baseJumpForce: 0.92,
    defaultColorHex: 0xdc2626,
  },
  {
    id: 'junk_rocket',
    name: 'Junk Rocket',
    description: 'Twin-supercharger frame engineered for colossal airtime launches and supersonic boost.',
    archetype: 'speed',
    unlockLevel: 3,
    costScrap: 260,
    baseMaxSpeed: 116,
    baseAccel: 1.15,
    baseBoostMultiplier: 1.55,
    baseJumpForce: 1.28,
    defaultColorHex: 0x0284c7,
  },
  {
    id: 'garden_rover',
    name: 'Garden Rover',
    description: 'High-traction crawler tuned specifically for mossy brick terraces and sharp chicanes.',
    archetype: 'agile',
    unlockLevel: 4,
    costScrap: 420,
    baseMaxSpeed: 104,
    baseAccel: 1.22,
    baseBoostMultiplier: 1.32,
    baseJumpForce: 1.08,
    defaultColorHex: 0x16a34a,
  },
  {
    id: 'wasteland_phantom',
    name: 'Wasteland Phantom',
    description: 'Elite titanium scrap interceptor featuring hyper-drive boosters and extreme agility.',
    archetype: 'elite',
    unlockLevel: 6,
    costScrap: 750,
    baseMaxSpeed: 126,
    baseAccel: 1.35,
    baseBoostMultiplier: 1.65,
    baseJumpForce: 1.35,
    defaultColorHex: 0x9333ea,
  },
];

export const PAINT_COLORS = [
  { name: 'Rust Amber', hex: 0xd97706 },
  { name: 'Scrap Crimson', hex: 0xdc2626 },
  { name: 'Cobalt Nitro', hex: 0x0284c7 },
  { name: 'Moss Jade', hex: 0x16a34a },
  { name: 'Purple Glory', hex: 0x9333ea },
  { name: 'Toxic Acid', hex: 0x84cc16 },
  { name: 'Desert Sand', hex: 0xd4a373 },
  { name: 'Pitch Black', hex: 0x18181b },
  { name: 'Cyber Orange', hex: 0xf97316 },
];

export const TRIM_COLORS = [
  { name: 'Charcoal Steel', hex: 0x27272a },
  { name: 'Chrome Polish', hex: 0xd4d4d8 },
  { name: 'Blued Titanium', hex: 0x38bdf8 },
  { name: 'Gold Brass', hex: 0xf59e0b },
];

export const UPGRADE_TIER_COSTS = [0, 40, 90, 160]; // Cost for tier 1 (free), 2, 3, 4

/**
 * Calculates current race level and progress toward next level from accumulated XP.
 * XP is earned from race finishes, stunts, scrap pickups, and victories.
 */
export function calculateRaceLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progressPercent: number } {
  // Level threshold: Level 1: 0, Level 2: 300, Level 3: 750, Level 4: 1350, Level 5: 2100, Level 6: 3000...
  const thresholds = [0, 300, 750, 1350, 2100, 3000, 4200, 5600, 7200, 9000];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) {
      level = i + 1;
      break;
    }
  }

  const currentThreshold = thresholds[level - 1] || 0;
  const nextThreshold = thresholds[level] || thresholds[level - 1] + 1500;
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progressPercent = Math.min(100, Math.round((xpInLevel / Math.max(1, xpNeeded)) * 100));

  return {
    level,
    currentXp: xp,
    nextLevelXp: nextThreshold,
    progressPercent,
  };
}

/**
 * Checks whether a player meets requirements to unlock/purchase a vehicle.
 */
export function canUnlockVehicle(playerLevel: number, playerScrap: number, vehicle: CatalogVehicle, unlockedIds: string[]): {
  unlocked: boolean;
  canBuy: boolean;
  reason?: string;
} {
  if (unlockedIds.includes(vehicle.id) || vehicle.costScrap === 0) {
    return { unlocked: true, canBuy: false };
  }

  if (playerLevel < vehicle.unlockLevel) {
    return {
      unlocked: false,
      canBuy: false,
      reason: `Requires Race Level ${vehicle.unlockLevel}`,
    };
  }

  if (playerScrap < vehicle.costScrap) {
    return {
      unlocked: false,
      canBuy: false,
      reason: `Need ${vehicle.costScrap - playerScrap} more Scrap (${vehicle.costScrap} required)`,
    };
  }

  return { unlocked: false, canBuy: true };
}

/**
 * Calculates modified vehicle performance specs with applied upgrades.
 */
export function calculateUpgradedSpecs(base: CatalogVehicle, upgrades: VehicleUpgradeLevels): {
  maxSpeedKmh: number;
  accelRating: number;
  boostMultiplier: number;
  jumpForce: number;
} {
  // Engine: +4 km/h and +0.08 accel per tier
  const engineBonusSpeed = (upgrades.engine - 1) * 4;
  const engineBonusAccel = (upgrades.engine - 1) * 0.08;

  // Tires: +0.05 accel and +3 km/h
  const tireBonusSpeed = (upgrades.tires - 1) * 2;
  const tireBonusAccel = (upgrades.tires - 1) * 0.06;

  // Thruster: +0.08 boost multiplier
  const thrusterBonus = (upgrades.thruster - 1) * 0.08;

  // Suspension: +0.09 jump force
  const jumpBonus = (upgrades.suspension - 1) * 0.09;

  return {
    maxSpeedKmh: Math.round(base.baseMaxSpeed + engineBonusSpeed + tireBonusSpeed),
    accelRating: Number((base.baseAccel + engineBonusAccel + tireBonusAccel).toFixed(2)),
    boostMultiplier: Number((base.baseBoostMultiplier + thrusterBonus).toFixed(2)),
    jumpForce: Number((base.baseJumpForce + jumpBonus).toFixed(2)),
  };
}

/**
 * Default preset for a vehicle.
 */
export function createDefaultPreset(vehicleId: string, colorHex?: number): VehicleCustomizationPreset {
  const cat = VEHICLE_CATALOG.find((v) => v.id === vehicleId) || VEHICLE_CATALOG[0];
  return {
    id: `preset_${vehicleId}_${Date.now()}`,
    name: 'Stock Runner',
    vehicleId,
    colorHex: colorHex ?? cat.defaultColorHex,
    finishType: 'matte',
    trimColorHex: 0x27272a,
    decal: 'none',
    upgrades: {
      engine: 1,
      tires: 1,
      thruster: 1,
      suspension: 1,
    },
    createdAt: Date.now(),
  };
}
