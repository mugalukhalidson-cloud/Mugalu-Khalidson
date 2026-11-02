import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordRaceOutcome,
  calculateStandings,
  formatLapTime,
  type PlayerStats,
  type NetworkPlayerState
} from './multiplayer';

test('recordRaceOutcome tracks victory and calculates win rate', () => {
  const initialStats: PlayerStats = {
    playerId: 'p1',
    playerName: 'Racer1',
    racesPlayed: 3,
    wins: 1,
    podiums: 2,
    losses: 2,
    winRate: 33,
    totalScore: 1200,
    bestLapTime: 34.5,
    scrapCollected: 14
  };

  // Win a race with a faster lap time
  const updated = recordRaceOutcome(initialStats, 1, 4, 1500, 31.2, 8);
  assert.equal(updated.racesPlayed, 4);
  assert.equal(updated.wins, 2);
  assert.equal(updated.podiums, 3);
  assert.equal(updated.losses, 2);
  assert.equal(updated.winRate, 50); // 2/4 = 50%
  assert.equal(updated.totalScore, 2700);
  assert.equal(updated.bestLapTime, 31.2);
  assert.equal(updated.scrapCollected, 22);
});

test('recordRaceOutcome records loss on 4th place', () => {
  const initialStats: PlayerStats = {
    playerId: 'p1',
    playerName: 'Racer1',
    racesPlayed: 1,
    wins: 1,
    podiums: 1,
    losses: 0,
    winRate: 100,
    totalScore: 800,
    bestLapTime: 40.0,
    scrapCollected: 5
  };

  const updated = recordRaceOutcome(initialStats, 4, 4, 300, 42.0, 2);
  assert.equal(updated.racesPlayed, 2);
  assert.equal(updated.wins, 1);
  assert.equal(updated.podiums, 1); // 4th is not podium
  assert.equal(updated.losses, 1);
  assert.equal(updated.winRate, 50);
  assert.equal(updated.bestLapTime, 40.0); // didn't beat best lap
});

test('calculateStandings accurately orders racers by lap, checkpoint and distance', () => {
  const checkpoints = [
    { x: 0, z: 0 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
  ];

  const players: NetworkPlayerState[] = [
    {
      id: 'p1',
      name: 'Leader',
      vehicleId: 'scrap_buggy',
      colorHex: 0xd97706,
      ready: true,
      isHost: true,
      x: 10,
      y: 0,
      z: -10,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 25,
      lap: 2,
      checkpoint: 1,
      score: 500,
      isFinished: false,
    },
    {
      id: 'p2',
      name: 'Trailer',
      vehicleId: 'junk_rocket',
      colorHex: 0x0284c7,
      ready: true,
      isHost: false,
      x: 0,
      y: 0,
      z: 5,
      heading: 0,
      pitch: 0,
      roll: 0,
      speed: 20,
      lap: 1,
      checkpoint: 2,
      score: 300,
      isFinished: false,
    },
  ];

  const standings = calculateStandings(players, checkpoints);
  assert.equal(standings[0].id, 'p1');
  assert.equal(standings[0].rank, 1);
  assert.equal(standings[1].id, 'p2');
  assert.equal(standings[1].rank, 2);
});

test('formatLapTime handles zero and minute-second intervals', () => {
  assert.equal(formatLapTime(0), '--:--.--');
  assert.equal(formatLapTime(65.42), '1:05.42');
  assert.equal(formatLapTime(24.8), '0:24.80');
});
