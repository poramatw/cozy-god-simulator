import Phaser from 'phaser';
import { EraId } from './ProceduralArtEngine';

export interface QuadrantExtractSpec {
  targetKey: string;
  col: number;
  row: number;
  outWidth: number;
  outHeight: number;
  subCrop?: { x0: number; y0: number; x1: number; y1: number };
  removeRedBerries?: boolean;
  walkBobOffset?: number;
}

function getOrCreateCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) {
    const existing = scene.textures.get(key);
    if (
      existing instanceof Phaser.Textures.CanvasTexture &&
      existing.width === w &&
      existing.height === h
    ) {
      return existing;
    }
    scene.textures.remove(key);
  }
  return scene.textures.createCanvas(key, w, h);
}

/**
 * Phase 6.1: Extracts True Alpha .png quadrants without runtime background-removal artifacts,
 * anchors each sprite with a grounded 2.5D elliptical drop shadow, and registers Phaser Animations.
 */
export function processSpriteSheet2x2(
  scene: Phaser.Scene,
  sourceKey: string,
  specs: QuadrantExtractSpec[]
): void {
  if (!scene.textures.exists(sourceKey)) return;
  const srcTex = scene.textures.get(sourceKey);
  const srcImg = srcTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  if (!srcImg || !srcImg.width || !srcImg.height) return;

  const fullW = srcImg.width;
  const fullH = srcImg.height;
  const halfW = Math.floor(fullW / 2);
  const halfH = Math.floor(fullH / 2);

  const workCanvas = document.createElement('canvas');
  workCanvas.width = fullW;
  workCanvas.height = fullH;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!workCtx) return;
  workCtx.drawImage(srcImg, 0, 0);

  for (const spec of specs) {
    let qx = spec.col * halfW;
    let qy = spec.row * halfH;
    let qw = halfW;
    let qh = halfH;

    const pad = 8;
    qx += pad;
    qy += pad;
    qw -= pad * 2;
    qh -= pad * 2;

    if (spec.subCrop) {
      const subX = qx + Math.floor(spec.subCrop.x0 * qw);
      const subY = qy + Math.floor(spec.subCrop.y0 * qh);
      const subW = Math.floor((spec.subCrop.x1 - spec.subCrop.x0) * qw);
      const subH = Math.floor((spec.subCrop.y1 - spec.subCrop.y0) * qh);
      qx = subX;
      qy = subY;
      qw = subW;
      qh = subH;
    }

    const imgData = workCtx.getImageData(qx, qy, qw, qh);
    const data = imgData.data;

    let minX = qw;
    let minY = qh;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < qh; y++) {
      for (let x = 0; x < qw; x++) {
        const dIdx = (y * qw + x) * 4;
        const a = data[dIdx + 3];
        if (a <= 22) continue;

        if (spec.removeRedBerries) {
          const r = data[dIdx];
          const g = data[dIdx + 1];
          const b = data[dIdx + 2];
          if (r > 90 && r > g * 1.3 && r > b * 1.3) {
            data[dIdx] = Math.floor(g * 0.65);
            data[dIdx + 1] = Math.min(255, Math.floor(r * 0.72));
            data[dIdx + 2] = Math.floor(b * 0.75);
          }
        }

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX <= minX || maxY <= minY) continue;

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = qw;
    tempCanvas.height = qh;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) continue;
    tempCtx.putImageData(imgData, 0, 0);

    const outTex = getOrCreateCanvasTexture(scene, spec.targetKey, spec.outWidth, spec.outHeight);
    if (!outTex) continue;
    const outCtx = outTex.getContext();
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.clearRect(0, 0, spec.outWidth, spec.outHeight);

    // Phase 6.1: Crisp Grounded Elliptical Drop Shadow at base of every 2.5D object
    outCtx.save();
    outCtx.translate(spec.outWidth / 2, spec.outHeight - 10);
    outCtx.scale(1, 0.42);
    const radius = spec.outWidth * 0.36;
    const shadowGrad = outCtx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
    shadowGrad.addColorStop(0, 'rgba(12, 16, 22, 0.48)');
    shadowGrad.addColorStop(0.65, 'rgba(12, 16, 22, 0.24)');
    shadowGrad.addColorStop(1, 'rgba(12, 16, 22, 0)');
    outCtx.fillStyle = shadowGrad;
    outCtx.beginPath();
    outCtx.arc(0, 0, radius, 0, Math.PI * 2);
    outCtx.fill();
    outCtx.restore();

    const scale = Math.min((spec.outWidth - 6) / cropW, (spec.outHeight - 8) / cropH);
    const drawW = Math.round(cropW * scale);
    const drawH = Math.round(cropH * scale);
    const drawX = Math.round((spec.outWidth - drawW) / 2);
    const bob = spec.walkBobOffset ?? 0;
    const drawY = Math.round(spec.outHeight - drawH - 5 + bob);

    outCtx.drawImage(tempCanvas, minX, minY, cropW, cropH, drawX, drawY, drawW, drawH);
    outTex.refresh();
  }
}

