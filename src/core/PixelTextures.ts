import Phaser from 'phaser';

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
  // 1. Smooth Atmospheric Radial Lights & Volumetric Fog Clouds
  createSmoothCanvas(scene, 'light_warm', 256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255, 224, 145, 0.96)');
    grad.addColorStop(0.28, 'rgba(255, 160, 68, 0.58)');
    grad.addColorStop(0.65, 'rgba(215, 95, 35, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'light_cyan', 256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(135, 248, 255, 0.80)');
    grad.addColorStop(0.45, 'rgba(55, 195, 235, 0.36)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'light_magenta', 192, 192, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255, 115, 200, 0.85)');
    grad.addColorStop(0.5, 'rgba(215, 50, 145, 0.34)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  createSmoothCanvas(scene, 'mist_cloud', 320, 192, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 12, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(135, 228, 252, 0.24)');
    grad.addColorStop(0.55, 'rgba(90, 175, 218, 0.11)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });

  // 2. Smooth Thought Bubble & Icons
  createSmoothCanvas(scene, 'thought_bubble', 32, 32, (ctx) => {
    ctx.fillStyle = 'rgba(16, 19, 28, 0.88)';
    ctx.strokeStyle = 'rgba(224, 169, 69, 0.75)';
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

  createSmoothCanvas(scene, 'tile_cursor', 32, 32, (ctx) => {
    ctx.strokeStyle = 'rgba(224, 169, 69, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 26, 26);
  });
}

export function renderHeroPortraitToCanvas(
  canvas: HTMLCanvasElement,
  cloakColor = '#3b7a57',
  isElder = false
): void {
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, 64, 64);

  // Soft warm halo behind portrait
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
  grad.addColorStop(0, 'rgba(224, 169, 69, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  // Cloak & Shoulders
  ctx.fillStyle = cloakColor;
  ctx.beginPath();
  ctx.ellipse(32, 50, 18, 14, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#eecbb0';
  ctx.beginPath();
  ctx.arc(32, 28, 11, 0, Math.PI * 2);
  ctx.fill();

  // Hair / Beard
  ctx.fillStyle = isElder ? '#dce2ec' : '#7d4427';
  ctx.beginPath();
  ctx.arc(32, 24, 11.5, Math.PI, Math.PI * 2);
  ctx.fill();

  if (isElder) {
    ctx.beginPath();
    ctx.ellipse(32, 39, 7, 8, 0, 0, Math.PI);
    ctx.fill();
  }
}
