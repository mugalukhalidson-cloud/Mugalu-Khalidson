/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatLapTime, type PlayerStats } from '../game/multiplayer';
import { sound } from '../game/audio';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenGarage: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenGarage,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-zinc-900 border border-amber-500/40 shadow-2xl text-center space-y-6 text-zinc-100">
        <div>
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
            SIMULATION PAUSED
          </span>
          <h2 className="text-2xl font-black text-white mt-1">Pit Stop</h2>
        </div>

        <div className="space-y-3">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all cursor-pointer shadow"
          >
            Resume Race
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Restart Lap
          </button>

          <button
            onClick={onOpenGarage}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Custom Garage
          </button>

          <button
            onClick={onTitle}
            className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Exit to Title
          </button>
        </div>
      </div>
    </div>
  );
};

interface RaceFinishModalProps {
  isVictory: boolean;
  placement: number;
  totalRacers: number;
  totalScore: number;
  bestLapTime: number;
  scrapEarned: number;
  stats: PlayerStats;
  onPlayAgain: () => void;
  onOpenGarage: () => void;
  onTitle: () => void;
}

export const RaceFinishModal: React.FC<RaceFinishModalProps> = ({
  isVictory,
  placement,
  totalRacers,
  totalScore,
  bestLapTime,
  scrapEarned,
  stats,
  onPlayAgain,
  onOpenGarage,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-amber-500/50 shadow-2xl text-center space-y-6 text-zinc-100">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
            {isVictory ? 'GRAND PRIX CHAMPION' : 'CHECKERED FLAG'}
          </span>
          <h2 className="text-3xl font-black text-white mt-1">
            {isVictory ? 'VICTORY!' : `Finished #${placement}`}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {isVictory
              ? 'Flawless ground racing! Dominant performance on the courtyard circuit.'
              : `Placed ${placement} out of ${totalRacers} competitors.`}
          </p>
        </div>

        {/* Win/Loss Record Banner */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-around font-mono text-xs">
          <div>
            <span className="text-zinc-400 block text-[10px]">RECORD</span>
            <span className="font-bold text-amber-300">
              {stats.wins}W - {stats.losses}L
            </span>
          </div>
          <div className="h-6 w-px bg-amber-500/20" />
          <div>
            <span className="text-zinc-400 block text-[10px]">WIN RATE</span>
            <span className="font-bold text-emerald-400">{stats.winRate}%</span>
          </div>
          <div className="h-6 w-px bg-amber-500/20" />
          <div>
            <span className="text-zinc-400 block text-[10px]">PODIUMS</span>
            <span className="font-bold text-sky-400">{stats.podiums}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div className="text-[10px] font-mono uppercase text-zinc-400">BEST LAP</div>
            <div className="text-base font-black font-mono text-white mt-0.5">
              {formatLapTime(bestLapTime)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div className="text-[10px] font-mono uppercase text-zinc-400">STUNT PTS</div>
            <div className="text-base font-black font-mono text-amber-400 mt-0.5">
              {totalScore}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <div className="text-[10px] font-mono uppercase text-zinc-400">SCRAP</div>
            <div className="text-base font-black font-mono text-amber-300 mt-0.5">
              +{scrapEarned}
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="space-y-3 pt-2">
          <button
            data-start="true"
            onClick={() => {
              onPlayAgain();
              sound.playScrapPickup();
            }}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl cursor-pointer"
          >
            Race Again
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onOpenGarage();
                sound.playScrapPickup();
              }}
              className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Garage / Upgrades
            </button>

            <button
              onClick={() => {
                onTitle();
                sound.playScrapPickup();
              }}
              className="py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
