import Dexie, { Table } from 'dexie';
import { ActionId, LifeStageId } from '../core/Types';

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type DisasterId = 'none' | 'wildfire' | 'blizzard' | 'meteor_shower' | 'earthquake';

export type PhilosophyId =
  | 'sylvan_harmony'
  | 'architect_creed'
  | 'stoic_scholar'
  | 'divine_mystic'
  | 'dynasty_vanguard';

export interface PhilosophyProfile {
  id: PhilosophyId;
  name: string;
  icon: string;
  maxim: string;
  points: number;
}

export interface EpisodicMemory {
  id?: number;
  generation: number;
  heroName: string;
  age: number;
  season: SeasonId;
  title: string;
  reflection: string;
  emotion: 'joy' | 'awe' | 'fear' | 'resolve' | 'wisdom';
  importance: number;
  tileX: number;
  tileY: number;
  timestamp: number;
}

export interface AncestralLegend {
  id?: number;
  generation: number;
  heroName: string;
  clanName: string;
  dominantPhilosophy: string;
  maxim: string;
  buildingsConstructed: number;
  epitaph: string;
}

class CozyLoreDatabase extends Dexie {
  public memories!: Table<EpisodicMemory, number>;
  public legends!: Table<AncestralLegend, number>;

  constructor() {
    super('CozyGodSimulatorLoreDB');
    this.version(1).stores({
      memories: '++id, generation, emotion, importance',
      legends: '++id, generation, heroName',
    });
  }
}

export interface CognitiveEvaluationInput {
  heroName: string;
  clanName: string;
  generation: number;
  age: number;
  lifeStageId: LifeStageId;
  str: number;
  int: number;
  agi: number;
  loreExp: number;
  hunger: number;
  maxHunger: number;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
  season: SeasonId;
  temperatureC: number;
  activeDisaster: DisasterId;
  isNight: boolean;
  isDangerNear: boolean;
  wood: number;
  stone: number;
  population: number;
  hasActiveConstruction: boolean;
  canBuildNextTier: boolean;
}

export interface DeepThoughtOutput {
  dominantPhilosophy: PhilosophyProfile;
  allPhilosophies: PhilosophyProfile[];
  ageRoleTitle: string;
  ageBehaviorSummary: string;
  currentMonologue: string;
  reasoningChain: string[];
  actionModifiers: Record<ActionId, number>;
  recentMemories: EpisodicMemory[];
  ancestralLegends: AncestralLegend[];
}

export class DeepCognitionEngine {
  private db: CozyLoreDatabase;
  private philosophies: Record<PhilosophyId, PhilosophyProfile>;
  private recentMemories: EpisodicMemory[] = [];
  private ancestralLegends: AncestralLegend[] = [];
  private currentMonologue = 'สายลมพัดผ่านยอดไม้... โลกใบนี้ช่างกว้างใหญ่นัก';
  private reasoningChain: string[] = [];
  private monologueTimer = 0;

  constructor() {
    this.db = new CozyLoreDatabase();
    this.philosophies = {
      sylvan_harmony: {
        id: 'sylvan_harmony',
        name: 'วิถีประสานพงไพร (Sylvan Harmony)',
        icon: '🌿',
        maxim: 'ผืนป่าและสายน้ำคือลมหายใจเดียวกับเรา จงพึ่งพิงแต่อย่าทำลาย',
        points: 15,
      },
      architect_creed: {
        id: 'architect_creed',
        name: 'ปณิธานสถาปนิก (Architect Creed)',
        icon: '⚒️',
        maxim: 'อิฐหินและค้อนเหล็กคือสิ่งเดียวที่ปกป้องตระกูลจากความโหดร้ายของกาลเวลา',
        points: 15,
      },
      stoic_scholar: {
        id: 'stoic_scholar',
        name: 'ปรัชญาสโตอิกและผู้รู้แจ้ง (Stoic Scholar)',
        icon: '🧘',
        maxim: 'พายุหิมะหรือไฟป่าไม่อาจสั่นคลอนจิตใจที่สงบนิ่งและเปี่ยมด้วยปัญญา',
        points: 18,
      },
      divine_mystic: {
        id: 'divine_mystic',
        name: 'ศรัทธาแห่งเทวะ (Divine Mystic)',
        icon: '☀️',
        maxim: 'ทุกหยาดฝนและสายฟ้าล้วนเป็นสาสน์จากหัตถ์พระเจ้าผู้เฝ้ามองเรา',
        points: 14,
      },
      dynasty_vanguard: {
        id: 'dynasty_vanguard',
        name: 'ผู้พิทักษ์สายเลือด (Dynasty Vanguard)',
        icon: '🛡️',
        maxim: 'ชีวิตของข้ามีอยู่เพื่อปูทางและปกป้องคนรุ่นหลังให้รุ่งเรืองสืบไป',
        points: 14,
      },
    };

    void this.loadPersistedLore();
  }

