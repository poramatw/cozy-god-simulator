import gsap from 'gsap';
import Phaser from 'phaser';
import { DisasterId, SeasonId } from '../agent/DeepCognitionEngine';
import { WorldResource } from '../core/Types';
import { IslandWorld } from './IslandWorld';

export interface SeasonMetadata {
  id: SeasonId;
  name: string;
  icon: string;
  temperatureC: number;
  foliageTint: number;
  cropGrowthMultiplier: number;
  windStrength: number;
  description: string;
}

export const SEASONS_TABLE: Record<SeasonId, SeasonMetadata> = {
  spring: {
    id: 'spring',
    name: 'ฤดูใบไม้ผลิ (Spring)',
    icon: '🌸',
    temperatureC: 22,
    foliageTint: 0xffffff,
    cropGrowthMultiplier: 1.35,
    windStrength: 1.0,
    description: 'อากาศอบอุ่น ดอกไม้ผลิบาน พืชผลและเบอร์รี่งอกงามรวดเร็ว',
  },
  summer: {
    id: 'summer',
    name: 'ฤดูร้อน (Summer)',
    icon: '☀️',
    temperatureC: 32,
    foliageTint: 0xfff3d6,
    cropGrowthMultiplier: 1.15,
    windStrength: 0.8,
    description: 'แดดแรงและอบอ้าว เหมาะแก่การก่อสร้าง แต่ระวังอัคคีภัยและไฟป่า',
  },
  autumn: {
    id: 'autumn',
    name: 'ฤดูใบไม้ร่วง (Autumn)',
    icon: '🍂',
    temperatureC: 14,
    foliageTint: 0xffcfa3,
    cropGrowthMultiplier: 0.9,
    windStrength: 1.45,
    description: 'ใบไม้เปลี่ยนเป็นสีทองอำพัน ลมแรง ต้องเร่งกักตุนเสบียงก่อนฤดูหนาว',
  },
  winter: {
    id: 'winter',
    name: 'ฤดูหนาว (Winter)',
    icon: '❄️',
    temperatureC: -3,
    foliageTint: 0xd4ecff,
    cropGrowthMultiplier: 0.45,
    windStrength: 1.8,
    description: 'หิมะปกคลุมและอากาศหนาวเหน็บ พืชโตช้า ต้องพึ่งพาไออุ่นจากกองไฟ',
  },
};

interface BurningTreeNode {
  res: WorldResource;
  burnTimer: number;
  flameSprite: Phaser.GameObjects.Sprite;
}

interface SeasonalParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

export class SeasonAndDisasterSystem {
  private scene: Phaser.Scene;
  private world: IslandWorld;
  private currentSeason: SeasonId = 'spring';
  private manualSeasonOverride: SeasonId | null = null;
  private activeDisaster: DisasterId = 'none';
  private disasterTimer = 0;
  private disasterTickTimer = 0;
  private windClock = 0;

  private burningTrees: BurningTreeNode[] = [];
  private fxGraphics: Phaser.GameObjects.Graphics;
  private seasonalParticles: SeasonalParticle[] = [];
  private onLogCallback?: (text: string, type: 'info' | 'warn' | 'milestone') => void;

  constructor(
    scene: Phaser.Scene,
    world: IslandWorld,
    onLog?: (text: string, type: 'info' | 'warn' | 'milestone') => void
  ) {
    this.scene = scene;
    this.world = world;
    this.onLogCallback = onLog;

    this.fxGraphics = this.scene.add.graphics();
    this.fxGraphics.setDepth(3380);

    this.initSeasonalParticles();
  }

