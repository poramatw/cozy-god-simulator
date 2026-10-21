import Phaser from 'phaser';
import {
  BuildingConfig,
  ConstructionSite,
  EraId,
  FollowerAgent,
  KingdomSnapshot,
  ResourceType,
} from '../core/Types';
import { IslandWorld } from '../world/IslandWorld';

const FOLLOWER_NAMES = [
  'คีร่า',
  'โบริน',
  'ไลล่า',
  'ฟินน์',
  'ทาโร่',
  'เอลิน',
  'กริมม์',
  'เซร่า',
  'ไมโล',
  'รูน่า',
];

export interface EraMeta {
  id: EraId;
  index: number;
  name: string;
  subtitle: string;
  loreRequired: number;
  minBuildingsRequired: number;
}

export const ERAS_ROADMAP: EraMeta[] = [
  {
    id: 'stone',
    index: 0,
    name: 'ยุคหิน (Stone Age)',
    subtitle: 'เพิงหนังสัตว์ กองไฟดึกดำบรรพ์ และการเอาชีวิตรอดในพงไพร',
    loreRequired: 0,
    minBuildingsRequired: 0,
  },
  {
    id: 'bronze',
    index: 1,
    name: 'ยุคสำริด (Bronze & Agrarian Age)',
    subtitle: 'บ้านไม้หลังคามุงจาก การทดน้ำเพาะปลูก และถนนดินอัด',
    loreRequired: 70,
    minBuildingsRequired: 3,
  },
  {
    id: 'medieval',
    index: 2,
    name: 'ยุคกลาง (Medieval Kingdom)',
    subtitle: 'ปราสาทหิน โรงตีเหล็ก คฤหาสน์ขุนนาง และถนนปูหิน',
    loreRequired: 180,
    minBuildingsRequired: 5,
  },
  {
    id: 'modern',
    index: 3,
    name: 'ยุคปัจจุบัน (Modern Industrial Era)',
    subtitle: 'อาคารอิฐและกระจก โรงงานอุตสาหกรรม เรือนกระจก และถนนลาดยาง',
    loreRequired: 360,
    minBuildingsRequired: 7,
  },
  {
    id: 'future',
    index: 4,
    name: 'ยุคอนาคต (Stellar Arcology Future)',
    subtitle: 'โดมนิเวศวิทยา เตาปฏิกรณ์ฟิวชัน หอคอยควอนตัม และทางเดินพลังงานแสง',
    loreRequired: 600,
    minBuildingsRequired: 9,
  },
];

export class KingdomManager {
  private scene: Phaser.Scene;
  private world: IslandWorld;
  private buildingsConfig: BuildingConfig[];

  private wood = 20;
  private stone = 10;
  private food = 18;
  private currentEraIndex = 0;
  private heroCloakColor = '#3b7a57';
  private buildingsCount: Record<string, number> = {};
  private activeSite: ConstructionSite | null = null;
  private followers: FollowerAgent[] = [];
  private onLogCallback?: (text: string, type: 'info' | 'milestone') => void;
  private onEraChangedCallback?: (era: EraMeta) => void;

  constructor(
    scene: Phaser.Scene,
    world: IslandWorld,
    buildingsConfig: BuildingConfig[],
    onLog?: (text: string, type: 'info' | 'milestone') => void,
    onEraChanged?: (era: EraMeta) => void
  ) {
    this.scene = scene;
    this.world = world;
    this.buildingsConfig = buildingsConfig;
    this.onLogCallback = onLog;
    this.onEraChangedCallback = onEraChanged;
    this.initStarterCounts();
  }

  public setHeroCloakColor(color: string): void {
    this.heroCloakColor = color;
  }

  public getCurrentEraMeta(): EraMeta {
    return ERAS_ROADMAP[this.currentEraIndex] ?? ERAS_ROADMAP[0];
  }

  public setEraByIndex(index: number, announce = true): EraMeta {
    const clamped = Phaser.Math.Clamp(index, 0, ERAS_ROADMAP.length - 1);
    this.currentEraIndex = clamped;
    const meta = ERAS_ROADMAP[clamped];
    this.world.setWorldEra(meta.id, this.heroCloakColor);

    // Refresh follower textures for the new era
    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      const prefix = i % 2 === 0 ? 'hero_adult' : 'hero_teen';
      f.sprite.setTexture(`${prefix}_0`);
      f.sprite.setDisplaySize(24, 28);
    }

