/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Creates the textured brick paving pattern matching the user's attachment:
 * Perforated terracotta-brown stone paver blocks with quadrant holes, mortar lines, and mossy weathering.
 */
export function createPavingGridTexture(anisotropy: number = 4): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base earth/stone tone
  ctx.fillStyle = '#8b6f58';
  ctx.fillRect(0, 0, size, size);

  // Draw 4x4 grid of paving blocks
  const cols = 4;
  const tileSize = size / cols;
  const gap = 6;

  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * tileSize;
      const py = y * tileSize;

      // Paver body variation
      const hueJitter = (Math.sin(x * 12.9 + y * 7.4) * 0.5 + 0.5);
      const r = Math.floor(138 + hueJitter * 20);
      const g = Math.floor(110 + hueJitter * 15);
      const b = Math.floor(88 + hueJitter * 12);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px + gap / 2, py + gap / 2, tileSize - gap, tileSize - gap);

      // Stone texture noise
      for (let n = 0; n < 80; n++) {
        const nx = px + gap + Math.random() * (tileSize - gap * 2);
        const ny = py + gap + Math.random() * (tileSize - gap * 2);
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70,50,35,0.25)' : 'rgba(180,150,120,0.2)';
        ctx.fillRect(nx, ny, 2, 2);
      }

      // Perforations: 3x3 array of small square hollow recesses inside each stone tile
      const subCols = 3;
      const subSize = (tileSize - gap * 2) / subCols;
      for (let sy = 0; sy < subCols; sy++) {
        for (let sx = 0; sx < subCols; sx++) {
          const hx = px + gap + sx * subSize + subSize * 0.2;
          const hy = py + gap + sy * subSize + subSize * 0.2;
          const hw = subSize * 0.6;
          const hh = subSize * 0.6;

          // Inner dark perforation cavity
          ctx.fillStyle = '#423326';
          ctx.fillRect(hx, hy, hw, hh);

          // Top highlight edge
          ctx.fillStyle = 'rgba(210,180,150,0.4)';
          ctx.fillRect(hx, hy, hw, 2);
          ctx.fillRect(hx, hy, 2, hh);

          // Deep bottom shadow
          ctx.fillStyle = 'rgba(20,15,10,0.6)';
          ctx.fillRect(hx, hy + hh - 2, hw, 2);
          ctx.fillRect(hx + hw - 2, hy, 2, hh);
        }
      }

      // Mortar gap (dark earth + occasional mossy green)
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = gap;
      ctx.strokeRect(px, py, tileSize, tileSize);

      if (hueJitter > 0.6) {
        ctx.fillStyle = 'rgba(60, 95, 45, 0.4)';
        ctx.fillRect(px, py, gap, tileSize);
        ctx.fillRect(px, py, tileSize, gap);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * Creates caution hazard yellow/black stripes for junk ramps and boost pads.
 */
export function createHazardStripeTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f59e0b'; // vibrant amber yellow
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#18181b'; // dark charcoal
  ctx.beginPath();
  const stripeW = 32;
  for (let x = -size; x < size * 2; x += stripeW * 2) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - size, size);
    ctx.lineTo(x - size, size);
  }
  ctx.fill();

  // Weathering scratches
  ctx.fillStyle = 'rgba(90, 70, 50, 0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 20 + 5, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates procedural rusted scrap metal texture for junk crates and buggy panels.
 */
export function createRustMetalTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c544e';
  ctx.fillRect(0, 0, size, size);

  // Rust patches
  for (let i = 0; i < 60; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    const rad = Math.random() * 35 + 10;
    const grad = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
    grad.addColorStop(0, 'rgba(180, 83, 30, 0.7)');
    grad.addColorStop(0.6, 'rgba(120, 50, 20, 0.4)');
    grad.addColorStop(1, 'rgba(90, 75, 65, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates soft radial contact shadow disc for grounded vehicles and props.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(10, 15, 10, 0.75)');
  grad.addColorStop(0.5, 'rgba(10, 15, 10, 0.35)');
  grad.addColorStop(1, 'rgba(10, 15, 10, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates custom decal textures for vehicle customization.
 */
export function createDecalTexture(decalType: 'none' | 'hazard' | 'chevrons' | 'flames' | 'skull', baseColorHex: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Transparent base with subtle base coat
  ctx.fillStyle = `#${baseColorHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, size, size);

  if (decalType === 'hazard') {
    // Yellow/black caution angled side stripes
    ctx.fillStyle = '#f59e0b';
    const w = 40;
    for (let x = -size; x < size * 2; x += w * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w - 50, size);
      ctx.lineTo(x - 50, size);
      ctx.fill();
    }
  } else if (decalType === 'chevrons') {
    // Racing double speed chevrons
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.1);
    ctx.lineTo(size * 0.5, size * 0.5);
    ctx.lineTo(size * 0.2, size * 0.9);
    ctx.lineTo(size * 0.35, size * 0.9);
    ctx.lineTo(size * 0.65, size * 0.5);
    ctx.lineTo(size * 0.35, size * 0.1);
    ctx.fill();

    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.1);
    ctx.lineTo(size * 0.8, size * 0.5);
    ctx.lineTo(size * 0.5, size * 0.9);
    ctx.lineTo(size * 0.65, size * 0.9);
    ctx.lineTo(size * 0.95, size * 0.5);
    ctx.lineTo(size * 0.65, size * 0.1);
    ctx.fill();
  } else if (decalType === 'flames') {
    // Hot rod flames
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.2);
    ctx.quadraticCurveTo(size * 0.4, size * 0.25, size * 0.8, size * 0.1);
    ctx.quadraticCurveTo(size * 0.5, size * 0.45, size * 0.95, size * 0.5);
    ctx.quadraticCurveTo(size * 0.4, size * 0.65, size * 0.75, size * 0.9);
    ctx.quadraticCurveTo(size * 0.3, size * 0.75, 0, size * 0.8);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.quadraticCurveTo(size * 0.3, size * 0.38, size * 0.55, size * 0.28);
    ctx.quadraticCurveTo(size * 0.35, size * 0.5, size * 0.7, size * 0.5);
    ctx.quadraticCurveTo(size * 0.25, size * 0.62, size * 0.5, size * 0.72);
    ctx.quadraticCurveTo(size * 0.15, size * 0.68, 0, size * 0.65);
    ctx.fill();
  } else if (decalType === 'skull') {
    // Stylized scrap skull
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.42, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(size * 0.38, size * 0.62, size * 0.24, size * 0.16);

    // Eye sockets
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(size * 0.42, size * 0.42, size * 0.08, 0, Math.PI * 2);
    ctx.arc(size * 0.58, size * 0.42, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

