/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface BuggyAssembly {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontLeftWheel: THREE.Mesh;
  frontRightWheel: THREE.Mesh;
  exhaustLeft: THREE.Mesh;
  exhaustRight: THREE.Mesh;
  rocketGlow: THREE.Mesh;
  headlights: THREE.SpotLight[];
}

export interface BuggyCustomizationOptions {
  bodyColor?: number;
  finishType?: 'matte' | 'gloss' | 'metallic' | 'weathered';
  trimColor?: number;
  decalTexture?: THREE.Texture | null;
  engineTier?: number;
  tireTier?: number;
  thrusterTier?: number;
  suspensionTier?: number;
}

/**
 * Builds a composite 10+ part procedural Scrap Junk Buggy with full customization support.
 */
export function createBuggy(
  bodyColorOrOptions: number | BuggyCustomizationOptions = 0xd97706,
  isPlayer: boolean = true
): BuggyAssembly {
  const group = new THREE.Group();

  const options: BuggyCustomizationOptions = typeof bodyColorOrOptions === 'number'
    ? { bodyColor: bodyColorOrOptions }
    : bodyColorOrOptions;

  const bodyColor = options.bodyColor ?? 0xd97706;
  const finish = options.finishType ?? 'matte';
  const trimColor = options.trimColor ?? 0x27272a;
  const engineTier = options.engineTier ?? 1;
  const tireTier = options.tireTier ?? 1;
  const thrusterTier = options.thrusterTier ?? 1;

  let roughness = 0.65;
  let metalness = 0.35;
  if (finish === 'gloss') {
    roughness = 0.22;
    metalness = 0.15;
  } else if (finish === 'metallic') {
    roughness = 0.18;
    metalness = 0.82;
  } else if (finish === 'weathered') {
    roughness = 0.88;
    metalness = 0.45;
  }

  // Materials
  const chassisMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness,
    metalness,
    map: options.decalTexture || undefined,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.75,
    metalness: 0.55,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.2,
    metalness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.1,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.7,
  });
  const emissionMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  // 1. Main Chassis Hull (Chiseled wedge)
  const chassisGeo = new THREE.BoxGeometry(1.6, 0.45, 2.8);
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.55;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Front Hood Taper / Rammer
  const noseGeo = new THREE.BoxGeometry(1.4, 0.3, 1.0);
  const nose = new THREE.Mesh(noseGeo, chassisMat);
  nose.position.set(0, 0.45, -1.6);
  nose.rotation.x = 0.15;
  nose.castShadow = true;
  group.add(nose);

  // 3. Heavy Front Bull-Bar
  const bullBarGeo = new THREE.TorusGeometry(0.7, 0.07, 8, 16, Math.PI);
  const bullBar = new THREE.Mesh(bullBarGeo, darkMetalMat);
  bullBar.rotation.x = Math.PI / 2;
  bullBar.position.set(0, 0.5, -2.15);
  bullBar.castShadow = true;
  group.add(bullBar);

  // 4. Exposed Engine Block
  const engineGeo = new THREE.BoxGeometry(0.8, 0.6, 0.7);
  const engine = new THREE.Mesh(engineGeo, darkMetalMat);
  engine.position.set(0, 0.85, 0.8);
  engine.castShadow = true;
  group.add(engine);

  // 5. Supercharger Blower Scoop (Chrome intake - scales with engine tier)
  const scoopScale = 1 + (engineTier - 1) * 0.18;
  const scoopGeo = new THREE.BoxGeometry(0.4 * scoopScale, 0.25 * scoopScale, 0.45 * scoopScale);
  const scoop = new THREE.Mesh(scoopGeo, chromeMat);
  scoop.position.set(0, 1.25 + (engineTier - 1) * 0.04, 0.8);
  scoop.castShadow = true;
  group.add(scoop);

  // 6. Tubular Steel Roll Cage
  const cageGroup = new THREE.Group();
  const tubeMat = darkMetalMat;
  // Side arches
  for (const side of [-0.65, 0.65]) {
    const archGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const frontPost = new THREE.Mesh(archGeo, tubeMat);
    frontPost.position.set(side, 1.1, -0.4);
    frontPost.rotation.x = 0.35;
    cageGroup.add(frontPost);

    const rearPost = new THREE.Mesh(archGeo, tubeMat);
    rearPost.position.set(side, 1.1, 0.5);
    rearPost.rotation.x = -0.2;
    cageGroup.add(rearPost);
  }
  // Cross bars
  const roofBarGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.35, 8);
  const roofFront = new THREE.Mesh(roofBarGeo, tubeMat);
  roofFront.rotation.z = Math.PI / 2;
  roofFront.position.set(0, 1.55, -0.2);
  cageGroup.add(roofFront);

  const roofRear = new THREE.Mesh(roofBarGeo, tubeMat);
  roofRear.rotation.z = Math.PI / 2;
  roofRear.position.set(0, 1.55, 0.4);
  cageGroup.add(roofRear);
  group.add(cageGroup);

  // 7. Cockpit Seat & Steering Wheel
  const seatGeo = new THREE.BoxGeometry(0.65, 0.7, 0.5);
  const seat = new THREE.Mesh(seatGeo, darkMetalMat);
  seat.position.set(0, 0.95, -0.1);
  group.add(seat);

  // 8. Rocket Thruster Nozzle & Glow (scales with thruster tier for higher jump action)
  const thrustScale = 1 + (thrusterTier - 1) * 0.2;
  const thrusterGeo = new THREE.CylinderGeometry(0.2 * thrustScale, 0.3 * thrustScale, 0.5 * thrustScale, 12);
  const thruster = new THREE.Mesh(thrusterGeo, darkMetalMat);
  thruster.rotation.x = Math.PI / 2;
  thruster.position.set(0, 0.75, 1.6);
  group.add(thruster);

  const glowGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const rocketGlow = new THREE.Mesh(glowGeo, emissionMat);
  rocketGlow.position.set(0, 0.75, 1.8);
  rocketGlow.visible = false;
  group.add(rocketGlow);

  // 9. Twin High-Angle Exhaust Pipes
  const pipeGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8);
  const exhaustLeft = new THREE.Mesh(pipeGeo, chromeMat);
  exhaustLeft.position.set(-0.55, 1.15, 1.2);
  exhaustLeft.rotation.x = 0.45;
  exhaustLeft.rotation.z = -0.25;
  group.add(exhaustLeft);

  const exhaustRight = new THREE.Mesh(pipeGeo, chromeMat);
  exhaustRight.position.set(0.55, 1.15, 1.2);
  exhaustRight.rotation.x = 0.45;
  exhaustRight.rotation.z = 0.25;
  group.add(exhaustRight);

  // 10. Wheels & Knobby Off-Road Tires
  const wheels: THREE.Mesh[] = [];
  const createWheel = (radius: number, width: number) => {
    const wheelGroup = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rimGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, width * 1.05, 12);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Tread studs
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const studGeo = new THREE.BoxGeometry(width * 0.9, 0.08, 0.12);
      const stud = new THREE.Mesh(studGeo, tireMat);
      stud.position.set(0, Math.sin(angle) * radius, Math.cos(angle) * radius);
      wheelGroup.add(stud);
    }
    return wheelGroup as unknown as THREE.Mesh;
  };

  // Rear Wheels (Larger monster tires)
  const rearLeft = createWheel(0.65, 0.55);
  rearLeft.position.set(-1.15, 0.65, 1.05);
  group.add(rearLeft);
  wheels.push(rearLeft);

  const rearRight = createWheel(0.65, 0.55);
  rearRight.position.set(1.15, 0.65, 1.05);
  group.add(rearRight);
  wheels.push(rearRight);

  // Front Wheels (Steering tires)
  const frontLeft = createWheel(0.5, 0.45);
  frontLeft.position.set(-1.05, 0.5, -1.25);
  group.add(frontLeft);
  wheels.push(frontLeft);

  const frontRight = createWheel(0.5, 0.45);
  frontRight.position.set(1.05, 0.5, -1.25);
  group.add(frontRight);
  wheels.push(frontRight);

  // Headlights
  const headlights: THREE.SpotLight[] = [];
  if (isPlayer) {
    for (const side of [-0.55, 0.55]) {
      const light = new THREE.SpotLight(0xfff5e6, 2.5, 28, Math.PI / 6, 0.35, 1.2);
      light.position.set(side, 0.7, -1.8);
      const target = new THREE.Object3D();
      target.position.set(side, 0.1, -12);
      group.add(target);
      light.target = target;
      group.add(light);
      headlights.push(light);

      // Bulb lens
      const lensGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(side, 0.7, -1.8);
      group.add(lens);
    }
  }

  // Soft Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(2.8, 4.0);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const sctx = shadowCanvas.getContext('2d')!;
  const sgrad = sctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  sgrad.addColorStop(0, 'rgba(0,0,0,0.6)');
  sgrad.addColorStop(0.7, 'rgba(0,0,0,0.2)');
  sgrad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.04;
  group.add(shadowMesh);

  return {
    group,
    wheels,
    frontLeftWheel: frontLeft,
    frontRightWheel: frontRight,
    exhaustLeft,
    exhaustRight,
    rocketGlow,
    headlights,
  };
}

