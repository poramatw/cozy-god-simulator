import Phaser from 'phaser';
import { LifeStageId } from './Types';

function createSmoothCanvas(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, w, h);
  drawFn(ctx, w, h);
  tex.refresh();
}

export function generateAllPixelTextures(scene: Phaser.Scene): void {
  // 1. Crisp, Tighter Atmospheric Radial Lights (Toned down to eliminate haze/blur)
  createSmoothCanvas(scene, 'light_warm', 192, 192, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255, 215, 130, 0.72)');
    grad.addColorStop(0.32, 'rgba(245, 148, 56, 0.34)');
    grad.addColorStop(0.65, 'rgba(195, 85, 28, 0.10)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'light_cyan', 192, 192, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(135, 240, 255, 0.58)');
    grad.addColorStop(0.4, 'rgba(55, 185, 225, 0.20)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'light_magenta', 160, 160, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255, 115, 200, 0.60)');
    grad.addColorStop(0.45, 'rgba(215, 50, 145, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'mist_cloud', 280, 160, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(135, 228, 252, 0.12)');
    grad.addColorStop(0.55, 'rgba(90, 175, 218, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  // 2. Smooth Thought Bubble & Action/Tool Icons
  createSmoothCanvas(scene, 'thought_bubble', 32, 32, (ctx) => {
    ctx.fillStyle = 'rgba(16, 19, 28, 0.92)';
    ctx.strokeStyle = 'rgba(224, 169, 69, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(16, 13, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0a945';
    ctx.beginPath();
    ctx.arc(16, 26, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  createSmoothCanvas(scene, 'icon_berry', 24, 24, (ctx) => {
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(9, 14, 4, 0, Math.PI * 2);
    ctx.arc(15, 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.ellipse(12, 8, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  createSmoothCanvas(scene, 'icon_zzz', 24, 24, (ctx) => {
    ctx.strokeStyle = '#8ef6ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(7, 8);
    ctx.lineTo(17, 8);
    ctx.lineTo(7, 16);
    ctx.lineTo(17, 16);
    ctx.stroke();
  });

  createSmoothCanvas(scene, 'icon_fire', 24, 24, (ctx) => {
    const grad = ctx.createRadialGradient(12, 14, 1, 12, 13, 7);
    grad.addColorStop(0, '#fff3a1');
    grad.addColorStop(0.5, '#ff9e2c');
    grad.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(12, 13, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  createSmoothCanvas(scene, 'icon_compass', 24, 24, (ctx) => {
    ctx.fillStyle = '#e0a945';
    ctx.beginPath();
    ctx.arc(12, 12, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#121521';
    ctx.beginPath();
    ctx.arc(12, 12, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Swinging Hammer Icon for Construction Animation
  createSmoothCanvas(scene, 'icon_hammer', 28, 28, (ctx) => {
    ctx.save();
    ctx.translate(14, 14);
    ctx.rotate(-0.35);
    // Wooden handle
    ctx.fillStyle = '#a86b32';
    ctx.fillRect(-2, -2, 4, 14);
    // Iron hammerhead
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-8, -9, 16, 7);
    ctx.strokeRect(-8, -9, 16, 7);
    ctx.restore();
  });

  // Swinging Axe/Pickaxe Icon for Gathering Animation
  createSmoothCanvas(scene, 'icon_axe', 28, 28, (ctx) => {
    ctx.save();
    ctx.translate(14, 14);
    ctx.rotate(0.25);
    // Wooden handle
    ctx.fillStyle = '#9c622b';
    ctx.fillRect(-2, -4, 4, 15);
    // Steel blade
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(10, -10, 9, 1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  createSmoothCanvas(scene, 'tile_cursor', 32, 32, (ctx) => {
    ctx.strokeStyle = 'rgba(224, 169, 69, 0.92)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 26, 26);
  });
}

/**
 * Renders the character portrait on the HUD canvas using the exact life-stage sprite
 * from Phaser's baked texture cache so the portrait matches the character's age on the map.
 */
export function renderHeroPortraitToCanvas(
  canvas: HTMLCanvasElement,
  cloakColor = '#3b7a57',
  lifeStageId: LifeStageId = 'adult',
  scene?: Phaser.Scene
): void {
  canvas.width = 72;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, 72, 72);

  // Subtle background glow matching cloak color
  const grad = ctx.createRadialGradient(36, 38, 4, 36, 38, 32);
  grad.addColorStop(0, `${cloakColor}66`);
  grad.addColorStop(0.7, 'rgba(224, 169, 69, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 72, 72);

  const stageKeyMap: Record<LifeStageId, string> = {
    infant: 'hero_infant_0',
    child: 'hero_child_0',
    teen: 'hero_teen_0',
    adult: 'hero_adult_0',
    elder: 'hero_elder_0',
  };
  const texKey = stageKeyMap[lifeStageId] ?? 'hero_adult_0';

  if (scene && scene.textures.exists(texKey)) {
    const tex = scene.textures.get(texKey);
    const src = tex.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    if (src && src.width > 0 && src.height > 0) {
      const scale = Math.min(64 / src.width, 66 / src.height);
      const dw = src.width * scale;
      const dh = src.height * scale;
      const dx = (72 - dw) / 2;
      const dy = (72 - dh) / 2 + 2;
      ctx.drawImage(src, dx, dy, dw, dh);
      return;
    }
  }

  // Fallback portrait if scene texture isn't ready yet (e.g., pre-game modal)
  ctx.fillStyle = cloakColor;
  ctx.beginPath();
  ctx.ellipse(36, 56, 18, 14, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#eecbb0';
  ctx.beginPath();
  ctx.arc(36, 32, lifeStageId === 'infant' ? 8 : lifeStageId === 'child' ? 9.5 : 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = lifeStageId === 'elder' ? '#dce2ec' : '#7d4427';
  ctx.beginPath();
  ctx.arc(36, 28, 11.5, Math.PI, Math.PI * 2);
  ctx.fill();
}
