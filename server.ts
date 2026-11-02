/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = 3000;

app.use(express.json());

// In-Memory Database for Win/Loss Records & Stats
interface ServerPlayerStats {
  playerId: string;
  playerName: string;
  racesPlayed: number;
  wins: number;
  podiums: number;
  losses: number;
  winRate: number;
  totalScore: number;
  bestLapTime: number;
  scrapCollected: number;
}

const statsStore = new Map<string, ServerPlayerStats>();

function getOrCreateStats(playerId: string, playerName: string): ServerPlayerStats {
  if (!statsStore.has(playerId)) {
    statsStore.set(playerId, {
      playerId,
      playerName: playerName || 'Racer',
      racesPlayed: 0,
      wins: 0,
      podiums: 0,
      losses: 0,
      winRate: 0,
      totalScore: 0,
      bestLapTime: 0,
      scrapCollected: 0,
    });
  }
  return statsStore.get(playerId)!;
}

// REST Endpoints
app.get('/api/stats/:id', (req, res) => {
  const stats = getOrCreateStats(req.params.id, String(req.query.name || 'Racer'));
  res.json(stats);
});

app.post('/api/stats/:id', (req, res) => {
  const { placement, totalRacers, scoreEarned, bestLap, scrapEarned, name } = req.body;
  const current = getOrCreateStats(req.params.id, name || 'Racer');

  const isWin = placement === 1;
  const isPodium = placement <= 3;
  const isLoss = !isWin;

  const newRaces = current.racesPlayed + 1;
  const newWins = current.wins + (isWin ? 1 : 0);
  const newPodiums = current.podiums + (isPodium ? 1 : 0);
  const newLosses = current.losses + (isLoss ? 1 : 0);
  const winRate = Math.round((newWins / newRaces) * 100);

  const updatedBestLap = current.bestLapTime === 0
    ? (bestLap || 0)
    : (bestLap > 0 ? Math.min(current.bestLapTime, bestLap) : current.bestLapTime);

  const updated: ServerPlayerStats = {
    ...current,
    playerName: name || current.playerName,
    racesPlayed: newRaces,
    wins: newWins,
    podiums: newPodiums,
    losses: newLosses,
    winRate,
    totalScore: current.totalScore + (scoreEarned || 0),
    bestLapTime: updatedBestLap,
    scrapCollected: current.scrapCollected + (scrapEarned || 0),
  };

  statsStore.set(req.params.id, updated);
  res.json(updated);
});

// WebSocket Server & Multiplayer Lobby Manager
interface ClientSocket extends WebSocket {
  playerId?: string;
  playerName?: string;
  lobbyId?: string;
}

interface LobbyPlayer {
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
  socket?: ClientSocket;
}

interface ServerLobby {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  state: 'waiting' | 'countdown' | 'racing' | 'finished';
  laps: number;
  players: Map<string, LobbyPlayer>;
  countdownTimer?: NodeJS.Timeout;
  countdownSeconds: number;
  finishCount: number;
}

const lobbies = new Map<string, ServerLobby>();

// Pre-create 1-2 default public lobbies so players immediately see community rooms
const defaultLobby: ServerLobby = {
  id: 'COURTYARD-1',
  name: 'Courtyard Terrace Grand Prix',
  hostId: 'system',
  maxPlayers: 4,
  state: 'waiting',
  laps: 3,
  players: new Map(),
  countdownSeconds: 0,
  finishCount: 0,
};
lobbies.set(defaultLobby.id, defaultLobby);

app.get('/api/lobbies', (_req, res) => {
  const list = Array.from(lobbies.values()).map((l) => ({
    id: l.id,
    name: l.name,
    hostName: l.players.get(l.hostId)?.name || 'Open Room',
    playerCount: l.players.size,
    maxPlayers: l.maxPlayers,
    state: l.state,
    laps: l.laps,
  }));
  res.json(list);
});

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastLobby(lobby: ServerLobby, msg: Record<string, unknown>, excludeSocket?: ClientSocket) {
  const payload = JSON.stringify(msg);
  lobby.players.forEach((p) => {
    if (p.socket && p.socket !== excludeSocket && p.socket.readyState === WebSocket.OPEN) {
      p.socket.send(payload);
    }
  });
}

