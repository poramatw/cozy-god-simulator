import Phaser from 'phaser';
import { createNoise2D } from 'simplex-noise';
import {
  BiomeConfig,
  ResourceType,
  TileData,
  WeatherConfig,
  WildBeast,
  WorldConfig,
  WorldResource,
} from '../core/Types';

function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface MistParticle {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
}

interface FireflyMote {
  sprite: Phaser.GameObjects.Arc;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
}

interface WeatherDrop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

export class IslandWorld {
  private scene: Phaser.Scene;
  private config: WorldConfig;
  private seed: number;
  private grid: TileData[][] = [];
  private resources: WorldResource[] = [];
  private beasts: WildBeast[] = [];
  private worldContainer: Phaser.GameObjects.Container;
  private lightContainer: Phaser.GameObjects.Container;
  private mistContainer: Phaser.GameObjects.Container;
  private weatherGraphics: Phaser.GameObjects.Graphics;
  private fxGraphics: Phaser.GameObjects.Graphics;

  private mistParticles: MistParticle[] = [];
  private fireflies: FireflyMote[] = [];
  private weatherDrops: WeatherDrop[] = [];
  private activeWeather!: WeatherConfig;

  private campfireRes: WorldResource | null = null;
  private seeThrough = false;
  private animClock = 0;
  private fireFrame = 0;
  private fireTimer = 0;

  constructor(
    scene: Phaser.Scene,
    config: WorldConfig,
    initialWeather: WeatherConfig,
    seed = Math.floor(Math.random() * 900000) + 100000
  ) {
    this.scene = scene;
    this.config = config;
    this.activeWeather = initialWeather;
    this.seed = seed;

    this.worldContainer = this.scene.add.container(0, 0);
    this.lightContainer = this.scene.add.container(0, 0);
    this.lightContainer.setDepth(3200);
    this.mistContainer = this.scene.add.container(0, 0);
    this.mistContainer.setDepth(3300);

    this.weatherGraphics = this.scene.add.graphics();
    this.weatherGraphics.setDepth(3350);

    this.fxGraphics = this.scene.add.graphics();
    this.fxGraphics.setDepth(3450);

    this.initWeatherDrops();
    this.generate(this.seed);
  }

  public getWorldContainer(): Phaser.GameObjects.Container {
    return this.worldContainer;
  }

  private initWeatherDrops(): void {
    const widthPx = this.config.mapWidth * this.config.tileSize;
    const heightPx = this.config.mapHeight * this.config.tileSize;
    this.weatherDrops = [];
    for (let i = 0; i < 200; i++) {
      this.weatherDrops.push({
        x: Math.random() * widthPx,
        y: Math.random() * heightPx,
        speed: 140 + Math.random() * 110,
        len: 8 + Math.random() * 8,
      });
    }
  }

  public setWeather(weather: WeatherConfig): void {
    this.activeWeather = weather;
  }

  public getWeather(): WeatherConfig {
    return this.activeWeather;
  }

  public getSeed(): number {
    return this.seed;
  }

  public getConfig(): WorldConfig {
    return this.config;
  }

  public isSeeThrough(): boolean {
    return this.seeThrough;
  }

  public setSeeThrough(enabled: boolean): void {
    this.seeThrough = enabled;
    const targetAlpha = enabled ? 0.38 : 1.0;
    for (const res of this.resources) {
      if (res.canSeeThrough && res.sprite) {
        this.scene.tweens.add({
          targets: res.sprite,
          alpha: targetAlpha,
          duration: 240,
          ease: 'Sine.easeOut',
        });
      }
    }
  }

  public regenerate(newSeed = Math.floor(Math.random() * 900000) + 100000): void {
    this.seed = newSeed;
    this.worldContainer.removeAll(true);
    this.lightContainer.removeAll(true);
    this.mistContainer.removeAll(true);
    this.mistParticles = [];
    this.fireflies = [];
    this.beasts = [];
    this.grid = [];
    this.resources = [];
    this.campfireRes = null;
    this.generate(this.seed);
  }

