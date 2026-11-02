/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  VEHICLE_CATALOG,
  PAINT_COLORS,
  TRIM_COLORS,
  UPGRADE_TIER_COSTS,
  calculateRaceLevel,
  calculateUpgradedSpecs,
  canUnlockVehicle,
  createDefaultPreset,
  type CatalogVehicle,
  type VehicleCustomizationPreset,
  type VehicleUpgradeLevels,
} from '../game/customization';
import { sound } from '../game/audio';

interface GarageModalProps {
  playerXp: number;
  playerScrap: number;
  unlockedVehicleIds: string[];
  activePreset: VehicleCustomizationPreset;
  presets: VehicleCustomizationPreset[];
  onEquipVehicle: (vehicleId: string) => void;
  onBuyVehicle: (vehicleId: string, cost: number) => void;
  onUpdatePreset: (preset: VehicleCustomizationPreset) => void;
  onSavePreset: (preset: VehicleCustomizationPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onSpendScrap: (amount: number) => boolean;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  playerXp,
  playerScrap,
  unlockedVehicleIds,
  activePreset,
  presets,
  onEquipVehicle,
  onBuyVehicle,
  onUpdatePreset,
  onSavePreset,
  onDeletePreset,
  onSpendScrap,
  onClose,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(activePreset.vehicleId);
  const [activeTab, setActiveTab] = useState<'paint' | 'decals' | 'upgrades' | 'presets'>('paint');
  const [presetNameInput, setPresetNameInput] = useState('');
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  const levelInfo = calculateRaceLevel(playerXp);
  const currentVehicle = VEHICLE_CATALOG.find((v) => v.id === selectedVehicleId) || VEHICLE_CATALOG[0];
  const isUnlocked = unlockedVehicleIds.includes(currentVehicle.id) || currentVehicle.costScrap === 0;
  const isEquipped = activePreset.vehicleId === currentVehicle.id;

  const currentSpecs = calculateUpgradedSpecs(currentVehicle, activePreset.upgrades);

  const handleSelectColor = (colorHex: number) => {
    onUpdatePreset({ ...activePreset, colorHex });
    sound.playScrapPickup();
  };

  const handleSelectFinish = (finishType: 'matte' | 'gloss' | 'metallic' | 'weathered') => {
    onUpdatePreset({ ...activePreset, finishType });
    sound.playScrapPickup();
  };

  const handleSelectTrim = (trimColorHex: number) => {
    onUpdatePreset({ ...activePreset, trimColorHex });
    sound.playScrapPickup();
  };

  const handleSelectDecal = (decal: 'none' | 'hazard' | 'chevrons' | 'flames' | 'skull') => {
    onUpdatePreset({ ...activePreset, decal });
    sound.playScrapPickup();
  };

  const handleUpgradeTier = (part: keyof VehicleUpgradeLevels) => {
    const currentTier = activePreset.upgrades[part];
    if (currentTier >= 4) return;
    const cost = UPGRADE_TIER_COSTS[currentTier]; // cost for next tier
    if (playerScrap < cost) {
      setPurchaseNotice(`Need ${cost - playerScrap} more Scrap to upgrade!`);
      setTimeout(() => setPurchaseNotice(null), 3000);
      return;
    }

    if (onSpendScrap(cost)) {
      const newUpgrades = {
        ...activePreset.upgrades,
        [part]: currentTier + 1,
      };
      onUpdatePreset({ ...activePreset, upgrades: newUpgrades });
      sound.playStuntChime();
      setPurchaseNotice(`${part.toUpperCase()} upgraded to Tier ${currentTier + 1}!`);
      setTimeout(() => setPurchaseNotice(null), 2500);
    }
  };

  const handleBuyVehicle = () => {
    const check = canUnlockVehicle(levelInfo.level, playerScrap, currentVehicle, unlockedVehicleIds);
    if (!check.canBuy) {
      setPurchaseNotice(check.reason || 'Cannot unlock vehicle yet');
      setTimeout(() => setPurchaseNotice(null), 3000);
      return;
    }

    onBuyVehicle(currentVehicle.id, currentVehicle.costScrap);
    sound.playStuntChime();
    setPurchaseNotice(`Unlocked ${currentVehicle.name}! Equipped now.`);
    setTimeout(() => setPurchaseNotice(null), 3000);
  };

  const handleSaveCurrentPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const name = presetNameInput.trim() || `Setup #${presets.length + 1}`;
    const newPreset: VehicleCustomizationPreset = {
      ...activePreset,
      id: `preset_${Date.now()}`,
      name,
      createdAt: Date.now(),
    };
    onSavePreset(newPreset);
    setPresetNameInput('');
    sound.playScrapPickup();
    setPurchaseNotice(`Preset "${name}" saved!`);
    setTimeout(() => setPurchaseNotice(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
              Scrap Yard Garage
            </h2>
            {/* Level & XP Badge */}
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/80 rounded-lg border border-zinc-700 text-xs">
              <span className="font-bold text-amber-300">LVL {levelInfo.level}</span>
              <div className="w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <span className="text-zinc-400 font-mono text-[10px]">
                {levelInfo.currentXp}/{levelInfo.nextLevelXp} XP
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Scrap Currency */}
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/40 border border-amber-600/40 rounded-lg text-amber-300 font-mono font-bold text-sm">
              <svg className="w-4 h-4 fill-amber-400" viewBox="0 0 24 24">
                <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
              </svg>
              <span>{playerScrap} SCRAP</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              aria-label="Close Garage"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {purchaseNotice && (
          <div className="px-6 py-2 bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-sm font-semibold text-center">
            {purchaseNotice}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Vehicle Selector Strip */}
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider text-zinc-400 mb-3">
              Vehicle Chassis Catalog
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {VEHICLE_CATALOG.map((v) => {
                const unlocked = unlockedVehicleIds.includes(v.id) || v.costScrap === 0;
                const isSelected = v.id === selectedVehicleId;
                const isCurrentEquipped = activePreset.vehicleId === v.id;

                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleId(v.id);
                      if (unlocked && !isCurrentEquipped) {
                        onEquipVehicle(v.id);
                      }
                      sound.playScrapPickup();
                    }}
                    className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10 shadow-lg'
                        : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-zinc-100">{v.name}</span>
                      {isCurrentEquipped && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          EQUIPPED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 capitalize mb-2">{v.archetype}</div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      {unlocked ? (
                        <span className="text-emerald-400">Unlocked</span>
                      ) : (
                        <span className="text-amber-400">
                          Lvl {v.unlockLevel} · {v.costScrap} Scrap
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Vehicle Overview Banner */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-black text-white">{currentVehicle.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase font-mono">
                  {currentVehicle.archetype}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">{currentVehicle.description}</p>
            </div>

            <div className="flex items-center gap-3">
              {!isUnlocked ? (
                <button
                  onClick={handleBuyVehicle}
                  className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
                  </svg>
                  Unlock for {currentVehicle.costScrap} Scrap
                </button>
              ) : !isEquipped ? (
                <button
                  onClick={() => onEquipVehicle(currentVehicle.id)}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all cursor-pointer"
                >
                  Equip Vehicle
                </button>
              ) : (
                <div className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                  Active in Race
                </div>
              )}
            </div>
          </div>

          {/* Performance Stat Bars */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-800">
            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-zinc-400">TOP SPEED</span>
                <span className="text-amber-400 font-bold">{currentSpecs.maxSpeedKmh} km/h</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, (currentSpecs.maxSpeedKmh / 140) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-zinc-400">ACCELERATION</span>
                <span className="text-amber-400 font-bold">{currentSpecs.accelRating}x</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${Math.min(100, (currentSpecs.accelRating / 1.6) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-zinc-400">NITRO BOOST</span>
                <span className="text-amber-400 font-bold">{currentSpecs.boostMultiplier}x</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${Math.min(100, (currentSpecs.boostMultiplier / 1.8) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-mono">
                <span className="text-zinc-400">JUMP LAUNCH</span>
                <span className="text-amber-400 font-bold">{currentSpecs.jumpForce}x</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400"
                  style={{ width: `${Math.min(100, (currentSpecs.jumpForce / 1.6) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Customization Tabs */}
          <div>
            <div className="flex border-b border-zinc-800 gap-2 mb-4">
              <button
                onClick={() => setActiveTab('paint')}
                className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'paint'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Paint & Finish
              </button>
              <button
                onClick={() => setActiveTab('decals')}
                className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'decals'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Decals & Livery
              </button>
              <button
                onClick={() => setActiveTab('upgrades')}
                className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'upgrades'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Performance Parts
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`pb-2 px-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'presets'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Saved Presets ({presets.length})
              </button>
            </div>

            {/* TAB 1: Paint & Colors */}
            {activeTab === 'paint' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">
                    Primary Chassis Paint
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                    {PAINT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => handleSelectColor(c.hex)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          activePreset.colorHex === c.hex
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-850 hover:border-zinc-700'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full border border-white/20 shadow-inner"
                          style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }}
                        />
                        <span className="text-[10px] text-zinc-300 font-medium truncate w-full text-center">
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">
                      Surface Finish Coating
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {(['matte', 'gloss', 'metallic', 'weathered'] as const).map((finish) => (
                        <button
                          key={finish}
                          onClick={() => handleSelectFinish(finish)}
                          className={`px-3 py-2 rounded-lg border text-xs capitalize font-bold transition-all cursor-pointer ${
                            activePreset.finishType === finish
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                              : 'border-zinc-800 bg-zinc-850 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {finish}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase font-bold text-zinc-400 mb-2">
                      Roll Cage & Trim Metal
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {TRIM_COLORS.map((t) => (
                        <button
                          key={t.hex}
                          onClick={() => handleSelectTrim(t.hex)}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                            activePreset.trimColorHex === t.hex
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                              : 'border-zinc-800 bg-zinc-850 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: `#${t.hex.toString(16).padStart(6, '0')}` }}
                          />
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Decals & Livery */}
            {activeTab === 'decals' && (
              <div>
                <h4 className="text-xs uppercase font-bold text-zinc-400 mb-3">
                  Vehicle Body Decals & Racing Stripes
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { id: 'none', label: 'Clean / Plain', desc: 'No decal' },
                    { id: 'hazard', label: 'Caution Hazard', desc: 'Yellow/black safety stripes' },
                    { id: 'chevrons', label: 'Speed Chevrons', desc: 'Dual aero arrows' },
                    { id: 'flames', label: 'Hot Rod Flames', desc: 'Desert combustion flames' },
                    { id: 'skull', label: 'Scrap Skull', desc: 'Wasteland pirate insignia' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelectDecal(d.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        activePreset.decal === d.id
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-zinc-800 bg-zinc-850 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold text-sm text-zinc-100">{d.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-1">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Performance Upgrades */}
            {activeTab === 'upgrades' && (
              <div className="space-y-4">
                {[
                  {
                    key: 'engine' as const,
                    name: 'Supercharged V8 Engine',
                    desc: 'Enhances top speed and acceleration curve.',
                    currentTier: activePreset.upgrades.engine,
                  },
                  {
                    key: 'tires' as const,
                    name: 'Knobby All-Terrain Tires',
                    desc: 'Improves brick surface grip, steering torque, and drift control.',
                    currentTier: activePreset.upgrades.tires,
                  },
                  {
                    key: 'thruster' as const,
                    name: 'Rocket Nitro Pod',
                    desc: 'Boosts rocket burn speed and supersonic jump velocity.',
                    currentTier: activePreset.upgrades.thruster,
                  },
                  {
                    key: 'suspension' as const,
                    name: 'Hydraulic Shock Springs',
                    desc: 'Dramatically raises ramp jump height and softens landing impacts.',
                    currentTier: activePreset.upgrades.suspension,
                  },
                ].map((part) => {
                  const nextTierCost = part.currentTier < 4 ? UPGRADE_TIER_COSTS[part.currentTier] : 0;
                  const canAfford = playerScrap >= nextTierCost;

                  return (
                    <div
                      key={part.key}
                      className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-white">{part.name}</h5>
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono font-bold">
                            Tier {part.currentTier} / 4
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{part.desc}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {part.currentTier < 4 ? (
                          <button
                            onClick={() => handleUpgradeTier(part.key)}
                            disabled={!canAfford}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                              canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            <span>Upgrade to T{part.currentTier + 1}</span>
                            <span className="font-mono text-zinc-900 font-extrabold">({nextTierCost} Scrap)</span>
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                            MAX TIER
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: Saved Presets */}
            {activeTab === 'presets' && (
              <div className="space-y-4">
                <form onSubmit={handleSaveCurrentPreset} className="flex gap-2">
                  <input
                    type="text"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    placeholder="Enter preset name (e.g. Stunt Jumper)"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none focus:border-amber-400"
                    maxLength={24}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Save Preset
                  </button>
                </form>

                <div className="space-y-2">
                  {presets.map((p) => {
                    const veh = VEHICLE_CATALOG.find((v) => v.id === p.vehicleId);
                    const isActive = activePreset.id === p.id;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          isActive
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-950/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: `#${p.colorHex.toString(16).padStart(6, '0')}` }}
                          />
                          <div>
                            <div className="font-bold text-sm text-white">{p.name}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {veh?.name} · {p.finishType} · Decal: {p.decal} · Eng T{p.upgrades.engine}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isActive && (
                            <button
                              onClick={() => {
                                onUpdatePreset(p);
                                onEquipVehicle(p.vehicleId);
                                sound.playScrapPickup();
                              }}
                              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-amber-300 cursor-pointer"
                            >
                              Load
                            </button>
                          )}
                          <button
                            onClick={() => onDeletePreset(p.id)}
                            className="px-2 py-1 rounded hover:bg-red-500/20 text-xs text-red-400 cursor-pointer"
                            title="Delete Preset"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Customizations save automatically and equip to your vehicle for both online and offline races.
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg cursor-pointer"
          >
            Ready to Race
          </button>
        </div>
      </div>
    </div>
  );
};