function copyTextureToTarget(
  scene: Phaser.Scene,
  srcKey: string,
  targetKey: string,
  outW: number,
  outH: number
): void {
  if (!scene.textures.exists(srcKey)) return;
  const srcImg = scene.textures.get(srcKey).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  if (!srcImg) return;
  const outTex = getOrCreateCanvasTexture(scene, targetKey, outW, outH);
  if (!outTex) return;
  const ctx = outTex.getContext();
  ctx.clearRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcImg, 0, 0, outW, outH);
  outTex.refresh();
}

export function applyCozyRealisticEraBuildings(scene: Phaser.Scene, era: EraId): void {
  if (era === 'stone') {
    copyTextureToTarget(scene, 'era_stone_tent', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'base_round_hut', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'base_stone_smithy', 'obj_stone_smithy', 230, 230);
  } else if (era === 'bronze') {
    copyTextureToTarget(scene, 'base_round_hut', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'base_timber_hut', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'base_stone_smithy', 'obj_stone_smithy', 230, 230);
  } else if (era === 'medieval') {
    copyTextureToTarget(scene, 'base_timber_hut', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'era_medieval_keep', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'base_stone_smithy', 'obj_stone_smithy', 230, 230);
  } else if (era === 'modern') {
    copyTextureToTarget(scene, 'era_medieval_keep', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'era_modern_hall', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'era_modern_hall', 'obj_stone_smithy', 230, 230);
  } else {
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_stone_smithy', 230, 230);
  }
}

