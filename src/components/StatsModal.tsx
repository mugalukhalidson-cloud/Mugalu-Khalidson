/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { type PlayerStats, formatLapTime } from '../game/multiplayer';
import { calculateRaceLevel } from '../game/customization';

interface StatsModalProps {
  stats: PlayerStats;
  playerXp: number;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, playerXp, onClose }) => {
  const levelInfo = calculateRaceLevel(playerXp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
              Career Win / Loss Records
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
              {stats.playerName}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Records"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Level Progress Banner */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-400 text-lg">
                {levelInfo.level}
              </div>
              <div>
                <div className="text-xs text-zinc-400 uppercase font-mono font-bold">
                  Driver Standing
                </div>
                <div className="text-sm font-bold text-white">
                  {levelInfo.level >= 6
                    ? 'Wasteland Legend'
                    : levelInfo.level >= 4
                    ? 'Pro Circuit Racer'
                    : levelInfo.level >= 2
                    ? 'Scrap Veteran'
                    : 'Rookie Contender'}
                </div>
              </div>
            </div>

            <div className="w-48 text-right">
              <div className="text-xs text-zinc-400 font-mono mb-1">
                {levelInfo.currentXp} / {levelInfo.nextLevelXp} XP ({levelInfo.progressPercent}%)
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Core Win / Loss Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 text-center">
              <div className="text-xs uppercase font-bold text-zinc-400 mb-1">Races Played</div>
              <div className="text-2xl font-black text-white font-mono">{stats.racesPlayed}</div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="text-xs uppercase font-bold text-emerald-400 mb-1">1st Victories</div>
              <div className="text-2xl font-black text-emerald-300 font-mono">{stats.wins}</div>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
              <div className="text-xs uppercase font-bold text-amber-400 mb-1">Podium Finishes</div>
              <div className="text-2xl font-black text-amber-300 font-mono">{stats.podiums}</div>
            </div>

            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
              <div className="text-xs uppercase font-bold text-red-400 mb-1">Losses</div>
              <div className="text-2xl font-black text-red-300 font-mono">{stats.losses}</div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-zinc-400">Win Rate</span>
              <span className="text-lg font-black text-amber-400 font-mono">{stats.winRate}%</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-zinc-400">Best Lap</span>
              <span className="text-lg font-black text-sky-400 font-mono">
                {formatLapTime(stats.bestLapTime)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-zinc-400">Total Scrap</span>
              <span className="text-lg font-black text-amber-300 font-mono">
                {stats.scrapCollected}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
