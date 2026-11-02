/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, type HUDState, type GameState } from './game/engine';
import {
  type PlayerStats,
  type VehicleConfig,
  VEHICLE_PRESETS,
  recordRaceOutcome,
} from './game/multiplayer';
import {
  type VehicleCustomizationPreset,
  createDefaultPreset,
  VEHICLE_CATALOG,
} from './game/customization';
import { createDecalTexture } from './game/textures';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { GarageModal } from './components/GarageModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { StatsModal } from './components/StatsModal';
import { PauseModal, RaceFinishModal } from './components/Modals';

const DEFAULT_HUD: HUDState = {
  speedKmh: 0,
  boostFuel: 100,
  maxBoostFuel: 100,
  gear: 1,
  altitude: 0,
  isAirborne: false,
  airtime: 0,
  scrapCount: 0,
  totalScore: 0,
  comboMultiplier: 1.0,
  lap: 1,
  maxLaps: 3,
  position: 1,
  totalRacers: 4,
  lapTime: 0,
  bestLapTime: 0,
  checkpointProgress: 0,
  recentStunt: null,
  cameraMode: 'chase',
  isMuted: false,
  isOnline: false,
  networkPlayerCount: 0,
  standings: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Persistent Player Profile
  const [playerId] = useState<string>(() => {
    let id = localStorage.getItem('ground_race_player_id');
    if (!id) {
      id = `racer_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('ground_race_player_id', id);
    }
    return id;
  });

  const [playerName] = useState<string>(() => {
    return localStorage.getItem('ground_race_player_name') || 'ScrapRacer';
  });

  const [playerXp, setPlayerXp] = useState<number>(() => {
    const val = localStorage.getItem('ground_race_xp');
    return val ? parseInt(val, 10) : 350; // Starter XP gives Level 2
  });

  const [playerScrap, setPlayerScrap] = useState<number>(() => {
    const val = localStorage.getItem('ground_race_scrap');
    return val ? parseInt(val, 10) : 280; // Starter scrap allows trying garage right away
  });

  const [unlockedVehicleIds, setUnlockedVehicleIds] = useState<string[]>(() => {
    const stored = localStorage.getItem('ground_race_unlocked');
    return stored ? JSON.parse(stored) : ['scrap_buggy'];
  });

  // Presets & Customization
  const [presets, setPresets] = useState<VehicleCustomizationPreset[]>(() => {
    const stored = localStorage.getItem('ground_race_presets');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return [createDefaultPreset('scrap_buggy', 0xd97706)];
  });

  const [activePreset, setActivePreset] = useState<VehicleCustomizationPreset>(() => {
    return presets[0] || createDefaultPreset('scrap_buggy', 0xd97706);
  });

  // Career Win/Loss Records
  const [stats, setStats] = useState<PlayerStats>(() => {
    const stored = localStorage.getItem('ground_race_stats');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return {
      playerId,
      playerName,
      racesPlayed: 0,
      wins: 0,
      podiums: 0,
      losses: 0,
      winRate: 0,
      totalScore: 0,
      bestLapTime: 0,
      scrapCollected: 0,
    };
  });

  // UI State
  const [gameState, setGameState] = useState<GameState>('title');
  const [hud, setHud] = useState<HUDState>(DEFAULT_HUD);
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);
  const [isGarageOpen, setIsGarageOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [lastRaceFinish, setLastRaceFinish] = useState<{
    placement: number;
    totalRacers: number;
    score: number;
    bestLap: number;
    scrap: number;
  } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ground_race_xp', playerXp.toString());
  }, [playerXp]);

  useEffect(() => {
    localStorage.setItem('ground_race_scrap', playerScrap.toString());
  }, [playerScrap]);

  useEffect(() => {
    localStorage.setItem('ground_race_unlocked', JSON.stringify(unlockedVehicleIds));
  }, [unlockedVehicleIds]);

  useEffect(() => {
    localStorage.setItem('ground_race_presets', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('ground_race_stats', JSON.stringify(stats));
  }, [stats]);

  // Fetch server stats
  useEffect(() => {
    fetch(`/api/stats/${playerId}?name=${encodeURIComponent(playerName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.racesPlayed > stats.racesPlayed) {
          setStats(data);
        }
      })
      .catch(() => {});
  }, [playerId, playerName]);

  // WebSocket connection for real multiplayer
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'init_player', playerId, playerName }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'player_pose' && engineRef.current) {
          engineRef.current.updateRemotePlayer(msg);
        } else if (msg.type === 'player_left' && engineRef.current) {
          engineRef.current.removeRemotePlayer(msg.id);
        }
      } catch {}
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [playerId, playerName]);

  // Apply active vehicle customization to engine
  const applyPresetToEngine = useCallback(
    (preset: VehicleCustomizationPreset) => {
      if (!engineRef.current) return;
      const cat = VEHICLE_CATALOG.find((v) => v.id === preset.vehicleId) || VEHICLE_CATALOG[0];

      // Build VehicleConfig for engine physics
      const config: VehicleConfig = {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        archetype: cat.archetype as any,
        colorHex: preset.colorHex,
        colorName: 'Custom',
        maxSpeed: cat.baseMaxSpeed + (preset.upgrades.engine - 1) * 4 + (preset.upgrades.tires - 1) * 2,
        accel: cat.baseAccel + (preset.upgrades.engine - 1) * 0.08 + (preset.upgrades.tires - 1) * 0.06,
        boostMultiplier: cat.baseBoostMultiplier + (preset.upgrades.thruster - 1) * 0.08,
        jumpForce: cat.baseJumpForce + (preset.upgrades.suspension - 1) * 0.09,
      };

      engineRef.current.setVehicle(config, preset.colorHex);

      // Notify WebSocket server of vehicle choice if connected
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'select_vehicle',
            vehicleId: preset.vehicleId,
            colorHex: preset.colorHex,
          })
        );
      }
    },
    []
  );

  // Initialize Game Engine once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const engine = new GameEngine(canvasMountRef.current, {
      onHUDUpdate: (newHud) => {
        setHud(newHud);
      },
      onGameStateChange: (newState) => {
        setGameState(newState);
      },
      onStuntNotice: () => {},
      onRaceFinished: (placement, totalRacers, score, bestLap, scrap) => {
        setLastRaceFinish({ placement, totalRacers, score, bestLap, scrap });

        // Update Career Win/Loss Record
        setStats((prev) => {
          const updated = recordRaceOutcome(prev, placement, totalRacers, score, bestLap, scrap);

          // Sync to server REST
          fetch(`/api/stats/${playerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              placement,
              totalRacers,
              scoreEarned: score,
              bestLap,
              scrapEarned: scrap,
              name: playerName,
            }),
          }).catch(() => {});

          return updated;
        });

        // Award XP and Scrap to player
        const xpEarned = (placement === 1 ? 300 : placement <= 3 ? 180 : 100) + Math.round(score / 10);
        setPlayerXp((xp) => xp + xpEarned);
        setPlayerScrap((sc) => sc + scrap + (placement === 1 ? 50 : 20));
      },
      onNetworkPoseUpdate: (pose) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'player_pose', ...pose }));
        }
      },
      onNetworkFinish: (finishTime, score, bestLap) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'player_finish', finishTime, score, bestLap }));
        }
      },
    });

    engineRef.current = engine;
    applyPresetToEngine(activePreset);

    return () => {
      engine.cleanup();
      engineRef.current = null;
    };
  }, []);

  // Sync active preset changes to engine
  useEffect(() => {
    applyPresetToEngine(activePreset);
  }, [activePreset, applyPresetToEngine]);

  // Handlers
  const handleStartOfflineRace = () => {
    if (!engineRef.current) return;
    engineRef.current.startOfflineRace();
  };

  const handleStartOnlineRace = (startingSlot: number) => {
    if (!engineRef.current) return;
    engineRef.current.startOnlineRace(startingSlot);
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleRestart = () => {
    engineRef.current?.resetPlayerPosition();
    engineRef.current?.resumeGame();
  };

  const handleTitle = () => {
    engineRef.current?.returnToTitle();
  };

  const handleToggleMute = () => {
    engineRef.current?.toggleMute();
  };

  const handleResetPos = () => {
    engineRef.current?.resetPlayerPosition();
  };

  const handleCycleCamera = () => {
    engineRef.current?.cycleCamera();
  };

  // Customization actions
  const handleEquipVehicle = (vehicleId: string) => {
    const cat = VEHICLE_CATALOG.find((v) => v.id === vehicleId) || VEHICLE_CATALOG[0];
    const newPreset = createDefaultPreset(vehicleId, cat.defaultColorHex);
    setActivePreset(newPreset);
  };

  const handleBuyVehicle = (vehicleId: string, cost: number) => {
    if (playerScrap < cost) return;
    setPlayerScrap((sc) => sc - cost);
    setUnlockedVehicleIds((prev) => (prev.includes(vehicleId) ? prev : [...prev, vehicleId]));
    handleEquipVehicle(vehicleId);
  };

  const handleUpdatePreset = (newPreset: VehicleCustomizationPreset) => {
    setActivePreset(newPreset);
    setPresets((prev) => prev.map((p) => (p.id === newPreset.id ? newPreset : p)));
  };

  const handleSavePreset = (newPreset: VehicleCustomizationPreset) => {
    setActivePreset(newPreset);
    setPresets((prev) => [newPreset, ...prev.filter((p) => p.id !== newPreset.id)]);
  };

  const handleDeletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  const handleSpendScrap = (amount: number): boolean => {
    if (playerScrap >= amount) {
      setPlayerScrap((sc) => sc - amount);
      return true;
    }
    return false;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-zinc-950 font-sans">
      {/* 3D WebGL Canvas Viewport (Mounted in isolated ref) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          playerXp={playerXp}
          playerScrap={playerScrap}
          stats={stats}
          activePreset={activePreset}
          onStartOffline={handleStartOfflineRace}
          onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
          onOpenGarage={() => setIsGarageOpen(true)}
          onOpenStats={() => setIsStatsOpen(true)}
        />
      )}

      {/* In-Game HUD (Visible during active gameplay) */}
      {gameState === 'playing' && (
        <GameHUD
          hud={hud}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onResetPos={handleResetPos}
          onCycleCamera={handleCycleCamera}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenGarage={() => setIsGarageOpen(true)}
          onTitle={handleTitle}
        />
      )}

      {/* Victory / Defeat Race Finish Modal */}
      {(gameState === 'victory' || gameState === 'gameover') && lastRaceFinish && (
        <RaceFinishModal
          isVictory={lastRaceFinish.placement === 1}
          placement={lastRaceFinish.placement}
          totalRacers={lastRaceFinish.totalRacers}
          totalScore={lastRaceFinish.score}
          bestLapTime={lastRaceFinish.bestLap}
          scrapEarned={lastRaceFinish.scrap}
          stats={stats}
          onPlayAgain={handleStartOfflineRace}
          onOpenGarage={() => setIsGarageOpen(true)}
          onTitle={handleTitle}
        />
      )}

      {/* Online Multiplayer Modal */}
      {isMultiplayerOpen && (
        <MultiplayerModal
          playerId={playerId}
          playerName={playerName}
          selectedVehicleId={activePreset.vehicleId}
          selectedColorHex={activePreset.colorHex}
          socket={socketRef.current}
          onStartOnlineRace={handleStartOnlineRace}
          onClose={() => setIsMultiplayerOpen(false)}
        />
      )}

      {/* Vehicle Customization & Garage Modal */}
      {isGarageOpen && (
        <GarageModal
          playerXp={playerXp}
          playerScrap={playerScrap}
          unlockedVehicleIds={unlockedVehicleIds}
          activePreset={activePreset}
          presets={presets}
          onEquipVehicle={handleEquipVehicle}
          onBuyVehicle={handleBuyVehicle}
          onUpdatePreset={handleUpdatePreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onSpendScrap={handleSpendScrap}
          onClose={() => setIsGarageOpen(false)}
        />
      )}

      {/* Win/Loss Career Records Modal */}
      {isStatsOpen && (
        <StatsModal
          stats={stats}
          playerXp={playerXp}
          onClose={() => setIsStatsOpen(false)}
        />
      )}
    </div>
  );
}