function generateAtmosphereAndShadowTextures(scene: Phaser.Scene): void {
  // 1. Reusable Grounded Elliptical Drop Shadow (Phase 6.1)
  const shadowTex = getOrCreateCanvasTexture(scene, 'drop_shadow', 64, 32);
  if (shadowTex) {
    const ctx = shadowTex.getContext();
    ctx.clearRect(0, 0, 64, 32);
    ctx.save();
    ctx.translate(32, 16);
    ctx.scale(1, 0.46);
    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
    grad.addColorStop(0, 'rgba(10, 14, 20, 0.45)');
    grad.addColorStop(0.65, 'rgba(10, 14, 20, 0.22)');
    grad.addColorStop(1, 'rgba(10, 14, 20, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    shadowTex.refresh();
  }

  // 2. Warm Point Light Radial Gradient (Phase 7.1)
  const warmLightTex = getOrCreateCanvasTexture(scene, 'light_warm_point', 256, 256);
  if (warmLightTex) {
    const ctx = warmLightTex.getContext();
    ctx.clearRect(0, 0, 256, 256);
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, 'rgba(255, 214, 130, 0.62)');
    grad.addColorStop(0.38, 'rgba(251, 146, 60, 0.30)');
    grad.addColorStop(0.72, 'rgba(217, 119, 6, 0.10)');
    grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    warmLightTex.refresh();
  }

  // 3. Drifting Daytime Cloud Shadow Blob (Phase 7.1)
  const cloudTex = getOrCreateCanvasTexture(scene, 'cloud_shadow_blob', 320, 180);
  if (cloudTex) {
    const ctx = cloudTex.getContext();
    ctx.clearRect(0, 0, 320, 180);
    const blobs = [
      { x: 110, y: 95, r: 75 },
      { x: 175, y: 80, r: 82 },
      { x: 225, y: 100, r: 65 },
      { x: 145, y: 112, r: 68 },
    ];
    for (const b of blobs) {
      const grad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, b.r);
      grad.addColorStop(0, 'rgba(8, 14, 24, 0.38)');
      grad.addColorStop(0.6, 'rgba(8, 14, 24, 0.16)');
      grad.addColorStop(1, 'rgba(8, 14, 24, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    cloudTex.refresh();
  }

  // 4. Nighttime Glowing Firefly Orb (Phase 7.1)
  const fireflyTex = getOrCreateCanvasTexture(scene, 'firefly_orb', 24, 24);
  if (fireflyTex) {
    const ctx = fireflyTex.getContext();
    ctx.clearRect(0, 0, 24, 24);
    const grad = ctx.createRadialGradient(12, 12, 1, 12, 12, 11);
    grad.addColorStop(0, 'rgba(254, 249, 195, 1)');
    grad.addColorStop(0.4, 'rgba(190, 242, 100, 0.65)');
    grad.addColorStop(1, 'rgba(163, 230, 53, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    fireflyTex.refresh();
  }
}

function registerStandardAnimations(scene: Phaser.Scene): void {
  const animPairs = [
    { key: 'hero-infant-walk', f0: 'hero_infant_0', f1: 'hero_infant_1', rate: 5 },
    { key: 'hero-child-walk', f0: 'hero_child_0', f1: 'hero_child_1', rate: 6 },
    { key: 'hero-teen-walk', f0: 'hero_teen_0', f1: 'hero_teen_1', rate: 6 },
    { key: 'hero-adult-walk', f0: 'hero_adult_0', f1: 'hero_adult_1', rate: 6 },
    { key: 'hero-elder-walk', f0: 'hero_elder_0', f1: 'hero_elder_1', rate: 4 },
    { key: 'campfire-burn', f0: 'obj_campfire_0', f1: 'obj_campfire_1', rate: 4 },
    { key: 'beast-wolf-walk', f0: 'beast_wolf_0', f1: 'beast_wolf_1', rate: 6 },
  ];

  for (const a of animPairs) {
    if (!scene.anims.exists(a.key) && scene.textures.exists(a.f0) && scene.textures.exists(a.f1)) {
      scene.anims.create({
        key: a.key,
        frames: [{ key: a.f0 }, { key: a.f1 }],
        frameRate: a.rate,
        repeat: -1,
      });
    }
  }
}

export function bakeAllHighResSpriteSheets(scene: Phaser.Scene, initialEra: EraId = 'stone'): void {
  generateAtmosphereAndShadowTextures(scene);

  const starTex = getOrCreateCanvasTexture(scene, 'icon_star', 28, 28);
  if (starTex) {
    const sCtx = starTex.getContext();
    sCtx.clearRect(0, 0, 28, 28);
    sCtx.fillStyle = '#fbbf24';
    sCtx.strokeStyle = '#fef3c7';
    sCtx.lineWidth = 1.5;
    sCtx.beginPath();
    sCtx.moveTo(14, 3);
    sCtx.lineTo(22, 14);
    sCtx.lineTo(14, 25);
    sCtx.lineTo(6, 14);
    sCtx.closePath();
    sCtx.fill();
    sCtx.stroke();
    starTex.refresh();
  }

  // 1. True Alpha .png Buildings Sheet
  processSpriteSheet2x2(scene, 'sheet_buildings', [
    { targetKey: 'base_timber_hut', col: 0, row: 0, outWidth: 220, outHeight: 220 },
    { targetKey: 'base_round_hut', col: 1, row: 0, outWidth: 200, outHeight: 200 },
    { targetKey: 'obj_watchtower', col: 0, row: 1, outWidth: 190, outHeight: 250 },
    { targetKey: 'obj_campfire_0', col: 1, row: 1, outWidth: 150, outHeight: 150, walkBobOffset: 0 },
    { targetKey: 'obj_campfire_1', col: 1, row: 1, outWidth: 150, outHeight: 150, walkBobOffset: -2 },
  ]);

  // 2. True Alpha .png Flora Sheet
  processSpriteSheet2x2(scene, 'sheet_flora', [
    { targetKey: 'obj_lantern_tree', col: 0, row: 0, outWidth: 240, outHeight: 256 },
    { targetKey: 'obj_crimson_canopy', col: 1, row: 0, outWidth: 220, outHeight: 230 },
    { targetKey: 'obj_tree', col: 0, row: 1, outWidth: 220, outHeight: 240 },
    { targetKey: 'obj_bush_full', col: 1, row: 1, outWidth: 148, outHeight: 148 },
    {
      targetKey: 'obj_bush_empty',
      col: 1,
      row: 1,
      outWidth: 148,
      outHeight: 148,
      removeRedBerries: true,
    },
  ]);

  // 3. True Alpha .png Characters Sheet
  processSpriteSheet2x2(scene, 'sheet_characters', [
    { targetKey: 'hero_teen_0', col: 0, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_teen_1', col: 0, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: -4 },
    { targetKey: 'hero_adult_0', col: 1, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_adult_1', col: 1, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: -4 },
    { targetKey: 'hero_elder_0', col: 0, row: 1, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_elder_1', col: 0, row: 1, outWidth: 112, outHeight: 128, walkBobOffset: -3 },
    { targetKey: 'hero_sleep', col: 1, row: 1, outWidth: 136, outHeight: 112 },
  ]);

  // 4. True Alpha .png Phase 3 Sheet
  processSpriteSheet2x2(scene, 'sheet_phase3', [
    { targetKey: 'obj_mountain_rock', col: 0, row: 0, outWidth: 196, outHeight: 196 },
    { targetKey: 'beast_wolf_0', col: 1, row: 0, outWidth: 140, outHeight: 116, walkBobOffset: 0 },
    { targetKey: 'beast_wolf_1', col: 1, row: 0, outWidth: 140, outHeight: 116, walkBobOffset: -4 },
    { targetKey: 'obj_blessing_shrine', col: 0, row: 1, outWidth: 168, outHeight: 184 },
    { targetKey: 'obj_crystal', col: 1, row: 1, outWidth: 164, outHeight: 164 },
  ]);

  // 5. True Alpha .png Kingdom & Early Life Stages Sheet
  processSpriteSheet2x2(scene, 'sheet_kingdom', [
    {
      targetKey: 'hero_infant_0',
      col: 0,
      row: 0,
      outWidth: 96,
      outHeight: 108,
      subCrop: { x0: 0.0, y0: 0.04, x1: 0.47, y1: 0.98 },
      walkBobOffset: 0,
    },
    {
      targetKey: 'hero_infant_1',
      col: 0,
      row: 0,
      outWidth: 96,
      outHeight: 108,
      subCrop: { x0: 0.0, y0: 0.04, x1: 0.47, y1: 0.98 },
      walkBobOffset: -3,
    },
    {
      targetKey: 'hero_child_0',
      col: 0,
      row: 0,
      outWidth: 104,
      outHeight: 118,
      subCrop: { x0: 0.47, y0: 0.02, x1: 0.98, y1: 0.98 },
      walkBobOffset: 0,
    },
    {
      targetKey: 'hero_child_1',
      col: 0,
      row: 0,
      outWidth: 104,
      outHeight: 118,
      subCrop: { x0: 0.47, y0: 0.02, x1: 0.98, y1: 0.98 },
      walkBobOffset: -4,
    },
    { targetKey: 'base_stone_smithy', col: 1, row: 0, outWidth: 230, outHeight: 230 },
    { targetKey: 'obj_farm_plot', col: 0, row: 1, outWidth: 210, outHeight: 190 },
    { targetKey: 'obj_construction_site', col: 1, row: 1, outWidth: 210, outHeight: 210 },
  ]);

  // 6. True Alpha .png Era Evolution Sheet
  processSpriteSheet2x2(scene, 'sheet_eras', [
    { targetKey: 'era_stone_tent', col: 0, row: 0, outWidth: 200, outHeight: 200 },
    { targetKey: 'era_medieval_keep', col: 1, row: 0, outWidth: 220, outHeight: 220 },
    { targetKey: 'era_modern_hall', col: 0, row: 1, outWidth: 225, outHeight: 225 },
    { targetKey: 'era_future_biodome', col: 1, row: 1, outWidth: 225, outHeight: 225 },
  ]);

  applyCozyRealisticEraBuildings(scene, initialEra);
  registerStandardAnimations(scene);
}
