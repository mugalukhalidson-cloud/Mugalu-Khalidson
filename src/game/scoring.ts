/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StuntState {
  airtime: number;
  maxAltitude: number;
  flips: number;
  rolls: number;
  spins: number;
  ringsPassed: number;
}

export interface ScoreBreakdown {
  basePoints: number;
  airtimeBonus: number;
  stuntBonus: number;
  ringBonus: number;
  multiplier: number;
  totalPoints: number;
  label: string;
}

/**
 * Calculates score earned upon landing from a high jump.
 */
export function evaluateJumpLanding(stunt: StuntState, comboMultiplier: number): ScoreBreakdown {
  if (stunt.airtime < 0.3) {
    return {
      basePoints: 0,
      airtimeBonus: 0,
      stuntBonus: 0,
      ringBonus: 0,
      multiplier: 1,
      totalPoints: 0,
      label: 'Ground Tap',
    };
  }

  // Base airtime calculation: exponential reward for big air
  const airSec = Math.min(stunt.airtime, 8.0);
  const airtimeBonus = Math.round(airSec * 150 + Math.pow(airSec, 2) * 50);

  // Stunts: 300 pts per flip, 250 pts per roll, 200 pts per 360 spin
  const stuntBonus = (stunt.flips * 300) + (stunt.rolls * 250) + (stunt.spins * 200);

  // Rings passed through in mid-air: 500 each
  const ringBonus = stunt.ringsPassed * 500;

  const rawPoints = 100 + airtimeBonus + stuntBonus + ringBonus;
  const multiplier = Math.max(1, Math.min(comboMultiplier, 5.0));
  const totalPoints = Math.round(rawPoints * multiplier);

  let label = 'Clean Jump!';
  if (stunt.ringsPassed > 0 && stunt.flips > 0) {
    label = 'AERIAL ACROBAT!';
  } else if (stunt.airtime > 2.5) {
    label = 'MEGA HIGH AIR!';
  } else if (stunt.flips + stunt.rolls > 1) {
    label = 'INSANE COMBO!';
  } else if (stunt.airtime > 1.2) {
    label = 'BIG JUMP!';
  }

  return {
    basePoints: 100,
    airtimeBonus,
    stuntBonus,
    ringBonus,
    multiplier,
    totalPoints,
    label,
  };
}

/**
 * Calculates scrap metal collected value and bonus boost refill.
 */
export function calculateScrapReward(baseValue: number, currentCombo: number): { points: number; boostRefill: number } {
  const points = Math.round(baseValue * (1 + (currentCombo - 1) * 0.25));
  const boostRefill = Math.min(25, baseValue * 0.8);
  return { points, boostRefill };
}

/**
 * Clamps simulation delta time to prevent tunneling.
 */
export function clampDeltaTime(rawDt: number): number {
  return Math.max(0.001, Math.min(rawDt, 0.05));
}

/**
 * Calculates speed tier for camera FOV and particle density.
 */
export function getSpeedTier(speedKmh: number, maxKmh: number): 'low' | 'mid' | 'high' | 'hyper' {
  const ratio = speedKmh / Math.max(1, maxKmh);
  if (ratio > 0.9) return 'hyper';
  if (ratio > 0.6) return 'high';
  if (ratio > 0.3) return 'mid';
  return 'low';
}

/**
 * Evaluates whether a race lap is complete based on checkpoints traversed in order.
 */
export function evaluateCheckpointProgress(
  lastCheckpoint: number,
  hitCheckpoint: number,
  totalCheckpoints: number,
  currentLap: number,
  maxLaps: number
): { valid: boolean; lapCompleted: boolean; raceFinished: boolean; nextCheckpoint: number } {
  const expectedNext = (lastCheckpoint + 1) % totalCheckpoints;
  if (hitCheckpoint !== expectedNext) {
    return { valid: false, lapCompleted: false, raceFinished: false, nextCheckpoint: lastCheckpoint };
  }

  const lapCompleted = hitCheckpoint === 0 && lastCheckpoint === totalCheckpoints - 1;
  const newLap = lapCompleted ? currentLap + 1 : currentLap;
  const raceFinished = lapCompleted && newLap > maxLaps;

  return {
    valid: true,
    lapCompleted,
    raceFinished,
    nextCheckpoint: (hitCheckpoint + 1) % totalCheckpoints,
  };
}
