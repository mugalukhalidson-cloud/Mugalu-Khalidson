import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRaceLevel,
  canUnlockVehicle,
  calculateUpgradedSpecs,
  createDefaultPreset,
  VEHICLE_CATALOG,
  type VehicleUpgradeLevels,
} from './customization';

test('calculateRaceLevel determines level and progress from XP', () => {
  // 0 XP -> Level 1
  const lvl1 = calculateRaceLevel(0);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.progressPercent, 0);

  // 450 XP -> Level 2 (Level 2 is 300 to 750, 150/450 = 33%)
  const lvl2 = calculateRaceLevel(450);
  assert.equal(lvl2.level, 2);
  assert.equal(lvl2.progressPercent, 33);

  // 1500 XP -> Level 4 (Level 4 is 1350 to 2100)
  const lvl4 = calculateRaceLevel(1500);
  assert.equal(lvl4.level, 4);
});

test('canUnlockVehicle validates level and scrap requirements', () => {
  const rammer = VEHICLE_CATALOG.find((v) => v.id === 'rust_rammer')!; // Req Level 2, 120 Scrap

  // Level 1 player cannot buy even with enough scrap
  const check1 = canUnlockVehicle(1, 200, rammer, ['scrap_buggy']);
  assert.equal(check1.unlocked, false);
  assert.equal(check1.canBuy, false);
  assert.ok(check1.reason?.includes('Race Level 2'));

  // Level 2 player with insufficient scrap cannot buy
  const check2 = canUnlockVehicle(2, 50, rammer, ['scrap_buggy']);
  assert.equal(check2.unlocked, false);
  assert.equal(check2.canBuy, false);
  assert.ok(check2.reason?.includes('more Scrap'));

  // Level 2 player with 150 scrap can buy!
  const check3 = canUnlockVehicle(2, 150, rammer, ['scrap_buggy']);
  assert.equal(check3.unlocked, false);
  assert.equal(check3.canBuy, true);

  // Already unlocked vehicle
  const check4 = canUnlockVehicle(1, 0, rammer, ['scrap_buggy', 'rust_rammer']);
  assert.equal(check4.unlocked, true);
  assert.equal(check4.canBuy, false);
});

test('calculateUpgradedSpecs enhances vehicle attributes per tier', () => {
  const buggy = VEHICLE_CATALOG[0]; // baseMaxSpeed: 100, baseAccel: 1.0, baseJumpForce: 1.0
  const stockUpgrades: VehicleUpgradeLevels = { engine: 1, tires: 1, thruster: 1, suspension: 1 };
  const stockSpecs = calculateUpgradedSpecs(buggy, stockUpgrades);
  assert.equal(stockSpecs.maxSpeedKmh, 100);
  assert.equal(stockSpecs.accelRating, 1.0);
  assert.equal(stockSpecs.jumpForce, 1.0);

  const maxUpgrades: VehicleUpgradeLevels = { engine: 4, tires: 4, thruster: 4, suspension: 4 };
  const maxSpecs = calculateUpgradedSpecs(buggy, maxUpgrades);
  assert.ok(maxSpecs.maxSpeedKmh > 115);
  assert.ok(maxSpecs.accelRating > 1.3);
  assert.ok(maxSpecs.boostMultiplier > 1.5);
  assert.ok(maxSpecs.jumpForce > 1.2);
});

test('createDefaultPreset creates a valid customizable preset', () => {
  const preset = createDefaultPreset('junk_rocket', 0x0284c7);
  assert.equal(preset.vehicleId, 'junk_rocket');
  assert.equal(preset.colorHex, 0x0284c7);
  assert.equal(preset.upgrades.engine, 1);
  assert.ok(preset.id.startsWith('preset_junk_rocket_'));
});
