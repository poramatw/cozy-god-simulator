import Phaser from 'phaser';
import {
  ActionId,
  AgentConfig,
  ChronicleEntry,
  HeroCustomization,
  HeroStatusSnapshot,
  LifeStageConfig,
  TraitConfig,
  UtilityScoreItem,
  WorldResource,
} from '../core/Types';
import { IslandWorld } from '../world/IslandWorld';
import { findPathAStar, GridPoint } from './Pathfinder';
import { UtilityBrain } from './UtilityBrain';

export class HeroAgent {
  private scene: Phaser.Scene;
  private world: IslandWorld;
  private config: AgentConfig;
  private allTraits: TraitConfig[];
  private brain: UtilityBrain;

  public name: string;
  public clanName: string;
  public str: number;
  public int: number;
  public agi: number;
  public cloakColor = '#3b7a57';
  public activeTraits: TraitConfig[] = [];
  public loreExp = 0;
  public generation = 1;

  public tileX = 32;
  public tileY = 32;
  public x = 0;
  public y = 0;

  private hunger: number;
  private energy: number;
  private health: number;
  private maxHealth: number;
  private baseAge: number;
  private currentAge: number;
  private dayOfYear = 1;
  private currentClockStr = '20:30';
  private isNight = true;
  private currentStage!: LifeStageConfig;

  private currentAction: ActionId = 'explore_island';
  private actionState: 'moving' | 'performing' | 'idle' = 'idle';
  private actionTimer = 0;
  private zzzParticleTimer = 0;
  private animTimer = 0;
  private animFrame = 0;
  private beastEncounterCooldown = 0;

  private path: GridPoint[] = [];
  private targetResource: WorldResource | null = null;
  private latestScores: UtilityScoreItem[] = [];

  private berriesEaten = 0;
  private napsTaken = 0;
  private visitedTiles = new Set<string>();

  private sprite: Phaser.GameObjects.Sprite;
  private heroGlow: Phaser.GameObjects.Image;
  private thoughtBg: Phaser.GameObjects.Image;
  private thoughtIcon: Phaser.GameObjects.Image;
  private pathGraphics: Phaser.GameObjects.Graphics;

  private onChronicleLog?: (entry: Omit<ChronicleEntry, 'id'>) => void;

  constructor(
    scene: Phaser.Scene,
    world: IslandWorld,
    config: AgentConfig,
    allTraits: TraitConfig[],
    onChronicleLog?: (entry: Omit<ChronicleEntry, 'id'>) => void
  ) {
    this.scene = scene;
    this.world = world;
    this.config = config;
    this.allTraits = allTraits;
    this.brain = new UtilityBrain(config);
    this.onChronicleLog = onChronicleLog;

    this.name = config.defaultHeroName;
    this.clanName = config.defaultClanName;
    this.str = config.defaultStats.str;
    this.int = config.defaultStats.int;
    this.agi = config.defaultStats.agi;
    this.activeTraits = allTraits.slice(0, 2);

    this.maxHealth = config.needs.health.max + (this.str - 5) * 6;
    this.hunger = config.needs.hunger.initial;
    this.energy = config.needs.energy.initial;
    this.health = this.maxHealth;
    this.baseAge = config.initialAge;
    this.currentAge = config.initialAge;
    this.currentStage = this.resolveLifeStage(this.currentAge);

    this.pathGraphics = this.scene.add.graphics();
    this.pathGraphics.setDepth(5);

    this.heroGlow = this.scene.add.image(0, 0, 'light_warm');
    this.heroGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.heroGlow.setScale(0.42);
    this.heroGlow.setAlpha(0.45);
    this.heroGlow.setDepth(3100);

    this.sprite = this.scene.add.sprite(0, 0, 'hero_youth_0');
    this.thoughtBg = this.scene.add.image(0, -22, 'thought_bubble');
    this.thoughtBg.setDisplaySize(20, 20);
    this.thoughtIcon = this.scene.add.image(0, -23, 'icon_compass');
    this.thoughtIcon.setDisplaySize(13, 13);
    this.thoughtBg.setDepth(3400);
    this.thoughtIcon.setDepth(3401);

    this.respawnOnIsland(true);
  }

