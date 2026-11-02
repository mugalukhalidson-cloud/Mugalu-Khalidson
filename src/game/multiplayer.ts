/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PlayerStats {
  playerId: string;
  playerName: string;
  racesPlayed: number;
  wins: number;
  podiums: number;
  losses: number;
  winRate: number; // percentage 0-100
  totalScore: number;
  bestLapTime: number;
  scrapCollected: number;
}

export interface VehicleConfig {
  id: string;
  name: string;
  description: string;
  archetype: 'balanced' | 'heavy' | 'speed' | 'agile';
  colorHex: number;
  colorName: string;
  maxSpeed: number; // km/h
  accel: number;
  boostMultiplier: number;
  jumpForce: number;
}

export const VEHICLE_PRESETS: VehicleConfig[] = [
  {
    id: 'scrap_buggy',
    name: 'Scrap Buggy',
    description: 'Balanced desert junkyard racer with rock-solid suspension and agile handling.',
    archetype: 'balanced',
    colorHex: 0xd97706, // Amber Rust
    colorName: 'Rust Amber',
    maxSpeed: 105,
    accel: 1.0,
    boostMultiplier: 1.35,
    jumpForce: 1.0,
  },
  {
    id: 'rust_rammer',
    name: 'Rust Rammer',
    description: 'Heavy armored brute with a fortified bull-bar. Smashes crates effortlessly.',
    archetype: 'heavy',
    colorHex: 0xdc2626, // Crimson Red
    colorName: 'Scrap Crimson',
    maxSpeed: 112,
    accel: 0.85,
    boostMultiplier: 1.25,
    jumpForce: 0.9,
  },
  {
    id: 'junk_rocket',
    name: 'Junk Rocket',
    description: 'Twin-supercharger frame built for maximum airtime stunts and supersonic boost.',
    archetype: 'speed',
    colorHex: 0x0284c7, // Sky Cyan
    colorName: 'Cobalt Nitro',
    maxSpeed: 118,
    accel: 1.15,
    boostMultiplier: 1.55,
    jumpForce: 1.25,
  },
  {
    id: 'garden_rover',
    name: 'Garden Rover',
    description: 'Specialized high-traction buggy optimized for mossy brick terraces and sharp chicanes.',
    archetype: 'agile',
    colorHex: 0x16a34a, // Emerald Green
    colorName: 'Moss Jade',
    maxSpeed: 102,
    accel: 1.2,
    boostMultiplier: 1.3,
    jumpForce: 1.05,
  },
];

export const VEHICLE_COLORS = [
  { name: 'Rust Amber', hex: 0xd97706 },
  { name: 'Scrap Crimson', hex: 0xdc2626 },
  { name: 'Cobalt Nitro', hex: 0x0284c7 },
  { name: 'Moss Jade', hex: 0x16a34a },
  { name: 'Purple Glory', hex: 0x9333ea },
  { name: 'Asphalt Black', hex: 0x27272a },
];

export interface NetworkPlayerState {
  id: string;
  name: string;
  vehicleId: string;
  colorHex: number;
  ready: boolean;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  speed: number;
  lap: number;
  checkpoint: number;
  score: number;
  isFinished: boolean;
  finishTime?: number;
  placement?: number;
}

export interface LobbyInfo {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  state: 'waiting' | 'countdown' | 'racing' | 'finished';
  laps: number;
}

/**
 * Updates a player's stats with a race result.
 */
export function recordRaceOutcome(
  currentStats: PlayerStats,
  placement: number,
  totalRacers: number,
  scoreEarned: number,
  bestLap: number,
  scrapEarned: number
): PlayerStats {
  const isWin = placement === 1;
  const isPodium = placement <= 3;
  const isLoss = !isWin;

  const newRaces = currentStats.racesPlayed + 1;
  const newWins = currentStats.wins + (isWin ? 1 : 0);
  const newPodiums = currentStats.podiums + (isPodium ? 1 : 0);
  const newLosses = currentStats.losses + (isLoss ? 1 : 0);
  const winRate = Math.round((newWins / newRaces) * 100);

  const updatedBestLap = currentStats.bestLapTime === 0
    ? bestLap
    : bestLap > 0 ? Math.min(currentStats.bestLapTime, bestLap) : currentStats.bestLapTime;

  return {
    ...currentStats,
    racesPlayed: newRaces,
    wins: newWins,
    podiums: newPodiums,
    losses: newLosses,
    winRate,
    totalScore: currentStats.totalScore + scoreEarned,
    bestLapTime: updatedBestLap,
    scrapCollected: currentStats.scrapCollected + scrapEarned,
  };
}

/**
 * Calculates current race placements based on lap, checkpoint, and distance.
 */
export function calculateStandings(
  players: NetworkPlayerState[],
  checkpoints: { x: number; z: number }[]
): { id: string; rank: number }[] {
  const scores = players.map((p) => {
    if (p.isFinished && p.placement) {
      // Already finished players are ordered by their finish placement
      return { id: p.id, sortScore: 1000000 - p.placement * 1000 };
    }
    const nextCpIdx = (p.checkpoint + 1) % Math.max(1, checkpoints.length);
    const nextCp = checkpoints[nextCpIdx] || { x: 0, z: 0 };
    const dx = p.x - nextCp.x;
    const dz = p.z - nextCp.z;
    const distToCp = Math.sqrt(dx * dx + dz * dz);

    const sortScore = (p.lap * 10000) + (p.checkpoint * 1000) - distToCp;
    return { id: p.id, sortScore };
  });

  scores.sort((a, b) => b.sortScore - a.sortScore);
  return scores.map((item, idx) => ({ id: item.id, rank: idx + 1 }));
}

/**
 * Formats seconds into MM:SS.SS
 */
export function formatLapTime(seconds: number): string {
  if (seconds <= 0) return '--:--.--';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}