function getLobbyStatePayload(lobby: ServerLobby) {
  return {
    type: 'lobby_sync',
    lobbyId: lobby.id,
    lobbyName: lobby.name,
    state: lobby.state,
    laps: lobby.laps,
    countdownSeconds: lobby.countdownSeconds,
    players: Array.from(lobby.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      vehicleId: p.vehicleId,
      colorHex: p.colorHex,
      ready: p.ready,
      isHost: p.isHost,
      x: p.x,
      y: p.y,
      z: p.z,
      heading: p.heading,
      pitch: p.pitch,
      roll: p.roll,
      speed: p.speed,
      lap: p.lap,
      checkpoint: p.checkpoint,
      score: p.score,
      isFinished: p.isFinished,
      placement: p.placement,
      finishTime: p.finishTime,
    })),
  };
}

wss.on('connection', (ws: ClientSocket) => {
  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'init_player') {
        ws.playerId = msg.playerId;
        ws.playerName = msg.playerName;
        getOrCreateStats(msg.playerId, msg.playerName);
      }

      // 1. Quick Matchmaking: finds open lobby or creates one
      else if (msg.type === 'quick_match') {
        const playerId = msg.playerId || ws.playerId || `guest_${Math.floor(Math.random() * 8999 + 1000)}`;
        const playerName = msg.playerName || ws.playerName || 'Racer';
        ws.playerId = playerId;
        ws.playerName = playerName;

        // Find available lobby
        let targetLobby: ServerLobby | undefined;
        for (const l of lobbies.values()) {
          if (l.state === 'waiting' && l.players.size < l.maxPlayers) {
            targetLobby = l;
            break;
          }
        }

        if (!targetLobby) {
          // Create new match lobby
          const lobbyId = `JUNK-${Math.floor(Math.random() * 899 + 100)}`;
          targetLobby = {
            id: lobbyId,
            name: `${playerName}'s Match`,
            hostId: playerId,
            maxPlayers: 4,
            state: 'waiting',
            laps: 3,
            players: new Map(),
            countdownSeconds: 0,
            finishCount: 0,
          };
          lobbies.set(lobbyId, targetLobby);
        }

        joinLobby(ws, targetLobby, playerId, playerName, msg.vehicleId, msg.colorHex);
      }

      // 2. Create Custom Lobby
      else if (msg.type === 'create_lobby') {
        const playerId = msg.playerId || ws.playerId || `guest_${Math.floor(Math.random() * 8999 + 1000)}`;
        const playerName = msg.playerName || ws.playerName || 'Racer';
        const lobbyId = (msg.lobbyId || `ROOM-${Math.floor(Math.random() * 899 + 100)}`).toUpperCase();

        const lobby: ServerLobby = {
          id: lobbyId,
          name: msg.lobbyName || `${playerName}'s Lobby`,
          hostId: playerId,
          maxPlayers: msg.maxPlayers || 4,
          state: 'waiting',
          laps: msg.laps || 3,
          players: new Map(),
          countdownSeconds: 0,
          finishCount: 0,
        };
        lobbies.set(lobbyId, lobby);
        joinLobby(ws, lobby, playerId, playerName, msg.vehicleId, msg.colorHex);
      }

      // 3. Join Existing Lobby
      else if (msg.type === 'join_lobby') {
        const lobby = lobbies.get(msg.lobbyId);
        if (!lobby) {
          ws.send(JSON.stringify({ type: 'error', message: 'Lobby not found' }));
          return;
        }
        if (lobby.players.size >= lobby.maxPlayers && !lobby.players.has(msg.playerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Lobby is full' }));
          return;
        }
        joinLobby(ws, lobby, msg.playerId, msg.playerName, msg.vehicleId, msg.colorHex);
      }

      // 4. Select Vehicle / Color
      else if (msg.type === 'select_vehicle') {
        if (!ws.lobbyId) return;
        const lobby = lobbies.get(ws.lobbyId);
        if (!lobby) return;
        const player = lobby.players.get(ws.playerId!);
        if (player) {
          if (msg.vehicleId) player.vehicleId = msg.vehicleId;
          if (msg.colorHex !== undefined) player.colorHex = msg.colorHex;
          broadcastLobby(lobby, getLobbyStatePayload(lobby));
        }
      }

      // 5. Toggle Ready
      else if (msg.type === 'toggle_ready') {
        if (!ws.lobbyId) return;
        const lobby = lobbies.get(ws.lobbyId);
        if (!lobby) return;
        const player = lobby.players.get(ws.playerId!);
        if (player) {
          player.ready = !player.ready;
          broadcastLobby(lobby, getLobbyStatePayload(lobby));

          // Auto-start countdown if all players ready and >= 2 players
          checkAutoStart(lobby);
        }
      }

      // 6. Host Manual Start Race
      else if (msg.type === 'start_race') {
        if (!ws.lobbyId) return;
        const lobby = lobbies.get(ws.lobbyId);
        if (!lobby) return;
        if (lobby.hostId === ws.playerId) {
          startRaceCountdown(lobby);
        }
      }

      // 7. Live Player Pose Updates (20Hz)
      else if (msg.type === 'player_pose') {
        if (!ws.lobbyId) return;
        const lobby = lobbies.get(ws.lobbyId);
        if (!lobby || lobby.state !== 'racing') return;
        const player = lobby.players.get(ws.playerId!);
        if (player) {
          player.x = msg.x;
          player.y = msg.y;
          player.z = msg.z;
          player.heading = msg.heading;
          player.pitch = msg.pitch;
          player.roll = msg.roll;
          player.speed = msg.speed;
          player.lap = msg.lap;
          player.checkpoint = msg.checkpoint;
          player.score = msg.score;

          // Broadcast to other racers
          broadcastLobby(
            lobby,
            {
              type: 'player_pose',
              id: player.id,
              x: player.x,
              y: player.y,
              z: player.z,
              heading: player.heading,
              pitch: player.pitch,
              roll: player.roll,
              speed: player.speed,
              lap: player.lap,
              checkpoint: player.checkpoint,
              score: player.score,
            },
            ws
          );
        }
      }

      // 8. Player Crosses Finish Line
      else if (msg.type === 'player_finish') {
        if (!ws.lobbyId) return;
        const lobby = lobbies.get(ws.lobbyId);
        if (!lobby) return;
        const player = lobby.players.get(ws.playerId!);
        if (player && !player.isFinished) {
          lobby.finishCount++;
          player.isFinished = true;
          player.placement = lobby.finishCount;
          player.finishTime = msg.finishTime;

          // Record stats
          const currentStats = getOrCreateStats(player.id, player.name);
          const isWin = player.placement === 1;
          const isPodium = player.placement <= 3;
          currentStats.racesPlayed++;
          if (isWin) currentStats.wins++;
          if (isPodium) currentStats.podiums++;
          else currentStats.losses++;
          currentStats.winRate = Math.round((currentStats.wins / currentStats.racesPlayed) * 100);
          currentStats.totalScore += msg.score || 0;
          if (msg.bestLap && (currentStats.bestLapTime === 0 || msg.bestLap < currentStats.bestLapTime)) {
            currentStats.bestLapTime = msg.bestLap;
          }

          broadcastLobby(lobby, {
            type: 'player_finish',
            id: player.id,
            placement: player.placement,
            finishTime: player.finishTime,
            stats: currentStats,
          });

          // Check if all finished
          const unfinished = Array.from(lobby.players.values()).filter((p) => !p.isFinished);
          if (unfinished.length === 0) {
            lobby.state = 'finished';
            broadcastLobby(lobby, getLobbyStatePayload(lobby));
          }
        }
      }

      // 9. Leave Lobby / Return to Menu
      else if (msg.type === 'leave_lobby') {
        handleDisconnect(ws);
      }
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });
});

