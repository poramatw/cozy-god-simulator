import Phaser from 'phaser';
import {
  bakeBuildingsForEra,
  bakeCharacterSpritesForEra,
  bakeCoherentWorldAssets,
  EraId,
} from './ProceduralArtEngine';

export function bakeAllHighResSpriteSheets(
  scene: Phaser.Scene,
  era: EraId = 'stone',
  cloakColor = '#3b7a57'
): void {
  bakeCoherentWorldAssets(scene);
  bakeBuildingsForEra(scene, era);
  bakeCharacterSpritesForEra(scene, era, cloakColor);

  // Crisp Shadow Wolf Sprites (2 frames)
  for (const frame of [0, 1]) {
    const key = `beast_wolf_${frame}`;
    let tex: Phaser.Textures.CanvasTexture | null = null;
    if (scene.textures.exists(key)) {
      const existing = scene.textures.get(key);
      if (existing instanceof Phaser.Textures.CanvasTexture) {
        tex = existing;
      } else {
        scene.textures.remove(key);
      }
    }
    if (!tex) {
      tex = scene.textures.createCanvas(key, 96, 80);
    }
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 96, 80);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const cx = 48;
    const by = 64 + (frame === 1 ? -3 : 0);

    // Contact shadow
    ctx.fillStyle = 'rgba(6, 9, 15, 0.42)';
    ctx.beginPath();
    ctx.ellipse(cx, 68, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wolf body & tail
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, by - 18, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Legs
    const stride = frame === 1 ? 4 : -4;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 14 + stride, by - 12, 5, 12);
    ctx.fillRect(cx + 10 - stride, by - 12, 5, 12);

    // Wolf Head & Ears
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx - 18, by - 26, 10, 0, Math.PI * 2);
    ctx.fill();

    // Glowing amber eye
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx - 21, by - 27, 2.2, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }
}
