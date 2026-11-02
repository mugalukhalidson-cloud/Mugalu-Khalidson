/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createBuggy,
  createJunkRamp,
  createJunkCrate,
  createScrapGear,
  createAirRingHoop,
  createPurpleFlowerBush,
  createGardenTree,
  createStoneLedge,
  type BuggyAssembly,
} from './models';
import {
  createPavingGridTexture,
  createHazardStripeTexture,
  createRustMetalTexture,
} from './textures';
import {
  evaluateJumpLanding,
  calculateScrapReward,
  clampDeltaTime,
  evaluateCheckpointProgress,
  type StuntState,
  type ScoreBreakdown,
} from './scoring';
import {
  type VehicleConfig,
  type NetworkPlayerState,
  VEHICLE_PRESETS,
} from './multiplayer';
import { sound } from './audio';

export type GameState = 'title' | 'lobby' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface HUDState {
  speedKmh: number;
  boostFuel: number;
  maxBoostFuel: number;
  gear: number;
  altitude: number;
  isAirborne: boolean;
  airtime: number;
  scrapCount: number;
  totalScore: number;
  comboMultiplier: number;
  lap: number;
  maxLaps: number;
  position: number;
  totalRacers: number;
  lapTime: number;
  bestLapTime: number;
  checkpointProgress: number;
  recentStunt: ScoreBreakdown | null;
  cameraMode: 'chase' | 'hood' | 'orbit';
  isMuted: boolean;
  isOnline: boolean;
  networkPlayerCount: number;
  standings: { name: string; lap: number; isPlayer: boolean; placement: number }[];
}

export interface EngineCallbacks {
  onHUDUpdate: (hud: HUDState) => void;
  onGameStateChange: (state: GameState) => void;
  onStuntNotice: (notice: ScoreBreakdown) => void;
  onRaceFinished: (placement: number, totalRacers: number, score: number, bestLap: number, scrap: number) => void;
  onNetworkPoseUpdate?: (pose: {
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
  }) => void;
  onNetworkFinish?: (finishTime: number, score: number, bestLap: number) => void;
}

// Reusable scratch vectors
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _forward = new THREE.Vector3();

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface Rival {
  assembly: BuggyAssembly;
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  waypointIndex: number;
  color: number;
}

interface RemoteRacer {
  id: string;
  name: string;
  assembly: BuggyAssembly;
  targetPos: THREE.Vector3;
  targetHeading: number;
  targetPitch: number;
  targetRoll: number;
  speed: number;
  lap: number;
  checkpoint: number;
  score: number;
  colorHex: number;
  namePlate?: THREE.Mesh;
}

interface CollectibleItem {
  group: THREE.Group;
  pos: THREE.Vector3;
  collected: boolean;
  respawnTimer: number;
}

interface CrateItem {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
}

interface AirRingItem {
  group: THREE.Group;
  pos: THREE.Vector3;
  radius: number;
  passed: boolean;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private clock: THREE.Clock = new THREE.Clock();

  // Mode: Offline vs Online Multiplayer
  private isOnline: boolean = false;
  private vehicleConfig: VehicleConfig = VEHICLE_PRESETS[0];

  // State
  private gameState: GameState = 'title';
  private cameraMode: 'chase' | 'hood' | 'orbit' = 'chase';
  private hitstopTimer: number = 0;
  private cameraShake: number = 0;

