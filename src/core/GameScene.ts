import Phaser from 'phaser';
import { DisasterId, SeasonId } from '../agent/DeepCognitionEngine';
import { HeroAgent } from '../agent/HeroAgent';
import { KingdomManager } from '../kingdom';
import { HudOverlay } from '../ui/HudOverlay';
import { IslandWorld } from '../world/IslandWorld';
import { SeasonAndDisasterSystem } from '../world/SeasonAndDisasterSystem';
import { generateAllPixelTextures } from './PixelTextures';
import { bakeAllHighResSpriteSheets } from './SpriteSheetProcessor';
import { TimeManager } from './TimeManager';
import {
  AgentConfig,
  BuildingConfig,
  BuildingsData,
  GodToolId,
  TraitConfig,
  WeatherConfig,
  WeatherId,
  WorldConfig,
} from './Types';

export class GameScene extends Phaser.Scene {
  private worldConfig!: WorldConfig;
  private agentConfig!: AgentConfig;
  private traitsList: TraitConfig[] = [];
  private weatherList: WeatherConfig[] = [];
  private buildingsList: BuildingConfig[] = [];

  private timeManager!: TimeManager;
  private world!: IslandWorld;
  private kingdom!: KingdomManager;
  private seasonSys!: SeasonAndDisasterSystem;
  private hero!: HeroAgent;
  private hud!: HudOverlay;

  private activeGodTool: GodToolId = 'inspect';
  private tileCursor!: Phaser.GameObjects.Image;
  private followHero = true;
  private isDraggingCamera = false;
  private pointerMovedWhileDown = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private hoveredTileX = -1;
  private hoveredTileY = -1;
  private uiRefreshTimer = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  public preload(): void {
    this.load.json('world_config', 'assets/data/world_config.json');
    this.load.json('agent_config', 'assets/data/agent_config.json');
    this.load.json('traits_data', 'assets/data/traits.json');
    this.load.json('weather_data', 'assets/data/weather_events.json');
    this.load.json('buildings_data', 'assets/data/buildings.json');

    // Load Smooth Hand-Painted 2.5D Sprite Sheets (Non-Pixel Art, matching Reference)
    this.load.image('sheet_buildings', 'assets/sprites/hd_buildings_sheet.jpg');
    this.load.image('sheet_flora', 'assets/sprites/hd_flora_sheet.jpg');
    this.load.image('sheet_characters', 'assets/sprites/hd_characters_sheet.jpg');
    this.load.image('sheet_phase3', 'assets/sprites/hd_phase3_sheet.jpg');
    this.load.image('sheet_kingdom', 'assets/sprites/hd_kingdom_sheet.jpg');
  }

