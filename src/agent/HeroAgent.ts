import Phaser from 'phaser';
import { soundscape } from '../core/AudioManager';
import {
  ActionId,
  AgentConfig,
  ChronicleEntry,
  HeirCandidate,
  HeroCustomization,
  HeroStatusSnapshot,
  LifeStageConfig,
  TraitConfig,
  UtilityScoreItem,
  WorldResource,
} from '../core/Types';
import { KingdomManager } from '../kingdom';
import { IslandWorld } from '../world/IslandWorld';
import { SeasonAndDisasterSystem } from '../world/SeasonAndDisasterSystem';
import { DeepCognitionEngine, DeepThoughtOutput } from './DeepCognitionEngine';
import { findPathAStar, GridPoint } from './Pathfinder';
import { UtilityBrain } from './UtilityBrain';

export class HeroAgent {
  private scene: Phaser.Scene;
  private world: IslandWorld;
  private kingdom: KingdomManager;
  private seasonSys: SeasonAndDisasterSystem;
  private config: AgentConfig;
  private allTraits: TraitConfig[];
  private brain: UtilityBrain;
  private cognition: DeepCognitionEngine;

  public name: string;
  public clanName: string;
  public str: number;
  public int: number;
  public agi: number;
  public cloakColor = '#3b7a57';
  public activeTraits: TraitConfig[] = [];
  public loreExp = 0;
  public generation = 1;

  public tileX = 64;
  public tileY = 64;
  public x = 0;
  public y = 0;

  private hunger: number;
  private energy: number;
  private health: number;
  private maxHealth: number;
  private baseAge: number;
  private currentAge: number;
  private worldYear = 1;
  private maxWorldYears = 300;
  private isAwaitingSuccession = false;
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
  private workSwingClock = 0;
  private beastEncounterCooldown = 0;

  private path: GridPoint[] = [];
  private targetResource: WorldResource | null = null;
  private latestScores: UtilityScoreItem[] = [];
  private latestDeepThought!: DeepThoughtOutput;

  private berriesEaten = 0;
  private napsTaken = 0;
  private buildingsCompleted = 0;
  private visitedTiles = new Set<string>();

  private sprite: Phaser.GameObjects.Sprite;
  private shadowSprite: Phaser.GameObjects.Image;
  private thoughtBubble: Phaser.GameObjects.Text;
  private toolSprite: Phaser.GameObjects.Image;
  private heroGlow: Phaser.GameObjects.Image;
  private pathGraphics: Phaser.GameObjects.Graphics;
  private workHitTimer = 0;
  private floatingQueue: { message: string; colorHex: string }[] = [];
  private floatingCooldown = 0;
  private activeFloatingTexts: { txt: Phaser.GameObjects.Text; offsetY: number }[] = [];

  private onChronicleLog?: (entry: Omit<ChronicleEntry, 'id'>) => void;
  private onHeirSuccessionRequired?: (
    candidates: HeirCandidate[],
    lateHero: {
      name: string;
      clanName: string;
      generation: number;
      age: number;
      philosophyTitle: string;
      buildingsBuilt: number;
    }
  ) => void;

  constructor(
    scene: Phaser.Scene,
    world: IslandWorld,
    kingdom: KingdomManager,
    seasonSys: SeasonAndDisasterSystem,
    config: AgentConfig,
    allTraits: TraitConfig[],
    onChronicleLog?: (entry: Omit<ChronicleEntry, 'id'>) => void,
    onHeirSuccessionRequired?: (
      candidates: HeirCandidate[],
      lateHero: {
        name: string;
        clanName: string;
        generation: number;
        age: number;
        philosophyTitle: string;
        buildingsBuilt: number;
      }
    ) => void
  ) {
    this.scene = scene;
    this.world = world;
    this.kingdom = kingdom;
    this.seasonSys = seasonSys;
    this.config = config;
    this.allTraits = allTraits;
    this.brain = new UtilityBrain(config);
    this.cognition = new DeepCognitionEngine();
    this.onChronicleLog = onChronicleLog;
    this.onHeirSuccessionRequired = onHeirSuccessionRequired;

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

    const worldContainer = this.world.getWorldContainer();

    this.pathGraphics = this.scene.add.graphics();
    this.pathGraphics.setDepth(5);
    worldContainer.add(this.pathGraphics);

    this.heroGlow = this.scene.add.image(0, 0, 'light_warm_point');
    this.heroGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.heroGlow.setScale(0.32);
    this.heroGlow.setAlpha(0.24);
    this.heroGlow.setDepth(3100);
    worldContainer.add(this.heroGlow);

    // Phase 6.1: Grounded Elliptical Drop Shadow beneath Hero
    this.shadowSprite = this.scene.add.image(0, 0, 'drop_shadow');
    this.shadowSprite.setDisplaySize(28, 13);
    this.shadowSprite.setAlpha(0.45);
    worldContainer.add(this.shadowSprite);

    this.sprite = this.scene.add.sprite(0, 0, `${this.getStageSpritePrefix()}_0`);
    this.sprite.setOrigin(0.5, 0.78);
    worldContainer.add(this.sprite);

    // Phase 8.1: Cozy Thought Bubble Icon above Hero's head
    this.thoughtBubble = this.scene.add.text(0, 0, '🧭', {
      fontFamily: '"Itim", "Chakra Petch", sans-serif',
      fontSize: '11px',
      color: '#2c1e16',
      backgroundColor: 'rgba(253, 251, 247, 0.92)',
      padding: { x: 5, y: 2 },
    });
    this.thoughtBubble.setOrigin(0.5, 1);
    this.thoughtBubble.setDepth(3490);
    worldContainer.add(this.thoughtBubble);

    this.toolSprite = this.scene.add.image(0, 0, 'icon_hammer');
    this.toolSprite.setDisplaySize(15, 15);
    this.toolSprite.setOrigin(0.5, 0.75);
    this.toolSprite.setVisible(false);
    worldContainer.add(this.toolSprite);

    this.respawnOnIsland(true);
  }