function joinLobby(
  ws: ClientSocket,
  lobby: ServerLobby,
  playerId: string,
  playerName: string,
  vehicleId?: string,
  colorHex?: number
) {
  if (ws.lobbyId && ws.lobbyId !== lobby.id) {
    handleDisconnect(ws);
  }

  ws.playerId = playerId;
  ws.playerName = playerName;
  ws.lobbyId = lobby.id;

  const isHost = lobby.players.size === 0 || lobby.hostId === playerId;
  if (isHost) lobby.hostId = playerId;

  const player: LobbyPlayer = {
    id: playerId,
    name: playerName,
    vehicleId: vehicleId || 'scrap_buggy',
    colorHex: colorHex ?? 0xd97706,
    ready: isHost, // Host is ready by default
    isHost,
    x: 0,
    y: 0.4,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    lap: 1,
    checkpoint: 0,
    score: 0,
    isFinished: false,
    socket: ws,
  };

  lobby.players.set(playerId, player);
  ws.send(JSON.stringify({ type: 'lobby_joined', lobbyId: lobby.id, isHost }));
  broadcastLobby(lobby, getLobbyStatePayload(lobby));
}

function checkAutoStart(lobby: ServerLobby) {
  if (lobby.state !== 'waiting') return;
  const count = lobby.players.size;
  if (count >= 2) {
    const allReady = Array.from(lobby.players.values()).every((p) => p.ready);
    if (allReady) {
      startRaceCountdown(lobby);
    }
  }
}