  private async loadPersistedLore(): Promise<void> {
    try {
      const mems = await this.db.memories.orderBy('id').reverse().limit(12).toArray();
      if (mems.length > 0) this.recentMemories = mems;
      const legs = await this.db.legends.orderBy('generation').reverse().limit(6).toArray();
      if (legs.length > 0) this.ancestralLegends = legs;
    } catch {
      // Fallback to in-memory if IndexedDB is blocked
    }
  }

  public recordEpisodicMemory(mem: Omit<EpisodicMemory, 'id' | 'timestamp'>): void {
    const full: EpisodicMemory = {
      ...mem,
      timestamp: Date.now(),
    };
    this.recentMemories.unshift(full);
    if (this.recentMemories.length > 15) {
      this.recentMemories.pop();
    }

    // Shift philosophy weights based on life experience!
    if (mem.emotion === 'awe') {
      this.philosophies.divine_mystic.points += 6;
      this.philosophies.stoic_scholar.points += 3;
    } else if (mem.emotion === 'resolve') {
      this.philosophies.architect_creed.points += 5;
      this.philosophies.dynasty_vanguard.points += 5;
    } else if (mem.emotion === 'wisdom') {
      this.philosophies.stoic_scholar.points += 7;
    } else if (mem.emotion === 'joy') {
      this.philosophies.sylvan_harmony.points += 5;
    } else if (mem.emotion === 'fear') {
      this.philosophies.dynasty_vanguard.points += 4;
      this.philosophies.architect_creed.points += 4;
    }

    void this.db.memories.add(full).catch(() => {});
  }

  public recordAncestralLegacy(
    generation: number,
    heroName: string,
    clanName: string,
    buildingsConstructed: number
  ): void {
    const dom = this.getDominantPhilosophy();
    const epitaph = `ผู้ยึดมั่นใน${dom.name.split(' ')[0]} สั่งสมความเจริญและส่งต่อคติ "${dom.maxim}" สู่ลูกหลาน`;
    const legend: AncestralLegend = {
      generation,
      heroName,
      clanName,
      dominantPhilosophy: `${dom.icon} ${dom.name}`,
      maxim: dom.maxim,
      buildingsConstructed,
      epitaph,
    };
    this.ancestralLegends.unshift(legend);
    if (this.ancestralLegends.length > 8) this.ancestralLegends.pop();
    void this.db.legends.add(legend).catch(() => {});
  }

  public getDominantPhilosophy(): PhilosophyProfile {
    let best = this.philosophies.stoic_scholar;
    for (const p of Object.values(this.philosophies)) {
      if (p.points > best.points) {
        best = p;
      }
    }
    return best;
  }