  public create(): void {
    this.worldConfig = this.cache.json.get('world_config') as WorldConfig;
    this.agentConfig = this.cache.json.get('agent_config') as AgentConfig;
    const rawTraits = this.cache.json.get('traits_data') as { traits: TraitConfig[] };
    this.traitsList = rawTraits?.traits ?? [];
    const rawWeather = this.cache.json.get('weather_data') as { weatherEvents: WeatherConfig[] };
    this.weatherList = rawWeather?.weatherEvents ?? [];
    const rawBuildings = this.cache.json.get('buildings_data') as BuildingsData;
    this.buildingsList = rawBuildings?.buildings ?? [];

    generateAllPixelTextures(this);
    bakeAllHighResSpriteSheets(this);

    this.timeManager = new TimeManager(this.agentConfig.secondsPerYear);
    this.world = new IslandWorld(this, this.worldConfig, this.weatherList[0]);

    this.kingdom = new KingdomManager(
      this,
      this.world,
      this.buildingsList,
      (text, type) => {
        if (!this.hud || !this.hero) return;
        const clock = this.timeManager.getClockTime();
        const snap = this.hero.getStatusSnapshot();
        this.hud.addChronicle({
          year: snap.age,
          day: snap.dayOfYear,
          timeStr: clock.formatted,
          lifeStageBadge: snap.lifeStage.badge,
          text,
          type,
        });
      },
      () => {
        if (this.hero) {
          this.hero.refreshEraAppearance();
          this.refreshHud();
        }
      }
    );

    this.seasonSys = new SeasonAndDisasterSystem(this, this.world, (text, type) => {
      if (!this.hud || !this.hero) return;
      const clock = this.timeManager.getClockTime();
      const snap = this.hero.getStatusSnapshot();
      this.hud.addChronicle({
        year: snap.age,
        day: snap.dayOfYear,
        timeStr: clock.formatted,
        lifeStageBadge: snap.lifeStage.badge,
        text,
        type,
      });
    });

    this.hud = new HudOverlay(
      this,
      {
        onSpeedChange: (speed) => this.timeManager.setSpeed(speed),
        onToggleFollow: () => {
          this.followHero = !this.followHero;
          return this.followHero;
        },
        onToggleSeeThrough: () => {
          const next = !this.world.isSeeThrough();
          this.world.setSeeThrough(next);
          return next;
        },
        onRegenerateWorld: () => {
          this.hud.clearChronicles();
          this.timeManager.reset();
          this.world.regenerate();
          this.kingdom.resetForNewWorld();
          this.hero.respawnOnIsland(false);
          this.followHero = true;
          this.hud.setFollowState(true);
          this.cameras.main.setZoom(1.85);
          this.centerCameraOnHero();
        },
        onCenterHero: () => {
          this.followHero = true;
          this.hud.setFollowState(true);
          if (this.cameras.main.zoom < 1.2) {
            this.cameras.main.zoomTo(1.85, 350, 'Sine.easeOut');
          }
          this.centerCameraOnHero();
        },
        onCenterVillage: () => {
          this.followHero = false;
          this.hud.setFollowState(false);
          const cx = (this.worldConfig.mapWidth * this.worldConfig.tileSize) / 2;
          const cy = (this.worldConfig.mapHeight * this.worldConfig.tileSize) / 2;
          this.cameras.main.pan(cx, cy, 450, 'Sine.easeInOut');
        },
        onZoomDelta: (delta: number) => {
          const cam = this.cameras.main;
          const nextZoom = Phaser.Math.Clamp(cam.zoom + delta, 0.42, 4.5);
          cam.zoomTo(nextZoom, 220, 'Sine.easeOut');
        },
        onZoomFullWorld: () => {
          this.followHero = false;
          this.hud.setFollowState(false);
          const cx = (this.worldConfig.mapWidth * this.worldConfig.tileSize) / 2;
          const cy = (this.worldConfig.mapHeight * this.worldConfig.tileSize) / 2;
          this.cameras.main.pan(cx, cy, 450, 'Sine.easeInOut');
          this.cameras.main.zoomTo(0.48, 450, 'Sine.easeInOut');
        },
        onApplyHeroCustomization: (custom) => {
          this.timeManager.reset();
          this.hero.applyCustomization(custom, true);
          this.hero.respawnOnIsland(false);
          this.followHero = true;
          this.hud.setFollowState(true);
          this.centerCameraOnHero();
          this.refreshHud();
        },
        onSelectWeather: (weatherId: WeatherId) => {
          const found = this.weatherList.find((w) => w.id === weatherId);
          if (found) {
            this.world.setWeather(found);
            const clock = this.timeManager.getClockTime();
            const snap = this.hero.getStatusSnapshot();
            this.hud.addChronicle({
              year: snap.age,
              day: snap.dayOfYear,
              timeStr: clock.formatted,
              lifeStageBadge: snap.lifeStage.badge,
              text: `${found.icon} พระเจ้าเปลี่ยนสภาพอากาศเป็น "${found.name}" — ${found.description}`,
              type: found.id === 'snow' || found.id === 'drought' ? 'warn' : 'info',
            });
          }
        },
        onSelectSeason: (seasonId: SeasonId) => {
          this.seasonSys.setSeasonManual(seasonId);
          this.refreshHud();
        },
        onTriggerDisaster: (disasterId: DisasterId) => {
          this.seasonSys.triggerDisaster(disasterId);
          this.hero.getCognitionEngine().recordEpisodicMemory({
            generation: this.hero.generation,
            heroName: this.hero.name,
            age: this.hero.getStatusSnapshot().age,
            season: this.seasonSys.getSeasonMeta().id,
            title: `เผชิญหน้าภัยพิบัติ: ${disasterId.toUpperCase()}`,
            reflection: 'ธรรมชาติและพลังแห่งทวีปสำแดงเดช ต้องตั้งสติและนำพาผู้คนให้รอดพ้น',
            emotion: disasterId === 'meteor_shower' ? 'awe' : 'fear',
            importance: 10,
            tileX: this.hero.tileX,
            tileY: this.hero.tileY,
          });
          this.refreshHud();
        },
        onSelectGodTool: (toolId: GodToolId) => {
          this.activeGodTool = toolId;
        },
        onGrantDivineInspiration: () => {
          this.hero.grantDivineInspiration();
          this.refreshHud();
        },
        onTriggerLegacyHeir: () => {
          this.timeManager.reset();
          this.hero.triggerNextGenerationHeir();
          this.refreshHud();
        },
        onAdvanceEra: () => {
          this.kingdom.advanceEraManual();
          this.hero.refreshEraAppearance();
          this.refreshHud();
        },
        onSelectEra: (eraIndex: number) => {
          this.kingdom.setEraByIndex(eraIndex, true);
          this.hero.refreshEraAppearance();
          this.refreshHud();
        },
      },
      this.traitsList,
      this.weatherList
    );

    this.hero = new HeroAgent(
      this,
      this.world,
      this.kingdom,
      this.seasonSys,
      this.agentConfig,
      this.traitsList,
      (entry) => {
        this.hud.addChronicle(entry);
      }
    );

    this.tileCursor = this.add.image(-100, -100, 'tile_cursor');
    this.tileCursor.setDisplaySize(20, 20);
    this.tileCursor.setDepth(3500);
    this.tileCursor.setAlpha(0.85);

    this.setupCameraAndInput();
    this.refreshHud();
  }

