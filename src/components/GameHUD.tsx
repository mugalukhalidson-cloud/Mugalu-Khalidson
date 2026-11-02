/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { type HUDState } from '../game/engine';
import { formatLapTime } from '../game/multiplayer';

interface GameHUDProps {
  hud: HUDState;
  onPause: () => void;
  onToggleMute: () => void;
  onResetPos: () => void;
  onCycleCamera: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  onPause,
  onToggleMute,
  onResetPos,
  onCycleCamera,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none flex flex-col justify-between p-5 sm:p-6">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Lap & Position Cluster (Matched to screenshot) */}
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-[20px] bg-zinc-950/90 border border-zinc-800/80 shadow-2xl text-zinc-100 flex items-center gap-5">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                POSITION
              </div>
              <div className="text-2xl font-black font-mono text-amber-400 leading-tight">
                {hud.position}
                <span className="text-xs text-zinc-500 font-normal"> / {hud.totalRacers}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-zinc-800" />

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                LAP
              </div>
              <div className="text-2xl font-black font-mono text-white leading-tight">
                {hud.lap}
                <span className="text-xs text-zinc-500 font-normal"> / {hud.maxLaps}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-zinc-800" />

            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                LAP TIME
              </div>
              <div className="text-base font-black font-mono text-cyan-400 leading-tight">
                {formatLapTime(hud.lapTime)}
              </div>
            </div>
          </div>

          {hud.isOnline && (
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>ONLINE ({hud.networkPlayerCount + 1})</span>
            </div>
          )}
        </div>

        {/* Top-Right: 4 Sleek Rounded Buttons (Matched to screenshot) */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Camera View Switcher */}
          <button
            onClick={onCycleCamera}
            className="w-11 h-11 rounded-[14px] bg-zinc-950/90 border border-zinc-800/80 hover:border-amber-400 text-white transition-all shadow-xl flex items-center justify-center cursor-pointer active:scale-95"
            title="Cycle Camera View [C]"
            tabIndex={-1}
            aria-label="Cycle Camera View"
          >
            <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* Reset Position */}
          <button
            onClick={onResetPos}
            className="w-11 h-11 rounded-[14px] bg-zinc-950/90 border border-zinc-800/80 hover:border-amber-400 text-white transition-all shadow-xl flex items-center justify-center cursor-pointer active:scale-95"
            title="Reset Position [R]"
            tabIndex={-1}
            aria-label="Reset Position"
          >
            <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          {/* Audio Mute/Unmute */}
          <button
            onClick={onToggleMute}
            className="w-11 h-11 rounded-[14px] bg-zinc-950/90 border border-zinc-800/80 hover:border-amber-400 text-white transition-all shadow-xl flex items-center justify-center cursor-pointer active:scale-95"
            title="Toggle Audio [M]"
            tabIndex={-1}
            aria-label="Toggle Audio"
          >
            {hud.isMuted ? (
              <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Pause */}
          <button
            onClick={onPause}
            className="w-11 h-11 rounded-[14px] bg-zinc-950/90 border border-zinc-800/80 hover:border-amber-400 text-white transition-all shadow-xl flex items-center justify-center cursor-pointer active:scale-95"
            title="Pause Game [Esc / P]"
            tabIndex={-1}
            aria-label="Pause Game"
          >
            <svg className="w-5 h-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mid Center: Stunt Combo & High Altitude Jump Banner */}
      <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
        {hud.isAirborne && (
          <div className="px-6 py-2.5 rounded-full bg-zinc-950/90 border border-sky-400/60 shadow-2xl flex items-center gap-3 animate-pulse">
            <span className="text-xs font-mono font-bold text-sky-300 uppercase tracking-widest">
              AIRBORNE
            </span>
            <span className="text-xl font-black font-mono text-white">
              {hud.altitude}m HIGH
            </span>
            <span className="text-xs font-mono text-amber-400">
              {hud.airtime}s
            </span>
          </div>
        )}

        {hud.recentStunt && (
          <div className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/95 to-orange-600/95 text-zinc-950 shadow-2xl flex items-center gap-4 transform scale-105 transition-all">
            <div className="font-black text-base uppercase tracking-wider">
              {hud.recentStunt.label}
            </div>
            <div className="font-mono font-extrabold text-lg">
              +{hud.recentStunt.totalPoints} PTS
            </div>
            {hud.comboMultiplier > 1 && (
              <span className="px-2 py-0.5 rounded bg-zinc-950 text-amber-300 text-xs font-bold font-mono">
                {hud.comboMultiplier}x COMBO
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Perimeter Bar */}
      <div className="flex items-end justify-between w-full">
        {/* Bottom-Left: Speedometer, Gear & Score (Matched to screenshot) */}
        <div className="px-5 py-4 rounded-[20px] bg-zinc-950/90 border border-zinc-800/80 shadow-2xl text-zinc-100 flex items-center gap-5">
          <div className="text-center min-w-10">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              GEAR
            </div>
            <div className="text-3xl font-black font-mono text-amber-400 leading-tight">
              {hud.gear}
            </div>
          </div>

          <div className="h-10 w-px bg-zinc-800" />

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black font-mono tracking-tight text-white tabular-nums leading-none">
                {hud.speedKmh}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">KM/H</span>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mt-1">
              SCORE : <span className="text-white font-bold">{hud.totalScore}</span>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Nitro Boost Gauge & Scrap Pickup Counter (Matched to screenshot) */}
        <div className="px-5 py-4 rounded-[20px] bg-zinc-950/90 border border-zinc-800/80 shadow-2xl text-zinc-100 space-y-2.5 min-w-64">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-200 flex items-center gap-1.5 font-bold tracking-wider">
              <span className="text-cyan-400 font-bold">★</span>
              <span>NITRO BOOST [SPACE]</span>
            </span>
            <span className="text-cyan-400 font-bold font-mono tabular-nums">{hud.boostFuel}%</span>
          </div>

          {/* Boost Progress Bar */}
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-100"
              style={{ width: `${(hud.boostFuel / hud.maxBoostFuel) * 100}%` }}
            />
          </div>

          {/* Scrap Collected Row */}
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-0.5">
            <span className="tracking-wider">SCRAP COLLECTED</span>
            <span className="text-amber-400 font-bold font-mono text-xs">{hud.scrapCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