  public grantDivineInspiration(): void {
    this.health = this.maxHealth;
    this.energy = this.config.needs.energy.max;
    this.hunger = Math.min(this.config.needs.hunger.max, this.hunger + 30);
    this.int += 1;
    this.loreExp += 60;
    this.spawnFloatingText('✨ พรแห่งปัญญา! (INT +1)', '#ffd166');
    this.logEvent(
      `ได้รับ "แรงบันดาลใจจากพระเจ้า"! ฟื้นฟูพลังเต็มเปี่ยม พร้อมเพิ่ม INT เป็น ${this.int} และภูมิปัญญา +60`,
      'milestone'
    );
  }

  public applyCustomization(custom: HeroCustomization, resetAgeToInfant = true): void {
    this.name = custom.name.trim() || this.config.defaultHeroName;
    this.clanName = custom.clanName.trim() || this.config.defaultClanName;
    this.str = custom.str;
    this.int = custom.int;
    this.agi = custom.agi;
    this.cloakColor = custom.cloakColor;
    this.activeTraits = this.allTraits.filter((t) => custom.traitIds.includes(t.id));

    this.maxHealth = this.config.needs.health.max + (this.str - 5) * 6;
    this.health = this.maxHealth;
    this.hunger = this.config.needs.hunger.max;
    this.energy = this.config.needs.energy.max;

    if (resetAgeToInfant) {
      this.baseAge = this.config.initialAge;
      this.currentAge = this.config.initialAge;
    }

    const nextStage = this.resolveLifeStage(this.currentAge);
    this.currentStage = nextStage;
    this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);

