import { ActionId, AgentConfig, UtilityScoreItem } from '../core/Types';

export interface BrainContext {
  hunger: number;
  maxHunger: number;
  energy: number;
  maxEnergy: number;
  currentAction: ActionId;
  isSleeping: boolean;
  isNight: boolean;
  isSnowing: boolean;
  isDangerNear: boolean;
  isInfant: boolean;
  exploreTraitBonus: number;
  hasRipeBerryOnIsland: boolean;
  hasTreeOnIsland: boolean;
  hasBlessingShrine: boolean;
  canBuildKingdom: boolean;
  hasActiveConstruction: boolean;
  deepModifiers?: Record<ActionId, number>;
}

export class UtilityBrain {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public evaluate(ctx: BrainContext): { bestAction: ActionId; scores: UtilityScoreItem[] } {
    const {
      eat_berry,
      sleep_tree,
      warm_campfire,
      seek_blessing,
      build_kingdom,
      gather_resources,
      explore_island,
    } = this.config.actions;

    const dm = ctx.deepModifiers ?? {
      eat_berry: 0,
      sleep_tree: 0,
      warm_campfire: 0,
      seek_blessing: 0,
      build_kingdom: 0,
      gather_resources: 0,
      explore_island: 0,
    };

    // 1. Eat Berry Utility
    let eatScore = 0;
    if (ctx.hasRipeBerryOnIsland) {
      const hungerDeficit = Math.max(0, 1 - ctx.hunger / ctx.maxHunger);
      eatScore = Math.pow(hungerDeficit, 1.55) * 1.18 + dm.eat_berry;
      if (ctx.hunger <= eat_berry.urgencyThreshold) {
        eatScore += 0.18;
      }
      if (ctx.currentAction === 'eat_berry' && ctx.hunger < ctx.maxHunger * 0.9) {
        eatScore += eat_berry.commitmentBonus;
      }
    }
    eatScore = Math.min(1, Math.max(0, eatScore));

    // 2. Sleep / Deep Rest Utility
    let sleepScore = 0;
    if (ctx.hasTreeOnIsland) {
      const energyDeficit = Math.max(0, 1 - ctx.energy / ctx.maxEnergy);
      sleepScore = Math.pow(energyDeficit, 1.65) * 1.15 + dm.sleep_tree;
      if (ctx.energy <= sleep_tree.urgencyThreshold) {
        sleepScore += 0.22;
      }
      if (
        ctx.currentAction === 'sleep_tree' &&
        ctx.energy < sleep_tree.wakeUpThreshold &&
        ctx.hunger > 15 &&
        !ctx.isSnowing
      ) {
        sleepScore = Math.max(sleepScore + sleep_tree.commitmentBonus, 0.88);
      }
    }
    sleepScore = Math.min(1, Math.max(0, sleepScore));

    // 3. Warm by Campfire (Critical during Snowstorms, Blizzards, or when fleeing Danger!)
    let fireScore =
      (warm_campfire ? (ctx.isNight ? warm_campfire.baseNightScore * 0.55 : 0.16) : 0.16) +
      dm.warm_campfire;
    if (ctx.isSnowing) {
      fireScore = Math.max(fireScore, 0.94);
    } else if (ctx.isDangerNear) {
      fireScore = Math.max(fireScore, 0.96);
    } else if (ctx.energy >= 80) {
      // Already well-rested — go explore, gather, or build instead of idling at the fire!
      fireScore = Math.min(fireScore, 0.18);
    } else if (ctx.energy < 74 && ctx.energy > 42 && ctx.hunger > 50) {
      fireScore += 0.12;
    }
    if (ctx.currentAction === 'warm_campfire' && ctx.energy < 84 && ctx.hunger > 35) {
      fireScore += warm_campfire?.commitmentBonus ?? 0.2;
    }
    fireScore = Math.min(0.98, Math.max(0.10, fireScore));

    // 4. Seek Divine Blessing Shrine (Phase 3 God's Hand)
    let blessingScore = 0;
    if (ctx.hasBlessingShrine && ctx.hunger > 25 && !ctx.isDangerNear) {
      blessingScore = (seek_blessing?.baseScore ?? 0.92) + dm.seek_blessing;
    }
    blessingScore = Math.min(0.98, Math.max(0, blessingScore));

    // 5. Phase 4: Build Kingdom Utility
    let buildScore = 0;
    if (!ctx.isInfant && ctx.canBuildKingdom && ctx.hunger > 38 && ctx.energy > 35 && !ctx.isSnowing) {
      buildScore = (build_kingdom?.baseScore ?? 0.78) + dm.build_kingdom;
      if (ctx.hasActiveConstruction) {
        buildScore += 0.08;
      }
      if (ctx.currentAction === 'build_kingdom') {
        buildScore += build_kingdom?.commitmentBonus ?? 0.18;
      }
    }
    buildScore = Math.min(0.95, Math.max(0, buildScore));

    // 6. Phase 4: Gather Resources (Wood & Stone) Utility
    let gatherScore = 0;
    if (!ctx.isInfant && !ctx.canBuildKingdom && ctx.hunger > 42 && ctx.energy > 40 && !ctx.isSnowing) {
      gatherScore = (gather_resources?.baseScore ?? 0.62) + dm.gather_resources;
      if (ctx.currentAction === 'gather_resources') {
        gatherScore += gather_resources?.commitmentBonus ?? 0.15;
      }
    }
    gatherScore = Math.min(0.88, Math.max(0, gatherScore));

    // 7. Explore Island Utility
    const wellBeingFactor =
      (ctx.hunger / ctx.maxHunger) * 0.5 + (ctx.energy / ctx.maxEnergy) * 0.5;
    let exploreScore =
      explore_island.baseScore +
      wellBeingFactor * 0.24 +
      ctx.exploreTraitBonus +
      dm.explore_island;
    exploreScore = Math.min(0.95, Math.max(0.12, exploreScore));

    const scores: UtilityScoreItem[] = [
      { id: 'eat_berry', label: eat_berry.label, score: eatScore },
      { id: 'sleep_tree', label: sleep_tree.label, score: sleepScore },
      { id: 'build_kingdom', label: build_kingdom.label, score: buildScore },
      { id: 'gather_resources', label: gather_resources.label, score: gatherScore },
      { id: 'warm_campfire', label: warm_campfire.label, score: fireScore },
      { id: 'seek_blessing', label: seek_blessing.label, score: blessingScore },
      { id: 'explore_island', label: explore_island.label, score: exploreScore },
    ];

    let bestAction: ActionId = 'explore_island';
    let highest = -1;
    for (const item of scores) {
      if (item.score > highest) {
        highest = item.score;
        bestAction = item.id;
      }
    }

    return { bestAction, scores };
  }
}