  // Player Vehicle Physics
  private playerAssembly!: BuggyAssembly;
  private playerPos = new THREE.Vector3(0, 0.4, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerHeading: number = 0;
  private playerPitch: number = 0;
  private playerRoll: number = 0;
  private speed: number = 0;
  private isAirborne: boolean = false;
  private stuntState: StuntState = { airtime: 0, maxAltitude: 0, flips: 0, rolls: 0, spins: 0, ringsPassed: 0 };
  private pitchAccum: number = 0;
  private rollAccum: number = 0;

  // Fuel & Boost
  private boostFuel: number = 100;
  private maxBoostFuel: number = 100;
  private isBoosting: boolean = false;

  // Race Progress & Scoring
  private scrapCount: number = 0;
  private totalScore: number = 0;
  private comboMultiplier: number = 1.0;
  private comboTimer: number = 0;
  private currentLap: number = 1;
  private maxLaps: number = 3;
  private currentCheckpoint: number = 0;
  private lapStartTime: number = 0;
  private currentLapTime: number = 0;
  private bestLapTime: number = 0;
  private raceStartTime: number = 0;
  private lastStuntNotice: ScoreBreakdown | null = null;
  private stuntNoticeTimer: number = 0;
  private hasReportedFinish: boolean = false;

  // World Elements
  private waypoints: THREE.Vector3[] = [];
  private checkpoints: THREE.Vector3[] = [];
  private offlineRivals: Rival[] = [];
  private remoteRacers = new Map<string, RemoteRacer>();
  private scrapItems: CollectibleItem[] = [];
  private crates: CrateItem[] = [];
  private airRings: AirRingItem[] = [];

  // Particles
  private particles: Particle[] = [];
  private particleGroup = new THREE.Group();

  // Network sync timer
  private networkSyncTimer: number = 0;

  // Input
  private keys: Record<string, boolean> = {};

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa7c2b3);
    this.scene.fog = new THREE.FogExp2(0xa7c2b3, 0.007);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.1,
      600
    );

    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {}

    const hemiLight = new THREE.HemisphereLight(0xdcfce7, 0x5c4033, 0.85);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(40, 60, 30);
    if (!this.isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 180;
      const d = 55;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    this.buildWorld();

    this.scene.add(this.particleGroup);
    this.initParticles();

    this.setupInputs();
    window.addEventListener('resize', this.onResize);

    this.clock.start();
    this.startLoop();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      this.startOfflineRace();
    }
  }

  private buildWorld() {
    const pavingTex = createPavingGridTexture(this.renderer.capabilities.getMaxAnisotropy());
    pavingTex.repeat.set(36, 36);

    const groundGeo = new THREE.PlaneGeometry(360, 360);
    const groundMat = new THREE.MeshStandardMaterial({
      map: pavingTex,
      roughness: 0.8,
      metalness: 0.15,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      const radius = 130 + Math.sin(angle * 4) * 20;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const tree = createGardenTree();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.9 + Math.random() * 0.4);
      this.scene.add(tree);

      const bush = createPurpleFlowerBush();
      bush.position.set(x + (Math.random() - 0.5) * 8, 0, z + (Math.random() - 0.5) * 8);
      bush.scale.setScalar(1.0 + Math.random() * 0.5);
      this.scene.add(bush);
    }

    this.waypoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -45),
      new THREE.Vector3(25, 0, -80),
      new THREE.Vector3(65, 0, -70),
      new THREE.Vector3(75, 0, -20),
      new THREE.Vector3(45, 0, 15),
      new THREE.Vector3(-25, 0, 30),
      new THREE.Vector3(-65, 0, 15),
      new THREE.Vector3(-75, 0, -35),
      new THREE.Vector3(-45, 0, -65),
      new THREE.Vector3(-15, 0, -30),
    ];

    this.checkpoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(65, 0, -70),
      new THREE.Vector3(45, 0, 15),
      new THREE.Vector3(-65, 0, 15),
    ];

    this.checkpoints.forEach((cp, idx) => {
      const arch = new THREE.Group();
      const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 6, 8);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: idx === 0 ? 0x22c55e : 0xf59e0b,
        emissive: idx === 0 ? 0x15803d : 0xb45309,
        emissiveIntensity: 0.5,
      });
      const p1 = new THREE.Mesh(pillarGeo, pillarMat);
      p1.position.set(-6, 3, 0);
      const p2 = new THREE.Mesh(pillarGeo, pillarMat);
      p2.position.set(6, 3, 0);
      const beamGeo = new THREE.BoxGeometry(12.5, 0.6, 0.6);
      const beam = new THREE.Mesh(beamGeo, pillarMat);
      beam.position.set(0, 6, 0);
      arch.add(p1, p2, beam);

      const bannerGeo = new THREE.PlaneGeometry(5, 1.2);
      const bannerMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0x16a34a : 0xd97706,
        side: THREE.DoubleSide,
      });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, 5.2, 0);
      arch.add(banner);

      arch.position.copy(cp);
      if (idx === 1) arch.rotation.y = Math.PI / 4;
      if (idx === 2) arch.rotation.y = -Math.PI / 3;
      if (idx === 3) arch.rotation.y = Math.PI / 2;
      this.scene.add(arch);
    });

    const hazardTex = createHazardStripeTexture();
    const rustTex = createRustMetalTexture();

    const ramp1 = createJunkRamp(hazardTex, 8, 4.0, 12);
    ramp1.position.set(65, 0, -50);
    ramp1.rotation.y = Math.PI * 0.9;
    this.scene.add(ramp1);

    const ramp2 = createJunkRamp(hazardTex, 10, 5.5, 15);
    ramp2.position.set(-65, 0, 5);
    ramp2.rotation.y = Math.PI * 0.1;
    this.scene.add(ramp2);

    const ramp3 = createJunkRamp(hazardTex, 7, 3.5, 10);
    ramp3.position.set(10, 0, 20);
    ramp3.rotation.y = -Math.PI * 0.45;
    this.scene.add(ramp3);

    const ring1 = createAirRingHoop(4.5);
    ring1.position.set(65, 12, -25);
    this.scene.add(ring1);
    this.airRings.push({ group: ring1, pos: ring1.position.clone(), radius: 4.5, passed: false });

    const ring2 = createAirRingHoop(5.0);
    ring2.position.set(-65, 15, -25);
    this.scene.add(ring2);
    this.airRings.push({ group: ring2, pos: ring2.position.clone(), radius: 5.0, passed: false });

    const ledges = [
      { x: -15, z: -45, rot: 0.1, len: 32 },
      { x: 35, z: -25, rot: 0.8, len: 24 },
      { x: -35, z: 20, rot: -0.6, len: 28 },
      { x: 15, z: -85, rot: 1.57, len: 30 },
    ];
    ledges.forEach(({ x, z, rot, len }) => {
      const wall = createStoneLedge(len, 1.4, 1.2);
      wall.position.set(x, 0, z);
      wall.rotation.y = rot;
      this.scene.add(wall);

      for (let s = -len / 2 + 3; s < len / 2; s += 5) {
        const bush = createPurpleFlowerBush();
        bush.position.set(
          x + Math.sin(rot + Math.PI / 2) * 1.8 + Math.cos(rot) * s,
          0,
          z + Math.cos(rot + Math.PI / 2) * 1.8 + Math.sin(rot) * s
        );
        bush.scale.setScalar(0.85 + Math.random() * 0.3);
        this.scene.add(bush);
      }
    });

    const crateLocations = [
      new THREE.Vector3(2, 0, -25),
      new THREE.Vector3(-2, 0, -25),
      new THREE.Vector3(45, 0, -78),
      new THREE.Vector3(47, 0, -77),
      new THREE.Vector3(76, 0, -3),
      new THREE.Vector3(-66, 0, -50),
      new THREE.Vector3(-64, 0, -49),
      new THREE.Vector3(-20, 0, 32),
    ];
    crateLocations.forEach((pos) => {
      const crateMesh = createJunkCrate(rustTex, 1.5);
      crateMesh.position.copy(pos);
      this.scene.add(crateMesh);
      this.crates.push({ mesh: crateMesh, pos: pos.clone(), active: true, respawnTimer: 0 });
    });

    const scrapLocations = [
      new THREE.Vector3(0, 1.2, -15),
      new THREE.Vector3(0, 1.2, -30),
      new THREE.Vector3(35, 1.2, -75),
      new THREE.Vector3(55, 1.2, -75),
      new THREE.Vector3(75, 1.2, -40),
      new THREE.Vector3(50, 1.2, 5),
      new THREE.Vector3(-10, 1.2, 25),
      new THREE.Vector3(-45, 1.2, 22),
      new THREE.Vector3(-65, 1.2, -10),
      new THREE.Vector3(-55, 1.2, -55),
    ];
    scrapLocations.forEach((pos) => {
      const gear = createScrapGear();
      gear.position.copy(pos);
      this.scene.add(gear);
      this.scrapItems.push({ group: gear, pos: pos.clone(), collected: false, respawnTimer: 0 });
    });

    // Player Buggy
    this.playerAssembly = createBuggy(this.vehicleConfig.colorHex, true);
    this.playerPos.set(0, 0.4, 0);
    this.playerAssembly.group.position.copy(this.playerPos);
    this.scene.add(this.playerAssembly.group);

    // Offline AI Rivals
    const rivalColors = [0xdc2626, 0x16a34a, 0x9333ea];
    const rivalOffsets = [new THREE.Vector3(3.5, 0.4, 2), new THREE.Vector3(-3.5, 0.4, 4), new THREE.Vector3(0, 0.4, 7)];
    this.offlineRivals = rivalColors.map((color, idx) => {
      const assembly = createBuggy(color, false);
      const pos = rivalOffsets[idx].clone();
      assembly.group.position.copy(pos);
      this.scene.add(assembly.group);
      return {
        assembly,
        pos,
        heading: 0,
        speed: 16 + idx * 1.5,
        waypointIndex: 1,
        color,
      };
    });
  }

  private initParticles() {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const count = 70;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        color: new THREE.Color(0xf59e0b),
      });
    }
  }

  public spawnBurst(pos: THREE.Vector3, count = 12, colorHex = 0xf59e0b, speedSpread = 8) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.life <= 0) {
        p.mesh.position.copy(pos);
        p.mesh.visible = true;
        p.life = 0.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.vx = (Math.random() - 0.5) * speedSpread;
        p.vy = Math.random() * speedSpread + 2;
        p.vz = (Math.random() - 0.5) * speedSpread;
        p.color.setHex(colorHex);
        (p.mesh.material as THREE.MeshBasicMaterial).color = p.color;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.gameState === 'playing') this.pauseGame();
        else if (this.gameState === 'paused') this.resumeGame();
      }
      if (e.code === 'KeyM') {
        sound.toggleMute();
      }
      if (e.code === 'KeyR' && (this.gameState === 'playing' || this.gameState === 'paused')) {
        this.resetPlayerPosition();
      }
      if (e.code === 'KeyC' && this.gameState === 'playing') {
        this.cycleCamera();
      }
      if ((e.code === 'Enter' || e.code === 'Space') && this.gameState === 'title') {
        this.startOfflineRace();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.keys = {};
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys = {};
      }
    });
  }

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setVehicle(vehicle: VehicleConfig, colorHex?: number) {
    this.vehicleConfig = {
      ...vehicle,
      colorHex: colorHex !== undefined ? colorHex : vehicle.colorHex,
    };

    // Rebuild player buggy mesh with selected color
    if (this.playerAssembly) {
      this.scene.remove(this.playerAssembly.group);
      this.playerAssembly = createBuggy(this.vehicleConfig.colorHex, true);
      this.playerAssembly.group.position.copy(this.playerPos);
      this.scene.add(this.playerAssembly.group);
    }
  }

  public startOfflineRace() {
    this.isOnline = false;
    this.startRaceCommon();
    // Enable AI rivals
    this.offlineRivals.forEach((r) => (r.assembly.group.visible = true));
    // Clear remote racers
    this.remoteRacers.forEach((rr) => this.scene.remove(rr.assembly.group));
    this.remoteRacers.clear();
  }

  public startOnlineRace(startingGridSlot = 0) {
    this.isOnline = true;
    this.startRaceCommon();
    // Hide offline AI rivals in online race
    this.offlineRivals.forEach((r) => (r.assembly.group.visible = false));

    // Stagger starting position on grid
    const startOffset = startingGridSlot * 3.5;
    this.playerPos.set(startOffset, 0.4, 0);
    this.playerAssembly.group.position.copy(this.playerPos);
  }

  private startRaceCommon() {
    this.gameState = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onGameStateChange('playing');
    this.raceStartTime = performance.now();
    this.lapStartTime = performance.now();
    this.currentLapTime = 0;
    this.speed = 0;
    this.boostFuel = 100;
    this.scrapCount = 0;
    this.totalScore = 0;
    this.comboMultiplier = 1.0;
    this.currentLap = 1;
    this.currentCheckpoint = 0;
    this.hasReportedFinish = false;
    this.resetPlayerPosition();
    sound.startEngine();
    sound.startMusic();
  }

  public pauseGame() {
    if (this.isOnline) return; // Cannot pause online race
    this.gameState = 'paused';
    document.body.dataset.state = 'paused';
    this.callbacks.onGameStateChange('paused');
    sound.stopEngine();
  }

  public resumeGame() {
    this.gameState = 'playing';
    document.body.dataset.state = 'playing';
    this.callbacks.onGameStateChange('playing');
    sound.startEngine();
  }

  public returnToTitle() {
    this.gameState = 'title';
    document.body.dataset.state = 'title';
    this.callbacks.onGameStateChange('title');
    sound.stopEngine();
  }

  public toggleMute(): boolean {
    return sound.toggleMute();
  }

  public cycleCamera() {
    if (this.cameraMode === 'chase') this.cameraMode = 'hood';
    else if (this.cameraMode === 'hood') this.cameraMode = 'orbit';
    else this.cameraMode = 'chase';
  }

  public resetPlayerPosition() {
    const cp = this.checkpoints[this.currentCheckpoint];
    this.playerPos.set(cp.x, 0.4, cp.z);
    this.playerVel.set(0, 0, 0);
    this.speed = 0;
    this.playerPitch = 0;
    this.playerRoll = 0;
    this.isAirborne = false;
  }

  // Handle incoming remote player updates
  public updateRemotePlayer(playerState: NetworkPlayerState) {
    let remote = this.remoteRacers.get(playerState.id);
    if (!remote) {
      const assembly = createBuggy(playerState.colorHex, false);
      this.scene.add(assembly.group);
      remote = {
        id: playerState.id,
        name: playerState.name,
        assembly,
        targetPos: new THREE.Vector3(playerState.x, playerState.y, playerState.z),
        targetHeading: playerState.heading,
        targetPitch: playerState.pitch,
        targetRoll: playerState.roll,
        speed: playerState.speed,
        lap: playerState.lap,
        checkpoint: playerState.checkpoint,
        score: playerState.score,
        colorHex: playerState.colorHex,
      };
      this.remoteRacers.set(playerState.id, remote);
    } else {
      remote.targetPos.set(playerState.x, playerState.y, playerState.z);
      remote.targetHeading = playerState.heading;
      remote.targetPitch = playerState.pitch;
      remote.targetRoll = playerState.roll;
      remote.speed = playerState.speed;
      remote.lap = playerState.lap;
      remote.checkpoint = playerState.checkpoint;
      remote.score = playerState.score;
    }
  }

  public removeRemotePlayer(playerId: string) {
    const remote = this.remoteRacers.get(playerId);
    if (remote) {
      this.scene.remove(remote.assembly.group);
      this.remoteRacers.delete(playerId);
    }
  }

  private startLoop() {
    const tick = () => {
      const rawDt = this.clock.getDelta();
      const dt = clampDeltaTime(rawDt);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number) {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 4);
      return;
    }

    if (this.gameState === 'title') {
      const time = performance.now() * 0.0004;
      const camR = 14;
      this.camera.position.set(
        Math.sin(time) * camR,
        6 + Math.cos(time * 0.7) * 2,
        Math.cos(time) * camR
      );
      this.camera.lookAt(0, 1.2, 0);
      this.updateParticles(dt);
      return;
    }

    if (this.gameState !== 'playing') {
      this.updateParticles(dt);
      return;
    }

    // Vehicle tuning based on selected archetype
    const cfg = this.vehicleConfig;
    const throttle = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 0.7 : 0);
    const steer = (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0) - (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0);
    const wantBoost = this.keys['Space'] && this.boostFuel > 0;
    const wantDrift = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

    this.isBoosting = wantBoost && (throttle > 0 || this.speed > 5);
    if (this.isBoosting) {
      this.boostFuel = Math.max(0, this.boostFuel - dt * 25);
      if (Math.random() < 0.3) sound.playBoost();
    } else {
      this.boostFuel = Math.min(this.maxBoostFuel, this.boostFuel + dt * 4);
    }

    const baseMax = cfg.maxSpeed / 3.6; // convert km/h to m/s
    const maxSpeed = this.isBoosting ? baseMax * cfg.boostMultiplier : (wantDrift ? baseMax * 0.75 : baseMax);
    const accelRate = (this.isBoosting ? 26 : 14) * cfg.accel;
    const brakeRate = 22;

    if (!this.isAirborne) {
      if (throttle > 0) {
        this.speed = Math.min(maxSpeed, this.speed + accelRate * throttle * dt);
      } else if (throttle < 0) {
        this.speed = Math.max(-10, this.speed - brakeRate * dt);
      } else {
        this.speed = THREE.MathUtils.damp(this.speed, 0, 1.8, dt);
      }

      const steerSpeed = (this.speed / maxSpeed) * (wantDrift ? 3.0 : 2.2);
      this.playerHeading += steer * steerSpeed * dt;

      this.playerPitch = THREE.MathUtils.damp(this.playerPitch, 0, 8, dt);
      this.playerRoll = THREE.MathUtils.damp(this.playerRoll, wantDrift ? -steer * 0.25 : -steer * 0.12, 10, dt);

      _forward.set(-Math.sin(this.playerHeading), 0, -Math.cos(this.playerHeading));
      this.playerPos.addScaledVector(_forward, this.speed * dt);
      this.playerPos.y = 0.4;

      this.checkRampLaunches();

      this.playerAssembly.rocketGlow.visible = this.isBoosting;
      if (this.isBoosting) {
        _v1.copy(this.playerPos).addScaledVector(_forward, -1.8);
        this.spawnBurst(_v1, 2, 0x06b6d4, 3);
      }
      if (Math.abs(this.speed) > 2) {
        _v2.copy(this.playerPos).addScaledVector(_forward, -1.5);
        this.spawnBurst(_v2, 1, 0x78716c, 2);
      }
    } else {
      this.stuntState.airtime += dt;
      this.stuntState.maxAltitude = Math.max(this.stuntState.maxAltitude, this.playerPos.y);

      this.playerVel.y -= 19.8 * dt;
      this.playerPos.addScaledVector(this.playerVel, dt);

      if (this.keys['KeyW'] || this.keys['ArrowUp']) {
        const dPitch = 3.8 * dt;
        this.playerPitch += dPitch;
        this.pitchAccum += Math.abs(dPitch);
      }
      if (this.keys['KeyS'] || this.keys['ArrowDown']) {
        const dPitch = -3.8 * dt;
        this.playerPitch += dPitch;
        this.pitchAccum += Math.abs(dPitch);
      }
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
        const dRoll = 4.2 * dt;
        this.playerRoll += dRoll;
        this.rollAccum += Math.abs(dRoll);
      }
      if (this.keys['KeyD'] || this.keys['ArrowRight']) {
        const dRoll = -4.2 * dt;
        this.playerRoll += dRoll;
        this.rollAccum += Math.abs(dRoll);
      }

      this.stuntState.flips = Math.floor(this.pitchAccum / (Math.PI * 1.8));
      this.stuntState.rolls = Math.floor(this.rollAccum / (Math.PI * 1.8));

      this.checkAirRings();

      if (this.playerPos.y <= 0.4) {
        this.playerPos.y = 0.4;
        this.isAirborne = false;
        const landingImpact = Math.abs(this.playerVel.y);
        sound.playLand(landingImpact);

        const scoreResult = evaluateJumpLanding(this.stuntState, this.comboMultiplier);
        if (scoreResult.totalPoints > 0) {
          this.totalScore += scoreResult.totalPoints;
          this.comboMultiplier = Math.min(5.0, this.comboMultiplier + 0.5);
          this.comboTimer = 6.0;
          this.lastStuntNotice = scoreResult;
          this.stuntNoticeTimer = 3.5;
          this.callbacks.onStuntNotice(scoreResult);
          sound.playStuntChime();
        }

        this.cameraShake = Math.min(1.0, landingImpact / 15);
        this.spawnBurst(this.playerPos, 16, 0xd4a373, 8);

        this.stuntState = { airtime: 0, maxAltitude: 0, flips: 0, rolls: 0, spins: 0, ringsPassed: 0 };
        this.pitchAccum = 0;
        this.rollAccum = 0;
      }
    }

    this.playerAssembly.wheels.forEach((w) => {
      w.rotation.x += (this.speed / 0.6) * dt;
    });
    const steerAngle = steer * 0.4;
    this.playerAssembly.frontLeftWheel.rotation.y = steerAngle;
    this.playerAssembly.frontRightWheel.rotation.y = steerAngle;

    this.playerAssembly.group.position.copy(this.playerPos);
    this.playerAssembly.group.rotation.set(this.playerPitch, this.playerHeading, this.playerRoll, 'YXZ');

    this.checkCheckpoints();
    this.checkCollectibles(dt);
    this.checkCrates(dt);

    if (this.isOnline) {
      this.updateRemoteRacers(dt);
      // Network broadcast at 20Hz (~50ms)
      this.networkSyncTimer += dt;
      if (this.networkSyncTimer >= 0.05) {
        this.networkSyncTimer = 0;
        if (this.callbacks.onNetworkPoseUpdate) {
          this.callbacks.onNetworkPoseUpdate({
            x: Number(this.playerPos.x.toFixed(2)),
            y: Number(this.playerPos.y.toFixed(2)),
            z: Number(this.playerPos.z.toFixed(2)),
            heading: Number(this.playerHeading.toFixed(3)),
            pitch: Number(this.playerPitch.toFixed(3)),
            roll: Number(this.playerRoll.toFixed(3)),
            speed: Number(this.speed.toFixed(1)),
            lap: this.currentLap,
            checkpoint: this.currentCheckpoint,
            score: this.totalScore,
          });
        }
      }
    } else {
      this.updateOfflineRivals(dt);
    }

    this.updateCamera(dt);

    const speedKmh = Math.round(Math.abs(this.speed) * 3.6);
    sound.updateEngine(speedKmh, maxSpeed * 3.6, this.isBoosting);

    this.currentLapTime = (performance.now() - this.lapStartTime) / 1000;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboMultiplier = 1.0;
    }
    if (this.stuntNoticeTimer > 0) {
      this.stuntNoticeTimer -= dt;
      if (this.stuntNoticeTimer <= 0) this.lastStuntNotice = null;
    }

    this.updateParticles(dt);
    this.emitHUD();
  }

  private checkRampLaunches() {
    const rampZones = [
      { pos: new THREE.Vector3(65, 0, -50), boostY: 15, boostFwd: 1.4, radius: 6 },
      { pos: new THREE.Vector3(-65, 0, 5), boostY: 20 * this.vehicleConfig.jumpForce, boostFwd: 1.6, radius: 7 },
      { pos: new THREE.Vector3(10, 0, 20), boostY: 13, boostFwd: 1.3, radius: 5 },
    ];

    for (const ramp of rampZones) {
      const dist = this.playerPos.distanceTo(ramp.pos);
      if (dist < ramp.radius && this.speed > 8) {
        this.isAirborne = true;
        _forward.set(-Math.sin(this.playerHeading), 0, -Math.cos(this.playerHeading));
        this.playerVel.copy(_forward).multiplyScalar(this.speed * ramp.boostFwd);
        this.playerVel.y = ramp.boostY + (this.isBoosting ? 6 : 0);
        this.playerPitch = -0.35;
        this.cameraShake = 0.4;
        sound.playJump();
        this.spawnBurst(this.playerPos, 14, 0x06b6d4, 10);
        break;
      }
    }
  }

  private checkAirRings() {
    for (const ring of this.airRings) {
      if (!ring.passed && this.playerPos.distanceTo(ring.pos) < ring.radius + 1.2) {
        ring.passed = true;
        this.stuntState.ringsPassed++;
        this.boostFuel = Math.min(this.maxBoostFuel, this.boostFuel + 50);
        sound.playStuntChime();
        this.spawnBurst(ring.pos, 22, 0x38bdf8, 12);
      }
    }
  }

  private checkCheckpoints() {
    this.checkpoints.forEach((cp, idx) => {
      const dist = this.playerPos.distanceTo(cp);
      if (dist < 10) {
        const result = evaluateCheckpointProgress(
          this.currentCheckpoint,
          idx,
          this.checkpoints.length,
          this.currentLap,
          this.maxLaps
        );
        if (result.valid) {
          this.currentCheckpoint = idx;
          if (result.lapCompleted) {
            if (this.bestLapTime === 0 || this.currentLapTime < this.bestLapTime) {
              this.bestLapTime = this.currentLapTime;
            }
            this.currentLap++;
            this.lapStartTime = performance.now();
            sound.playStuntChime();

            this.airRings.forEach((r) => (r.passed = false));

            if (result.raceFinished && !this.hasReportedFinish) {
              this.hasReportedFinish = true;
              const totalRaceSec = (performance.now() - this.raceStartTime) / 1000;
              const placement = this.calculatePlayerPosition();
              const totalCount = this.isOnline ? this.remoteRacers.size + 1 : this.offlineRivals.length + 1;

              this.gameState = placement === 1 ? 'victory' : 'gameover';
              document.body.dataset.state = 'gameover';
              this.callbacks.onGameStateChange(this.gameState);

              this.callbacks.onRaceFinished(
                placement,
                totalCount,
                this.totalScore,
                this.bestLapTime,
                this.scrapCount
              );

              if (this.isOnline && this.callbacks.onNetworkFinish) {
                this.callbacks.onNetworkFinish(totalRaceSec, this.totalScore, this.bestLapTime);
              }
            }
          }
        }
      }
    });
  }

  private checkCollectibles(dt: number) {
    for (const item of this.scrapItems) {
      if (item.collected) {
        item.respawnTimer -= dt;
        if (item.respawnTimer <= 0) {
          item.collected = false;
          item.group.visible = true;
        }
      } else {
        item.group.rotation.y += 2.5 * dt;
        if (this.playerPos.distanceTo(item.pos) < 2.5) {
          item.collected = true;
          item.group.visible = false;
          item.respawnTimer = 15;
          const reward = calculateScrapReward(25, this.comboMultiplier);
          this.scrapCount++;
          this.totalScore += reward.points;
          this.boostFuel = Math.min(this.maxBoostFuel, this.boostFuel + reward.boostRefill);
          sound.playScrapPickup();
          this.spawnBurst(item.pos, 10, 0xf59e0b, 5);
        }
      }
    }
  }

  private checkCrates(dt: number) {
    for (const crate of this.crates) {
      if (!crate.active) {
        crate.respawnTimer -= dt;
        if (crate.respawnTimer <= 0) {
          crate.active = true;
          crate.mesh.visible = true;
        }
      } else {
        if (this.playerPos.distanceTo(crate.pos) < 2.2) {
          crate.active = false;
          crate.mesh.visible = false;
          crate.respawnTimer = 20;

          this.hitstopTimer = 0.05;
          this.cameraShake = 0.6;
          this.totalScore += 150;
          this.boostFuel = Math.min(this.maxBoostFuel, this.boostFuel + 15);
          sound.playCrash();
          this.spawnBurst(crate.pos, 24, 0x854d0e, 10);
        }
      }
    }
  }

  private updateOfflineRivals(dt: number) {
    for (const rival of this.offlineRivals) {
      const targetWp = this.waypoints[rival.waypointIndex];
      _v1.subVectors(targetWp, rival.pos);
      const distToWp = _v1.length();

      if (distToWp < 12) {
        rival.waypointIndex = (rival.waypointIndex + 1) % this.waypoints.length;
      }

      const targetAngle = Math.atan2(-_v1.x, -_v1.z);
      let angleDiff = targetAngle - rival.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      rival.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.0 * dt);

      _forward.set(-Math.sin(rival.heading), 0, -Math.cos(rival.heading));
      rival.pos.addScaledVector(_forward, rival.speed * dt);
      rival.assembly.group.position.copy(rival.pos);
      rival.assembly.group.rotation.set(0, rival.heading, 0);

      rival.assembly.wheels.forEach((w) => {
        w.rotation.x += (rival.speed / 0.6) * dt;
      });
    }
  }

  private updateRemoteRacers(dt: number) {
    this.remoteRacers.forEach((remote) => {
      // Smooth lerp to target network position
      remote.assembly.group.position.lerp(remote.targetPos, 1 - Math.exp(-12 * dt));

      // Heading interpolation
      let angleDiff = remote.targetHeading - remote.assembly.group.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      remote.assembly.group.rotation.y += angleDiff * (1 - Math.exp(-12 * dt));

      // Wheels
      remote.assembly.wheels.forEach((w) => {
        w.rotation.x += (remote.speed / 0.6) * dt;
      });
    });
  }

  private updateCamera(dt: number) {
    const shakeOffset = (this.cameraShake * this.cameraShake) * 0.8;
    const sx = (Math.random() - 0.5) * shakeOffset;
    const sy = (Math.random() - 0.5) * shakeOffset;
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
    }

    if (this.cameraMode === 'chase') {
      _forward.set(-Math.sin(this.playerHeading), 0, -Math.cos(this.playerHeading));

      const airFactor = Math.min(1, Math.max(0, (this.playerPos.y - 0.4) / 10));
      const camDist = 6.8 + (this.speed / 30) * 2.0 + airFactor * 3.5;
      const camHeight = 2.5 + airFactor * 2.8;

      const targetCamPos = _v1
        .copy(this.playerPos)
        .addScaledVector(_forward, -camDist)
        .add(new THREE.Vector3(0, camHeight, 0));

      targetCamPos.y = Math.max(0.8, targetCamPos.y);

      this.camera.position.lerp(targetCamPos, 1 - Math.exp(-9 * dt));
      this.camera.position.x += sx;
      this.camera.position.y += sy;

      const lookTarget = _v2.copy(this.playerPos).add(new THREE.Vector3(0, 0.95 + airFactor * 1.2, 0));
      this.camera.lookAt(lookTarget);

      const targetFov = 65 + (this.speed / 38) * 15 + (this.isAirborne ? 8 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'hood') {
      _forward.set(-Math.sin(this.playerHeading), 0, -Math.cos(this.playerHeading));
      this.camera.position.copy(this.playerPos).add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(_forward, 0.4);
      const lookTarget = _v2.copy(this.camera.position).addScaledVector(_forward, 20);
      this.camera.lookAt(lookTarget);
    } else {
      const time = performance.now() * 0.001;
      this.camera.position.set(
        this.playerPos.x + Math.sin(time) * 12,
        this.playerPos.y + 5,
        this.playerPos.z + Math.cos(time) * 12
      );
      this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1, this.playerPos.z);
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 12 * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        if (p.mesh.position.y < 0.1) {
          p.mesh.position.y = 0.1;
          p.vy *= -0.3;
        }

        const scale = (p.life / p.maxLife) * 0.25;
        p.mesh.scale.setScalar(scale);

        if (p.life <= 0) {
          p.mesh.visible = false;
        }
      }
    }
  }

  private calculatePlayerPosition(): number {
    const calcScore = (pos: THREE.Vector3, lap: number, cpIdx: number) => {
      const nextCp = this.checkpoints[(cpIdx + 1) % this.checkpoints.length];
      const dist = pos.distanceTo(nextCp);
      return lap * 1000 + cpIdx * 100 - dist;
    };

    const playerScore = calcScore(this.playerPos, this.currentLap, this.currentCheckpoint);
    let rank = 1;

    if (this.isOnline) {
      this.remoteRacers.forEach((remote) => {
        const rScore = calcScore(remote.assembly.group.position, remote.lap, remote.checkpoint);
        if (rScore > playerScore) rank++;
      });
    } else {
      for (const r of this.offlineRivals) {
        const rScore = calcScore(r.pos, this.currentLap, r.waypointIndex % this.checkpoints.length);
        if (rScore > playerScore) rank++;
      }
    }
    return rank;
  }

  private getLiveStandings(): { name: string; lap: number; isPlayer: boolean; placement: number }[] {
    const list: { name: string; lap: number; isPlayer: boolean; score: number }[] = [];
    const calcScore = (pos: THREE.Vector3, lap: number, cpIdx: number) => {
      const nextCp = this.checkpoints[(cpIdx + 1) % this.checkpoints.length];
      const dist = pos.distanceTo(nextCp);
      return lap * 1000 + cpIdx * 100 - dist;
    };

    list.push({
      name: 'You',
      lap: Math.min(this.currentLap, this.maxLaps),
      isPlayer: true,
      score: calcScore(this.playerPos, this.currentLap, this.currentCheckpoint),
    });

    if (this.isOnline) {
      this.remoteRacers.forEach((r) => {
        list.push({
          name: r.name,
          lap: Math.min(r.lap, this.maxLaps),
          isPlayer: false,
          score: calcScore(r.assembly.group.position, r.lap, r.checkpoint),
        });
      });
    } else {
      this.offlineRivals.forEach((r, idx) => {
        list.push({
          name: `Rival #${idx + 1}`,
          lap: Math.min(this.currentLap, this.maxLaps),
          isPlayer: false,
          score: calcScore(r.pos, this.currentLap, r.waypointIndex % this.checkpoints.length),
        });
      });
    }

    list.sort((a, b) => b.score - a.score);
    return list.map((item, idx) => ({
      name: item.name,
      lap: item.lap,
      isPlayer: item.isPlayer,
      placement: idx + 1,
    }));
  }

  private emitHUD() {
    const speedKmh = Math.round(Math.abs(this.speed) * 3.6);
    const gear = speedKmh > 85 ? 4 : speedKmh > 55 ? 3 : speedKmh > 25 ? 2 : 1;
    const standings = this.getLiveStandings();
    const playerRank = standings.find((s) => s.isPlayer)?.placement || 1;

    this.callbacks.onHUDUpdate({
      speedKmh,
      boostFuel: Math.round(this.boostFuel),
      maxBoostFuel: this.maxBoostFuel,
      gear,
      altitude: Math.max(0, Number((this.playerPos.y - 0.4).toFixed(1))),
      isAirborne: this.isAirborne,
      airtime: Number(this.stuntState.airtime.toFixed(1)),
      scrapCount: this.scrapCount,
      totalScore: this.totalScore,
      comboMultiplier: Number(this.comboMultiplier.toFixed(1)),
      lap: Math.min(this.currentLap, this.maxLaps),
      maxLaps: this.maxLaps,
      position: playerRank,
      totalRacers: standings.length,
      lapTime: Number(this.currentLapTime.toFixed(1)),
      bestLapTime: Number(this.bestLapTime.toFixed(1)),
      checkpointProgress: this.currentCheckpoint,
      recentStunt: this.lastStuntNotice,
      cameraMode: this.cameraMode,
      isMuted: sound.getMuted(),
      isOnline: this.isOnline,
      networkPlayerCount: this.remoteRacers.size,
      standings,
    });
  }

  public cleanup() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
    }
    window.removeEventListener('resize', this.onResize);
    sound.cleanup();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }
  }
}