/**
 * Creates a Junk Jump Ramp with hazard yellow/black stripes and launch booster strip.
 */
export function createJunkRamp(hazardTex: THREE.Texture, width = 7, height = 3.2, length = 10): THREE.Group {
  const group = new THREE.Group();

  // Ramp deck using extruded profile
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  // Gentle curved launch curve
  shape.quadraticCurveTo(length * 0.35, 0.1, 0, 0);

  const extrudeSettings = {
    steps: 1,
    depth: width,
    bevelEnabled: false,
  };
  const rampGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  rampGeo.center();

  const deckMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.6,
    metalness: 0.4,
  });
  const rampMesh = new THREE.Mesh(rampGeo, deckMat);
  rampMesh.rotation.y = Math.PI / 2;
  rampMesh.position.y = height / 2;
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  group.add(rampMesh);

  // Side rusty steel guard rails
  const railGeo = new THREE.BoxGeometry(0.3, height + 0.6, length * 1.05);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.5 });
  for (const x of [-width / 2 - 0.15, width / 2 + 0.15]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(x, height / 2, 0);
    group.add(rail);
  }

  // Glowing launch booster strip at the lip
  const boosterGeo = new THREE.BoxGeometry(width * 0.9, 0.15, 0.6);
  const boosterMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
  const booster = new THREE.Mesh(boosterGeo, boosterMat);
  booster.position.set(0, height + 0.05, length / 2 - 0.3);
  group.add(booster);

  return group;
}