  /**
   * Performs Deep Cognitive Evaluation:
   * Combines Life Stage Psychology + Season/Disaster Anticipation + Personal Philosophy + Ancestral Lore
   */
  public evaluateDeepCognition(
    dt: number,
    input: CognitiveEvaluationInput
  ): DeepThoughtOutput {
    const mods: Record<ActionId, number> = {
      eat_berry: 0,
      sleep_tree: 0,
      warm_campfire: 0,
      seek_blessing: 0,
      build_kingdom: 0,
      gather_resources: 0,
      explore_island: 0,
    };

    const chain: string[] = [];

    // 1. Life Stage Psychological Profile (พฤติกรรมสมวัยอย่างแท้จริง)
    let ageRoleTitle = 'ผู้บุกเบิกวัยฉกรรจ์';
    let ageBehaviorSummary = 'รับผิดชอบการสร้างอาณาจักรและสะสมเสบียงเพื่อส่วนรวม';

    switch (input.lifeStageId) {
      case 'infant':
        ageRoleTitle = '👶 ทารกน้อยแห่งกองไฟ';
        ageBehaviorSummary =
          'ยังทำงานหนักไม่ได้ ต้องการไออุ่นความปลอดภัย การนอนหลับ และเดินเตาะแตะชมธรรมชาติใกล้หมู่บ้าน';
        mods.explore_island += 0.28;
        mods.warm_campfire += 0.08;
        mods.sleep_tree += 0.15;
        mods.build_kingdom = -10; // Cannot build
        mods.gather_resources = -10; // Cannot chop trees
        chain.push('[จิตวิทยาวัยทารก] ร่างกายยังเยาว์วัย เดินเตาะแตะสำรวจรอบกองไฟและพักผ่อน งดงานก่อสร้าง');
        break;

      case 'child':
        ageRoleTitle = '🧒 วัยเด็กช่างฝันและอยากรู้อยากเห็น';
        ageBehaviorSummary =
          'ชอบวิ่งเล่นสำรวจผืนป่า เก็บผลเบอร์รี่ และเลียนแบบผู้ใหญ่ แต่จะรีบกลับเข้าแคมป์เมื่อพลบค่ำหรือมีภัย';
        mods.explore_island += 0.22;
        mods.eat_berry += 0.10;
        mods.build_kingdom -= 0.25;
        mods.gather_resources -= 0.15;
        if (input.isNight || input.isDangerNear) {
          mods.warm_campfire += 0.45;
        }
        chain.push('[จิตวิทยาวัยเด็ก] ความอยากรู้อยากเห็นสูง (+สำรวจเกาะ) แต่กลัวความมืดและสัตว์ร้าย');
        break;

      case 'teen':
        ageRoleTitle = '🧑 วัยรุ่นผู้เปี่ยมไฟฝัน';
        ageBehaviorSummary =
          'พลังงานล้นเหลือ ชอบออกไปบุกเบิกดินแดนใหม่และตัดไม้สกัดหินเพื่อพิสูจน์คุณค่าของตนเอง';
        mods.explore_island += 0.18;
        mods.gather_resources += 0.20;
        mods.build_kingdom += 0.12;
        chain.push('[จิตวิทยาวัยรุ่น] พลังกายและไฟฝันแรงกล้า มุ่งสำรวจขอบทวีปและหาทรัพยากร (+ตัดไม้/สกัดหิน)');
        break;

      case 'adult':
        ageRoleTitle = '⚔️ เสาหลักแห่งตระกูล (วัยผู้ใหญ่)';
        ageBehaviorSummary =
          'มุ่งมั่นขยายอาณาจักร ก่อสร้างอาคารบ้านเรือน และปกป้องผู้ติดตามจากภัยพิบัติ';
        mods.build_kingdom += 0.22;
        mods.gather_resources += 0.16;
        chain.push('[จิตวิทยาวัยผู้ใหญ่] รับผิดชอบต่อความอยู่รอดของตระกูล มุ่งเน้นการสร้างเมืองและวางรากฐาน');
        break;

      case 'elder':
        ageRoleTitle = '🧙 ปราชญ์อาวุโสผู้ทรงภูมิ (วัยชรา)';
        ageBehaviorSummary =
          'ลดงานใช้แรงงานหนัก เน้นนั่งผิงไฟถ่ายทอดภูมิปัญญา บันทึกตำนานตระกูล และรับพรศักดิ์สิทธิ์';
        mods.warm_campfire += 0.26;
        mods.seek_blessing += 0.22;
        mods.gather_resources -= 0.22;
        chain.push('[จิตวิทยาวัยชรา] สังขารร่วงโรยแต่ปัญญาล้ำลึก เน้นผิงไฟถ่ายทอดวิชาและใคร่ครวญปรัชญาชีวิต');
        break;
    }

    // 2. Seasonal & Disaster Foresight (การวางแผนล่วงหน้าตามฤดูกาลและภัยพิบัติ)
    if (input.activeDisaster !== 'none') {
      if (input.activeDisaster === 'wildfire') {
        mods.warm_campfire += 0.40;
        mods.gather_resources -= 0.40;
        chain.push('🔥 [วิเคราะห์ภัยพิบัติ: ไฟป่า] เปลวเพลิงกำลังลุกลามในป่า! งดตัดไม้และถอยกลับพื้นที่ปลอดภัย');
      } else if (input.activeDisaster === 'blizzard') {
        mods.warm_campfire += 0.65;
        mods.explore_island -= 0.50;
        chain.push('🌨️ [วิเคราะห์ภัยพิบัติ: พายุหิมะคลั่ง] อุณหภูมิดิ่งเหว! ต้องอยู่ใกล้กองไฟศักดิ์สิทธิ์เพื่อรักษาชีวิต');
      } else if (input.activeDisaster === 'meteor_shower') {
        mods.seek_blessing += 0.35;
        chain.push('☄️ [วิเคราะห์ปรากฏการณ์: ฝนดาวตก] อุกกาบาตผลึกดาราตกลงมาจากฟากฟ้า เป็นโอกาสเก็บแร่และรับพร!');
      } else if (input.activeDisaster === 'earthquake') {
        mods.build_kingdom += 0.25;
        chain.push('🌋 [วิเคราะห์ภัยพิบัติ: แผ่นดินไหว] แผ่นดินสั่นสะเทือนและเกิดโขดหินใหม่ ต้องเร่งซ่อมแซมและสร้างบ้านให้มั่นคง');
      }
    } else {
      if (input.season === 'autumn') {
        mods.gather_resources += 0.16;
        mods.eat_berry += 0.12;
        chain.push('🍂 [การวางแผนฤดูใบไม้ร่วง] ลมหนาวใกล้เข้ามาแล้ว ต้องเร่งกักตุนอาหารและไม้ฟืนก่อนฤดูหนาวจะมาเยือน');
      } else if (input.season === 'winter') {
        mods.warm_campfire += 0.28;
        chain.push(`❄️ [การปรับตัวฤดูหนาว] อุณหภูมิ ${input.temperatureC}°C อากาศหนาวเย็น เน้นพักผ่อนและผิงไฟถนอมพลังงาน`);
      } else if (input.season === 'spring') {
        mods.explore_island += 0.12;
        mods.build_kingdom += 0.12;
        chain.push('🌸 [การวางแผนฤดูใบไม้ผลิ] พืชพรรณผลิบานอุดมสมบูรณ์ เหมาะแก่การออกสำรวจและขยายหมู่บ้าน');
      } else if (input.season === 'summer') {
        mods.build_kingdom += 0.16;
        chain.push('☀️ [การวางแผนฤดูร้อน] ช่วงเวลากลางวันยาวนาน เหมาะแก่การเร่งก่อสร้างสิ่งปลูกสร้างใหญ่');
      }
    }

    // 3. Personal Philosophy Weighting (อิทธิพลจากปรัชญาประจำตัว)
    const domPhil = this.getDominantPhilosophy();
    if (domPhil.id === 'architect_creed') {
      mods.build_kingdom += 0.14;
      mods.gather_resources += 0.10;
    } else if (domPhil.id === 'sylvan_harmony') {
      mods.explore_island += 0.14;
      mods.eat_berry += 0.08;
    } else if (domPhil.id === 'stoic_scholar') {
      mods.warm_campfire += 0.14;
    } else if (domPhil.id === 'divine_mystic') {
      mods.seek_blessing += 0.20;
    } else if (domPhil.id === 'dynasty_vanguard') {
      mods.build_kingdom += 0.12;
    }
    chain.push(`${domPhil.icon} [เข็มทิศปรัชญา: ${domPhil.name.split(' ')[0]}] "${domPhil.maxim}"`);

    // 4. Generate Contextual Inner Monologue (เสียงความคิดในใจ)
    this.monologueTimer += dt;
    if (this.monologueTimer >= 4.5 || !this.currentMonologue) {
      this.monologueTimer = 0;
      this.currentMonologue = this.composeInnerMonologue(input, domPhil);
    }

    this.reasoningChain = chain;

    return {
      dominantPhilosophy: domPhil,
      allPhilosophies: Object.values(this.philosophies).sort((a, b) => b.points - a.points),
      ageRoleTitle,
      ageBehaviorSummary,
      currentMonologue: this.currentMonologue,
      reasoningChain: this.reasoningChain,
      actionModifiers: mods,
      recentMemories: this.recentMemories,
      ancestralLegends: this.ancestralLegends,
    };
  }