function startRaceCountdown(lobby: ServerLobby) {
  if (lobby.state !== 'waiting') return;
  lobby.state = 'countdown';
  lobby.countdownSeconds = 3;
  lobby.finishCount = 0;

  // Reset player race progress
  lobby.players.forEach((p) => {
    p.isFinished = false;
    p.placement = undefined;
    p.finishTime = undefined;
    p.lap = 1;
    p.checkpoint = 0;
    p.score = 0;
  });

  broadcastLobby(lobby, getLobbyStatePayload(lobby));

  lobby.countdownTimer = setInterval(() => {
    lobby.countdownSeconds--;
    if (lobby.countdownSeconds <= 0) {
      clearInterval(lobby.countdownTimer);
      lobby.state = 'racing';
      broadcastLobby(lobby, { type: 'race_start' });
      broadcastLobby(lobby, getLobbyStatePayload(lobby));
    } else {
      broadcastLobby(lobby, { type: 'countdown_tick', seconds: lobby.countdownSeconds });
    }
  }, 1000);
}

function handleDisconnect(ws: ClientSocket) {
  if (ws.lobbyId && ws.playerId) {
    const lobby = lobbies.get(ws.lobbyId);
    if (lobby) {
      lobby.players.delete(ws.playerId);
      if (lobby.players.size === 0) {
        if (lobby.id !== 'COURTYARD-1') {
          lobbies.delete(lobby.id);
        } else {
          lobby.state = 'waiting';
        }
      } else {
        if (lobby.hostId === ws.playerId) {
          // Reassign host
          const nextHost = lobby.players.values().next().value;
          if (nextHost) {
            lobby.hostId = nextHost.id;
            nextHost.isHost = true;
          }
        }
        broadcastLobby(lobby, getLobbyStatePayload(lobby));
      }
    }
    ws.lobbyId = undefined;
  }
}

// Development Vite Server integration vs Production build
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
