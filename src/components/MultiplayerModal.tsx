/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { type LobbyInfo, type NetworkPlayerState } from '../game/multiplayer';
import { VEHICLE_CATALOG } from '../game/customization';
import { sound } from '../game/audio';

interface MultiplayerModalProps {
  playerId: string;
  playerName: string;
  selectedVehicleId: string;
  selectedColorHex: number;
  socket: WebSocket | null;
  onStartOnlineRace: (startingSlot: number) => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  playerId,
  playerName,
  selectedVehicleId,
  selectedColorHex,
  socket,
  onStartOnlineRace,
  onClose,
}) => {
  const [view, setView] = useState<'hub' | 'lobby' | 'create'>('hub');
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [currentLobbyName, setCurrentLobbyName] = useState<string>('');
  const [players, setPlayers] = useState<NetworkPlayerState[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [customLobbyName, setCustomLobbyName] = useState(`${playerName}'s Grand Prix`);
  const [customLaps, setCustomLaps] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch public lobbies
  const fetchLobbies = async () => {
    try {
      const res = await fetch('/api/lobbies');
      if (res.ok) {
        const data = await res.json();
        setLobbies(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'lobby_joined') {
          setCurrentLobbyId(msg.lobbyId);
          setIsHost(msg.isHost);
          setView('lobby');
          sound.playScrapPickup();
        } else if (msg.type === 'lobby_sync') {
          setCurrentLobbyName(msg.lobbyName);
          setPlayers(msg.players || []);
          if (msg.countdownSeconds && msg.countdownSeconds > 0) {
            setCountdown(msg.countdownSeconds);
          } else {
            setCountdown(null);
          }
        } else if (msg.type === 'countdown_tick') {
          setCountdown(msg.seconds);
          sound.playJump();
        } else if (msg.type === 'race_start') {
          setCountdown(null);
          sound.playStuntChime();
          // Find own slot index
          const slot = players.findIndex((p) => p.id === playerId);
          onStartOnlineRace(Math.max(0, slot));
          onClose();
        } else if (msg.type === 'error') {
          setErrorMessage(msg.message);
          setTimeout(() => setErrorMessage(null), 3000);
        }
      } catch {}
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket, players, playerId, onStartOnlineRace, onClose]);

  const handleQuickMatch = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage('Connecting to game server...');
      return;
    }
    socket.send(
      JSON.stringify({
        type: 'quick_match',
        playerId,
        playerName,
        vehicleId: selectedVehicleId,
        colorHex: selectedColorHex,
      })
    );
    sound.playScrapPickup();
  };

  const handleCreateLobby = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: 'create_lobby',
        playerId,
        playerName,
        lobbyName: customLobbyName,
        laps: customLaps,
        vehicleId: selectedVehicleId,
        colorHex: selectedColorHex,
      })
    );
    sound.playScrapPickup();
  };

  const handleJoinLobby = (lobbyId: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: 'join_lobby',
        lobbyId,
        playerId,
        playerName,
        vehicleId: selectedVehicleId,
        colorHex: selectedColorHex,
      })
    );
    sound.playScrapPickup();
  };

  const handleToggleReady = () => {
    if (!socket) return;
    socket.send(JSON.stringify({ type: 'toggle_ready' }));
    sound.playScrapPickup();
  };

  const handleStartRace = () => {
    if (!socket || !isHost) return;
    socket.send(JSON.stringify({ type: 'start_race' }));
    sound.playStuntChime();
  };

  const handleLeaveLobby = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: 'leave_lobby' }));
    }
    setCurrentLobbyId(null);
    setView('hub');
    fetchLobbies();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
              Online Multiplayer Hub
            </h2>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>LIVE SERVER</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Multiplayer Hub"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="px-6 py-2 bg-red-500/20 border-b border-red-500/40 text-red-200 text-xs font-bold text-center">
            {errorMessage}
          </div>
        )}

        {/* VIEW 1: HUB / BROWSER */}
        {view === 'hub' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Match Hero Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/60 to-zinc-900 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  FAST MATCHMAKING
                </span>
                <h3 className="text-2xl font-black text-white mt-1">Quick Match</h3>
                <p className="text-xs text-zinc-300 mt-1 max-w-md">
                  Jump straight into the active ground race circuit. Automatically pools with other online scrap racers!
                </p>
              </div>
              <button
                onClick={handleQuickMatch}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer whitespace-nowrap"
              >
                Find Online Race
              </button>
            </div>

            {/* Create Custom Room Banner */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                Active Lobbies ({lobbies.length})
              </h3>
              <button
                onClick={() => setView('create')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                + Create Custom Lobby
              </button>
            </div>

            {/* Lobby List */}
            <div className="space-y-3">
              {lobbies.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
                  No public lobbies found. Click &quot;Find Online Race&quot; or create a custom room!
                </div>
              ) : (
                lobbies.map((l) => (
                  <div
                    key={l.id}
                    className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between hover:border-zinc-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{l.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {l.id}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 font-mono">
                        Host: {l.hostName} · {l.laps} Laps · Status: {l.state.toUpperCase()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs font-mono text-zinc-300">
                        {l.playerCount} / {l.maxPlayers} Racers
                      </div>
                      <button
                        onClick={() => handleJoinLobby(l.id)}
                        disabled={l.playerCount >= l.maxPlayers || l.state === 'racing'}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          l.playerCount < l.maxPlayers && l.state !== 'racing'
                            ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {l.state === 'racing' ? 'In Progress' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: CREATE LOBBY */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-lg font-black text-white mb-4">Create Custom Racing Room</h3>
            <form onSubmit={handleCreateLobby} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                  Lobby Title
                </label>
                <input
                  type="text"
                  value={customLobbyName}
                  onChange={(e) => setCustomLobbyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-400"
                  maxLength={32}
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                  Race Distance (Laps)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 5].map((laps) => (
                    <button
                      type="button"
                      key={laps}
                      onClick={() => setCustomLaps(laps)}
                      className={`py-2 rounded-lg border text-xs font-bold font-mono transition-all cursor-pointer ${
                        customLaps === laps
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'border-zinc-800 bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {laps} {laps === 1 ? 'Lap' : 'Laps'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  Create & Enter Room
                </button>
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 3: IN-LOBBY ROOM */}
        {view === 'lobby' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Lobby Banner */}
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  ROOM ID: {currentLobbyId}
                </span>
                <h3 className="text-xl font-black text-white">{currentLobbyName}</h3>
              </div>

              {countdown !== null && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-black text-lg animate-bounce">
                  STARTING IN {countdown}...
                </div>
              )}
            </div>

            {/* Racers Grid */}
            <div>
              <h4 className="text-xs uppercase font-bold tracking-wider text-zinc-400 mb-3">
                Racers in Lobby ({players.length} / 4)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {players.map((p) => {
                  const veh = VEHICLE_CATALOG.find((v) => v.id === p.vehicleId);
                  const isMe = p.id === playerId;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        isMe ? 'border-amber-400/60 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full border border-white/20 shadow"
                          style={{ backgroundColor: `#${p.colorHex.toString(16).padStart(6, '0')}` }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {p.name} {isMe && '(You)'}
                            </span>
                            {p.isHost && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold uppercase">
                                Host
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 font-mono mt-0.5">
                            {veh?.name || 'Scrap Buggy'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        {p.ready ? (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase font-mono">
                            READY
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                            WAITING
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* In-Lobby Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={handleLeaveLobby}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Leave Lobby
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleReady}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    players.find((p) => p.id === playerId)?.ready
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {players.find((p) => p.id === playerId)?.ready ? 'Set Unready' : 'Ready Up'}
                </button>

                {isHost && (
                  <button
                    onClick={handleStartRace}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    Start Race Now
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