  private composeInnerMonologue(
    input: CognitiveEvaluationInput,
    phil: PhilosophyProfile
  ): string {
    if (input.activeDisaster === 'wildfire') {
      return '“กลิ่นควันไฟป่าโชยมาตามลม... ขออย่าให้เปลวเพลิงลามมาถึงหมู่บ้านของเราเลย!”';
    }
    if (input.activeDisaster === 'blizzard') {
      return '“พายุหิมะพัดแรงเหลือเกิน... แสงจากกองไฟศักดิ์สิทธิ์คือความหวังเดียวในคืนนี้”';
    }
    if (input.activeDisaster === 'meteor_shower') {
      return '“ดูบนฟ้าสิ! ดาวตกสีครามกำลังร่วงหล่นลงมา... พระเจ้ากำลังประทานพรแก่ทวีปนี้แน่ๆ”';
    }
    if (input.hunger < 30) {
      return input.lifeStageId === 'infant'
        ? '“แง... หิวจังเลย อยากกินเบอร์รี่หวานๆ...”'
        : '“ท้องร้องประท้วงแล้วสิ ต้องแวะไปเก็บผลไม้หรือดูที่แปลงเกษตรสักหน่อย”';
    }
    if (input.energy < 28) {
      return input.lifeStageId === 'elder'
        ? '“สังขารในวัยชราเหนื่อยง่ายเหลือเกิน... ขอเอนหลังฟังเสียงลมสักงีบเถิด”'
        : '“เปลือกตาเริ่มหนักอึ้งแล้ว... ได้เวลาพักผ่อนเอาแรงสำหรับวันพรุ่งนี้”';
    }

    if (input.lifeStageId === 'infant') {
      return '“แสงไฟอุ่นจัง... หิ่งห้อยพวกนั้นบินไปไหนกันนะ?”';
    }
    if (input.lifeStageId === 'child') {
      return '“ถ้าข้าโตเป็นผู้ใหญ่เมื่อไหร่ ข้าจะสร้างหอคอยที่สูงที่สุดในเกาะนี้ให้ดู!”';
    }
    if (input.lifeStageId === 'teen') {
      return '“ดินแดนหลังม่านหมอกนั่นยังมีที่ที่ยังไม่มีใครเคยไปเหยียบ ข้าอยากออกไปเห็นด้วยตาตัวเอง!”';
    }
    if (input.lifeStageId === 'elder') {
      if (this.ancestralLegends.length > 0) {
        const anc = this.ancestralLegends[0];
        return `“ข้าหวังว่าทายาทรุ่นต่อไปจะจดจำคำสอนของบรรพบุรุษ ${anc.heroName} ได้ขึ้นใจ...”`;
      }
      return `“เวลาผ่านไปไวราวสายน้ำ... สิ่งที่เราก่อสร้างไว้ในวันนี้ จะเป็นร่มเงาให้ลูกหลานในวันหน้า”`;
    }

    if (input.season === 'autumn') {
      return '“ใบไม้เปลี่ยนเป็นสีทองอำพันแล้ว ต้องรีบตัดไม้และซ่อมแซมบ้านก่อนหิมะแรกจะโปรยปราย”';
    }
    if (input.season === 'winter') {
      return '“ฤดูหนาวสอนให้เรารู้จักคุณค่าของเปลวไฟและมิตรภาพในหมู่บ้าน”';
    }

    return `“${phil.maxim}”`;
  }
}