/**
 * Destructible Junk Crate that shatters into debris when rammed at speed.
 */
export function createJunkCrate(rustTex: THREE.Texture, size = 1.4): THREE.Mesh {
  const crateGeo = new THREE.BoxGeometry(size, size, size);
  const crateMat = new THREE.MeshStandardMaterial({
    map: rustTex,
    roughness: 0.8,
    metalness: 0.3,
  });
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.y = size / 2;
  crate.castShadow = true;
  crate.receiveShadow = true;
  return crate;
}

/**
 * Spinning scrap gear pickup that grants points and nitro boost.
 */
export function createScrapGear(): THREE.Group {
  const group = new THREE.Group();
  const gearMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x78350f,
    emissiveIntensity: 0.3,
  });

  const coreGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.2, 12);
  const core = new THREE.Mesh(coreGeo, gearMat);
  group.add(core);

  // Teeth
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const toothGeo = new THREE.BoxGeometry(0.3, 0.2, 0.4);
    const tooth = new THREE.Mesh(toothGeo, gearMat);
    tooth.position.set(Math.sin(angle) * 0.85, 0, Math.cos(angle) * 0.85);
    tooth.rotation.y = angle;
    group.add(tooth);
  }

  // Center hole
  const holeGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.25, 8);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  group.add(hole);

  group.scale.set(1.1, 1.1, 1.1);
  return group;
}

/**
 * High-air stunt hoop ring suspended in mid-air.
 */