  private generate(seed: number): void {
    const rng = createSeededRandom(seed);
    const noiseMain = createNoise2D(createSeededRandom(seed + 101));
    const noiseDetail = createNoise2D(createSeededRandom(seed + 202));
    const noiseRiver = createNoise2D(createSeededRandom(seed + 303));

    const { mapWidth, mapHeight, noiseScale, detailScale } = this.config;
    const centerX = Math.floor(mapWidth / 2);
    const centerY = Math.floor(mapHeight / 2);
    const maxRadius = Math.min(centerX, centerY) * 0.94;

    for (let y = 0; y < mapHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        const dx = (x - centerX) / maxRadius;
        const dy = (y - centerY) / maxRadius;
        const distNorm = Math.sqrt(dx * dx + dy * dy);
        const distTiles = Math.hypot(x - centerX, y - centerY);

        const falloff = Math.max(0, 1 - Math.pow(distNorm, 2.25));
        const n1 = (noiseMain(x * noiseScale, y * noiseScale) + 1) * 0.5;
        const n2 = (noiseDetail(x * detailScale, y * detailScale) + 1) * 0.5;
        let elevation = Phaser.Math.Clamp((n1 * 0.78 + n2 * 0.22) * falloff * 1.26, 0, 1);

        const riverVal = Math.abs(noiseRiver(x * 0.042, y * 0.042));
        if (riverVal < 0.056 && distTiles > 11 && elevation > 0.24) {
          elevation = 0.30;
        }

        // Central sanctuary plateau
        if (distTiles <= 12) {
          elevation = Math.max(elevation, 0.56);
        }

        const biome = this.pickBiome(elevation);
        const angle = Math.atan2(y - centerY, x - centerX);
        const pathWave = Math.sin(angle * 4 + n2 * 1.4);
        const isPath =
          biome.walkable &&
          biome.id !== 'shallow_water' &&
          (distTiles < 8.5 || (distTiles < 28 && pathWave > 0.80));

        this.grid[y][x] = {
          x,
          y,
          elevation,
          biome,
          isPath,
        };
      }
    }

    // 2. Paint Crisp, Rich Painterly Terrain Canvas (No blurry haze!)
    this.paintSmoothPainterlyTerrain(seed, noiseDetail);

    // 3. Central Village Sanctuary (Starts with Campfire + 1 Starter Hut so Kingdom grows organically!)
    this.campfireRes = this.spawnResource('campfire', centerX, centerY, false);

    const starterStructures: { type: ResourceType; ox: number; oy: number }[] = [
      { type: 'round_hut', ox: -4, oy: -3 },
      { type: 'lantern_tree', ox: -7, oy: 5 },
      { type: 'lantern_tree', ox: 7, oy: -5 },
      { type: 'crimson_canopy', ox: 8, oy: 5 },
      { type: 'crystal', ox: -6, oy: 6 },
    ];

    for (const st of starterStructures) {
      const tx = centerX + st.ox;
      const ty = centerY + st.oy;
      const t = this.getTile(tx, ty);
      if (t && t.biome.walkable && !t.resource) {
        this.spawnResource(st.type, tx, ty, false);
      }
    }

    // 4. Spawn Lush Painterly Flora & Stone Deposits across the 128x128 Open World
    for (let y = 3; y < mapHeight - 3; y++) {
      for (let x = 3; x < mapWidth - 3; x++) {
        const tile = this.grid[y][x];
        const distCenter = Math.hypot(x - centerX, y - centerY);
        // Leave room around center (radius 10) for Kingdom Building Construction!
        if (!tile.biome.walkable || tile.resource || distCenter < 10.5) continue;
        if (tile.isPath || tile.biome.id === 'shallow_water') continue;

        const roll = rng();
        if (roll < tile.biome.berryChance * 0.72) {
          this.spawnResource('berry_bush', x, y, true);
        } else if (tile.elevation > 0.66 && roll < 0.045) {
          this.spawnResource('mountain_rock', x, y, false);
        } else if (roll < (tile.biome.berryChance + tile.biome.treeChance) * 0.62) {
          const floraRoll = rng();
          if (floraRoll < 0.18) {
            this.spawnResource('lantern_tree', x, y, false);
          } else if (floraRoll < 0.34) {
            this.spawnResource('crimson_canopy', x, y, false);
          } else if (floraRoll < 0.41) {
            this.spawnResource('crystal', x, y, false);
          } else {
            this.spawnResource('tree', x, y, false);
          }
        }
      }
    }