    if (announce) {
      this.onLogCallback?.(
        `วิวัฒนาการโลกก้าวเข้าสู่ "${meta.name}" — ${meta.subtitle}`,
        'milestone'
      );
    }
    this.onEraChangedCallback?.(meta);
    return meta;
  }

  public advanceEraManual(): EraMeta {
    const nextIdx = (this.currentEraIndex + 1) % ERAS_ROADMAP.length;
    return this.setEraByIndex(nextIdx, true);
  }

  private checkAutoEraEvolution(heroLore: number): void {
    if (this.currentEraIndex >= ERAS_ROADMAP.length - 1) return;
    const nextMeta = ERAS_ROADMAP[this.currentEraIndex + 1];
    const totalBuilt = this.getTotalBuildingsCount();
    if (heroLore >= nextMeta.loreRequired && totalBuilt >= nextMeta.minBuildingsRequired) {
      this.setEraByIndex(this.currentEraIndex + 1, true);
    }
  }

  private getTotalBuildingsCount(): number {
    let total = 0;
    for (const b of this.buildingsConfig) {
      total += this.buildingsCount[b.id] ?? 0;
    }
    return total;
  }

  private initStarterCounts(): void {
    this.buildingsCount = {};
    for (const b of this.buildingsConfig) {
      this.buildingsCount[b.id] = 0;
    }
    this.buildingsCount['campfire'] = 1;
    this.buildingsCount['wooden_hut'] = 1;
  }

  public resetForNewWorld(): void {
    if (this.activeSite) {
      this.activeSite.progressGraphics.destroy();
      this.activeSite = null;
    }
    for (const f of this.followers) {
      f.sprite.destroy();
      f.toolSprite.destroy();
    }
    this.followers = [];
    this.wood = 20;
    this.stone = 10;
    this.food = 18;
    this.currentEraIndex = 0;
    this.initStarterCounts();
    this.world.setWorldEra('stone', this.heroCloakColor);
  }

  public addResources(woodDelta: number, stoneDelta: number, foodDelta = 0): void {
    this.wood = Math.max(0, this.wood + woodDelta);
    this.stone = Math.max(0, this.stone + stoneDelta);
    this.food = Math.max(0, this.food + foodDelta);
  }

  public getResources(): { wood: number; stone: number; food: number } {
    return { wood: this.wood, stone: this.stone, food: this.food };
  }

  public getActiveSite(): ConstructionSite | null {
    return this.activeSite;
  }

  public getMaxPopulation(): number {
    let cap = 0;
    for (const b of this.buildingsConfig) {
      const count = this.buildingsCount[b.id] ?? 0;
      cap += count * b.followerCapBonus;
    }
    return cap;
  }

  public canStartOrContinueBuild(heroInt: number, heroLore: number): boolean {
    if (this.activeSite) return true;
    return this.getNextBuildableBuilding(heroInt, heroLore) !== null;
  }

  public getNextNeededResource(heroInt: number, heroLore: number): 'wood' | 'stone' | null {
    for (const b of this.buildingsConfig) {
      const count = this.buildingsCount[b.id] ?? 0;
      if (count >= b.maxCount) continue;
      if (heroInt >= b.requiredInt && heroLore >= b.requiredLore) {
        if (this.wood < b.woodCost) return 'wood';
        if (this.stone < b.stoneCost) return 'stone';
      }
    }
    return this.wood <= this.stone * 1.4 ? 'wood' : 'stone';
  }

  public getNextBuildableBuilding(heroInt: number, heroLore: number): BuildingConfig | null {
    for (const b of this.buildingsConfig) {
      const count = this.buildingsCount[b.id] ?? 0;
      if (count >= b.maxCount) continue;
      if (heroInt >= b.requiredInt && heroLore >= b.requiredLore) {
        if (this.wood >= b.woodCost && this.stone >= b.stoneCost) {
          return b;
        }
      }
    }
    return null;
  }

  public ensureConstructionSite(heroInt: number, heroLore: number): ConstructionSite | null {
    if (this.activeSite) return this.activeSite;
    const nextB = this.getNextBuildableBuilding(heroInt, heroLore);
    if (!nextB) return null;

    const spot = this.findVillageBuildTile();
    if (!spot) return null;

    this.wood -= nextB.woodCost;
    this.stone -= nextB.stoneCost;

    const res = this.world.spawnResource('construction_site', spot.x, spot.y, false);
    const progressGraphics = this.scene.add.graphics();
    progressGraphics.setDepth(3100);
    this.world.getWorldContainer().add(progressGraphics);

    this.activeSite = {
      id: `site_${nextB.id}_${Date.now()}`,
      building: nextB,
      tileX: spot.x,
      tileY: spot.y,
      progressSec: 0,
      totalSec: nextB.buildTimeSec,
      sprite: res.sprite!,
      progressGraphics,
    };

    this.drawSiteProgress(this.activeSite);
    this.onLogCallback?.(
      `เริ่มวางรากฐาน "${nextB.name}" ที่พิกัด (${spot.x}, ${spot.y})`,
      'info'
    );
    return this.activeSite;
  }

  public advanceConstruction(workSec: number): boolean {
    if (!this.activeSite) return false;
    this.activeSite.progressSec += workSec;
    this.drawSiteProgress(this.activeSite);

    const tileSize = this.world.getConfig().tileSize;
    const px = this.activeSite.tileX * tileSize + tileSize / 2;
    const py = this.activeSite.tileY * tileSize + tileSize / 2;

    if (Math.random() < 0.35) {
      this.world.spawnWorkParticles(px, py, 'build');
      if (this.activeSite.sprite && !this.scene.tweens.isTweening(this.activeSite.sprite)) {
        const baseW = 72;
        const baseH = 72;
        this.scene.tweens.add({
          targets: this.activeSite.sprite,
          displayWidth: { from: baseW * 1.07, to: baseW },
          displayHeight: { from: baseH * 0.93, to: baseH },
          duration: 160,
          ease: 'Sine.easeOut',
        });
      }
    }

    if (this.activeSite.progressSec >= this.activeSite.totalSec) {
      this.completeConstruction(this.activeSite);
      return true;
    }
    return false;
  }

  private completeConstruction(site: ConstructionSite): void {
    site.progressGraphics.destroy();
    const b = site.building;
    const resType = this.mapBuildingIdToResourceType(b.id);

    const completedRes = this.world.spawnResource(
      resType,
      site.tileX,
      site.tileY,
      resType === 'farm_plot'
    );

    if (completedRes.sprite) {
      const targetW = completedRes.sprite.displayWidth;
      const targetH = completedRes.sprite.displayHeight;
      completedRes.sprite.setDisplaySize(targetW * 0.4, targetH * 0.4);
      this.scene.tweens.add({
        targets: completedRes.sprite,
        displayWidth: targetW,
        displayHeight: targetH,
        duration: 420,
        ease: 'Back.easeOut',
      });
    }

    const tileSize = this.world.getConfig().tileSize;
    const px = site.tileX * tileSize + tileSize / 2;
    const py = site.tileY * tileSize + tileSize / 2;
    this.world.spawnWorkParticles(px, py, 'build');
    this.world.spawnWorkParticles(px, py - 8, 'build');

    this.buildingsCount[b.id] = (this.buildingsCount[b.id] ?? 0) + 1;
    this.activeSite = null;

    this.onLogCallback?.(
      `ก่อสร้าง "${b.name}" สำเร็จ! อาณาจักรเจริญรุ่งเรืองขึ้น`,
      'milestone'
    );

    this.checkSpawnFollowers();
  }

  private mapBuildingIdToResourceType(buildingId: string): ResourceType {
    switch (buildingId) {
      case 'wooden_hut':
        return 'round_hut';
      case 'farm_plot':
        return 'farm_plot';
      case 'watchtower':
        return 'watchtower';
      case 'stone_house':
        return 'hut';
      case 'stone_smithy':
        return 'stone_smithy';
      default:
        return 'round_hut';
    }
  }

  private drawSiteProgress(site: ConstructionSite): void {
    const g = site.progressGraphics;
    g.clear();
    const tileSize = this.world.getConfig().tileSize;
    const px = site.tileX * tileSize + tileSize / 2;
    const py = site.tileY * tileSize - 26;
    const barW = 46;
    const barH = 6;
    const ratio = Phaser.Math.Clamp(site.progressSec / site.totalSec, 0, 1);

    g.fillStyle(0x0c0e14, 0.88);
    g.fillRoundedRect(px - barW / 2 - 1, py - 1, barW + 2, barH + 2, 3);

    g.fillStyle(0xf59e0b, 0.95);
    g.fillRoundedRect(px - barW / 2, py, Math.max(2, barW * ratio), barH, 2);
  }

  private findVillageBuildTile(): { x: number; y: number } | null {
    const cfg = this.world.getConfig();
    const cx = Math.floor(cfg.mapWidth / 2);
    const cy = Math.floor(cfg.mapHeight / 2);

    for (let r = 3; r <= 14; r++) {
      const candidates: { x: number; y: number }[] = [];
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.hypot(dx, dy);
          if (dist < r - 0.6 || dist > r + 0.6) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          const tile = this.world.getTile(tx, ty);
          if (
            tile &&
            tile.biome.walkable &&
            tile.biome.id !== 'shallow_water' &&
            !tile.resource &&
            !this.hasAdjacentBuilding(tx, ty)
          ) {
            candidates.push({ x: tx, y: ty });
          }
        }
      }
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return null;
  }

  private hasAdjacentBuilding(tx: number, ty: number): boolean {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const t = this.world.getTile(tx + ox, ty + oy);
        if (t?.resource && t.resource.type !== 'berry_bush' && t.resource.type !== 'tree') {
          return true;
        }
      }
    }
    return false;
  }

  private checkSpawnFollowers(): void {
    const maxPop = this.getMaxPopulation();
    while (this.followers.length < maxPop && this.followers.length < 10) {
      const idx = this.followers.length;
      const name = FOLLOWER_NAMES[idx % FOLLOWER_NAMES.length];
      const roles: ('gatherer' | 'builder' | 'farmer')[] = ['gatherer', 'builder', 'farmer'];
      const role = roles[idx % roles.length];

      const spawn = this.world.getCenterSpawnTile();
      const tileSize = this.world.getConfig().tileSize;
      const px = spawn.x * tileSize + tileSize / 2;
      const py = spawn.y * tileSize + tileSize / 2;

      const texKey = idx % 2 === 0 ? 'hero_adult_0' : 'hero_teen_0';
      const sprite = this.scene.add.sprite(px, py, texKey);
      sprite.setDisplaySize(24, 28);
      sprite.setOrigin(0.5, 0.78);
      sprite.setTint(role === 'builder' ? 0xfde68a : role === 'farmer' ? 0xa7f3d0 : 0xbae6fd);
      sprite.setDepth(py + 2);
      this.world.getWorldContainer().add(sprite);

      const toolSprite = this.scene.add.image(
        px + 8,
        py - 12,
        role === 'builder' ? 'icon_hammer' : 'icon_axe'
      );
      toolSprite.setDisplaySize(13, 13);
      toolSprite.setDepth(py + 5);
      toolSprite.setVisible(false);
      this.world.getWorldContainer().add(toolSprite);

      this.followers.push({
        id: `follower_${idx}_${Date.now()}`,
        name,
        role,
        tileX: spawn.x,
        tileY: spawn.y,
        x: px,
        y: py,
        targetX: px,
        targetY: py,
        sprite,
        toolSprite,
        animTimer: 0,
        taskTimer: 0,
        taskLabel: 'ดูแลหมู่บ้าน',
      });

      this.onLogCallback?.(
        `พลเมืองคนใหม่ "${name}" (${role === 'builder' ? 'ช่างก่อสร้าง' : role === 'farmer' ? 'เกษตรกร' : 'นักสำรวจทรัพยากร'}) เข้าร่วมอาณาจักร`,
        'milestone'
      );
    }
  }

  public update(simDeltaSec: number, heroInt: number, heroLore: number): void {
    if (simDeltaSec <= 0) return;

    this.checkAutoEraEvolution(heroLore);

    if (this.followers.length < this.getMaxPopulation() && Math.random() < 0.08) {
      this.checkSpawnFollowers();
    }

    const tileSize = this.world.getConfig().tileSize;

    for (let i = 0; i < this.followers.length; i++) {
      const f = this.followers[i];
      const dx = f.targetX - f.x;
      const dy = f.targetY - f.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 4) {
        f.toolSprite.setVisible(false);
        const speed = 34 * simDeltaSec;
        f.x += (dx / dist) * speed;
        f.y += (dy / dist) * speed;
        f.tileX = Math.floor(f.x / tileSize);
        f.tileY = Math.floor(f.y / tileSize);
        f.sprite.setFlipX(dx < 0);

        f.animTimer += simDeltaSec;
        const frame = Math.floor(f.animTimer * 5) % 2;
        const prefix = i % 2 === 0 ? 'hero_adult' : 'hero_teen';
        f.sprite.setTexture(`${prefix}_${frame}`);
        f.sprite.setDisplaySize(24, 28);
      } else {
        f.taskTimer += simDeltaSec;
        f.toolSprite.setVisible(true);
        f.toolSprite.setPosition(f.x + 8, f.y - 12);
        f.toolSprite.setRotation(Math.sin(f.taskTimer * 12) * 0.55);

        if (this.activeSite && (f.role === 'builder' || i === 0)) {
          f.toolSprite.setTexture('icon_hammer');
          this.advanceConstruction(simDeltaSec * 0.65);
        }

        if (f.taskTimer >= 3.2) {
          f.taskTimer = 0;
          if (f.role === 'gatherer') {
            this.addResources(2, 1, 0);
            this.world.spawnWorkParticles(f.x, f.y, 'wood');
          } else if (f.role === 'farmer') {
            this.addResources(1, 0, 2);
          } else {
            this.addResources(1, 1, 0);
          }

          if (this.activeSite) {
            f.targetX =
              this.activeSite.tileX * tileSize + tileSize / 2 + (Math.random() - 0.5) * 14;
            f.targetY = this.activeSite.tileY * tileSize + tileSize / 2 + 8;
          } else {
            const gatherRes = this.world.findNearestGatherResource(
              f.tileX,
              f.tileY,
              this.stone < this.wood * 0.6
            );
            if (gatherRes && Math.random() < 0.7) {
              f.targetX = gatherRes.tileX * tileSize + tileSize / 2;
              f.targetY = gatherRes.tileY * tileSize + tileSize / 2 + 6;
            } else {
              const dest = this.world.getRandomWalkableTileNear(
                Math.floor(this.world.getConfig().mapWidth / 2),
                Math.floor(this.world.getConfig().mapHeight / 2),
                12
              );
              f.targetX = dest.x * tileSize + tileSize / 2;
              f.targetY = dest.y * tileSize + tileSize / 2;
            }
          }
        }
      }

      f.sprite.setPosition(f.x, f.y);
      f.sprite.setDepth(f.y + 2);
      f.toolSprite.setDepth(f.y + 6);
    }

    if (!this.activeSite && this.followers.length > 0 && Math.random() < 0.04) {
      this.ensureConstructionSite(heroInt, heroLore);
    }
  }

  public getSnapshot(heroInt: number, heroLore: number): KingdomSnapshot {
    let totalBuilt = 0;
    const buildingsList = this.buildingsConfig.map((cfg) => {
      const count = this.buildingsCount[cfg.id] ?? 0;
      totalBuilt += count;
      const unlocked = heroInt >= cfg.requiredInt && heroLore >= cfg.requiredLore;
      const canAfford =
        unlocked &&
        count < cfg.maxCount &&
        this.wood >= cfg.woodCost &&
        this.stone >= cfg.stoneCost;
      return {
        config: cfg,
        count,
        unlocked,
        canAfford,
      };
    });

    const prosperity =
      totalBuilt * 25 +
      this.followers.length * 20 +
      this.currentEraIndex * 80 +
      Math.floor((this.wood + this.stone) * 0.5);

    const eraMeta = this.getCurrentEraMeta();
    const nextEraMeta =
      this.currentEraIndex < ERAS_ROADMAP.length - 1
        ? ERAS_ROADMAP[this.currentEraIndex + 1]
        : ERAS_ROADMAP[ERAS_ROADMAP.length - 1];

    return {
      wood: Math.floor(this.wood),
      stone: Math.floor(this.stone),
      food: Math.floor(this.food),
      population: this.followers.length,
      maxPopulation: this.getMaxPopulation(),
      prosperity,
      currentEra: eraMeta.id,
      eraName: eraMeta.name,
      eraIndex: eraMeta.index,
      nextEraLoreRequired: nextEraMeta.loreRequired,
      buildingsCount: { ...this.buildingsCount },
      activeSite: this.activeSite
        ? {
            name: this.activeSite.building.name,
            icon: this.activeSite.building.icon,
            percent: Math.min(
              100,
              Math.round((this.activeSite.progressSec / this.activeSite.totalSec) * 100)
            ),
          }
        : null,
      buildingsList,
    };
  }
}
