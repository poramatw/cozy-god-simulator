export type BiomeId = 'deep_water' | 'shallow_water' | 'sand' | 'grass' | 'forest';

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  maxElevation: number;
  walkable: boolean;
  speedMultiplier: number;
  treeChance: number;
  berryChance: number;
}

export interface WorldConfig {
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  noiseScale: number;
  detailScale: number;
  berryRegrowSeconds: number;
  biomes: BiomeConfig[];
}

export type WeatherId = 'fog' | 'rain' | 'drought' | 'snow';

export interface WeatherConfig {
  id: WeatherId;
  name: string;
  shortLabel: string;
  icon: string;
  moveSpeedMultiplier: number;
  berryRegrowMultiplier: number;
  coldDamagePerSec: number;
  hungerDecayMultiplier: number;
  description: string;
}

export type GodToolId =
  | 'inspect'
  | 'spawn_mountain'
  | 'terraform_river'
  | 'spawn_berry'
  | 'spawn_beast'
  | 'smite_lightning'
  | 'spawn_blessing';

export type LifeStageId = 'infant' | 'child' | 'teen' | 'adult' | 'elder';

export interface LifeStageConfig {
  id: LifeStageId;
  name: string;
  badge: string;
  minAge: number;
  maxAge: number;
  scale: number;
  speedMultiplier: number;
  energyDecayMultiplier: number;
  hungerDecayMultiplier: number;
  description: string;
}

export interface TraitConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  exploreBonus: number;
  speedMultiplier: number;
  energyDecayMultiplier: number;
  sleepRecoveryMultiplier: number;
  hungerRestoreMultiplier: number;
}

export interface HeroCustomization {
  name: string;
  clanName: string;
  str: number;
  int: number;
  agi: number;
  traitIds: string[];
  cloakColor: string;
}

export interface AgentConfig {
  defaultHeroName: string;
  defaultClanName: string;
  initialAge: number;
  maxLifespanAge: number;
  secondsPerYear: number;
  baseMoveSpeedPx: number;
  defaultStats: {
    str: number;
    int: number;
    agi: number;
    bonusPoints: number;
  };
  lifeStages: LifeStageConfig[];
  needs: {
    hunger: {
      initial: number;
      max: number;
      decayPerSec: number;
      starveDamagePerSec: number;
    };
    energy: {
      initial: number;
      max: number;
      decayPerSec: number;
      moveExtraDecayPerSec: number;
      exhaustDamagePerSec: number;
    };
    health: {
      initial: number;
      max: number;
      regenPerSecWhenWell: number;
      wellThresholdHunger: number;
      wellThresholdEnergy: number;
    };
  };
  actions: {
    eat_berry: {
      id: 'eat_berry';
      label: string;
      icon: string;
      hungerRestore: number;
      healthRestore: number;
      durationSec: number;
      urgencyThreshold: number;
      commitmentBonus: number;
    };
    sleep_tree: {
      id: 'sleep_tree';
      label: string;
      icon: string;
      energyRestorePerSec: number;
      healthRestorePerSec: number;
      wakeUpThreshold: number;
      urgencyThreshold: number;
      commitmentBonus: number;
    };
    warm_campfire: {
      id: 'warm_campfire';
      label: string;
      icon: string;
      energyRestorePerSec: number;
      healthRestorePerSec: number;
      durationSec: number;
      baseNightScore: number;
      commitmentBonus: number;
    };
    seek_blessing: {
      id: 'seek_blessing';
      label: string;
      icon: string;
      durationSec: number;
      baseScore: number;
    };
    explore_island: {
      id: 'explore_island';
      label: string;
      icon: string;
      baseScore: number;
      pauseDurationSec: number;
      maxWanderRadiusTiles: number;
    };
  };
}

export type ResourceType =
  | 'tree'
  | 'lantern_tree'
  | 'crimson_canopy'
  | 'berry_bush'
  | 'campfire'
  | 'hut'
  | 'round_hut'
  | 'watchtower'
  | 'crystal'
  | 'mountain_rock'
  | 'blessing_shrine';

export interface WorldResource {
  id: string;
  type: ResourceType;
  tileX: number;
  tileY: number;
  hasBerry: boolean;
  regrowTimer: number;
  blocksMovement?: boolean;
  sprite?: Phaser.GameObjects.Sprite;
  glowSprite?: Phaser.GameObjects.Image;
  canSeeThrough?: boolean;
}

export interface WildBeast {
  id: string;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  sprite: Phaser.GameObjects.Sprite;
  animTimer: number;
  animFrame: number;
}

export interface TileData {
  x: number;
  y: number;
  elevation: number;
  biome: BiomeConfig;
  isPath?: boolean;
  resource?: WorldResource;
}

export type ActionId =
  | 'eat_berry'
  | 'sleep_tree'
  | 'warm_campfire'
  | 'seek_blessing'
  | 'explore_island';

export interface UtilityScoreItem {
  id: ActionId;
  label: string;
  score: number;
}

export interface HeroStatusSnapshot {
  name: string;
  clanName: string;
  age: number;
  maxAge: number;
  dayOfYear: number;
  lifeStage: LifeStageConfig;
  str: number;
  int: number;
  agi: number;
  loreExp: number;
  traits: TraitConfig[];
  cloakColor: string;
  tileX: number;
  tileY: number;
  hunger: number;
  maxHunger: number;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
  currentActionId: ActionId;
  currentActionLabel: string;
  actionStateText: string;
  narrativeCaption: string;
  scores: UtilityScoreItem[];
  berriesEaten: number;
  napsTaken: number;
  tilesExplored: number;
  generation: number;
  activeWeather: WeatherConfig;
}

export interface ChronicleEntry {
  id: number;
  year: number;
  day: number;
  timeStr: string;
  lifeStageBadge: string;
  text: string;
  type: 'info' | 'food' | 'sleep' | 'warn' | 'milestone';
}

export type TimeSpeed = 0 | 1 | 2 | 4 | 10;
