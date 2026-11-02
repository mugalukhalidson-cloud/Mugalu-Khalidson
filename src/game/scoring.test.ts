import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateJumpLanding,
  calculateScrapReward,
  clampDeltaTime,
  getSpeedTier,
  evaluateCheckpointProgress,
  type StuntState
} from './scoring';

test('evaluateJumpLanding awards zero for tiny ground tap', () => {
  const stunt: StuntState = {
    airtime: 0.1,
    maxAltitude: 0.5,
    flips: 0,
    rolls: 0,
    spins: 0,
    ringsPassed: 0
  };
  const result = evaluateJumpLanding(stunt, 1.0);
  assert.equal(result.totalPoints, 0);
  assert.equal(result.label, 'Ground Tap');
});

test('evaluateJumpLanding scales points with big air and stunts', () => {
  const stunt: StuntState = {
    airtime: 1.5,
    maxAltitude: 12.0,
    flips: 1,
    rolls: 1,
    spins: 0,
    ringsPassed: 1
  };
  const result = evaluateJumpLanding(stunt, 2.0);
  assert.ok(result.totalPoints > 1000);
  assert.ok(result.multiplier === 2.0);
  assert.ok(result.label.includes('AERIAL') || result.label.includes('BIG') || result.label.includes('COMBO'));
});

test('calculateScrapReward gives points and boost refill', () => {
  const reward = calculateScrapReward(20, 2);
  assert.equal(reward.points, 25);
  assert.equal(reward.boostRefill, 16);
});

test('clampDeltaTime limits delta time to prevent tunneling', () => {
  assert.equal(clampDeltaTime(0.25), 0.05);
  assert.equal(clampDeltaTime(0.016), 0.016);
  assert.equal(clampDeltaTime(0.0001), 0.001);
});

test('getSpeedTier classifies vehicle velocity correctly', () => {
  assert.equal(getSpeedTier(10, 100), 'low');
  assert.equal(getSpeedTier(45, 100), 'mid');
  assert.equal(getSpeedTier(75, 100), 'high');
  assert.equal(getSpeedTier(98, 100), 'hyper');
});

test('evaluateCheckpointProgress enforces checkpoint order', () => {
  // total 4 checkpoints: 0, 1, 2, 3
  // From 0 to 1 -> valid
  const step1 = evaluateCheckpointProgress(0, 1, 4, 1, 3);
  assert.equal(step1.valid, true);
  assert.equal(step1.nextCheckpoint, 2);
  assert.equal(step1.lapCompleted, false);

  // Skipping to 3 -> invalid
  const stepBad = evaluateCheckpointProgress(1, 3, 4, 1, 3);
  assert.equal(stepBad.valid, false);

  // Final checkpoint 3 to 0 finishes lap
  const stepLap = evaluateCheckpointProgress(3, 0, 4, 1, 3);
  assert.equal(stepLap.valid, true);
  assert.equal(stepLap.lapCompleted, true);
  assert.equal(stepLap.raceFinished, false);

  // Finishing final lap 3 -> finishes race
  const stepFinal = evaluateCheckpointProgress(3, 0, 4, 3, 3);
  assert.equal(stepFinal.raceFinished, true);
});
