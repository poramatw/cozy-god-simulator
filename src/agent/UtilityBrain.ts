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
  exploreTraitBonus: number;
  hasRipeBerryOnIsland: boolean;
  hasTreeOnIsland: boolean;
  hasBlessingShrine: boolean;
}

export class UtilityBrain {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public evaluate(ctx: BrainContext): { bestAction: ActionId; scores: UtilityScoreItem[] } {
    const { eat_berry, sleep_tree, warm_campfire, seek_blessing, explore_island } =
      this.config.actions;

    // 1. Eat Berry Utility
    let eatScore = 0;
    if (ctx.hasRipeBerryOnIsland) {
      const hungerDeficit = Math.max(0, 1 - ctx.hunger / ctx.maxHunger);
      eatScore = Math.pow(hungerDeficit, 1.55) * 1.18;
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
      sleepScore = Math.pow(energyDeficit, 1.65) * 1.15;
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

    // 3. Warm by Campfire (Critical during Snowstorms or when fleeing Danger!)
    let fireScore = warm_campfire ? (ctx.isNight ? warm_campfire.baseNightScore : 0.24) : 0.24;
    if (ctx.isSnowing) {
      fireScore = 0.94;
    } else if (ctx.isDangerNear) {
      fireScore = 0.96;
    } else if (ctx.energy < 78 && ctx.energy > 42 && ctx.hunger > 50) {
      fireScore += 0.16;
    }
    if (ctx.currentAction === 'warm_campfire' && ctx.energy < 90 && ctx.hunger > 35) {
      fireScore += warm_campfire?.commitmentBonus ?? 0.2;
    }
    fireScore = Math.min(0.97, Math.max(0.12, fireScore));

    // 4. Seek Divine Blessing Shrine (Phase 3 God's Hand)
    let blessingScore = 0;
    if (ctx.hasBlessingShrine && ctx.hunger > 25 && !ctx.isDangerNear) {
      blessingScore = seek_blessing?.baseScore ?? 0.92;
    }

    // 5. Explore Island Utility
    const wellBeingFactor =
      (ctx.hunger / ctx.maxHunger) * 0.5 + (ctx.energy / ctx.maxEnergy) * 0.5;
    let exploreScore =
      explore_island.baseScore + wellBeingFactor * 0.24 + ctx.exploreTraitBonus;
    exploreScore = Math.min(1, Math.max(0.15, exploreScore));

    const scores: UtilityScoreItem[] = [
      { id: 'eat_berry', label: eat_berry.label, score: eatScore },
      { id: 'sleep_tree', label: sleep_tree.label, score: sleepScore },
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