  private setupCameraAndInput(): void {
    const mapPxW = this.worldConfig.mapWidth * this.worldConfig.tileSize;
    const mapPxH = this.worldConfig.mapHeight * this.worldConfig.tileSize;

    const cam = this.cameras.main;
    cam.setBounds(-400, -400, mapPxW + 800, mapPxH + 800);
    cam.setZoom(1.85);
    this.centerCameraOnHero();

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDraggingCamera = true;
      this.pointerMovedWhileDown = false;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.isDraggingCamera = false;
      if (!this.pointerMovedWhileDown && this.activeGodTool !== 'inspect') {
        const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
        const tx = Math.floor(worldPoint.x / this.worldConfig.tileSize);
        const ty = Math.floor(worldPoint.y / this.worldConfig.tileSize);
        this.executeGodToolAt(tx, ty);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera && pointer.isDown) {
        const dx = (pointer.x - this.dragStartX) / cam.zoom;
        const dy = (pointer.y - this.dragStartY) / cam.zoom;
        if (Math.hypot(dx, dy) > 3) {
          this.pointerMovedWhileDown = true;
          this.followHero = false;
          this.hud.setFollowState(false);
          cam.scrollX -= dx;
          cam.scrollY -= dy;
          this.dragStartX = pointer.x;
          this.dragStartY = pointer.y;
        }
      }

      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(worldPoint.x / this.worldConfig.tileSize);
      const ty = Math.floor(worldPoint.y / this.worldConfig.tileSize);

      const tile = this.world.getTile(tx, ty);
      if (tile) {
        this.hoveredTileX = tx;
        this.hoveredTileY = ty;
        this.tileCursor.setVisible(true);
        this.tileCursor.setPosition(
          tx * this.worldConfig.tileSize + this.worldConfig.tileSize / 2,
          ty * this.worldConfig.tileSize + this.worldConfig.tileSize / 2
        );
        this.hud.updateTileInspector(tile);
      } else {
        this.hoveredTileX = -1;
        this.hoveredTileY = -1;
        this.tileCursor.setVisible(false);
        this.hud.updateTileInspector(undefined);
      }
    });

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        const factor = deltaY > 0 ? -0.22 : 0.22;
        const nextZoom = Phaser.Math.Clamp(cam.zoom + factor, 0.42, 4.5);
        cam.setZoom(nextZoom);
      }
    );
  }

  private executeGodToolAt(tx: number, ty: number): void {
    const tile = this.world.getTile(tx, ty);
    if (!tile) return;

    const clock = this.timeManager.getClockTime();
    const snap = this.hero.getStatusSnapshot();

    switch (this.activeGodTool) {
      case 'spawn_mountain':
        if (this.world.spawnGodMountain(tx, ty)) {
          this.hud.addChronicle({
            year: snap.age,
            day: snap.dayOfYear,
            timeStr: clock.formatted,
            lifeStageBadge: snap.lifeStage.badge,
            text: `⛰️ พระเจ้าเสกโขดหินผารูนโบราณที่พิกัด (${tx}, ${ty})`,
            type: 'info',
          });
        }
        break;
      case 'terraform_river':
        if (this.world.terraformRiverTile(tx, ty)) {
          this.hud.addChronicle({
            year: snap.age,
            day: snap.dayOfYear,
            timeStr: clock.formatted,
            lifeStageBadge: snap.lifeStage.badge,
            text: `🌊 พระเจ้าเนรมิตลำธารที่พิกัด (${tx}, ${ty})`,
            type: 'info',
          });
        }
        break;
      case 'spawn_berry':
        if (tile.biome.walkable) {
          this.world.spawnResource('berry_bush', tx, ty, true);
          this.hud.addChronicle({
            year: snap.age,
            day: snap.dayOfYear,
            timeStr: clock.formatted,
            lifeStageBadge: snap.lifeStage.badge,
            text: `🍒 พระเจ้าประทานพุ่มเบอร์รี่สดฉ่ำที่พิกัด (${tx}, ${ty})`,
            type: 'food',
          });
        }
        break;
      case 'spawn_beast':
        if (this.world.spawnWildBeast(tx, ty)) {
          this.hud.addChronicle({
            year: snap.age,
            day: snap.dayOfYear,
            timeStr: clock.formatted,
            lifeStageBadge: snap.lifeStage.badge,
            text: `🐺 หมาป่าเงาแห่งพงไพรปรากฏตัวขึ้นที่พิกัด (${tx}, ${ty})!`,
            type: 'warn',
          });
        }
        break;
      case 'smite_lightning': {
        const res = this.world.strikeLightningAt(tx, ty);
        this.hud.addChronicle({
          year: snap.age,
          day: snap.dayOfYear,
          timeStr: clock.formatted,
          lifeStageBadge: snap.lifeStage.badge,
          text: `⚡ สายฟ้าสวรรค์ฟาดลงที่พิกัด (${tx}, ${ty})! (ทำลายสิ่งกีดขวาง ${res.destroyedCount} ชิ้น, ปราบสัตว์ป่า ${res.slainBeasts} ตัว)`,
          type: 'warn',
        });
        break;
      }
      case 'spawn_blessing':
        if (tile.biome.walkable) {
          this.world.spawnResource('blessing_shrine', tx, ty, false);
          this.hud.addChronicle({
            year: snap.age,
            day: snap.dayOfYear,
            timeStr: clock.formatted,
            lifeStageBadge: snap.lifeStage.badge,
            text: `💎 แท่นผลึกดาราศักดิ์สิทธิ์จุติลงที่พิกัด (${tx}, ${ty}) รอให้บอทมารับพร!`,
            type: 'milestone',
          });
        }
        break;
    }

    this.hud.updateTileInspector(this.world.getTile(tx, ty));
  }

  private centerCameraOnHero(): void {
    this.cameras.main.centerOn(this.hero.x, this.hero.y);
  }

  public update(_time: number, deltaMs: number): void {
    const simDeltaSec = this.timeManager.update(deltaMs);
    const clock = this.timeManager.getClockTime();

    this.world.update(simDeltaSec, deltaMs);
    this.seasonSys.update(simDeltaSec, deltaMs, this.timeManager.getDayOfYear());
    this.kingdom.update(simDeltaSec, this.hero.int, Math.floor(this.hero.loreExp));
    this.hero.update(
      simDeltaSec,
      this.timeManager.getElapsedYears(),
      this.timeManager.getDayOfYear(),
      clock.formatted,
      clock.isNight
    );

    this.handleCameraMovement(deltaMs);

    this.uiRefreshTimer += deltaMs;
    if (this.uiRefreshTimer >= 120) {
      this.uiRefreshTimer = 0;
      this.refreshHud();
    }
  }

  private handleCameraMovement(deltaMs: number): void {
    const cam = this.cameras.main;
    const panSpeed = (0.42 * deltaMs) / cam.zoom;
    let manualPan = false;

    if (this.cursors?.left.isDown || this.wasdKeys?.A.isDown) {
      cam.scrollX -= panSpeed;
      manualPan = true;
    }
    if (this.cursors?.right.isDown || this.wasdKeys?.D.isDown) {
      cam.scrollX += panSpeed;
      manualPan = true;
    }
    if (this.cursors?.up.isDown || this.wasdKeys?.W.isDown) {
      cam.scrollY -= panSpeed;
      manualPan = true;
    }
    if (this.cursors?.down.isDown || this.wasdKeys?.S.isDown) {
      cam.scrollY += panSpeed;
      manualPan = true;
    }

    if (manualPan && this.followHero) {
      this.followHero = false;
      this.hud.setFollowState(false);
    }

    if (this.followHero) {
      const targetScrollX = this.hero.x - cam.width / 2;
      const targetScrollY = this.hero.y - cam.height / 2;
      cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetScrollX, 0.12);
      cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetScrollY, 0.12);
    }
  }

  private refreshHud(): void {
    const clock = this.timeManager.getClockTime();
    this.hud.updateHeroStatus(
      this.hero.getStatusSnapshot(),
      this.game.loop.actualFps || 60,
      this.timeManager.getDayCount(),
      clock.formatted
    );

    if (this.hoveredTileX >= 0 && this.hoveredTileY >= 0) {
      this.hud.updateTileInspector(this.world.getTile(this.hoveredTileX, this.hoveredTileY));
    }
  }
}
