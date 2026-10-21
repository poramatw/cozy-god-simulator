import Phaser from 'phaser';
import { LifeStageId } from './Types';

export type EraId = 'stone' | 'bronze' | 'medieval' | 'modern' | 'future';

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  let tex: Phaser.Textures.CanvasTexture | null = null;
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    if (existing instanceof Phaser.Textures.CanvasTexture && existing.width === w && existing.height === h) {
      tex = existing;
    } else {
      scene.textures.remove(key);
    }
  }
  if (!tex) {
    tex = scene.textures.createCanvas(key, w, h);
  }
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
}

function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.42
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
  grad.addColorStop(0, `rgba(6, 9, 15, ${alpha})`);
  grad.addColorStop(0.7, `rgba(6, 9, 15, ${alpha * 0.4})`);
  grad.addColorStop(1, 'rgba(6, 9, 15, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Generates rigged, high-DPI 2.5D character sprites for all 5 Life Stages and 5 Civilization Eras.
 * Zero JPG background artifacts, crisp vector-painterly shading, accurate age proportions, and era attire.
 */
export function bakeCharacterSpritesForEra(
  scene: Phaser.Scene,
  era: EraId,
  primaryColor = '#3b7a57'
): void {
  const stages: LifeStageId[] = ['infant', 'child', 'teen', 'adult', 'elder'];

  const eraPalette: Record<
    EraId,
    { outfitMain: string; outfitTrim: string; belt: string;visor?: string }
  > = {
    stone: { outfitMain: '#8c583a', outfitTrim: '#c49a6c', belt: '#4a2e1b' },
    bronze: { outfitMain: primaryColor, outfitTrim: '#d99b52', belt: '#5c3c24' },
    medieval: { outfitMain: primaryColor, outfitTrim: '#cbd5e1', belt: '#b45309' },
    modern: { outfitMain: '#2b4c65', outfitTrim: '#e2e8f0', belt: '#1e293b' },
    future: { outfitMain: '#1e293b', outfitTrim: '#38bdf8', belt: '#0284c7', visor: '#38bdf8' },
  };

  const pal = eraPalette[era];

  for (const st of stages) {
    for (const frame of [0, 1]) {
      const key = `hero_${st}_${frame}`;
      makeCanvas(scene, key, 96, 112, (ctx, w, h) => {
        const cx = w / 2;
        const baseY = h - 12;
        drawSoftShadow(ctx, cx, baseY, 22, 9, 0.45);

        const stride = frame === 1 ? 1 : -1;
        const bob = frame === 1 ? -2.5 : 0;

        // Age-based proportions
        const bodyScale =
          st === 'infant'
            ? 0.58
            : st === 'child'
            ? 0.74
            : st === 'teen'
            ? 0.88
            : st === 'adult'
            ? 1.0
            : 0.94;
        const headRadius = st === 'infant' ? 13 : st === 'child' ? 12.5 : 12;
        const torsoH = Math.round(28 * bodyScale);
        const torsoW = Math.round(22 * bodyScale);
        const legH = Math.round(14 * bodyScale);

        ctx.save();
        ctx.translate(cx, baseY + bob);

        // 1. Legs / Boots
        if (st !== 'infant') {
          ctx.fillStyle = era === 'future' ? '#0f172a' : '#3d281a';
          ctx.beginPath();
          ctx.roundRect(-7 - stride * 2, -legH, 5.5, legH, 2.5);
          ctx.roundRect(1.5 + stride * 2, -legH, 5.5, legH, 2.5);
          ctx.fill();
        }

        // 2. Back Cape / Cloak (Medieval, Adult/Elder)
        if (era === 'medieval' || era === 'bronze') {
          ctx.fillStyle = pal.outfitMain;
          ctx.beginPath();
          ctx.ellipse(0, -legH - torsoH * 0.45, torsoW * 0.68, torsoH * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Torso / Tunic / Suit
        const torsoTop = -legH - torsoH;
        const torsoGrad = ctx.createLinearGradient(0, torsoTop, 0, -legH);
        torsoGrad.addColorStop(0, pal.outfitMain);
        torsoGrad.addColorStop(1, '#141b24');
        ctx.fillStyle = torsoGrad;
        ctx.strokeStyle = pal.outfitTrim;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-torsoW / 2, torsoTop, torsoW, torsoH, 6);
        ctx.fill();
        ctx.stroke();

        // Belt or Sci-Fi Core
        ctx.fillStyle = pal.belt;
        ctx.fillRect(-torsoW / 2 + 1, torsoTop + torsoH * 0.65, torsoW - 2, 3.5);
        if (era === 'future') {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, torsoTop + torsoH * 0.4, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Arms
        ctx.fillStyle = pal.outfitMain;
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-torsoW / 2 - 4, torsoTop + 3 + stride * 2, 5, torsoH * 0.68, 2.5);
        ctx.roundRect(torsoW / 2 - 1, torsoTop + 3 - stride * 2, 5, torsoH * 0.68, 2.5);
        ctx.fill();
        ctx.stroke();

        // Elder walking staff
        if (st === 'elder') {
          ctx.strokeStyle = era === 'future' ? '#38bdf8' : '#8c583a';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(torsoW / 2 + 4, torsoTop - 8);
          ctx.lineTo(torsoW / 2 + 4, 0);
          ctx.stroke();
        }

        // 5. Head & Face
        const headY = torsoTop - headRadius + 3;
        ctx.fillStyle = '#f3cfb3';
        ctx.strokeStyle = '#4a3222';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Blush & Eyes
        if (pal.visor) {
          // Futuristic glowing visor
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(-7, headY - 3, 14, 4.5, 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(-4, headY - 1, 1.7, 0, Math.PI * 2);
          ctx.arc(4, headY - 1, 1.7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(230, 95, 92, 0.35)';
          ctx.beginPath();
          ctx.arc(-6.5, headY + 2, 2.2, 0, Math.PI * 2);
          ctx.arc(6.5, headY + 2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // 6. Hair / Beard / Era Headgear
        const hairColor =
          st === 'elder' ? '#e2e8f0' : st === 'infant' ? '#8c583a' : '#5c3824';
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.arc(0, headY - 2.5, headRadius + 1, Math.PI * 0.95, Math.PI * 2.05);
        ctx.fill();

        if (st === 'elder') {
          // Wise silver beard
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(-6, headY + 5);
          ctx.quadraticCurveTo(0, headY + 18, 6, headY + 5);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });
    }
  }

  // Sleeping sprite
  makeCanvas(scene, 'hero_sleep', 110, 84, (ctx, w, h) => {
    drawSoftShadow(ctx, w / 2, h - 18, 36, 14, 0.5);
    // Cozy bedroll / sleeping pod
    ctx.fillStyle = era === 'future' ? '#1e293b' : '#7c4d32';
    ctx.strokeStyle = era === 'future' ? '#38bdf8' : '#d99b52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(22, h - 38, 66, 24, 10);
    ctx.fill();
    ctx.stroke();

    // Sleeping head on pillow
    ctx.fillStyle = '#f3cfb3';
    ctx.beginPath();
    ctx.arc(36, h - 28, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Generates crisp, coherent 2.5D flora, resources, and buildings for all 5 Civilization Eras.
 */
export function bakeCoherentWorldAssets(scene: Phaser.Scene): void {
  // 1. Missing Icon Fix: icon_star + clean action icons
  makeCanvas(scene, 'icon_star', 28, 28, (ctx) => {
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 3);
    ctx.lineTo(22, 14);
    ctx.lineTo(14, 25);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // 2. Coherent Natural Flora (No black JPG cutout borders!)
  // Lush Forest Tree (Oak/Pine layered canopy)
  makeCanvas(scene, 'obj_tree', 140, 160, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 38, 15, 0.45);
    // Trunk
    ctx.fillStyle = '#4a3222';
    ctx.beginPath();
    ctx.roundRect(cx - 8, h - 54, 16, 42, 4);
    ctx.fill();

    // Layered Painterly Foliage Domes
    const layers = [
      { x: cx, y: h - 68, r: 38, c1: '#1e3f2d', c2: '#12281d' },
      { x: cx - 16, y: h - 82, r: 28, c1: '#28523b', c2: '#1a3828' },
      { x: cx + 16, y: h - 80, r: 28, c1: '#28523b', c2: '#1a3828' },
      { x: cx, y: h - 102, r: 32, c1: '#36694c', c2: '#234733' },
      { x: cx - 6, y: h - 114, r: 22, c1: '#498460', c2: '#2e593f' },
    ];
    for (const l of layers) {
      const g = ctx.createRadialGradient(l.x - 6, l.y - 8, 4, l.x, l.y, l.r);
      g.addColorStop(0, l.c1);
      g.addColorStop(1, l.c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Ancient Lantern Willow Tree
  makeCanvas(scene, 'obj_lantern_tree', 150, 168, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 42, 16, 0.45);
    ctx.fillStyle = '#3d271d';
    ctx.beginPath();
    ctx.roundRect(cx - 9, h - 60, 18, 48, 5);
    ctx.fill();

    const domes = [
      { x: cx, y: h - 82, r: 42, c1: '#245c52', c2: '#153832' },
      { x: cx - 18, y: h - 96, r: 30, c1: '#2e7366', c2: '#1c4740' },
      { x: cx + 18, y: h - 94, r: 30, c1: '#2e7366', c2: '#1c4740' },
      { x: cx, y: h - 114, r: 32, c1: '#3d8c7c', c2: '#24594e' },
    ];
    for (const d of domes) {
      const g = ctx.createRadialGradient(d.x - 5, d.y - 6, 4, d.x, d.y, d.r);
      g.addColorStop(0, d.c1);
      g.addColorStop(1, d.c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hanging warm golden lanterns
    for (const lx of [cx - 24, cx + 22, cx - 8, cx + 10]) {
      const ly = h - (lx < cx ? 64 : 72);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Autumn / Highland Maple Tree (replaces weird alien mushroom!)
  makeCanvas(scene, 'obj_crimson_canopy', 140, 156, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 36, 14, 0.45);
    ctx.fillStyle = '#3b2318';
    ctx.beginPath();
    ctx.roundRect(cx - 7, h - 52, 14, 40, 4);
    ctx.fill();

    const layers = [
      { x: cx, y: h - 72, r: 36, c1: '#9c4221', c2: '#652b19' },
      { x: cx - 15, y: h - 86, r: 26, c1: '#c05621', c2: '#7b341e' },
      { x: cx + 15, y: h - 84, r: 26, c1: '#c05621', c2: '#7b341e' },
      { x: cx, y: h - 102, r: 28, c1: '#dd6b20', c2: '#9c4221' },
    ];
    for (const l of layers) {
      const g = ctx.createRadialGradient(l.x - 5, l.y - 6, 4, l.x, l.y, l.r);
      g.addColorStop(0, l.c1);
      g.addColorStop(1, l.c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Berry Bush (Full & Empty)
  for (const full of [true, false]) {
    makeCanvas(scene, full ? 'obj_bush_full' : 'obj_bush_empty', 84, 84, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h - 24;
      drawSoftShadow(ctx, cx, h - 12, 26, 10, 0.4);
      const puffs = [
        { x: cx - 12, y: cy, r: 16 },
        { x: cx + 12, y: cy, r: 16 },
        { x: cx, y: cy - 8, r: 19 },
      ];
      for (const p of puffs) {
        const g = ctx.createRadialGradient(p.x - 3, p.y - 4, 2, p.x, p.y, p.r);
        g.addColorStop(0, '#3b7a57');
        g.addColorStop(1, '#1e3f2d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (full) {
        ctx.fillStyle = '#e11d48';
        for (const [bx, by] of [
          [cx - 10, cy - 2],
          [cx + 8, cy - 4],
          [cx - 2, cy - 12],
          [cx + 4, cy + 4],
          [cx - 14, cy + 5],
        ]) {
          ctx.beginPath();
          ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  // Stone Outcrop / Mountain Rock
  makeCanvas(scene, 'obj_mountain_rock', 110, 110, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 36, 14, 0.5);
    const grad = ctx.createLinearGradient(cx - 25, h - 75, cx + 25, h - 14);
    grad.addColorStop(0, '#64748b');
    grad.addColorStop(0.6, '#475569');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 32, h - 18);
    ctx.lineTo(cx - 22, h - 62);
    ctx.lineTo(cx - 4, h - 82);
    ctx.lineTo(cx + 20, h - 66);
    ctx.lineTo(cx + 34, h - 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Mineral / Starfall Crystal Outcrop
  makeCanvas(scene, 'obj_crystal', 96, 96, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 24, 10, 0.42);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1.5;
    for (const [ox, oy, ang, ch] of [
      [-10, 0, -0.25, 32],
      [10, 2, 0.28, 28],
      [0, -4, 0, 42],
    ]) {
      ctx.save();
      ctx.translate(cx + ox, h - 18 + oy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(0, -ch);
      ctx.lineTo(6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  });

  // Blessing Shrine
  makeCanvas(scene, 'obj_blessing_shrine', 110, 124, (ctx, w, h) => {
    const cx = w / 2;
    drawSoftShadow(ctx, cx, h - 14, 30, 12, 0.45);
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 22, h - 32, 44, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Floating celestial obelisk
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(cx, h - 98);
    ctx.lineTo(cx + 14, h - 64);
    ctx.lineTo(cx, h - 38);
    ctx.lineTo(cx - 14, h - 64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  // Campfire (2 frames)
  for (const frame of [0, 1]) {
    makeCanvas(scene, `obj_campfire_${frame}`, 96, 96, (ctx, w, h) => {
      const cx = w / 2;
      const cy = h - 22;
      drawSoftShadow(ctx, cx, cy, 26, 11, 0.45);
      // Stone ring
      ctx.fillStyle = '#64748b';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 16, cy + Math.sin(a) * 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Logs
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 3);
      ctx.lineTo(cx + 12, cy - 5);
      ctx.moveTo(cx - 12, cy - 5);
      ctx.lineTo(cx + 12, cy + 3);
      ctx.stroke();

      // Flame
      const fh = frame === 0 ? 28 : 33;
      const g = ctx.createRadialGradient(cx, cy - 8, 2, cx, cy - 12, fh);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(0.5, '#f97316');
      g.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy);
      ctx.quadraticCurveTo(cx, cy - fh - 8, cx + 11, cy);
      ctx.closePath();
      ctx.fill();
    });
  }
}

/**
 * Generates Era-Specific Building Textures so as the world evolves from Stone Age -> Bronze -> Medieval -> Modern -> Future,
 * the architecture on the map transforms to match the civilization era!
 */
export function bakeBuildingsForEra(scene: Phaser.Scene, era: EraId): void {
  // 1. Primary Dwelling (obj_round_hut)
  makeCanvas(scene, 'obj_round_hut', 160, 160, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 18;
    drawSoftShadow(ctx, cx, by, 52, 22, 0.5);

    if (era === 'stone') {
      // Prehistoric Hide Tent / Mammoth Bone Teepee
      ctx.fillStyle = '#9c6644';
      ctx.strokeStyle = '#582f0e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, by - 95);
      ctx.lineTo(cx + 46, by - 6);
      ctx.lineTo(cx - 46, by - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (era === 'bronze' || era === 'medieval') {
      // Cozy Timber & Thatched Roundhouse
      ctx.fillStyle = '#7f5539';
      ctx.fillRect(cx - 38, by - 46, 76, 38);
      ctx.fillStyle = '#d4a373';
      ctx.strokeStyle = '#6c584c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, by - 102);
      ctx.lineTo(cx + 48, by - 42);
      ctx.lineTo(cx - 48, by - 42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (era === 'modern') {
      // Modern Brick & Glass Townhouse
      ctx.fillStyle = '#991b1b';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx - 42, by - 92, 84, 84, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 45, by - 98, 90, 12);
      // Lit windows
      ctx.fillStyle = '#fef08a';
      for (const wy of [by - 76, by - 48]) {
        ctx.fillRect(cx - 28, wy, 18, 16);
        ctx.fillRect(cx + 10, wy, 18, 16);
      }
    } else {
      // Future Sci-Fi Geodesic Habitat Pod
      const g = ctx.createRadialGradient(cx - 10, by - 55, 8, cx, by - 45, 52);
      g.addColorStop(0, '#f8fafc');
      g.addColorStop(0.7, '#cbd5e1');
      g.addColorStop(1, '#475569');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, by - 36, 46, Math.PI, 0);
      ctx.lineTo(cx + 46, by - 8);
      ctx.lineTo(cx - 46, by - 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });

  // 2. Advanced Hall / Manor / Arcology (obj_hut)
  makeCanvas(scene, 'obj_hut', 180, 180, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 18;
    drawSoftShadow(ctx, cx, by, 62, 24, 0.52);

    if (era === 'stone' || era === 'bronze') {
      // Timber Longhouse
      ctx.fillStyle = '#6f4e37';
      ctx.fillRect(cx - 50, by - 56, 100, 46);
      ctx.fillStyle = '#a98467';
      ctx.beginPath();
      ctx.moveTo(cx - 58, by - 52);
      ctx.lineTo(cx, by - 110);
      ctx.lineTo(cx + 58, by - 52);
      ctx.closePath();
      ctx.fill();
    } else if (era === 'medieval') {
      // Stone Keep / Guildhall
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 52, by - 66, 104, 56);
      ctx.strokeRect(cx - 52, by - 66, 104, 56);
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(cx - 60, by - 64);
      ctx.lineTo(cx, by - 122);
      ctx.lineTo(cx + 60, by - 64);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - 32, by - 48, 16, 20);
      ctx.fillRect(cx + 16, by - 48, 16, 20);
    } else if (era === 'modern') {
      // Modern Glass Civic Center
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 50, by - 118, 100, 108);
      ctx.strokeRect(cx - 50, by - 118, 100, 108);
      ctx.fillStyle = '#38bdf8';
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(cx - 38, by - 102 + r * 28, 76, 16);
      }
    } else {
      // Future Arcology Bio-Dome
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, by - 24, 58, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 60, by - 26, 120, 16);
    }
  });

  // 3. Watchtower / Radar / Quantum Spire (obj_watchtower)
  makeCanvas(scene, 'obj_watchtower', 150, 200, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 16;
    drawSoftShadow(ctx, cx, by, 42, 18, 0.5);

    if (era === 'future') {
      // Quantum Energy Spire
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, by - 165);
      ctx.lineTo(cx + 28, by - 12);
      ctx.lineTo(cx - 28, by - 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, by - 140, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = era === 'modern' ? '#475569' : '#5c3c24';
      ctx.fillRect(cx - 22, by - 128, 44, 116);
      ctx.fillStyle = era === 'modern' ? '#1e293b' : '#8c583a';
      ctx.beginPath();
      ctx.moveTo(cx - 32, by - 124);
      ctx.lineTo(cx, by - 164);
      ctx.lineTo(cx + 32, by - 124);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, by - 112, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // 4. Agriculture / Hydroponics (obj_farm_plot)
  makeCanvas(scene, 'obj_farm_plot', 160, 140, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 16;
    ctx.fillStyle = era === 'future' ? '#0f172a' : '#4a3222';
    ctx.strokeStyle = era === 'future' ? '#38bdf8' : '#8c583a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 56, by - 76, 112, 64, 8);
    ctx.fill();
    ctx.stroke();

    // Crop rows
    ctx.fillStyle = era === 'future' ? '#34d399' : '#eab308';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.beginPath();
        ctx.arc(cx - 40 + c * 16, by - 60 + r * 18, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // 5. Smithy / Factory / Fusion Reactor (obj_stone_smithy)
  makeCanvas(scene, 'obj_stone_smithy', 180, 180, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 18;
    drawSoftShadow(ctx, cx, by, 58, 22, 0.5);

    ctx.fillStyle = era === 'future' ? '#1e293b' : '#475569';
    ctx.strokeStyle = era === 'future' ? '#38bdf8' : '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - 52, by - 88, 104, 76, 6);
    ctx.fill();
    ctx.stroke();

    // Furnace / Reactor Core
    ctx.fillStyle = era === 'future' ? '#38bdf8' : '#f97316';
    ctx.beginPath();
    ctx.arc(cx, by - 36, 16, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6. Construction Site Scaffolding
  makeCanvas(scene, 'obj_construction_site', 160, 160, (ctx, w, h) => {
    const cx = w / 2;
    const by = h - 18;
    drawSoftShadow(ctx, cx, by, 52, 20, 0.4);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(cx - 42, by - 78, 84, 66);
    ctx.beginPath();
    ctx.moveTo(cx - 42, by - 78);
    ctx.lineTo(cx + 42, by - 12);
    ctx.moveTo(cx + 42, by - 78);
    ctx.lineTo(cx - 42, by - 12);
    ctx.stroke();
  });
}
