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
 * Extracts smooth, high-resolution hand-painted 2.5D Cozy Realistic sprites from 2x2 sheets on black backgrounds.
 * Uses border flood-fill and soft luminance feathering so warm candle/lantern halos are preserved
 * without jagged edges, and updates CanvasTextures in-place so WebGL references remain valid.
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

    const pad = 10;
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

    const isDarkBg = (idx: number): boolean => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      return maxC < 46;
    };

    const visited = new Uint8Array(qw * qh);
    const queue = new Int32Array(qw * qh);
    let head = 0;
    let tail = 0;

    const pushIfBg = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= qw || y >= qh) return;
      const pIdx = y * qw + x;
      if (visited[pIdx]) return;
      if (isDarkBg(pIdx * 4)) {
        visited[pIdx] = 1;
        queue[tail++] = pIdx;
      }
    };

    for (let x = 0; x < qw; x++) {
      pushIfBg(x, 0);
      pushIfBg(x, qh - 1);
    }
    for (let y = 0; y < qh; y++) {
      pushIfBg(0, y);
      pushIfBg(qw - 1, y);
    }

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % qw;
      const cy = Math.floor(curr / qw);
      pushIfBg(cx + 1, cy);
      pushIfBg(cx - 1, cy);
      pushIfBg(cx, cy + 1);
      pushIfBg(cx, cy - 1);
    }

    let minX = qw;
    let minY = qh;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < qh; y++) {
      for (let x = 0; x < qw; x++) {
        const pIdx = y * qw + x;
        const dIdx = pIdx * 4;
        const r = data[dIdx];
        const g = data[dIdx + 1];
        const b = data[dIdx + 2];
        const maxC = Math.max(r, g, b);

        if (visited[pIdx]) {
          if (maxC < 16) {
            data[dIdx + 3] = 0;
          } else {
            data[dIdx + 3] = Math.min(255, Math.floor((maxC - 16) * 4.8));
          }
        } else {
          // Soften 1-pixel fringe adjacent to visited background
          const hasBgNeighbor =
            (x > 0 && visited[pIdx - 1]) ||
            (x < qw - 1 && visited[pIdx + 1]) ||
            (y > 0 && visited[pIdx - qw]) ||
            (y < qh - 1 && visited[pIdx + qw]);
          if (hasBgNeighbor && maxC < 75) {
            data[dIdx + 3] = Math.min(255, Math.floor(maxC * 2.8));
          }

          if (spec.removeRedBerries && r > 90 && r > g * 1.3 && r > b * 1.3) {
            data[dIdx] = Math.floor(g * 0.65);
            data[dIdx + 1] = Math.min(255, Math.floor(r * 0.72));
            data[dIdx + 2] = Math.floor(b * 0.75);
          }

          if (data[dIdx + 3] > 18) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
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

    // Smooth radial contact shadow at the base
    const shadowGrad = outCtx.createRadialGradient(
      spec.outWidth / 2,
      spec.outHeight - 10,
      3,
      spec.outWidth / 2,
      spec.outHeight - 10,
      spec.outWidth * 0.36
    );
    shadowGrad.addColorStop(0, 'rgba(3, 5, 10, 0.72)');
    shadowGrad.addColorStop(1, 'rgba(3, 5, 10, 0)');
    outCtx.fillStyle = shadowGrad;
    outCtx.fillRect(0, spec.outHeight - 24, spec.outWidth, 24);

    const scale = Math.min((spec.outWidth - 6) / cropW, (spec.outHeight - 6) / cropH);
    const drawW = Math.round(cropW * scale);
    const drawH = Math.round(cropH * scale);
    const drawX = Math.round((spec.outWidth - drawW) / 2);
    const bob = spec.walkBobOffset ?? 0;
    const drawY = Math.round(spec.outHeight - drawH - 4 + bob);

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
    // Future Bio-Dome Arcology Era
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_round_hut', 200, 200);
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_hut', 220, 220);
    copyTextureToTarget(scene, 'era_future_biodome', 'obj_stone_smithy', 230, 230);
  }
}

export function bakeAllHighResSpriteSheets(scene: Phaser.Scene, initialEra: EraId = 'stone'): void {
  // Ensure icon_star exists so seek_blessing never shows a missing texture placeholder
  const starTex = getOrCreateCanvasTexture(scene, 'icon_star', 28, 28);
  if (starTex) {
    const sCtx = starTex.getContext();
    sCtx.clearRect(0, 0, 28, 28);
    sCtx.fillStyle = '#38bdf8';
    sCtx.strokeStyle = '#e0f2fe';
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

  // 1. Smooth Painterly Buildings Sheet (Base Cozy Realistic Structures)
  processSpriteSheet2x2(scene, 'sheet_buildings', [
    { targetKey: 'base_timber_hut', col: 0, row: 0, outWidth: 220, outHeight: 220 },
    { targetKey: 'base_round_hut', col: 1, row: 0, outWidth: 200, outHeight: 200 },
    { targetKey: 'obj_watchtower', col: 0, row: 1, outWidth: 190, outHeight: 250 },
    { targetKey: 'obj_campfire_0', col: 1, row: 1, outWidth: 150, outHeight: 150, walkBobOffset: 0 },
    { targetKey: 'obj_campfire_1', col: 1, row: 1, outWidth: 150, outHeight: 150, walkBobOffset: -2 },
  ]);

  // 2. Smooth Painterly Flora Sheet (Cozy Realistic Trees & Bushes)
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

  // 3. Smooth Painterly Characters Sheet (Teen, Adult, Elder, Sleep)
  processSpriteSheet2x2(scene, 'sheet_characters', [
    { targetKey: 'hero_teen_0', col: 0, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_teen_1', col: 0, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: -4 },
    { targetKey: 'hero_adult_0', col: 1, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_adult_1', col: 1, row: 0, outWidth: 112, outHeight: 128, walkBobOffset: -4 },
    { targetKey: 'hero_elder_0', col: 0, row: 1, outWidth: 112, outHeight: 128, walkBobOffset: 0 },
    { targetKey: 'hero_elder_1', col: 0, row: 1, outWidth: 112, outHeight: 128, walkBobOffset: -3 },
    { targetKey: 'hero_sleep', col: 1, row: 1, outWidth: 136, outHeight: 112 },
  ]);

  // 4. Smooth Painterly Phase 3 Sheet (Mountain Rock, Shadow Wolf, Blessing Shrine, Crystal & Cyan Ferns)
  processSpriteSheet2x2(scene, 'sheet_phase3', [
    { targetKey: 'obj_mountain_rock', col: 0, row: 0, outWidth: 196, outHeight: 196 },
    { targetKey: 'beast_wolf_0', col: 1, row: 0, outWidth: 140, outHeight: 116, walkBobOffset: 0 },
    { targetKey: 'beast_wolf_1', col: 1, row: 0, outWidth: 140, outHeight: 116, walkBobOffset: -4 },
    { targetKey: 'obj_blessing_shrine', col: 0, row: 1, outWidth: 168, outHeight: 184 },
    { targetKey: 'obj_crystal', col: 1, row: 1, outWidth: 164, outHeight: 164 },
  ]);

  // 5. Smooth Painterly Phase 4 Kingdom & Early Life Stages Sheet
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

  // 6. Smooth Painterly Era Evolution Sheet (Stone Age Tent, Medieval Keep, Modern Hall, Future Bio-Dome)
  processSpriteSheet2x2(scene, 'sheet_eras', [
    { targetKey: 'era_stone_tent', col: 0, row: 0, outWidth: 200, outHeight: 200 },
    { targetKey: 'era_medieval_keep', col: 1, row: 0, outWidth: 220, outHeight: 220 },
    { targetKey: 'era_modern_hall', col: 0, row: 1, outWidth: 225, outHeight: 225 },
    { targetKey: 'era_future_biodome', col: 1, row: 1, outWidth: 225, outHeight: 225 },
  ]);

  applyCozyRealisticEraBuildings(scene, initialEra);
}