export function createAirRingHoop(radius = 3.5): THREE.Group {
  const group = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(radius, 0.35, 12, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    emissive: 0x2563eb,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.9,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);

  // Chevron beacons around ring
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const beaconGeo = new THREE.ConeGeometry(0.4, 0.8, 6);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(Math.sin(angle) * (radius + 0.5), Math.cos(angle) * (radius + 0.5), 0);
    beacon.rotation.z = -angle;
    group.add(beacon);
  }

  return group;
}

/**
 * Purple flowering bush inspired directly by the user's uploaded photo!
 * Dense green leafy canopy dotted with clusters of vibrant purple flowers (Tibouchina / Glory Bush).
 */
export function createPurpleFlowerBush(): THREE.Group {
  const group = new THREE.Group();

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2d5a27, // deep lush green matching photo foliage
    roughness: 0.85,
    metalness: 0.1,
  });
  const flowerMat = new THREE.MeshStandardMaterial({
    color: 0x9333ea, // vibrant violet/purple petals matching user photo!
    emissive: 0x581c87,
    emissiveIntensity: 0.2,
    roughness: 0.6,
  });

  // Base bush clumps
  const mainClumpGeo = new THREE.SphereGeometry(1.2, 8, 8);
  const mainBush = new THREE.Mesh(mainClumpGeo, leafMat);
  mainBush.position.y = 1.0;
  mainBush.scale.set(1.4, 1.0, 1.2);
  mainBush.castShadow = true;
  group.add(mainBush);

  // Secondary foliage clumps
  const offsets = [
    [-0.8, 0.7, 0.5, 0.9],
    [0.7, 0.6, -0.4, 0.85],
    [-0.5, 0.8, -0.6, 0.95],
    [0.6, 0.75, 0.6, 0.8],
  ];
  for (const [ox, oy, oz, scale] of offsets) {
    const subGeo = new THREE.SphereGeometry(scale, 7, 7);
    const subBush = new THREE.Mesh(subGeo, leafMat);
    subBush.position.set(ox, oy, oz);
    group.add(subBush);
  }

  // Purple flower blossom clusters scattered across the surface
  const flowerGeo = new THREE.SphereGeometry(0.2, 5, 5);
  for (let i = 0; i < 22; i++) {
    const flower = new THREE.Mesh(flowerGeo, flowerMat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI * 0.45); // top half
    const r = 1.35 + (Math.random() - 0.5) * 0.3;
    flower.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      0.6 + r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    flower.scale.set(1 + Math.random() * 0.5, 0.8, 1 + Math.random() * 0.5);
    group.add(flower);
  }

  return group;
}

/**
 * Lush garden tree with gnarled trunk and tiered green canopy matching the garden scene in photo.
 */
export function createGardenTree(): THREE.Group {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.9,
    metalness: 0.1,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a1e,
    roughness: 0.8,
    metalness: 0.05,
  });

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.65, 3.8, 8);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.9;
  trunk.castShadow = true;
  group.add(trunk);

  // 3-tier foliage crown
  const tierHeights = [3.8, 5.0, 6.0];
  const tierRadii = [2.2, 1.8, 1.2];
  for (let i = 0; i < 3; i++) {
    const crownGeo = new THREE.ConeGeometry(tierRadii[i], 2.2, 8);
    const crown = new THREE.Mesh(crownGeo, leafMat);
    crown.position.y = tierHeights[i];
    crown.castShadow = true;
    group.add(crown);
  }

  return group;
}

/**
 * Weathered stone brick retaining wall / garden ledge matching the photo.
 */
export function createStoneLedge(length = 12, height = 1.2, width = 1.0): THREE.Mesh {
  const ledgeGeo = new THREE.BoxGeometry(width, height, length);
  const ledgeMat = new THREE.MeshStandardMaterial({
    color: 0x786251,
    roughness: 0.85,
    metalness: 0.15,
  });
  const ledge = new THREE.Mesh(ledgeGeo, ledgeMat);
  ledge.position.y = height / 2;
  ledge.castShadow = true;
  ledge.receiveShadow = true;
  return ledge;
}