  public refreshEraAppearance(): void {
    this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_${this.animFrame}`);
  }

  public getCognitionEngine(): DeepCognitionEngine {
    return this.cognition;
  }

  public grantDivineInspiration(): void {
    this.health = this.maxHealth;
    this.energy = this.config.needs.energy.max;
    this.hunger = Math.min(this.config.needs.hunger.max, this.hunger + 30);
    this.int += 1;
    this.loreExp += 60;
    this.kingdom.addResources(10, 8, 5);
    this.cognition.recordEpisodicMemory({
      generation: this.generation,
      heroName: this.name,
      age: this.currentAge,
      season: this.seasonSys.getSeasonMeta().id,
      title: 'ปาฏิหาริย์แห่งแรงบันดาลใจจากพระเจ้า',
      reflection: 'แสงอบอุ่นสาดส่องลงมาจากฟากฟ้า มอบความรู้แจ้งและทรัพยากรให้ตระกูลของเรา',
      emotion: 'awe',
      importance: 9,
      tileX: this.tileX,
      tileY: this.tileY,
    });
    this.spawnFloatingText('✨ พรแห่งปัญญา! (INT +1, ไม้/หิน +10)', '#ffd166');
    this.logEvent(
      `ได้รับ "แรงบันดาลใจจากพระเจ้า"! ฟื้นฟูพลังเต็มเปี่ยม พร้อมเพิ่ม INT เป็น ${this.int}, ภูมิปัญญา +60 และทรัพยากรอาณาจักร`,
      'milestone'
    );
  }

  public generateHeirCandidates(): HeirCandidate[] {
    const nextGen = this.generation + 1;
    const namesPool = [
      ['อารอน', 'วาเลน', 'คีรอน'],
      ['ไลร่า', 'เซเลส', 'เอลาร่า'],
      ['เซธ', 'ฟินน์', 'เรเวน'],
    ];
    const cloakPool = ['#3b7a57', '#2563eb', '#b91c1c', '#6d28d9', '#d97706'];
    const tIds = this.allTraits.map((t) => t.id);
    const pickTraits = (i1: number, i2: number) => [
      tIds[i1 % tIds.length] ?? 'fleet_footed',
      tIds[i2 % tIds.length] ?? 'forest_child',
    ];

    return [
      {
        id: `heir_guardian_${nextGen}`,
        name: namesPool[0][nextGen % 3],
        archetypeTitle: 'สายผู้พิทักษ์แห่งปราการ (Guardian Heir)',
        description:
          'สืบทอดพละกำลังและความกล้าหาญ เด่นด้านการสกัดแร่หิน ตัดไม้ และปราบสัตว์ร้ายปกป้องเมือง',
        startingAge: 14,
        str: Math.min(15, this.str + 2),
        int: Math.min(15, this.int + 1),
        agi: Math.min(15, this.agi + 1),
        traitIds: pickTraits(0, 2),
        cloakColor: cloakPool[(nextGen + 1) % cloakPool.length],
      },
      {
        id: `heir_scholar_${nextGen}`,
        name: namesPool[1][nextGen % 3],
        archetypeTitle: 'สายปราชญ์และสถาปนิก (Architect Scholar)',
        description:
          'เปี่ยมด้วยสติปัญญาและปรัชญา เร่งสั่งสมภูมิปัญญาเพื่อวิวัฒนาการโลกสู่ยุคสมัยใหม่ได้เร็วที่สุด',
        startingAge: 14,
        str: Math.min(15, this.str + 1),
        int: Math.min(15, this.int + 2),
        agi: Math.min(15, this.agi + 1),
        traitIds: pickTraits(1, 3),
        cloakColor: cloakPool[(nextGen + 2) % cloakPool.length],
      },
      {
        id: `heir_pioneer_${nextGen}`,
        name: namesPool[2][nextGen % 3],
        archetypeTitle: 'สายนักบุกเบิกว่องไว (Swift Pioneer)',
        description:
          'เริ่มตั้งแต่วัยเยาว์ (7 ปี) มีความว่องไวสูง สำรวจแผนที่และเก็บเกี่ยวเสบียงอาหารได้อย่างรวดเร็ว',
        startingAge: 7,
        str: Math.min(15, this.str + 1),
        int: Math.min(15, this.int + 1),
        agi: Math.min(15, this.agi + 2),
        traitIds: pickTraits(0, 1),
        cloakColor: cloakPool[(nextGen + 3) % cloakPool.length],
      },
    ];
  }

  public triggerNextGenerationHeir(): void {
    if (this.isAwaitingSuccession) return;
    const candidates = this.generateHeirCandidates();
    if (this.onHeirSuccessionRequired) {
      this.isAwaitingSuccession = true;
      const domPhil = this.cognition.getDominantPhilosophy();
      this.onHeirSuccessionRequired(candidates, {
        name: this.name,
        clanName: this.clanName,
        generation: this.generation,
        age: this.currentAge,
        philosophyTitle: domPhil.name,
        buildingsBuilt: this.buildingsCompleted,
      });
      return;
    }
    this.ascendChosenHeir(candidates[0]);
  }

  public ascendChosenHeir(heir: HeirCandidate): void {
    this.isAwaitingSuccession = false;
    this.cognition.recordAncestralLegacy(
      this.generation,
      `${this.name} ${this.clanName}`,
      this.clanName,
      this.buildingsCompleted
    );

    this.generation++;
    this.name = heir.name.trim() || this.name;
    this.baseAge = heir.startingAge;
    this.currentAge = heir.startingAge;
    this.str = heir.str;
    this.int = heir.int;
    this.agi = heir.agi;
    this.cloakColor = heir.cloakColor;
    this.activeTraits = this.allTraits.filter((t) => heir.traitIds.includes(t.id));
    this.maxHealth = this.config.needs.health.max + (this.str - 5) * 6;
    this.health = this.maxHealth;
    this.hunger = this.config.needs.hunger.max;
    this.energy = this.config.needs.energy.max;
    this.currentStage = this.resolveLifeStage(this.currentAge);
    this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);

    this.cognition.recordEpisodicMemory({
      generation: this.generation,
      heroName: this.name,
      age: this.currentAge,
      season: this.seasonSys.getSeasonMeta().id,
      title: `พิธีสืบทอดสายเลือดสู่รุ่นที่ ${this.generation}: ${this.name}`,
      reflection: `รับมอบเจตนารมณ์แห่ง ${this.clanName} เพื่อพัฒนาอารยธรรมต่อไปจนกว่าโลกจะถึงกาลอวสาน`,
      emotion: 'wisdom',
      importance: 10,
      tileX: this.tileX,
      tileY: this.tileY,
    });

    this.logEvent(
      `สืบทอดมรดกตระกูลสู่รุ่นที่ ${this.generation}: "${this.name} ${this.clanName}" (${heir.archetypeTitle})`,
      'milestone'
    );
    this.spawnFloatingText(`ทายาทรุ่นที่ ${this.generation}: ${this.name}`, '#8ef6ff');
  }

  public applyCustomization(custom: HeroCustomization, resetAge = true): void {
    this.isAwaitingSuccession = false;
    this.name = custom.name.trim() || this.config.defaultHeroName;
    this.clanName = custom.clanName.trim() || this.config.defaultClanName;
    this.str = custom.str;
    this.int = custom.int;
    this.agi = custom.agi;
    this.cloakColor = custom.cloakColor;
    this.activeTraits = this.allTraits.filter((t) => custom.traitIds.includes(t.id));
    this.kingdom.setHeroCloakColor(this.cloakColor);

    this.maxHealth = this.config.needs.health.max + (this.str - 5) * 6;
    this.health = this.maxHealth;
    this.hunger = this.config.needs.hunger.max;
    this.energy = this.config.needs.energy.max;

    if (resetAge) {
      const startAge = custom.startingAge ?? this.config.initialAge;
      this.baseAge = startAge;
      this.currentAge = startAge;
    }

    const nextStage = this.resolveLifeStage(this.currentAge);
    this.currentStage = nextStage;
    this.updateHeroSpriteTexture(`${this.getStageSpritePrefix()}_0`);

    const traitNames =
      this.activeTraits.map((t) => t.name.split(' ')[0]).join(', ') || 'ไร้ลักษณะพิเศษ';
    this.logEvent(
      `ปฐมกาลแห่งสายเลือด "${this.name} ${this.clanName}" เริ่มต้นที่อายุ ${this.currentAge} ปี (STR ${this.str} • INT ${this.int} • AGI ${this.agi} | นิสัย: ${traitNames})`,
      'milestone'
    );
    this.spawnFloatingText(`เริ่มต้นตำนาน: ${this.name}`, '#ffd166');
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
    this.evaluateBrain(true, 0.1);

    if (isInitial) {
      this.cognition.recordEpisodicMemory({
        generation: this.generation,
        heroName: this.name,
        age: this.currentAge,
        season: 'spring',
        title: 'แสงแรกข้างกองไฟศักดิ์สิทธิ์',
        reflection: 'ลืมตาตื่นขึ้นครั้งแรกท่ามกลางไออุ่นของกองไฟและสายหมอกแห่งโมริมาร์',
        emotion: 'joy',
        importance: 8,
        tileX: this.tileX,
        tileY: this.tileY,
      });
      this.logEvent(
        `${this.name} ${this.clanName} ถือกำเนิดข้างกองไฟศักดิ์สิทธิ์ที่พิกัด (${this.tileX}, ${this.tileY})`,
        'milestone'
      );
    } else {
      this.logEvent(`ออกเดินทางมาตั้งรกรากบนทวีปแห่งใหม่ที่พิกัด (${this.tileX}, ${this.tileY})`, 'info');
    }
  }

  public update(
    simDeltaSec: number,
    elapsedYears: number,
    dayOfYear: number,
    clockStr: string,
    isNight: boolean,
    worldYear = 1,
    maxWorldYears = 300
  ): void {
    this.dayOfYear = dayOfYear;
    this.currentClockStr = clockStr;
    this.isNight = isNight;
    this.worldYear = worldYear;
    this.maxWorldYears = maxWorldYears;

    if (this.isAwaitingSuccession) return;

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
    this.evaluateBrain(false, simDeltaSec);
    this.executeCurrentAction(simDeltaSec);
    this.updateAnimations(simDeltaSec);
    this.updateFloatingQueue(simDeltaSec);
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
          this.kingdom.addResources(0, 4, 6);
          this.cognition.recordEpisodicMemory({
            generation: this.generation,
            heroName: this.name,
            age: this.currentAge,
            season: this.seasonSys.getSeasonMeta().id,
            title: 'ชัยชนะเหนือหมาป่าเงา',
            reflection: 'ยืนหยัดปกป้องผืนแผ่นดินและขับไล่สัตว์ร้ายด้วยพละกำลังของตนเอง',
            emotion: 'resolve',
            importance: 9,
            tileX: this.tileX,
            tileY: this.tileY,
          });
          this.spawnFloatingText('⚔️ ปราบหมาป่าเงา! (STR +1)', '#ffd166');
          this.logEvent(
            `ปะทะและขับไล่หมาป่าเงาแห่งพงไพรสำเร็จ! ได้รับ STR +1 และภูมิปัญญา +40`,
            'milestone'
          );
        } else {
          this.health = Math.max(10, this.health - 12);
          this.cognition.recordEpisodicMemory({
            generation: this.generation,
            heroName: this.name,
            age: this.currentAge,
            season: this.seasonSys.getSeasonMeta().id,
            title: 'รอยแผลแห่งความหวาดกลัวในพงไพร',
            reflection: 'เผชิญหน้าหมาป่าเงาดุร้ายในขณะที่ยังไร้กำลัง ต้องรีบถอยกลับเข้าหาแสงไฟ',
            emotion: 'fear',
            importance: 8,
            tileX: this.tileX,
            tileY: this.tileY,
          });
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
      this.cognition.recordEpisodicMemory({
        generation: this.generation,
        heroName: this.name,
        age: this.currentAge,
        season: this.seasonSys.getSeasonMeta().id,
        title: `ก้าวเข้าสู่วัย "${nextStage.name}"`,
        reflection: nextStage.description,
        emotion: 'wisdom',
        importance: 8,
        tileX: this.tileX,
        tileY: this.tileY,
      });
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
      this.triggerNextGenerationHeir();
    }
  }

  private getTraitMultiplier(
    key: keyof Pick<
      TraitConfig,
      | 'speedMultiplier'
      | 'energyDecayMultiplier'
      | 'sleepRecoveryMultiplier'
      | 'hungerRestoreMultiplier'
    >
  ): number {
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
    const seasonMeta = this.seasonSys.getSeasonMeta();
    const disaster = this.seasonSys.getActiveDisaster();

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
      const elderMentorBonus = this.currentStage.id === 'elder' ? 1.8 : 1.0;
      this.loreExp += (0.55 + this.int * 0.14) * elderMentorBonus * dt;
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
      this.loreExp += (0.18 + this.int * 0.05) * dt;
    }

    const fire = this.world.getCampfireResource();
    const distToFire = fire
      ? Math.hypot(this.tileX - fire.tileX, this.tileY - fire.tileY)
      : 99;
    const isColdSnap =
      weather.coldDamagePerSec > 0 ||
      seasonMeta.temperatureC < 0 ||
      disaster === 'blizzard';
    const isFreezing = isColdSnap && distToFire > 8.5;

    const strResilience = Math.max(0.5, 1 - (this.str - 5) * 0.06);
    if (isFreezing) {
      const coldDmg = Math.max(weather.coldDamagePerSec, disaster === 'blizzard' ? 4.5 : 2.0);
      this.health = Phaser.Math.Clamp(
        this.health - coldDmg * strResilience * dt,
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

  private evaluateBrain(forceReplan: boolean, dt: number): void {
    const stats = this.world.getResourceStats();
    const weather = this.world.getWeather();
    const seasonMeta = this.seasonSys.getSeasonMeta();
    const activeDisaster = this.seasonSys.getActiveDisaster();
    const beasts = this.world.getBeasts();
    const isDangerNear = beasts.some(
      (b) => Math.hypot(b.tileX - this.tileX, b.tileY - this.tileY) <= 5.5 && this.str < 6
    );

    const canBuild = this.kingdom.canStartOrContinueBuild(this.int, Math.floor(this.loreExp));
    const resStock = this.kingdom.getResources();

    // 1. Run Deep Cognition Engine (Age Psychology + Seasonal Foresight + Philosophy + Memories)
    this.latestDeepThought = this.cognition.evaluateDeepCognition(dt, {
      heroName: this.name,
      clanName: this.clanName,
      generation: this.generation,
      age: this.currentAge,
      lifeStageId: this.currentStage.id,
      str: this.str,
      int: this.int,
      agi: this.agi,
      loreExp: Math.floor(this.loreExp),
      hunger: this.hunger,
      maxHunger: this.config.needs.hunger.max,
      energy: this.energy,
      maxEnergy: this.config.needs.energy.max,
      health: this.health,
      maxHealth: this.maxHealth,
      season: seasonMeta.id,
      temperatureC: seasonMeta.temperatureC,
      activeDisaster,
      isNight: this.isNight,
      isDangerNear,
      wood: resStock.wood,
      stone: resStock.stone,
      population: this.kingdom.getMaxPopulation(),
      hasActiveConstruction: this.kingdom.getActiveSite() !== null,
      canBuildNextTier: canBuild,
    });

    if (
      (this.currentAction === 'eat_berry' ||
        this.currentAction === 'build_kingdom' ||
        this.currentAction === 'gather_resources') &&
      this.actionState === 'performing' &&
      !forceReplan
    ) {
      return;
    }

    const result = this.brain.evaluate({
      hunger: this.hunger,
      maxHunger: this.config.needs.hunger.max,
      energy: this.energy,
      maxEnergy: this.config.needs.energy.max,
      currentAction: this.currentAction,
      isSleeping: this.currentAction === 'sleep_tree' && this.actionState === 'performing',
      isNight: this.isNight,
      isSnowing: weather.id === 'snow' || activeDisaster === 'blizzard',
      isDangerNear,
      isInfant: this.currentStage.id === 'infant',
      exploreTraitBonus: this.getExploreTraitBonus(),
      hasRipeBerryOnIsland: stats.ripeBerries > 0,
      hasTreeOnIsland: stats.trees > 0,
      hasBlessingShrine: stats.shrines > 0,
      canBuildKingdom: canBuild,
      hasActiveConstruction: this.kingdom.getActiveSite() !== null,
      deepModifiers: this.latestDeepThought.actionModifiers,
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
    this.toolSprite.setVisible(false);

    if (nextAction === 'eat_berry' && prevAction !== 'eat_berry') {
      this.logEvent(
        `ท้องเริ่มร้อง (ความอิ่ม ${Math.round(this.hunger)}%) ออกเดินหาผลไม้หรือผลผลิตจากแปลงเกษตร`,
        'food'
      );
    } else if (nextAction === 'sleep_tree' && prevAction !== 'sleep_tree') {
      this.logEvent(
        `ร่างกายอ่อนล้า (พลังงาน ${Math.round(this.energy)}%) มองหาบ้านพักหรือร่มไม้เพื่อหลับพัก`,
        'sleep'
      );
    } else if (nextAction === 'build_kingdom' && prevAction !== 'build_kingdom') {
      this.logEvent(
        `🔨 เตรียมลงมือก่อสร้างสิ่งปลูกสร้างใหม่เพื่อพัฒนาอาณาจักรตระกูล ${this.clanName}`,
        'info'
      );
    } else if (nextAction === 'gather_resources' && prevAction !== 'gather_resources') {
      this.logEvent(`🪓 ออกตัดไม้และสกัดหินเพื่อสะสมทรัพยากรสร้างเมือง`, 'info');
    } else if (nextAction === 'warm_campfire' && prevAction !== 'warm_campfire') {
      const isCold =
        this.world.getWeather().id === 'snow' ||
        this.seasonSys.getActiveDisaster() === 'blizzard';
      this.logEvent(
        isCold
          ? `❄️ อากาศหนาวเหน็บ! รีบเดินกลับไปผิงไฟศักดิ์สิทธิ์กลางหมู่บ้าน`
          : `เดินกลับเข้าสู่ลานกองไฟศักดิ์สิทธิ์เพื่อผิงไฟและใคร่ครวญปรัชญาชีวิต`,
        isCold ? 'warn' : 'info'
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
    } else if (this.currentAction === 'build_kingdom') {
      this.handleBuildKingdomAction(dt);
    } else if (this.currentAction === 'gather_resources') {
      this.handleGatherResourcesAction(dt);
    } else if (this.currentAction === 'warm_campfire') {
      this.handleWarmCampfireAction(dt);
    } else if (this.currentAction === 'seek_blessing') {
      this.handleSeekBlessingAction(dt);
    } else {
      this.handleExploreAction(dt);
    }
  }

  private handleBuildKingdomAction(dt: number): void {
    const site = this.kingdom.ensureConstructionSite(this.int, Math.floor(this.loreExp));
    if (!site) {
      this.switchAction('gather_resources');
      return;
    }

    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      this.workHitTimer += dt;
      if (this.workHitTimer >= 0.45) {
        this.workHitTimer = 0;
        this.world.shakeResourceAt(site.tileX, site.tileY, 'build');
      }
      const buildSpeed = 1 + (this.str - 5) * 0.08 + (this.int - 5) * 0.06;
      const finished = this.kingdom.advanceConstruction(dt * buildSpeed);
      this.loreExp += 1.4 * dt;

      if (finished || this.actionTimer <= 0) {
        if (finished) {
          this.buildingsCompleted++;
          soundscape.playBuildComplete();
          this.cognition.recordEpisodicMemory({
            generation: this.generation,
            heroName: this.name,
            age: this.currentAge,
            season: this.seasonSys.getSeasonMeta().id,
            title: `ก่อสร้าง "${site.building.name}" สำเร็จ`,
            reflection: `ด้วยหยาดเหงื่อและค้อนเหล็ก เราได้สร้าง ${site.building.name} ไว้เป็นรากฐานแก่ลูกหลาน`,
            emotion: 'resolve',
            importance: 9,
            tileX: this.tileX,
            tileY: this.tileY,
          });
          this.spawnFloatingText(`🏛️ ${site.building.name}`, '#ffd166');
        }
        this.toolSprite.setVisible(false);
        this.actionState = 'idle';
        this.evaluateBrain(true, dt);
      }
      return;
    }

    const dist = Math.hypot(this.tileX - site.tileX, this.tileY - site.tileY);
    if (dist <= 1.5) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.build_kingdom.durationSec;
      this.path = [];
      return;
    }

    if (this.path.length === 0) {
      this.path = findPathAStar(this.world, this.tileX, this.tileY, site.tileX, site.tileY);
      if (this.path.length === 0) {
        this.actionState = 'performing';
        this.actionTimer = this.config.actions.build_kingdom.durationSec;
        return;
      }
      this.actionState = 'moving';
    }

    this.moveAlongPath(dt);
  }

  private handleGatherResourcesAction(dt: number): void {
    if (this.actionState === 'performing') {
      this.actionTimer -= dt;
      this.workHitTimer += dt;
      if (this.workHitTimer >= 0.44 && this.targetResource) {
        this.workHitTimer = 0;
        const isStone =
          this.targetResource.type === 'mountain_rock' || this.targetResource.type === 'crystal';
        this.world.shakeResourceAt(
          this.targetResource.tileX,
          this.targetResource.tileY,
          isStone ? 'stone' : 'wood'
        );
      }

      if (this.actionTimer <= 0) {
        const isStone =
          this.targetResource?.type === 'mountain_rock' || this.targetResource?.type === 'crystal';
        const yieldAmt = 3 + Math.floor(this.str * 0.4);
        if (isStone) {
          this.kingdom.addResources(1, yieldAmt, 0);
          this.spawnFloatingText(`+${yieldAmt} 🪨 หิน`, '#cbd5e1');
        } else {
          this.kingdom.addResources(yieldAmt, 1, 0);
          this.spawnFloatingText(`+${yieldAmt} 🪵 ไม้`, '#f59e0b');
        }
        this.loreExp += 6;
        this.toolSprite.setVisible(false);
        this.targetResource = null;
        this.actionState = 'idle';
        this.evaluateBrain(true, dt);
      }
      return;
    }

    if (!this.targetResource) {
      const needed = this.kingdom.getNextNeededResource(this.int, Math.floor(this.loreExp));
      const res = this.world.findNearestGatherResource(
        this.tileX,
        this.tileY,
        needed === 'stone'
      );
      if (!res) {
        this.switchAction('explore_island');
        return;
      }
      this.targetResource = res;
      let destX = res.tileX;
      let destY = res.tileY;
      if (res.blocksMovement) {
        const adj = [
          { x: res.tileX + 1, y: res.tileY },
          { x: res.tileX - 1, y: res.tileY },
          { x: res.tileX, y: res.tileY + 1 },
          { x: res.tileX, y: res.tileY - 1 },
        ].find((p) => this.world.isWalkable(p.x, p.y));
        if (adj) {
          destX = adj.x;
          destY = adj.y;
        }
      }
      this.path = findPathAStar(this.world, this.tileX, this.tileY, destX, destY);
      this.actionState = 'moving';
    }

    const dist = Math.hypot(
      this.tileX - this.targetResource.tileX,
      this.tileY - this.targetResource.tileY
    );
    if (dist <= 1.5) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.gather_resources.durationSec;
      this.path = [];
      return;
    }

    if (this.path.length === 0) {
      this.actionState = 'performing';
      this.actionTimer = this.config.actions.gather_resources.durationSec;
      return;
    }

    this.moveAlongPath(dt);
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
          this.kingdom.addResources(8, 8, 5);
          this.cognition.recordEpisodicMemory({
            generation: this.generation,
            heroName: this.name,
            age: this.currentAge,
            season: this.seasonSys.getSeasonMeta().id,
            title: 'ซึมซับพรจากผลึกดาราสวรรค์',
            reflection: 'สัมผัสพลังศักดิ์สิทธิ์จากผลึกดาราที่ตกลงมาจากฟากฟ้า จิตใจสว่างไสวด้วยศรัทธา',
            emotion: 'awe',
            importance: 9,
            tileX: this.tileX,
            tileY: this.tileY,
          });
          this.spawnFloatingText('💎 รับพรผลึกดารา! (STR/INT +1)', '#8ef6ff');
          this.logEvent(
            `ซึมซับพลังจากผลึกดาราศักดิ์สิทธิ์! ได้รับ STR +1, INT +1 และภูมิปัญญา +55`,
            'milestone'
          );
        }
        this.targetResource = null;
        this.actionState = 'idle';
        this.evaluateBrain(true, dt);
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
          const isFarm = this.targetResource.type === 'farm_plot';
          this.world.harvestBerryBush(this.targetResource);
          const restoreMult = this.getTraitMultiplier('hungerRestoreMultiplier');
          const restored = Math.round(cfg.hungerRestore * restoreMult * (isFarm ? 1.2 : 1.0));
          this.hunger = Math.min(this.config.needs.hunger.max, this.hunger + restored);
          this.health = Math.min(this.maxHealth, this.health + cfg.healthRestore);
          this.berriesEaten++;
          this.spawnFloatingText(`+${restored} ${isFarm ? '🌾' : '🍒'}`, '#8ef6ff');
          this.logEvent(
            isFarm
              ? `เก็บเกี่ยวผลผลิตจากแปลงเกษตรที่พิกัด (${this.tileX}, ${this.tileY}) ฟื้นฟูความอิ่ม +${restored}`
              : `เก็บเบอร์รี่ป่ากินที่พิกัด (${this.tileX}, ${this.tileY}) ฟื้นฟูความอิ่ม +${restored}`,
            'food'
          );
        }
        this.targetResource = null;
        this.actionState = 'idle';
        this.evaluateBrain(true, dt);
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
        this.evaluateBrain(true, dt);
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
        `เอนกายพักผ่อนที่พิกัด (${this.tileX}, ${this.tileY}) 💤`,
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
        this.actionTimer <= 0 &&
        this.world.getWeather().id !== 'snow' &&
        this.seasonSys.getActiveDisaster() !== 'blizzard'
      ) {
        this.spawnFloatingText(`+ปัญญา ✨`, '#ffd166');
        this.actionState = 'idle';
        this.switchAction('explore_island');
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
      // Age-appropriate exploration radius! Infants stay close to camp, Teens explore far!
      const baseRadius = this.config.actions.explore_island.maxWanderRadiusTiles;
      const ageRadius =
        this.currentStage.id === 'infant'
          ? 5
          : this.currentStage.id === 'child'
          ? 10
          : this.currentStage.id === 'teen'
          ? 24
          : baseRadius;
      const destTile = this.world.getRandomWalkableTileNear(this.tileX, this.tileY, ageRadius);
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
    // Realistic subtle breathing expansion
    const breath = 1 + Math.sin(this.workSwingClock * 3.6) * 0.035;
    if (key === 'hero_sleep') {
      this.sprite.setDisplaySize(Math.round(34 * sc), Math.round(28 * sc * breath));
      this.sprite.setRotation(0);
    } else {
      this.sprite.setDisplaySize(
        Math.round(30 * sc * (2 - breath)),
        Math.round(34 * sc * breath)
      );
    }
  }

  private getStageSpritePrefix(): string {
    const st = this.currentStage?.id ?? 'adult';
    switch (st) {
      case 'infant':
        return 'hero_infant';
      case 'child':
        return 'hero_child';
      case 'teen':
        return 'hero_teen';
      case 'adult':
        return 'hero_adult';
      case 'elder':
        return 'hero_elder';
      default:
        return 'hero_adult';
    }
  }

  private updateAnimations(dt: number): void {
    this.animTimer += dt;
    this.workSwingClock += dt;

    if (this.currentAction === 'sleep_tree' && this.actionState === 'performing') {
      this.toolSprite.setVisible(false);
      this.updateHeroSpriteTexture('hero_sleep');
      return;
    }

    const isWorking =
      this.actionState === 'performing' &&
      (this.currentAction === 'build_kingdom' || this.currentAction === 'gather_resources');

    if (isWorking) {
      this.toolSprite.setVisible(true);
      this.toolSprite.setTexture(
        this.currentAction === 'build_kingdom' ? 'icon_hammer' : 'icon_axe'
      );
      const swingAngle = Math.sin(this.workSwingClock * 14) * 0.68;
      this.toolSprite.setRotation(swingAngle);
      // Realistic upper-body lean while swinging tool!
      this.sprite.setRotation(swingAngle * 0.14);
    } else if (this.actionState === 'moving') {
      this.toolSprite.setVisible(false);
      // Realistic stride lean while walking/running!
      const strideTilt = Math.sin(this.workSwingClock * 11) * 0.065;
      this.sprite.setRotation(strideTilt);
    } else {
      this.toolSprite.setVisible(false);
      this.sprite.setRotation(0);
    }

    const prefix = this.getStageSpritePrefix();

    if (this.actionState === 'moving' || isWorking) {
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
    this.shadowSprite.setPosition(this.x, this.y + 2);
    this.shadowSprite.setDepth(this.y + 1);

    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y + 3);
    this.heroGlow.setPosition(this.x, this.y - 4);

    this.toolSprite.setPosition(this.x + (this.sprite.flipX ? -11 : 11), this.y - 10);
    this.toolSprite.setDepth(this.y + 6);

    // Phase 8.1: Update cute Thought Bubble icon above Hero's head
    const bubbleIcons: Record<ActionId, string> = {
      eat_berry: '🍖',
      sleep_tree: '💤',
      warm_campfire: '🔥',
      seek_blessing: '💎',
      build_kingdom: '🔨',
      gather_resources: '🪓',
      explore_island: '🧭',
    };
    const nextIcon = bubbleIcons[this.currentAction] || '🧭';
    if (this.thoughtBubble.text !== nextIcon) {
      this.thoughtBubble.setText(nextIcon);
    }
    const floatBob = Math.sin(this.workSwingClock * 3.2) * 1.8;
    this.thoughtBubble.setPosition(this.x, this.y - 28 + floatBob);

    for (let i = 0; i < this.activeFloatingTexts.length; i++) {
      const item = this.activeFloatingTexts[i];
      if (item.txt.active) {
        item.txt.setX(this.x);
      }
    }
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
    // Prevent duplicate stacking in queue
    if (this.floatingQueue.some((q) => q.message === message)) return;
    if (this.floatingQueue.length >= 4) {
      this.floatingQueue.shift();
    }
    this.floatingQueue.push({ message, colorHex });
  }

  private updateFloatingQueue(dt: number): void {
    if (this.floatingCooldown > 0) {
      this.floatingCooldown -= dt;
    }

    // Clean up destroyed labels
    this.activeFloatingTexts = this.activeFloatingTexts.filter((item) => item.txt.active);

    if (this.floatingCooldown <= 0 && this.floatingQueue.length > 0) {
      const next = this.floatingQueue.shift()!;
      this.floatingCooldown = 0.42;

      // Push existing active floating labels up by 16px so they never overlap!
      for (const existing of this.activeFloatingTexts) {
        existing.offsetY -= 16;
        existing.txt.setY(existing.txt.y - 16);
      }

      const startY = this.y - 34;
      const txt = this.scene.add.text(this.x, startY, next.message, {
        fontFamily: '"Chakra Petch", sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: next.colorHex,
        backgroundColor: 'rgba(11, 14, 20, 0.78)',
        padding: { x: 6, y: 2 },
        stroke: '#06070b',
        strokeThickness: 2,
      });
      txt.setOrigin(0.5, 0.5);
      txt.setDepth(3500);
      this.world.getWorldContainer().add(txt);

      const entry = { txt, offsetY: -34 };
      this.activeFloatingTexts.push(entry);

      this.scene.tweens.add({
        targets: txt,
        y: startY - 22,
        alpha: { from: 1, to: 0 },
        duration: 1150,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          txt.destroy();
        },
      });
    }
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
    let narrativeAction = 'กำลังเดินสำรวจทวีปเรืองแสง';

    if (this.currentAction === 'eat_berry') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังเก็บผลไม้และพืชผลเกษตรมารับประทาน'
          : 'กำลังมุ่งหน้าไปหาอาหาร';
      actionStateText = `🍒 ${narrativeAction}`;
    } else if (this.currentAction === 'sleep_tree') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังหลับใหลฟื้นฟูพลังอย่างอบอุ่น'
          : 'กำลังเดินกลับไปพักผ่อน';
      actionStateText = `💤 ${narrativeAction}`;
    } else if (this.currentAction === 'build_kingdom') {
      const site = this.kingdom.getActiveSite();
      narrativeAction =
        this.actionState === 'performing'
          ? `กำลังตอกค้อนก่อสร้าง "${site?.building.name ?? 'สิ่งปลูกสร้าง'}"`
          : `กำลังเดินทางไปเขตก่อสร้าง "${site?.building.name ?? 'หมู่บ้าน'}"`;
      actionStateText = `🔨 ${narrativeAction}`;
    } else if (this.currentAction === 'gather_resources') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังตัดไม้และสกัดหินเพื่อสร้างอาณาจักร'
          : 'กำลังเดินไปหาแหล่งไม้และหินในป่า';
      actionStateText = `🪓 ${narrativeAction}`;
    } else if (this.currentAction === 'warm_campfire') {
      narrativeAction =
        this.actionState === 'performing'
          ? 'กำลังนั่งผิงไฟศักดิ์สิทธิ์และใคร่ครวญปรัชญาชีวิต'
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
          ? 'กำลังชมทิวทัศน์ท่ามกลางผืนป่าใหญ่'
          : 'กำลังออกสำรวจดินแดนกว้างใหญ่';
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
      narrativeCaption: `${this.name} ${this.clanName} ${narrativeAction} — ${this.latestDeepThought.currentMonologue}`,
      scores: this.latestScores,
      berriesEaten: this.berriesEaten,
      napsTaken: this.napsTaken,
      tilesExplored: this.visitedTiles.size,
      generation: this.generation,
      worldYear: this.worldYear,
      maxWorldYears: this.maxWorldYears,
      activeWeather: this.world.getWeather(),
      kingdom: this.kingdom.getSnapshot(this.int, Math.floor(this.loreExp)),
      deepThought: this.latestDeepThought,
      seasonMeta: this.seasonSys.getSeasonMeta(),
      activeDisaster: this.seasonSys.getActiveDisaster(),
    };
  }
}