    const traitNames =
      this.activeTraits.map((t) => t.name.split(' ')[0]).join(', ') || 'ไร้ลักษณะพิเศษ';
    this.logEvent(
      `พรแห่งพระเจ้าประทานชีวิตให้ "${this.name} ${this.clanName}" (STR ${this.str} • INT ${this.int} • AGI ${this.agi} | นิสัย: ${traitNames})`,
      'milestone'
    );
    this.spawnFloatingText('✨ จุติร่างใหม่!', '#ffd166');
  }

  private resolveLifeStage(age: number): LifeStageConfig {
    for (const st of this.config.lifeStages) {
      if (age >= st.minAge && age <= st.maxAge) {
        return st;
      }
    }
    return this.config.lifeStages[this.config.lifeStages.length - 1];
  }

  public respawnOnIsland(isInitial = false): void {
    const spawnTile = this.world.getCenterSpawnTile();
    const tileSize = this.world.getConfig().tileSize;
    this.tileX = spawnTile.x;
    this.tileY = spawnTile.y;
    this.x = spawnTile.x * tileSize + tileSize / 2;
    this.y = spawnTile.y * tileSize + tileSize / 2;

    this.hunger = this.config.needs.hunger.initial;
    this.energy = this.config.needs.energy.initial;
    this.health = this.maxHealth;
    this.path = [];
    this.targetResource = null;
    this.actionState = 'idle';
    this.currentAction = 'explore_island';
    this.visitedTiles.clear();
    this.visitedTiles.add(`${this.tileX},${this.tileY}`);

    this.currentStage = this.resolveLifeStage(this.currentAge);
    this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);

    this.syncVisualPosition();
    this.evaluateBrain(true);

    if (isInitial) {
      this.logEvent(
        `${this.name} ${this.clanName} ถือกำเนิดข้างกองไฟศักดิ์สิทธิ์ที่พิกัด (${this.tileX}, ${this.tileY})`,
        'milestone'
      );
    } else {
      this.logEvent(`ออกเดินทางมาตั้งรกรากบนเกาะแห่งใหม่ที่พิกัด (${this.tileX}, ${this.tileY})`, 'info');
    }
  }

  public update(
    simDeltaSec: number,
    elapsedYears: number,
    dayOfYear: number,
    clockStr: string,
    isNight: boolean
  ): void {
    this.dayOfYear = dayOfYear;
    this.currentClockStr = clockStr;
    this.isNight = isNight;

    const newAge = this.baseAge + elapsedYears;
    if (newAge > this.currentAge) {
      this.currentAge = newAge;
      this.handleAgeProgression();
    }

    if (simDeltaSec <= 0) return;

    if (this.beastEncounterCooldown > 0) {
      this.beastEncounterCooldown -= simDeltaSec;
    }

    this.updateNeeds(simDeltaSec);
    this.checkBeastEncounters();
    this.evaluateBrain(false);
    this.executeCurrentAction(simDeltaSec);
    this.updateAnimations(simDeltaSec);
    this.syncVisualPosition();
    this.drawPathLine();
  }

  private checkBeastEncounters(): void {
    if (this.beastEncounterCooldown > 0) return;
    const beasts = this.world.getBeasts();
    for (const beast of beasts) {
      const d = Math.hypot(beast.tileX - this.tileX, beast.tileY - this.tileY);
      if (d <= 2.4) {
        this.beastEncounterCooldown = 3.5;
        if (this.str >= 6 && this.health >= 40 && this.currentStage.id !== 'infant') {
          this.world.removeBeast(beast);
          this.loreExp += 40;
          this.str += 1;
          this.spawnFloatingText('⚔️ ปราบหมาป่าเงา! (STR +1)', '#ffd166');
          this.logEvent(
            `ปะทะและขับไล่หมาป่าเงาแห่งพงไพรสำเร็จ! ได้รับ STR +1 และภูมิปัญญา +40`,
            'milestone'
          );
        } else {
          this.health = Math.max(10, this.health - 12);
          this.spawnFloatingText('🐺 ตกใจหมาป่า! หนีเข้าแคมป์!', '#e63946');
          this.logEvent(
            `เผชิญหน้าหมาป่าเงาดุร้าย! รีบวิ่งหนีกลับเข้าหาแสงไฟกลางหมู่บ้าน`,
            'warn'
          );
          this.switchAction('warm_campfire');
        }
        break;
      }
    }
  }

  private handleAgeProgression(): void {
    const nextStage = this.resolveLifeStage(this.currentAge);
    if (nextStage.id !== this.currentStage.id) {
      this.currentStage = nextStage;
      this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);
      this.logEvent(
        `เติบโตเข้าสู่ช่วง "${nextStage.name}" ที่อายุ ${this.currentAge} ปี — ${nextStage.description}`,
        'milestone'
      );
      this.spawnFloatingText(`${nextStage.badge}!`, '#ffd166');
    } else if (this.currentAge % 5 === 0) {
      this.logEvent(
        `ฉลองวันเกิดครบรอบ ${this.currentAge} ปี (สั่งสมภูมิปัญญา ${Math.floor(this.loreExp)} แต้ม)`,
        'info'
      );
      this.spawnFloatingText(`อายุ ${this.currentAge} ปี!`, '#ffd166');
    }

    if (this.currentAge >= this.config.maxLifespanAge) {
      this.generation++;
      this.baseAge = 1;
      this.currentAge = 1;
      this.str += 1;
      this.int += 1;
      this.agi += 1;
      this.currentStage = this.resolveLifeStage(1);
      this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);
      this.logEvent(
        `สิ้นสุดตำนานรุ่นก่อน... ทายาทรุ่นที่ ${this.generation} แห่ง ${this.clanName} สืบทอดมรดกและภูมิปัญญาต่อไป!`,
        'milestone'
      );
      this.spawnFloatingText(`🌟 ทายาทรุ่นที่ ${this.generation}`, '#8ef6ff');
    }
  }

  private getTraitMultiplier(key: keyof Pick<
    TraitConfig,
    'speedMultiplier' | 'energyDecayMultiplier' | 'sleepRecoveryMultiplier' | 'hungerRestoreMultiplier'
  >): number {
    let mult = 1.0;
    for (const t of this.activeTraits) {
      mult *= t[key];
    }
    return mult;
  }

  private getExploreTraitBonus(): number {
    let bonus = 0;
    for (const t of this.activeTraits) {
      bonus += t.exploreBonus;
    }
    if (this.currentStage.id === 'child' || this.currentStage.id === 'teen') {
      bonus += 0.08;
    }
    return bonus;
  }

  private updateNeeds(dt: number): void {
    const { hunger, energy, health } = this.config.needs;
    const weather = this.world.getWeather();
    const isSleeping = this.currentAction === 'sleep_tree' && this.actionState === 'performing';
    const isWarmingFire =
      this.currentAction === 'warm_campfire' && this.actionState === 'performing';
    const isMoving = this.actionState === 'moving';

    const stageHungerMult = this.currentStage.hungerDecayMultiplier;
    const weatherHungerMult = weather.hungerDecayMultiplier;
    const hungerDecay =
      hunger.decayPerSec *
      stageHungerMult *
      weatherHungerMult *
      (isSleeping ? 0.45 : 1.0) *
      dt;
    this.hunger = Phaser.Math.Clamp(this.hunger - hungerDecay, 0, hunger.max);

    const sleepTraitMult = this.getTraitMultiplier('sleepRecoveryMultiplier');

    if (isSleeping) {
      const sleepCfg = this.config.actions.sleep_tree;
      this.energy = Phaser.Math.Clamp(
        this.energy + sleepCfg.energyRestorePerSec * sleepTraitMult * dt,
        0,
        energy.max
      );
      this.health = Phaser.Math.Clamp(
        this.health + sleepCfg.healthRestorePerSec * sleepTraitMult * dt,
        0,
        this.maxHealth
      );
    } else if (isWarmingFire) {
      const fireCfg = this.config.actions.warm_campfire;
      this.energy = Phaser.Math.Clamp(
        this.energy + fireCfg.energyRestorePerSec * sleepTraitMult * dt,
        0,
        energy.max
      );
      this.health = Phaser.Math.Clamp(
        this.health + fireCfg.healthRestorePerSec * dt,
        0,
        this.maxHealth
      );
      this.loreExp += (0.4 + this.int * 0.12) * dt;
    } else {
      const extraMove = isMoving ? energy.moveExtraDecayPerSec : 0;
      const agiEfficiency = Math.max(0.65, 1 - (this.agi - 5) * 0.03);
      const energyDecayMult =
        this.currentStage.energyDecayMultiplier *
        this.getTraitMultiplier('energyDecayMultiplier') *
        agiEfficiency;

      this.energy = Phaser.Math.Clamp(
        this.energy - (energy.decayPerSec + extraMove) * energyDecayMult * dt,
        0,
        energy.max
      );
    }

    if (isMoving) {
      this.loreExp += (0.15 + this.int * 0.05) * dt;
    }

    // Snowstorm cold check (safe within 6.5 tiles of the village campfire)
    const fire = this.world.getCampfireResource();
    const distToFire = fire
      ? Math.hypot(this.tileX - fire.tileX, this.tileY - fire.tileY)
      : 99;
    const isFreezing = weather.coldDamagePerSec > 0 && distToFire > 6.5;

    const strResilience = Math.max(0.5, 1 - (this.str - 5) * 0.06);
    if (isFreezing) {
      this.health = Phaser.Math.Clamp(
        this.health - weather.coldDamagePerSec * strResilience * dt,
        5,
        this.maxHealth
      );
    } else if (this.hunger <= 0) {
      this.health = Phaser.Math.Clamp(
        this.health - hunger.starveDamagePerSec * strResilience * dt,
        1,
        this.maxHealth
      );
    } else if (this.energy <= 0) {
      this.health = Phaser.Math.Clamp(
        this.health - energy.exhaustDamagePerSec * strResilience * dt,
        1,
        this.maxHealth
      );
    } else if (
      this.hunger >= health.wellThresholdHunger &&
      this.energy >= health.wellThresholdEnergy
    ) {
      this.health = Phaser.Math.Clamp(
        this.health + health.regenPerSecWhenWell * dt,
        0,
        this.maxHealth
      );
    }
  }

  private evaluateBrain(forceReplan: boolean): void {
    if (this.currentAction === 'eat_berry' && this.actionState === 'performing' && !forceReplan) {
      return;
    }

    const stats = this.world.getResourceStats();
    const weather = this.world.getWeather();
    const beasts = this.world.getBeasts();
    const isDangerNear = beasts.some(
      (b) => Math.hypot(b.tileX - this.tileX, b.tileY - this.tileY) <= 5.5 && this.str < 6
    );

    const result = this.brain.evaluate({
      hunger: this.hunger,
      maxHunger: this.config.needs.hunger.max,
      energy: this.energy,
      maxEnergy: this.config.needs.energy.max,
      currentAction: this.currentAction,
      isSleeping: this.currentAction === 'sleep_tree' && this.actionState === 'performing',
      isNight: this.isNight,
      isSnowing: weather.id === 'snow',
      isDangerNear,
      exploreTraitBonus: this.getExploreTraitBonus(),
      hasRipeBerryOnIsland: stats.ripeBerries > 0,
      hasTreeOnIsland: stats.trees > 0,
      hasBlessingShrine: stats.shrines > 0,
    });

    this.latestScores = result.scores;

    if (forceReplan || result.bestAction !== this.currentAction) {
      this.switchAction(result.bestAction);
    }
  }

  private switchAction(nextAction: ActionId): void {
    const prevAction = this.currentAction;
    this.currentAction = nextAction;
    this.path = [];
    this.targetResource = null;
    this.actionState = 'idle';
    this.actionTimer = 0;

    const iconKey = this.config.actions[nextAction].icon;
    this.thoughtIcon.setTexture(iconKey);
    this.thoughtIcon.setDisplaySize(13, 13);

    if (nextAction === 'eat_berry' && prevAction !== 'eat_berry') {
      this.logEvent(`ท้องเริ่มร้อง (ความอิ่ม ${Math.round(this.hunger)}%) ออกเดินหาพุ่มเบอร์รี่ป่า`, 'food');
    } else if (nextAction === 'sleep_tree' && prevAction !== 'sleep_tree') {
      this.logEvent(`ร่างกายอ่อนล้า (พลังงาน ${Math.round(this.energy)}%) มองหาร่มไม้หลิวเพื่อหลับพัก`, 'sleep');
    } else if (nextAction === 'warm_campfire' && prevAction !== 'warm_campfire') {
      const isSnow = this.world.getWeather().id === 'snow';
      this.logEvent(
        isSnow
          ? `❄️ หิมะหนาวเหน็บ! รีบเดินกลับไปผิงไฟศักดิ์สิทธิ์กลางหมู่บ้านเพื่อรักษาชีวิต`
          : `เดินกลับเข้าสู่ลานกองไฟศักดิ์สิทธิ์เพื่อผิงไฟและทบทวนความรู้`,
        isSnow ? 'warn' : 'info'
      );
    } else if (nextAction === 'seek_blessing' && prevAction !== 'seek_blessing') {
      this.logEvent(`🌟 สัมผัสได้ถึงพลังศักดิ์สิทธิ์! มุ่งหน้าไปรับพรจากผลึกดารา`, 'milestone');
    }
  }

  private executeCurrentAction(dt: number): void {
    if (this.currentAction === 'eat_berry') {
      this.handleEatBerryAction(dt);
    } else if (this.currentAction === 'sleep_tree') {
      this.handleSleepTreeAction(dt);
    } else if (this.currentAction === 'warm_campfire') {
      this.handleWarmCampfireAction(dt);
    } else if (this.currentAction === 'seek_blessing') {
      this.handleSeekBlessingAction(dt);
    } else {
      this.handleExploreAction(dt);
    }
  }

  private handleSeekBlessingAction(dt: number): void {
    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        if (this.targetResource && this.targetResource.type === 'blessing_shrine') {
          this.world.removeResource(this.targetResource);
          this.loreExp += 55;
          this.hunger = this.config.needs.hunger.max;
          this.energy = this.config.needs.energy.max;
          this.health = this.maxHealth;
          this.int += 1;
          this.str += 1;
          this.spawnFloatingText('💎 รับพรผลึกดารา! (STR/INT +1)', '#8ef6ff');
          this.logEvent(
            `ซึมซับพลังจากผลึกดาราศักดิ์สิทธิ์! ได้รับ STR +1, INT +1 และภูมิปัญญา +55`,
            'milestone'
          );
        }
        this.targetResource = null;
        this.actionState = 'idle';
        this.evaluateBrain(true);
      }
      return;
    }

    if (!this.targetResource || this.targetResource.type !== 'blessing_shrine') {
      const shrine = this.world.findNearestBlessingShrine(this.tileX, this.tileY);
      if (!shrine) {
        this.switchAction('explore_island');
        return;
      }
      this.targetResource = shrine;
      this.path = findPathAStar(this.world, this.tileX, this.tileY, shrine.tileX, shrine.tileY);
      this.actionState = 'moving';
    }

    if (this.tileX === this.targetResource.tileX && this.tileY === this.targetResource.tileY) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.seek_blessing.durationSec;
      this.path = [];
      return;
    }

    if (this.path.length === 0) {
      this.path = findPathAStar(
        this.world,
        this.tileX,
        this.tileY,
        this.targetResource.tileX,
        this.targetResource.tileY
      );
      if (this.path.length === 0) {
        this.switchAction('explore_island');
        return;
      }
    }

    this.moveAlongPath(dt);
  }

  private handleEatBerryAction(dt: number): void {
    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        const cfg = this.config.actions.eat_berry;
        if (this.targetResource && this.targetResource.hasBerry) {
          this.world.harvestBerryBush(this.targetResource);
          const restoreMult = this.getTraitMultiplier('hungerRestoreMultiplier');
          const restored = Math.round(cfg.hungerRestore * restoreMult);
          this.hunger = Math.min(this.config.needs.hunger.max, this.hunger + restored);
          this.health = Math.min(this.maxHealth, this.health + cfg.healthRestore);
          this.berriesEaten++;
          this.spawnFloatingText(`+${restored} 🍒`, '#8ef6ff');
          this.logEvent(
            `เก็บเบอร์รี่ป่ากินที่พิกัด (${this.tileX}, ${this.tileY}) ฟื้นฟูความอิ่ม +${restored}`,
            'food'
          );
        }
        this.targetResource = null;
        this.actionState = 'idle';
        this.evaluateBrain(true);
      }
      return;
    }

    if (!this.targetResource || !this.targetResource.hasBerry) {
      const bush = this.world.findNearestRipeBerryBush(this.tileX, this.tileY);
      if (!bush) {
        this.switchAction('explore_island');
        return;
      }
      this.targetResource = bush;
      this.path = findPathAStar(this.world, this.tileX, this.tileY, bush.tileX, bush.tileY);
      this.actionState = 'moving';
    }

    if (this.tileX === this.targetResource.tileX && this.tileY === this.targetResource.tileY) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.eat_berry.durationSec;
      this.path = [];
      return;
    }

    if (this.path.length === 0) {
      this.path = findPathAStar(
        this.world,
        this.tileX,
        this.tileY,
        this.targetResource.tileX,
        this.targetResource.tileY
      );
      if (this.path.length === 0) {
        this.switchAction('explore_island');
        return;
      }
    }

    this.moveAlongPath(dt);
  }

  private handleSleepTreeAction(dt: number): void {
    if (this.actionState === 'performing') {
      this.zzzParticleTimer += dt;
      if (this.zzzParticleTimer >= 1.6) {
        this.zzzParticleTimer = 0;
        this.spawnFloatingText('Zzz..', '#8ef6ff');
      }
      if (this.energy >= this.config.actions.sleep_tree.wakeUpThreshold) {
        this.napsTaken++;
        this.spawnFloatingText('สดชื่น! ✨', '#ffd166');
        this.actionState = 'idle';
        this.targetResource = null;
        this.evaluateBrain(true);
      }
      return;
    }

    if (!this.targetResource) {
      const spot = this.world.findNearestRestSpot(this.tileX, this.tileY);
      if (!spot) {
        this.actionState = 'performing';
        return;
      }
      this.targetResource = spot;
      this.path = findPathAStar(this.world, this.tileX, this.tileY, spot.tileX, spot.tileY);
      this.actionState = 'moving';
    }

    if (this.tileX === this.targetResource.tileX && this.tileY === this.targetResource.tileY) {
      this.actionState = 'performing';
      this.zzzParticleTimer = 0;
      this.path = [];
      this.logEvent(
        `เอนกายพักผ่อนใต้แสงโคมไม้ที่พิกัด (${this.tileX}, ${this.tileY}) 💤`,
        'sleep'
      );
      return;
    }

    if (this.path.length === 0) {
      this.path = findPathAStar(
        this.world,
        this.tileX,
        this.tileY,
        this.targetResource.tileX,
        this.targetResource.tileY
      );
      if (this.path.length === 0) {
        this.actionState = 'performing';
        return;
      }
    }

    this.moveAlongPath(dt);
  }

  private handleWarmCampfireAction(dt: number): void {
    const fire = this.world.getCampfireResource();
    if (!fire) {
      this.switchAction('explore_island');
      return;
    }

    const standX = fire.tileX;
    const standY = fire.tileY + 1;

    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      if (
        (this.actionTimer <= 0 || this.energy >= 92) &&
        this.world.getWeather().id !== 'snow'
      ) {
        this.spawnFloatingText(`+ปัญญา ✨`, '#ffd166');
        this.actionState = 'idle';
        this.evaluateBrain(true);
      }
      return;
    }

    if (this.tileX === standX && this.tileY === standY) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.warm_campfire.durationSec;
      this.path = [];
      return;
    }

    if (this.path.length === 0) {
      this.path = findPathAStar(this.world, this.tileX, this.tileY, standX, standY);
      if (this.path.length === 0) {
        this.actionState = 'performing';
        this.actionTimer = 2.5;
        return;
      }
      this.actionState = 'moving';
    }

    this.moveAlongPath(dt);
  }

  private handleExploreAction(dt: number): void {
    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        this.actionState = 'idle';
      }
      return;
    }

    if (this.path.length === 0) {
      const radius = this.config.actions.explore_island.maxWanderRadiusTiles;
      const destTile = this.world.getRandomWalkableTileNear(this.tileX, this.tileY, radius);
      this.path = findPathAStar(this.world, this.tileX, this.tileY, destTile.x, destTile.y);
      if (this.path.length > 0) {
        this.actionState = 'moving';
      } else {
        this.actionState = 'performing';
        this.actionTimer = 1.0;
      }
      return;
    }

    this.moveAlongPath(dt);
    if (this.path.length === 0) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.explore_island.pauseDurationSec;
    }
  }

  private moveAlongPath(dt: number): void {
    if (this.path.length === 0) return;

    // Phase 3 Dynamic Obstacle Check: If God spawned a mountain blocking the next step, re-path immediately!
    const nextCheck = this.path[0];
    if (!this.world.isWalkable(nextCheck.x, nextCheck.y)) {
      const finalGoal = this.path[this.path.length - 1];
      this.path = findPathAStar(this.world, this.tileX, this.tileY, finalGoal.x, finalGoal.y);
      this.spawnFloatingText('⛰️ หลบสิ่งกีดขวาง!', '#ffd166');
      return;
    }

    const tileSize = this.world.getConfig().tileSize;
    const currentTile = this.world.getTile(this.tileX, this.tileY);
    const terrainMult = currentTile ? currentTile.biome.speedMultiplier : 1.0;
    const pathRoadBonus = currentTile?.isPath ? 1.15 : 1.0;
    const weatherMult = this.world.getWeather().moveSpeedMultiplier;
    const agiMult = 1 + (this.agi - 5) * 0.04;
    const stageMult = this.currentStage.speedMultiplier;
    const traitMult = this.getTraitMultiplier('speedMultiplier');

    let remainingDist =
      this.config.baseMoveSpeedPx *
      terrainMult *
      pathRoadBonus *
      weatherMult *
      agiMult *
      stageMult *
      traitMult *
      dt;

    while (remainingDist > 0 && this.path.length > 0) {
      const nextStep = this.path[0];
      if (!this.world.isWalkable(nextStep.x, nextStep.y)) {
        this.path = [];
        break;
      }
      const targetPx = nextStep.x * tileSize + tileSize / 2;
      const targetPy = nextStep.y * tileSize + tileSize / 2;

      const dx = targetPx - this.x;
      const dy = targetPy - this.y;
      const dist = Math.hypot(dx, dy);

      if (dx < -0.1) {
        this.sprite.setFlipX(true);
      } else if (dx > 0.1) {
        this.sprite.setFlipX(false);
      }

      if (dist <= remainingDist) {
        this.x = targetPx;
        this.y = targetPy;
        this.tileX = nextStep.x;
        this.tileY = nextStep.y;
        this.visitedTiles.add(`${this.tileX},${this.tileY}`);
        remainingDist -= dist;
        this.path.shift();
      } else {
        this.x += (dx / dist) * remainingDist;
        this.y += (dy / dist) * remainingDist;
        remainingDist = 0;
      }
    }
  }

  private updateHeroSpriteTexture(key: string): void {
    if (!this.scene.textures.exists(key)) return;
    this.sprite.setTexture(key);
    const sc = this.currentStage?.scale ?? 1.0;
    if (key === 'hero_sleep') {
      this.sprite.setDisplaySize(Math.round(34 * sc), Math.round(28 * sc));
    } else {
      this.sprite.setDisplaySize(Math.round(30 * sc), Math.round(34 * sc));
    }
  }

  private getStageSpritePrefix(): string {
    const st = this.currentStage?.id ?? 'adult';
    if (st === 'elder') return 'hero_elder';
    if (st === 'adult') return 'hero_adult';
    return 'hero_youth';
  }

  private updateAnimations(dt: number): void {
    this.animTimer += dt;

    if (this.currentAction === 'sleep_tree' && this.actionState === 'performing') {
      this.updateHeroSpriteTexture('hero_sleep');
      return;
    }

    const prefix = this.getStageSpritePrefix();

    if (this.actionState === 'moving') {
      if (this.animTimer >= 0.18) {
        this.animTimer = 0;
        this.animFrame = this.animFrame === 0 ? 1 : 0;
      }
      this.updateHeroSpriteTexture(`${prefix}_${this.animFrame}`);
    } else {
      if (this.animTimer >= 0.45) {
        this.animTimer = 0;
        this.animFrame = this.animFrame === 0 ? 1 : 0;
      }
      this.updateHeroSpriteTexture(`${prefix}_${this.animFrame}`);
    }
  }

  private syncVisualPosition(): void {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y + 3);
    this.heroGlow.setPosition(this.x, this.y - 4);

    const bobOffset = this.animFrame === 1 ? -1.5 : 0;
    this.thoughtBg.setPosition(this.x, this.y - 22 + bobOffset);
    this.thoughtIcon.setPosition(this.x, this.y - 23 + bobOffset);
  }

  private drawPathLine(): void {
    this.pathGraphics.clear();
    if (this.path.length === 0) return;

    const tileSize = this.world.getConfig().tileSize;
    this.pathGraphics.fillStyle(0x8ef6ff, 0.35);

    for (let i = 0; i < this.path.length; i++) {
      const pt = this.path[i];
      const px = pt.x * tileSize + tileSize / 2;
      const py = pt.y * tileSize + tileSize / 2;
      if (i === this.path.length - 1) {
        this.pathGraphics.fillStyle(0xe0a945, 0.85);
        this.pathGraphics.fillCircle(px, py, 2.5);
      } else {
        this.pathGraphics.fillCircle(px, py, 1.2);
      }
    }
  }

  private spawnFloatingText(message: string, colorHex: string): void {
    const txt = this.scene.add.text(this.x, this.y - 26, message, {
      fontFamily: '"Chakra Petch", sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: colorHex,
      stroke: '#06070b',
      strokeThickness: 3,
    });
    txt.setOrigin(0.5, 0.5);
    txt.setDepth(3500);

    this.scene.tweens.add({
      targets: txt,
      y: txt.y - 18,
      alpha: { from: 1, to: 0 },
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  private logEvent(text: string, type: ChronicleEntry['type']): void {
    if (this.onChronicleLog) {
      this.onChronicleLog({
        year: this.currentAge,
        day: this.dayOfYear,
        timeStr: this.currentClockStr,
        lifeStageBadge: this.currentStage.badge,
        text,
        type,
      });
    }
  }

  public getStatusSnapshot(): HeroStatusSnapshot {
    const actionLabel = this.config.actions[this.currentAction].label;
    let actionStateText = 'กำลังครุ่นคิด...';
    let narrativeAction = 'กำลังเดินสำรวจสายหมอกเรืองแสง';

    if (this.currentAction === 'eat_berry') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังเก็บผลเบอร์รี่ป่าริมธารน้ำเรืองแสง'
          : 'กำลังมุ่งหน้าไปหาพุ่มเบอร์รี่ป่า';
      actionStateText = `🍒 ${narrativeAction}`;
    } else if (this.currentAction === 'sleep_tree') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังหลับใหลฟื้นฟูพลังอยู่ใต้ร่มไม้โบราณ'
          : 'กำลังเดินกลับไปพักผ่อนใต้ร่มไม้';
      actionStateText = `💤 ${narrativeAction}`;
    } else if (this.currentAction === 'warm_campfire') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังนั่งผิงไฟศักดิ์สิทธิ์และใคร่ครวญภูมิปัญญา'
          : 'กำลังเดินกลับไปยังกองไฟกลางหมู่บ้าน';
      actionStateText = `🔥 ${narrativeAction}`;
    } else if (this.currentAction === 'seek_blessing') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังซึมซับพรศักดิ์สิทธิ์จากผลึกดารา'
          : 'กำลังมุ่งหน้าไปรับพรที่แท่นผลึกดารา';
      actionStateText = `💎 ${narrativeAction}`;
    } else {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังหยุดชมสายหมอกเรืองแสงท่ามกลางพงไพร'
          : 'กำลังออกสำรวจเส้นทางใหม่ในพงไพร';
      actionStateText = `🧭 ${narrativeAction}`;
    }

    return {
      name: this.name,
      clanName: this.clanName,
      age: this.currentAge,
      maxAge: this.config.maxLifespanAge,
      dayOfYear: this.dayOfYear,
      lifeStage: this.currentStage,
      str: this.str,
      int: this.int,
      agi: this.agi,
      loreExp: Math.floor(this.loreExp),
      traits: this.activeTraits,
      cloakColor: this.cloakColor,
      tileX: this.tileX,
      tileY: this.tileY,
      hunger: this.hunger,
      maxHunger: this.config.needs.hunger.max,
      energy: this.energy,
      maxEnergy: this.config.needs.energy.max,
      health: this.health,
      maxHealth: this.maxHealth,
      currentActionId: this.currentAction,
      currentActionLabel: actionLabel,
      actionStateText,
      narrativeCaption: `${this.name} ${this.clanName} ${narrativeAction}`,
      scores: this.latestScores,
      berriesEaten: this.berriesEaten,
      napsTaken: this.napsTaken,
      tilesExplored: this.visitedTiles.size,
      generation: this.generation,
      activeWeather: this.world.getWeather(),
    };
  }
}