  private initSeasonalParticles(): void {
    const cfg = this.world.getConfig();
    const widthPx = cfg.mapWidth * cfg.tileSize;
    const heightPx = cfg.mapHeight * cfg.tileSize;
    this.seasonalParticles = [];
    for (let i = 0; i < 110; i++) {
      this.seasonalParticles.push({
        x: Math.random() * widthPx,
        y: Math.random() * heightPx,
        vx: 16 + Math.random() * 22,
        vy: 14 + Math.random() * 18,
        size: 2.2 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public getSeasonMeta(): SeasonMetadata {
    const base = SEASONS_TABLE[this.currentSeason];
    if (this.activeDisaster === 'blizzard') {
      return {
        ...base,
        temperatureC: -15,
        windStrength: 3.2,
      };
    }
    if (this.activeDisaster === 'wildfire') {
      return {
        ...base,
        temperatureC: base.temperatureC + 9,
      };
    }
    return base;
  }

  public getActiveDisaster(): DisasterId {
    return this.activeDisaster;
  }

  public setSeasonManual(seasonId: SeasonId): void {
    this.manualSeasonOverride = seasonId;
    this.applySeasonTransition(seasonId);
  }

  private applySeasonTransition(nextSeason: SeasonId): void {
    if (this.currentSeason === nextSeason) return;
    this.currentSeason = nextSeason;
    const meta = SEASONS_TABLE[nextSeason];

    // Smoothly tint flora across the island to match the season
    for (const res of this.world.getAllResources()) {
      if (
        res.sprite &&
        (res.type === 'tree' || res.type === 'lantern_tree' || res.type === 'berry_bush')
      ) {
        res.sprite.setTint(meta.foliageTint);
      }
    }

    this.onLogCallback?.(
      `${meta.icon} ฤดูกาลผันเปลี่ยนเข้าสู่ "${meta.name}" (อุณหภูมิเฉลี่ย ${meta.temperatureC}°C) — ${meta.description}`,
      'info'
    );
  }

  public triggerDisaster(disaster: DisasterId): void {
    this.activeDisaster = disaster;
    if (disaster === 'none') {
      this.clearBurningTrees();
      this.disasterTimer = 0;
      return;
    }

    this.disasterTimer = 18;
    this.disasterTickTimer = 0;

    if (disaster === 'wildfire') {
      this.igniteRandomForestTrees(3);
      this.onLogCallback?.(
        '🔥 [ภัยพิบัติ: ไฟป่าลุกลาม!] เปลวเพลิงลุกไหม้ต้นไม้ในป่า! (เสกฝนตกเพื่อดับไฟป่าได้)',
        'warn'
      );
    } else if (disaster === 'blizzard') {
      this.onLogCallback?.(
        '🌨️ [ภัยพิบัติ: พายุหิมะคลั่ง!] ลมหนาวพัดกระหน่ำทั่วทวีป อุณหภูมิดิ่งลงถึง -15°C!',
        'warn'
      );
    } else if (disaster === 'meteor_shower') {
      this.spawnMeteorStrike();
      this.onLogCallback?.(
        '☄️ [ปรากฏการณ์: ฝนดาวตกดารา!] อุกกาบาตผลึกเวทมนตร์พุ่งตกจากฟากฟ้า!',
        'milestone'
      );
    } else if (disaster === 'earthquake') {
      this.triggerEarthquakeTremor();
      this.onLogCallback?.(
        '🌋 [ภัยพิบัติ: แผ่นดินไหว!] แผ่นดินสั่นสะเทือนและดันสายแร่หินผุดขึ้นมาจากใต้พิภพ!',
        'warn'
      );
    }
  }

  private igniteRandomForestTrees(count: number): void {
    const trees = this.world
      .getAllResources()
      .filter((r) => r.type === 'tree' || r.type === 'crimson_canopy');
    if (trees.length === 0) return;

    const tileSize = this.world.getConfig().tileSize;
    for (let i = 0; i < count; i++) {
      const pick = trees[Math.floor(Math.random() * trees.length)];
      if (this.burningTrees.some((b) => b.res === pick)) continue;

      const px = pick.tileX * tileSize + tileSize / 2;
      const py = pick.tileY * tileSize + tileSize / 2;
      const flameSprite = this.scene.add.sprite(px, py - 8, 'obj_campfire_0');
      flameSprite.setDisplaySize(48, 48);
      flameSprite.setDepth(py + 25);
      this.world.getWorldContainer().add(flameSprite);

      if (pick.sprite) {
        pick.sprite.setTint(0xff7b42);
      }

      this.burningTrees.push({
        res: pick,
        burnTimer: 7 + Math.random() * 4,
        flameSprite,
      });
    }
  }

  private clearBurningTrees(): void {
    const meta = SEASONS_TABLE[this.currentSeason];
    for (const b of this.burningTrees) {
      b.flameSprite.destroy();
      if (b.res.sprite && b.res.sprite.active) {
        b.res.sprite.setTint(meta.foliageTint);
      }
    }
    this.burningTrees = [];
  }

  private spawnMeteorStrike(): void {
    const cfg = this.world.getConfig();
    const cx = Math.floor(cfg.mapWidth / 2);
    const cy = Math.floor(cfg.mapHeight / 2);
    const targetTile = this.world.getRandomWalkableTileNear(cx, cy, 24);
    const tileSize = cfg.tileSize;
    const txPx = targetTile.x * tileSize + tileSize / 2;
    const tyPx = targetTile.y * tileSize + tileSize / 2;

    const meteor = this.scene.add.circle(txPx - 140, tyPx - 240, 8, 0x8ef6ff, 1);
    meteor.setStrokeStyle(3, 0xffd166);
    meteor.setDepth(3550);
    this.world.getWorldContainer().add(meteor);

    gsap.to(meteor, {
      x: txPx,
      y: tyPx,
      duration: 0.65,
      ease: 'power2.in',
      onComplete: () => {
        meteor.destroy();
        this.scene.cameras.main.shake(220, 0.007);
        this.world.spawnWorkParticles(txPx, tyPx, 'build');
        this.world.spawnWorkParticles(txPx, tyPx, 'stone');
        if (!targetTile.resource) {
          this.world.spawnResource(
            Math.random() < 0.55 ? 'blessing_shrine' : 'crystal',
            targetTile.x,
            targetTile.y,
            false
          );
        }
      },
    });
  }

  private triggerEarthquakeTremor(): void {
    this.scene.cameras.main.shake(450, 0.009);
    const cfg = this.world.getConfig();
    const cx = Math.floor(cfg.mapWidth / 2);
    const cy = Math.floor(cfg.mapHeight / 2);

    for (let i = 0; i < 3; i++) {
      const spot = this.world.getRandomWalkableTileNear(cx, cy, 22);
      if (!spot.resource && Math.hypot(spot.x - cx, spot.y - cy) > 6) {
        this.world.spawnGodMountain(spot.x, spot.y);
      }
    }
  }

  public update(simDeltaSec: number, rawDeltaMs: number, dayOfYear: number): void {
    const dtRaw = rawDeltaMs / 1000;
    this.windClock += dtRaw;

    // 1. Automatic Season Progression by Day of Year (unless manually overridden)
    if (!this.manualSeasonOverride) {
      const autoSeason: SeasonId =
        dayOfYear <= 90
          ? 'spring'
          : dayOfYear <= 180
          ? 'summer'
          : dayOfYear <= 270
          ? 'autumn'
          : 'winter';
      if (autoSeason !== this.currentSeason) {
        this.applySeasonTransition(autoSeason);
      }
    }

    // 2. Realistic Wind Sway Animation on Flora
    const seasonMeta = this.getSeasonMeta();
    const windAmp = 0.025 * seasonMeta.windStrength;
    const allRes = this.world.getAllResources();
    for (let i = 0; i < allRes.length; i++) {
      const r = allRes[i];
      if (
        r.sprite &&
        (r.type === 'tree' ||
          r.type === 'lantern_tree' ||
          r.type === 'crimson_canopy' ||
          r.type === 'berry_bush')
      ) {
        const phase = (r.tileX * 0.7 + r.tileY * 1.1) % 6.28;
        r.sprite.setRotation(Math.sin(this.windClock * 2.2 + phase) * windAmp);
      }
    }

    // 3. Render Seasonal Drifting Petals / Autumn Leaves / Blizzard Gusts
    this.renderSeasonalAndDisasterParticles(dtRaw, seasonMeta);

    if (simDeltaSec <= 0) return;

    // 4. Rain automatically extinguishes Wildfires!
    if (this.activeDisaster === 'wildfire' && this.world.getWeather().id === 'rain') {
      this.clearBurningTrees();
      this.activeDisaster = 'none';
      this.onLogCallback?.(
        '🌧️ สายฝนแห่งพระเจ้าช่วยดับเปลวไฟป่าจนมอดสนิท! ผืนป่ารอดพ้นจากอัคคีภัย',
        'milestone'
      );
      return;
    }

    // 5. Update Active Disasters
    if (this.activeDisaster !== 'none') {
      this.disasterTimer -= simDeltaSec;
      this.disasterTickTimer += simDeltaSec;

      if (this.activeDisaster === 'wildfire') {
        for (let i = this.burningTrees.length - 1; i >= 0; i--) {
          const b = this.burningTrees[i];
          b.burnTimer -= simDeltaSec;
          const frame = Math.floor(this.windClock * 6) % 2;
          b.flameSprite.setTexture(`obj_campfire_${frame}`);
          b.flameSprite.setDisplaySize(48, 48);

          if (b.burnTimer <= 0) {
            b.flameSprite.destroy();
            this.world.removeResource(b.res);
            this.burningTrees.splice(i, 1);
          }
        }
        if (this.disasterTickTimer >= 4.0) {
          this.disasterTickTimer = 0;
          this.igniteRandomForestTrees(1);
        }
      } else if (this.activeDisaster === 'meteor_shower' && this.disasterTickTimer >= 2.6) {
        this.disasterTickTimer = 0;
        this.spawnMeteorStrike();
      } else if (this.activeDisaster === 'earthquake' && this.disasterTickTimer >= 4.5) {
        this.disasterTickTimer = 0;
        this.triggerEarthquakeTremor();
      }

      if (this.disasterTimer <= 0) {
        this.clearBurningTrees();
        this.activeDisaster = 'none';
        this.onLogCallback?.('🌤️ ภัยพิบัติสงบลงแล้ว ทวีปกลับคืนสู่สภาวะปกติ', 'info');
      }
    }
  }

  private renderSeasonalAndDisasterParticles(dt: number, meta: SeasonMetadata): void {
    this.fxGraphics.clear();
    const cfg = this.world.getConfig();
    const widthPx = cfg.mapWidth * cfg.tileSize;
    const heightPx = cfg.mapHeight * cfg.tileSize;

    if (this.activeDisaster === 'blizzard') {
      this.fxGraphics.lineStyle(1.8, 0xe2f1ff, 0.72);
      this.fxGraphics.beginPath();
      for (const p of this.seasonalParticles) {
        p.x += p.vx * 8.5 * dt;
        p.y += p.vy * 3.5 * dt;
        if (p.x > widthPx) p.x = 0;
        if (p.y > heightPx) p.y = 0;
        this.fxGraphics.moveTo(p.x, p.y);
        this.fxGraphics.lineTo(p.x - 16, p.y - 5);
      }
      this.fxGraphics.strokePath();
      return;
    }

    if (meta.id === 'spring') {
      // Soft pink cherry blossom petals drifting
      this.fxGraphics.fillStyle(0xffb7c5, 0.65);
      for (let i = 0; i < 55; i++) {
        const p = this.seasonalParticles[i];
        p.x += (p.vx * 0.6 + Math.sin(this.windClock * 2 + p.phase) * 8) * dt;
        p.y += p.vy * 0.7 * dt;
        if (p.x > widthPx) p.x = 0;
        if (p.y > heightPx) p.y = 0;
        this.fxGraphics.fillCircle(p.x, p.y, p.size * 0.85);
      }
    } else if (meta.id === 'autumn') {
      // Falling golden-amber maple leaves
      this.fxGraphics.fillStyle(0xf4a261, 0.75);
      for (let i = 0; i < 70; i++) {
        const p = this.seasonalParticles[i];
        p.x += (p.vx * 1.1 + Math.sin(this.windClock * 2.5 + p.phase) * 14) * dt;
        p.y += p.vy * 0.95 * dt;
        if (p.x > widthPx) p.x = 0;
        if (p.y > heightPx) p.y = 0;
        this.fxGraphics.fillEllipse(p.x, p.y, p.size * 2.1, p.size * 1.2);
      }
    } else if (meta.id === 'winter') {
      // Gentle winter snowflakes
      this.fxGraphics.fillStyle(0xf0f7ff, 0.75);
      for (let i = 0; i < 85; i++) {
        const p = this.seasonalParticles[i];
        p.x += Math.sin(this.windClock * 1.8 + p.phase) * 12 * dt;
        p.y += p.vy * 1.1 * dt;
        if (p.y > heightPx) p.y = 0;
        this.fxGraphics.fillCircle(p.x, p.y, p.size * 0.8);
      }
    }
  }
}