    this.ensureMinimumResources(rng, 28, 32);
    this.spawnVolumetricMistAndFireflies(rng);
  }

  private paintSmoothPainterlyTerrain(
    seed: number,
    noiseDetail: (x: number, y: number) => number
  ): void {
    const { mapWidth, mapHeight, tileSize } = this.config;
    const widthPx = mapWidth * tileSize;
    const heightPx = mapHeight * tileSize;
    const texKey = 'world_seamless_terrain';

    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey);
    }

    // Higher-definition base terrain grid (8x per tile) for crisp biome transitions without blurry haze
    const subRes = 6;
    const lowW = mapWidth * subRes;
    const lowH = mapHeight * subRes;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = lowW;
    offCanvas.height = lowH;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(lowW, lowH);
    const data = imgData.data;

    for (let ly = 0; ly < lowH; ly++) {
      const ty = Math.min(mapHeight - 1, Math.floor(ly / subRes));
      for (let lx = 0; lx < lowW; lx++) {
        const tx = Math.min(mapWidth - 1, Math.floor(lx / subRes));
        const tile = this.grid[ty][tx];
        const n = noiseDetail(lx * 0.06, ly * 0.06); // -1..1
        const micro = noiseDetail(lx * 0.25, ly * 0.25) * 4;

        let r = 10;
        let g = 18;
        let b = 30;

        if (tile.biome.id === 'deep_water') {
          r = 8 + n * 4;
          g = 16 + n * 6;
          b = 29 + n * 9;
        } else if (tile.biome.id === 'shallow_water') {
          // Crisp deep-teal stream
          r = 22 + n * 10;
          g = 112 + n * 22;
          b = 142 + n * 24;
        } else if (tile.isPath) {
          // Crisp warm cobblestone / packed village earth
          r = 74 + n * 11 + micro;
          g = 62 + n * 9 + micro;
          b = 50 + n * 7 + micro;
        } else if (tile.biome.id === 'sand') {
          r = 68 + n * 9 + micro;
          g = 60 + n * 8 + micro;
          b = 49 + n * 6 + micro;
        } else if (tile.biome.id === 'grass') {
          r = 34 + n * 9 + micro;
          g = 52 + n * 12 + micro;
          b = 36 + n * 7 + micro;
        } else {
          // Deep crisp woodland moss
          r = 21 + n * 7 + micro;
          g = 36 + n * 10 + micro;
          b = 28 + n * 7 + micro;
        }

        const idx = (ly * lowW + lx) * 4;
        data[idx] = Phaser.Math.Clamp(Math.round(r), 0, 255);
        data[idx + 1] = Phaser.Math.Clamp(Math.round(g), 0, 255);
        data[idx + 2] = Phaser.Math.Clamp(Math.round(b), 0, 255);
        data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(imgData, 0, 0);

    const canvasTex = this.scene.textures.createCanvas(texKey, widthPx, heightPx);
    if (!canvasTex) return;
    const ctx = canvasTex.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offCanvas, 0, 0, lowW, lowH, 0, 0, widthPx, heightPx);

    // Paint crisp high-resolution ground details (sharp grass blades, cobble stones, water ripples)
    const rng = createSeededRandom(seed + 999);
    for (let i = 0; i < 6500; i++) {
      const px = rng() * widthPx;
      const py = rng() * heightPx;
      const tx = Math.floor(px / tileSize);
      const ty = Math.floor(py / tileSize);
      const tile = this.getTile(tx, ty);
      if (!tile || !tile.biome.walkable) continue;

      if (tile.biome.id === 'shallow_water') {
        ctx.strokeStyle = 'rgba(135, 240, 255, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, 3 + rng() * 5, 0, Math.PI);
        ctx.stroke();
      } else if (tile.isPath) {
        ctx.fillStyle = rng() < 0.5 ? 'rgba(105, 90, 74, 0.42)' : 'rgba(52, 44, 36, 0.38)';
        ctx.beginPath();
        ctx.ellipse(px, py, 3.5 + rng() * 4, 2 + rng() * 2.5, rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = rng() < 0.55 ? 'rgba(78, 112, 72, 0.52)' : 'rgba(24, 42, 30, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px - 1.5, py - 4, px + (rng() - 0.5) * 4, py - 7.5);
        ctx.stroke();
      }
    }

    canvasTex.refresh();
    const existing = this.worldContainer.getByName('terrain_base') as Phaser.GameObjects.Image | null;
    if (existing) {
      existing.setTexture(texKey);
      existing.setPosition(widthPx / 2, heightPx / 2);
    } else {
      const terrainImg = this.scene.add.image(widthPx / 2, heightPx / 2, texKey);
      terrainImg.setName('terrain_base');
      terrainImg.setDepth(0);
      this.worldContainer.add(terrainImg);
    }
  }

  private spawnVolumetricMistAndFireflies(rng: () => number): void {
    const { mapWidth, mapHeight, tileSize } = this.config;
    const widthPx = mapWidth * tileSize;
    const heightPx = mapHeight * tileSize;

    // Subtle, non-hazy atmospheric mist (low count and very low alpha so colors stay crisp!)
    for (let i = 0; i < 14; i++) {
      const mx = rng() * widthPx;
      const my = rng() * heightPx;
      const mist = this.scene.add.image(mx, my, 'mist_cloud');
      mist.setBlendMode(Phaser.BlendModes.SCREEN);
      const baseAlpha = 0.05 + rng() * 0.05;
      mist.setAlpha(baseAlpha);
      mist.setScale(0.7 + rng() * 0.6);
      this.mistContainer.add(mist);

      this.mistParticles.push({
        sprite: mist,
        vx: 3.0 + rng() * 4.5,
        vy: (rng() - 0.5) * 1.4,
        baseAlpha,
        phase: rng() * Math.PI * 2,
      });
    }

    // Crisp firefly motes
    for (let i = 0; i < 85; i++) {
      const fx = 160 + rng() * (widthPx - 320);
      const fy = 160 + rng() * (heightPx - 320);
      const isWarm = rng() < 0.6;
      const mote = this.scene.add.circle(
        fx,
        fy,
        1.5,
        isWarm ? 0xffd166 : 0x8ef6ff,
        0.75
      );
      mote.setBlendMode(Phaser.BlendModes.ADD);
      this.mistContainer.add(mote);

      this.fireflies.push({
        sprite: mote,
        baseX: fx,
        baseY: fy,
        phase: rng() * Math.PI * 2,
        speed: 1.2 + rng() * 1.8,
      });
    }
  }

  private ensureMinimumResources(rng: () => number, minBerries: number, minTrees: number): void {
    const grassTiles: TileData[] = [];
    for (let y = 4; y < this.config.mapHeight - 4; y++) {
      for (let x = 4; x < this.config.mapWidth - 4; x++) {
        const t = this.grid[y][x];
        if ((t.biome.id === 'grass' || t.biome.id === 'forest') && !t.resource && !t.isPath) {
          grassTiles.push(t);
        }
      }
    }
    if (grassTiles.length === 0) return;

    let berryCount = this.resources.filter((r) => r.type === 'berry_bush').length;
    while (berryCount < minBerries && grassTiles.length > 0) {
      const idx = Math.floor(rng() * grassTiles.length);
      const tile = grassTiles.splice(idx, 1)[0];
      this.spawnResource('berry_bush', tile.x, tile.y, true);
      berryCount++;
    }

    let treeCount = this.resources.filter(
      (r) => r.type === 'tree' || r.type === 'lantern_tree'
    ).length;
    while (treeCount < minTrees && grassTiles.length > 0) {
      const idx = Math.floor(rng() * grassTiles.length);
      const tile = grassTiles.splice(idx, 1)[0];
      this.spawnResource('lantern_tree', tile.x, tile.y, false);
      treeCount++;
    }
  }

  public spawnResource(
    type: ResourceType,
    tileX: number,
    tileY: number,
    hasBerry: boolean
  ): WorldResource {
    const existing = this.grid[tileY]?.[tileX]?.resource;
    if (existing) {
      this.removeResource(existing);
    }

    const { tileSize } = this.config;
    const px = tileX * tileSize + tileSize / 2;
    const py = tileY * tileSize + tileSize / 2;

    let texKey = 'obj_tree';
    let canSeeThrough = false;
    let blocksMovement = false;
    let dispW = 64;
    let dispH = 72;

    switch (type) {
      case 'campfire':
        texKey = 'obj_campfire_0';
        dispW = 44;
        dispH = 44;
        break;
      case 'lantern_tree':
        texKey = 'obj_lantern_tree';
        canSeeThrough = true;
        dispW = 76;
        dispH = 84;
        break;
      case 'tree':
        texKey = 'obj_tree';
        canSeeThrough = true;
        dispW = 70;
        dispH = 78;
        break;
      case 'crimson_canopy':
        texKey = 'obj_crimson_canopy';
        canSeeThrough = true;
        dispW = 68;
        dispH = 72;
        break;
      case 'hut':
        texKey = 'obj_hut';
        canSeeThrough = true;
        dispW = 82;
        dispH = 82;
        break;
      case 'round_hut':
        texKey = 'obj_round_hut';
        canSeeThrough = true;
        dispW = 70;
        dispH = 70;
        break;
      case 'watchtower':
        texKey = 'obj_watchtower';
        canSeeThrough = true;
        dispW = 64;
        dispH = 88;
        break;
      case 'farm_plot':
        texKey = 'obj_farm_plot';
        dispW = 68;
        dispH = 60;
        break;
      case 'stone_smithy':
        texKey = 'obj_stone_smithy';
        canSeeThrough = true;
        dispW = 86;
        dispH = 86;
        break;
      case 'construction_site':
        texKey = 'obj_construction_site';
        dispW = 72;
        dispH = 72;
        break;
      case 'crystal':
        texKey = 'obj_crystal';
        dispW = 42;
        dispH = 42;
        break;
      case 'berry_bush':
        texKey = hasBerry ? 'obj_bush_full' : 'obj_bush_empty';
        dispW = 36;
        dispH = 36;
        break;
      case 'mountain_rock':
        texKey = 'obj_mountain_rock';
        blocksMovement = true;
        dispW = 48;
        dispH = 48;
        break;
      case 'blessing_shrine':
        texKey = 'obj_blessing_shrine';
        dispW = 44;
        dispH = 50;
        break;
    }

    const sprite = this.scene.add.sprite(px, py, texKey);
    sprite.setDisplaySize(dispW, dispH);
    if (canSeeThrough) {
      sprite.setOrigin(0.5, 0.84);
      if (this.seeThrough) sprite.setAlpha(0.38);
    } else {
      sprite.setOrigin(0.5, 0.72);
    }
    sprite.setDepth(py);
    this.worldContainer.add(sprite);

    // Subtle, focused local light halos (toned down so there is zero screen haze!)
    let glowSprite: Phaser.GameObjects.Image | undefined;
    if (type === 'campfire') {
      glowSprite = this.scene.add.image(px, py, 'light_warm');
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);
      glowSprite.setScale(0.75);
      glowSprite.setAlpha(0.36);
      this.lightContainer.add(glowSprite);
    } else if (
      type === 'lantern_tree' ||
      type === 'hut' ||
      type === 'round_hut' ||
      type === 'watchtower' ||
      type === 'stone_smithy'
    ) {
      glowSprite = this.scene.add.image(px, py - 8, 'light_warm');
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);
      glowSprite.setScale(type === 'lantern_tree' ? 0.45 : 0.40);
      glowSprite.setAlpha(0.24);
      this.lightContainer.add(glowSprite);
    } else if (type === 'crystal') {
      glowSprite = this.scene.add.image(px, py - 4, 'light_magenta');
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);
      glowSprite.setScale(0.38);
      glowSprite.setAlpha(0.28);
      this.lightContainer.add(glowSprite);
    } else if (type === 'blessing_shrine') {
      glowSprite = this.scene.add.image(px, py - 6, 'light_cyan');
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);
      glowSprite.setScale(0.48);
      glowSprite.setAlpha(0.34);
      this.lightContainer.add(glowSprite);
    }

    const res: WorldResource = {
      id: `${type}_${tileX}_${tileY}_${Date.now()}`,
      type,
      tileX,
      tileY,
      hasBerry: type === 'farm_plot' ? true : hasBerry,
      regrowTimer: 0,
      blocksMovement,
      sprite,
      glowSprite,
      canSeeThrough,
    };

    this.grid[tileY][tileX].resource = res;
    this.resources.push(res);
    return res;
  }

  public removeResource(res: WorldResource): void {
    res.sprite?.destroy();
    res.glowSprite?.destroy();
    const tile = this.getTile(res.tileX, res.tileY);
    if (tile && tile.resource === res) {
      tile.resource = undefined;
    }
    this.resources = this.resources.filter((r) => r !== res);
  }

  /**
   * Emits animated wood chips, stone sparks, or golden construction sparks at a world position.
   */
  public spawnWorkParticles(
    worldX: number,
    worldY: number,
    kind: 'wood' | 'stone' | 'build'
  ): void {
    const color =
      kind === 'wood' ? 0xd99b52 : kind === 'stone' ? 0x94a3b8 : 0xffd166;
    const count = kind === 'build' ? 5 : 4;

    for (let i = 0; i < count; i++) {
      const p = this.scene.add.circle(
        worldX + (Math.random() - 0.5) * 14,
        worldY - 8 + (Math.random() - 0.5) * 8,
        kind === 'build' ? 2.4 : 2.0,
        color,
        0.95
      );
      p.setDepth(worldY + 40);
      this.worldContainer.add(p);

      const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const dist = 10 + Math.random() * 16;
      this.scene.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * dist,
        y: p.y + Math.sin(angle) * dist - 6,
        alpha: 0,
        scale: 0.2,
        duration: 380 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  // --- Phase 3: God's Hand Powers ---

  public spawnGodMountain(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile || tile.resource?.type === 'campfire') return false;
    const res = this.spawnResource('mountain_rock', tileX, tileY, false);
    if (res.sprite) {
      this.scene.tweens.add({
        targets: res.sprite,
        y: { from: res.sprite.y - 24, to: res.sprite.y },
        duration: 240,
        ease: 'Bounce.easeOut',
      });
    }
    this.scene.cameras.main.shake(110, 0.003);
    return true;
  }

  public terraformRiverTile(tileX: number, tileY: number): boolean {
    const tile = this.getTile(tileX, tileY);
    if (!tile || tile.resource?.type === 'campfire') return false;
    if (tile.resource) {
      this.removeResource(tile.resource);
    }
    const shallowBiome = this.config.biomes.find((b) => b.id === 'shallow_water');
    if (!shallowBiome) return false;

    tile.biome = shallowBiome;
    tile.elevation = 0.30;
    tile.isPath = false;

    const { tileSize } = this.config;
    const px = tileX * tileSize + tileSize / 2;
    const py = tileY * tileSize + tileSize / 2;

    const streamPatch = this.scene.add.circle(px, py, tileSize * 0.72, 0x2b8da3, 0.85);
    streamPatch.setDepth(1);
    this.worldContainer.add(streamPatch);
    return true;
  }

  public spawnWildBeast(tileX: number, tileY: number): WildBeast | null {
    const tile = this.getTile(tileX, tileY);
    if (!tile || !tile.biome.walkable) return null;

    const { tileSize } = this.config;
    const px = tileX * tileSize + tileSize / 2;
    const py = tileY * tileSize + tileSize / 2;

    const sprite = this.scene.add.sprite(px, py, 'beast_wolf_0');
    sprite.setDisplaySize(38, 32);
    sprite.setOrigin(0.5, 0.75);
    sprite.setDepth(py + 2);
    this.worldContainer.add(sprite);

    const beast: WildBeast = {
      id: `wolf_${Date.now()}_${Math.random()}`,
      tileX,
      tileY,
      x: px,
      y: py,
      targetX: px,
      targetY: py,
      hp: 100,
      sprite,
      animTimer: 0,
      animFrame: 0,
    };
    this.beasts.push(beast);
    return beast;
  }

  public strikeLightningAt(tileX: number, tileY: number): {
    destroyedCount: number;
    slainBeasts: number;
  } {
    const { tileSize } = this.config;
    const px = tileX * tileSize + tileSize / 2;
    const py = tileY * tileSize + tileSize / 2;

    this.fxGraphics.clear();
    this.fxGraphics.lineStyle(3.5, 0xffffff, 1);
    this.fxGraphics.beginPath();
    let currX = px + (Math.random() - 0.5) * 40;
    let currY = py - 260;
    this.fxGraphics.moveTo(currX, currY);
    const segments = 8;
    for (let i = 1; i <= segments; i++) {
      currX =
        Phaser.Math.Linear(currX, px, i / segments) +
        (i < segments ? (Math.random() - 0.5) * 22 : 0);
      currY = Phaser.Math.Linear(py - 260, py, i / segments);
      this.fxGraphics.lineTo(currX, currY);
    }
    this.fxGraphics.strokePath();

    this.fxGraphics.fillStyle(0x8ef6ff, 0.55);
    this.fxGraphics.fillCircle(px, py, 24);

    this.scene.time.delayedCall(180, () => {
      this.fxGraphics.clear();
    });

    this.scene.cameras.main.shake(220, 0.008);

    let destroyedCount = 0;
    const toRemove = this.resources.filter(
      (r) =>
        r.type !== 'campfire' &&
        Math.hypot(r.tileX - tileX, r.tileY - tileY) <= 2.2
    );
    for (const r of toRemove) {
      this.removeResource(r);
      destroyedCount++;
    }

    let slainBeasts = 0;
    this.beasts = this.beasts.filter((b) => {
      if (Math.hypot(b.tileX - tileX, b.tileY - tileY) <= 2.8) {
        b.sprite.destroy();
        slainBeasts++;
        return false;
      }
      return true;
    });

    return { destroyedCount, slainBeasts };
  }

  public getBeasts(): WildBeast[] {
    return this.beasts;
  }

  public removeBeast(beast: WildBeast): void {
    beast.sprite.destroy();
    this.beasts = this.beasts.filter((b) => b !== beast);
  }

  private pickBiome(elevation: number): BiomeConfig {
    for (const b of this.config.biomes) {
      if (elevation <= b.maxElevation) {
        return b;
      }
    }
    return this.config.biomes[this.config.biomes.length - 1];
  }

  public update(simDeltaSec: number, rawDeltaMs: number): void {
    const dtRaw = rawDeltaMs / 1000;
    this.animClock += dtRaw;

    this.fireTimer += rawDeltaMs;
    if (this.fireTimer >= 220) {
      this.fireTimer = 0;
      this.fireFrame = this.fireFrame === 0 ? 1 : 0;
      if (this.campfireRes?.sprite) {
        this.campfireRes.sprite.setTexture(`obj_campfire_${this.fireFrame}`);
        this.campfireRes.sprite.setDisplaySize(44, 44);
      }
      if (this.campfireRes?.glowSprite) {
        const pulse = 0.72 + Math.sin(this.animClock * 6) * 0.06;
        this.campfireRes.glowSprite.setScale(pulse);
      }
    }

    const widthPx = this.config.mapWidth * this.config.tileSize;
    const heightPx = this.config.mapHeight * this.config.tileSize;
    for (const m of this.mistParticles) {
      m.sprite.x += m.vx * dtRaw;
      m.sprite.y += m.vy * dtRaw;
      if (m.sprite.x > widthPx + 80) m.sprite.x = -80;
      if (m.sprite.y > heightPx + 80) m.sprite.y = -80;
      if (m.sprite.y < -80) m.sprite.y = heightPx + 80;
      m.sprite.setAlpha(m.baseAlpha + Math.sin(this.animClock * 1.4 + m.phase) * 0.02);
    }

    for (const f of this.fireflies) {
      f.sprite.x = f.baseX + Math.sin(this.animClock * f.speed + f.phase) * 10;
      f.sprite.y = f.baseY + Math.cos(this.animClock * f.speed * 0.8 + f.phase) * 8;
      f.sprite.setAlpha(0.30 + (Math.sin(this.animClock * 3 + f.phase) + 1) * 0.28);
    }

    this.renderWeatherParticles(dtRaw, widthPx, heightPx);

    if (simDeltaSec <= 0) return;

    this.updateBeasts(simDeltaSec);

    const regrowMult = this.activeWeather?.berryRegrowMultiplier ?? 1.0;
    for (const res of this.resources) {
      if ((res.type === 'berry_bush' || res.type === 'farm_plot') && !res.hasBerry) {
        res.regrowTimer -= simDeltaSec * regrowMult;
        if (res.regrowTimer <= 0) {
          res.regrowTimer = 0;
          res.hasBerry = true;
          if (res.type === 'berry_bush' && res.sprite) {
            res.sprite.setTexture('obj_bush_full');
            res.sprite.setDisplaySize(36, 36);
          }
        }
      }
    }
  }

  private updateBeasts(dt: number): void {
    const { tileSize } = this.config;
    for (const b of this.beasts) {
      const dx = b.targetX - b.x;
      const dy = b.targetY - b.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 4) {
        const dest = this.getRandomWalkableTileNear(b.tileX, b.tileY, 8);
        b.targetX = dest.x * tileSize + tileSize / 2;
        b.targetY = dest.y * tileSize + tileSize / 2;
      } else {
        const spd = 28 * dt;
        b.x += (dx / dist) * spd;
        b.y += (dy / dist) * spd;
        b.tileX = Math.floor(b.x / tileSize);
        b.tileY = Math.floor(b.y / tileSize);
        b.sprite.setFlipX(dx > 0);
      }

      b.animTimer += dt;
      if (b.animTimer >= 0.24) {
        b.animTimer = 0;
        b.animFrame = b.animFrame === 0 ? 1 : 0;
        b.sprite.setTexture(`beast_wolf_${b.animFrame}`);
        b.sprite.setDisplaySize(38, 32);
      }
      b.sprite.setPosition(b.x, b.y);
      b.sprite.setDepth(b.y + 2);
    }
  }

  private renderWeatherParticles(dt: number, widthPx: number, heightPx: number): void {
    this.weatherGraphics.clear();
    const wId = this.activeWeather?.id ?? 'fog';
    if (wId === 'fog') return;

    if (wId === 'rain') {
      this.weatherGraphics.lineStyle(1.2, 0x8ef6ff, 0.42);
      this.weatherGraphics.beginPath();
      for (const d of this.weatherDrops) {
        d.x -= d.speed * 0.25 * dt;
        d.y += d.speed * dt;
        if (d.y > heightPx) {
          d.y = 0;
          d.x = Math.random() * widthPx;
        }
        if (d.x < 0) d.x = widthPx;
        this.weatherGraphics.moveTo(d.x, d.y);
        this.weatherGraphics.lineTo(d.x - 3, d.y + d.len);
      }
      this.weatherGraphics.strokePath();
    } else if (wId === 'snow') {
      this.weatherGraphics.fillStyle(0xf2f7ff, 0.72);
      for (const d of this.weatherDrops) {
        d.y += d.speed * 0.28 * dt;
        d.x += Math.sin(this.animClock * 2 + d.len) * 14 * dt;
        if (d.y > heightPx) {
          d.y = 0;
          d.x = Math.random() * widthPx;
        }
        this.weatherGraphics.fillCircle(d.x, d.y, 1.8);
      }
    } else if (wId === 'drought') {
      this.weatherGraphics.fillStyle(0xffae42, 0.25);
      for (let i = 0; i < 65; i++) {
        const d = this.weatherDrops[i];
        d.y -= d.speed * 0.15 * dt;
        if (d.y < 0) d.y = heightPx;
        this.weatherGraphics.fillCircle(d.x, d.y, 2.0);
      }
    }
  }

  public harvestBerryBush(res: WorldResource): boolean {
    if ((res.type !== 'berry_bush' && res.type !== 'farm_plot') || !res.hasBerry) return false;
    res.hasBerry = false;
    res.regrowTimer =
      res.type === 'farm_plot'
        ? this.config.berryRegrowSeconds * 0.55
        : this.config.berryRegrowSeconds;
    if (res.type === 'berry_bush' && res.sprite) {
      res.sprite.setTexture('obj_bush_empty');
      res.sprite.setDisplaySize(36, 36);
    }
    return true;
  }

  public getCampfireResource(): WorldResource | null {
    return this.campfireRes;
  }

  public findNearestBlessingShrine(fromX: number, fromY: number): WorldResource | null {
    let nearest: WorldResource | null = null;
    let bestDist = Infinity;
    for (const res of this.resources) {
      if (res.type === 'blessing_shrine') {
        const d = Math.hypot(res.tileX - fromX, res.tileY - fromY);
        if (d < bestDist) {
          bestDist = d;
          nearest = res;
        }
      }
    }
    return nearest;
  }

  public findNearestGatherResource(
    fromX: number,
    fromY: number,
    preferStone: boolean
  ): WorldResource | null {
    let nearest: WorldResource | null = null;
    let bestDist = Infinity;
    for (const res of this.resources) {
      const isStone = res.type === 'mountain_rock' || res.type === 'crystal';
      const isWood = res.type === 'tree' || res.type === 'crimson_canopy';
      if ((preferStone && isStone) || (!preferStone && isWood)) {
        const d = Math.hypot(res.tileX - fromX, res.tileY - fromY);
        if (d < bestDist) {
          bestDist = d;
          nearest = res;
        }
      }
    }
    // Fallback to any gatherable resource if preferred type not found
    if (!nearest) {
      for (const res of this.resources) {
        if (
          res.type === 'tree' ||
          res.type === 'crimson_canopy' ||
          res.type === 'mountain_rock' ||
          res.type === 'crystal'
        ) {
          const d = Math.hypot(res.tileX - fromX, res.tileY - fromY);
          if (d < bestDist) {
            bestDist = d;
            nearest = res;
          }
        }
      }
    }
    return nearest;
  }

  public getTile(x: number, y: number): TileData | undefined {
    if (x < 0 || y < 0 || x >= this.config.mapWidth || y >= this.config.mapHeight) {
      return undefined;
    }
    return this.grid[y][x];
  }

  public isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    if (!tile || !tile.biome.walkable) return false;
    if (tile.resource?.blocksMovement) return false;
    return true;
  }

  public getCenterSpawnTile(): TileData {
    const cx = Math.floor(this.config.mapWidth / 2);
    const cy = Math.floor(this.config.mapHeight / 2) + 1;
    const t = this.getTile(cx, cy);
    if (t && this.isWalkable(cx, cy)) return t;
    return this.grid[Math.floor(this.config.mapHeight / 2)][cx];
  }

  public findNearestRipeBerryBush(fromX: number, fromY: number): WorldResource | null {
    let nearest: WorldResource | null = null;
    let bestDist = Infinity;
    for (const res of this.resources) {
      if ((res.type === 'berry_bush' || res.type === 'farm_plot') && res.hasBerry) {
        const d = Math.hypot(res.tileX - fromX, res.tileY - fromY);
        if (d < bestDist) {
          bestDist = d;
          nearest = res;
        }
      }
    }
    return nearest;
  }

  public findNearestRestSpot(fromX: number, fromY: number): WorldResource | null {
    let nearest: WorldResource | null = null;
    let bestDist = Infinity;
    for (const res of this.resources) {
      if (
        res.type === 'hut' ||
        res.type === 'round_hut' ||
        res.type === 'lantern_tree' ||
        res.type === 'tree'
      ) {
        // Prefer huts slightly by giving them a small distance discount
        const bonus = res.type === 'hut' || res.type === 'round_hut' ? 0.65 : 1.0;
        const d = Math.hypot(res.tileX - fromX, res.tileY - fromY) * bonus;
        if (d < bestDist) {
          bestDist = d;
          nearest = res;
        }
      }
    }
    return nearest;
  }

  public getRandomWalkableTileNear(fromX: number, fromY: number, maxRadius: number): TileData {
    const candidates: TileData[] = [];
    const minX = Math.max(0, fromX - maxRadius);
    const maxX = Math.min(this.config.mapWidth - 1, fromX + maxRadius);
    const minY = Math.max(0, fromY - maxRadius);
    const maxY = Math.min(this.config.mapHeight - 1, fromY + maxRadius);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = this.grid[y][x];
        const dist = Math.hypot(x - fromX, y - fromY);
        if (
          this.isWalkable(x, y) &&
          tile.biome.id !== 'shallow_water' &&
          dist >= 3 &&
          dist <= maxRadius
        ) {
          candidates.push(tile);
        }
      }
    }

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return this.getCenterSpawnTile();
  }

  public getResourceStats(): {
    ripeBerries: number;
    totalBerries: number;
    trees: number;
    shrines: number;
    beasts: number;
  } {
    let ripeBerries = 0;
    let totalBerries = 0;
    let trees = 0;
    let shrines = 0;
    for (const r of this.resources) {
      if (r.type === 'berry_bush' || r.type === 'farm_plot') {
        totalBerries++;
        if (r.hasBerry) ripeBerries++;
      } else if (r.type === 'tree' || r.type === 'lantern_tree' || r.type === 'crimson_canopy') {
        trees++;
      } else if (r.type === 'blessing_shrine') {
        shrines++;
      }
    }
    return { ripeBerries, totalBerries, trees, shrines, beasts: this.beasts.length };
  }
}
