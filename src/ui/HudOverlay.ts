import { renderHeroPortraitToCanvas } from '../core/PixelTextures';
import {
  ChronicleEntry,
  GodToolId,
  HeroCustomization,
  HeroStatusSnapshot,
  TileData,
  TimeSpeed,
  TraitConfig,
  WeatherConfig,
  WeatherId,
} from '../core/Types';

export interface HudCallbacks {
  onSpeedChange: (speed: TimeSpeed) => void;
  onToggleFollow: () => boolean;
  onToggleSeeThrough: () => boolean;
  onRegenerateWorld: () => void;
  onCenterHero: () => void;
  onCenterVillage: () => void;
  onApplyHeroCustomization: (custom: HeroCustomization) => void;
  onSelectWeather: (weatherId: WeatherId) => void;
  onSelectGodTool: (toolId: GodToolId) => void;
  onGrantDivineInspiration: () => void;
}

const CLOAK_PALETTES = [
  { id: '#3b7a57', label: 'เขียวมรกต (Emerald)' },
  { id: '#d48b35', label: 'ทองอำพัน (Amber)' },
  { id: '#2d7da8', label: 'ฟ้าหมอกเรืองแสง (Cyan)' },
  { id: '#a8384b', label: 'แดงทับทิม (Crimson)' },
  { id: '#6c4ca3', label: 'ม่วงสนธยา (Twilight)' },
];

const RANDOM_NAMES = [
  { name: 'เอลิน (Elin)', clan: 'แห่งโมริมาร์ (of the Morimar)' },
  { name: 'อิลโก (Ilgo)', clan: 'แห่งรุ่งอรุณ (of Dawnwatch)' },
  { name: 'เซราห์ (Sera)', clan: 'แห่งสายหมอก (of Mistvale)' },
  { name: 'คาลัน (Kaelen)', clan: 'แห่งพงไพร (of Sylvanglade)' },
  { name: 'ลูนา (Luna)', clan: 'แห่งโคมดารา (of Starlantern)' },
];

export class HudOverlay {
  private root: HTMLDivElement;
  private callbacks: HudCallbacks;
  private availableTraits: TraitConfig[];
  private weatherList: WeatherConfig[];
  private chronicles: ChronicleEntry[] = [];
  private nextLogId = 1;

  // Top Letterbox Elements
  private fpsEl!: HTMLElement;
  private seeThroughBtn!: HTMLButtonElement;
  private watchBtn!: HTMLButtonElement;
  private speedButtons = new Map<TimeSpeed, HTMLButtonElement>();
  private clockPillEl!: HTMLElement;

  // Bottom Letterbox Narrative Caption
  private narrativeCaptionEl!: HTMLElement;

  // God Toolbar Elements (Phase 3)
  private weatherButtons = new Map<WeatherId, HTMLButtonElement>();
  private godToolButtons = new Map<GodToolId, HTMLButtonElement>();
  private godHintEl!: HTMLElement;

  // Left Floating Status & Chronicle Panel
  private leftPanel!: HTMLElement;
  private portraitCanvas!: HTMLCanvasElement;
  private lastPortraitColor = '';
  private lastPortraitElder = false;
  private heroNameEl!: HTMLElement;
  private heroStageBadgeEl!: HTMLElement;
  private heroAgeEl!: HTMLElement;
  private geneticsRowEl!: HTMLElement;
  private traitsRowEl!: HTMLElement;

  private hungerBar!: HTMLElement;
  private hungerVal!: HTMLElement;
  private energyBar!: HTMLElement;
  private energyVal!: HTMLElement;
  private healthBar!: HTMLElement;
  private healthVal!: HTMLElement;

  private utilitySectionEl!: HTMLElement;
  private utilityContainer!: HTMLElement;
  private chronicleCardEl!: HTMLElement;
  private chronicleListEl!: HTMLElement;

  // Bottom-Right Watch / Inspector Panel
  private tileInspectorEl!: HTMLElement;

  // Phase 2: God's Creation Modal
  private creationModal!: HTMLElement;
  private draftCustom: HeroCustomization = {
    name: 'เอลิน (Elin)',
    clanName: 'แห่งโมริมาร์ (of the Morimar)',
    str: 6,
    int: 7,
    agi: 7,
    traitIds: ['curious', 'peaceful'],
    cloakColor: '#3b7a57',
  };

  constructor(
    callbacks: HudCallbacks,
    availableTraits: TraitConfig[],
    weatherList: WeatherConfig[]
  ) {
    this.callbacks = callbacks;
    this.availableTraits = availableTraits;
    this.weatherList = weatherList;
    this.injectStyles();

    this.root = document.createElement('div');
    this.root.id = 'cozy-hud-overlay';
    document.body.appendChild(this.root);

    this.buildLayout();
    this.buildCreationModal();
  }

  private injectStyles(): void {
    if (document.getElementById('cozy-pixel-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'cozy-pixel-ui-styles';
    style.textContent = `
      #cozy-hud-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 20;
        font-family: 'Chakra Petch', sans-serif;
        color: #e6e8f0;
      }

      .letterbox-top {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 46px;
        background: #06070b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        pointer-events: auto;
        z-index: 25;
      }

      .letterbox-bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 48px;
        background: #06070b;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 20px;
        pointer-events: auto;
        z-index: 25;
      }

      .narrative-caption {
        font-size: 15.5px;
        font-weight: 500;
        color: #f2f4fa;
        letter-spacing: 0.3px;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      }

      .pill-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ref-pill-btn {
        pointer-events: auto;
        cursor: pointer;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 12px;
        font-weight: 600;
        color: #d5d9e6;
        background: #1a1c26;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 5px;
        padding: 5px 10px;
        transition: all 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .ref-pill-btn:hover {
        background: #272a38;
        color: #ffffff;
        transform: translateY(-1px);
      }

      .ref-pill-btn:active,
      .ref-pill-btn.juice-pop {
        transform: scale(0.94);
      }

      .ref-pill-btn.active {
        background: #e0a945;
        color: #0e1017;
        font-weight: 700;
        border-color: #f3c66f;
        box-shadow: 0 0 12px rgba(224, 169, 69, 0.35);
      }

      .ref-pill-btn.accent-create {
        border-color: rgba(142, 246, 255, 0.4);
        color: #8ef6ff;
      }

      .clock-pill {
        background: #14161f;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 5px;
        padding: 5px 12px;
        font-size: 12px;
        color: #c7ccd9;
        margin-left: 4px;
      }

      .dark-glass-panel {
        pointer-events: auto;
        background: rgba(14, 16, 24, 0.86);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 8px;
        padding: 12px 14px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6);
      }

      /* Phase 3: God's Hand Toolbar */
      .god-toolbar {
        position: absolute;
        bottom: 58px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 9px 14px;
        z-index: 24;
      }

      .god-toolbar-row {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .left-column {
        position: absolute;
        top: 56px;
        left: 14px;
        width: 310px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: calc(100vh - 118px);
      }

      .hero-header {
        display: flex;
        align-items: center;
        gap: 11px;
        margin-bottom: 8px;
      }

      .portrait-box {
        width: 48px;
        height: 48px;
        background: radial-gradient(circle, #24384a 0%, #121521 100%);
        border: 1px solid rgba(224, 169, 69, 0.5);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
      }

      .portrait-box canvas {
        width: 42px;
        height: 42px;
      }

      .stage-badge {
        display: inline-block;
        background: rgba(224, 169, 69, 0.18);
        color: #f3c66f;
        border: 1px solid rgba(224, 169, 69, 0.45);
        border-radius: 4px;
        padding: 1px 6px;
        font-size: 11px;
        font-weight: 700;
      }

      .genetics-bar {
        display: flex;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 5px;
        padding: 5px 8px;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .trait-chip {
        display: inline-block;
        background: rgba(71, 181, 207, 0.16);
        color: #8ef6ff;
        border: 1px solid rgba(142, 246, 255, 0.28);
        border-radius: 4px;
        padding: 1px 6px;
        font-size: 10px;
        margin-right: 4px;
        margin-bottom: 4px;
      }

      .need-row {
        margin-bottom: 6px;
      }

      .need-label-row {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #b8bfd1;
        margin-bottom: 2px;
      }

      .bar-track {
        width: 100%;
        height: 7px;
        background: #1e2130;
        border-radius: 3px;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        transition: width 0.2s ease-out;
      }

      .section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #e0a945;
        margin: 8px 0 5px 0;
      }

      .chronicle-panel {
        flex: 1;
        min-height: 125px;
        max-height: 195px;
        display: flex;
        flex-direction: column;
      }

      .chronicle-list {
        overflow-y: auto;
        flex: 1;
        font-size: 11.5px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-right: 4px;
      }

      .chronicle-item {
        background: rgba(255, 255, 255, 0.04);
        border-left: 3px solid #6c738a;
        border-radius: 0 4px 4px 0;
        padding: 4px 7px;
        line-height: 1.35;
        color: #d6dbe8;
      }
      .chronicle-item.milestone {
        border-left-color: #e0a945;
        background: rgba(224, 169, 69, 0.11);
      }
      .chronicle-item.food { border-left-color: #e63946; }
      .chronicle-item.sleep { border-left-color: #49cbe0; }
      .chronicle-item.warn {
        border-left-color: #ff5964;
        background: rgba(255, 89, 100, 0.12);
      }
      .chronicle-item.info { border-left-color: #52b788; }

      .watch-card {
        position: absolute;
        bottom: 58px;
        right: 14px;
        width: 255px;
      }

      .watch-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 6px;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(5, 7, 12, 0.78);
        backdrop-filter: blur(5px);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 60;
      }
      .modal-backdrop.open {
        display: flex;
      }
      .creation-dialog {
        width: 480px;
        max-width: 94vw;
        background: #121521;
        border: 1px solid rgba(224, 169, 69, 0.45);
        border-radius: 10px;
        padding: 18px 20px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85);
      }
      .form-input {
        background: #1b1f30;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 5px;
        color: #ffffff;
        padding: 6px 10px;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 13px;
        width: 100%;
      }
      .stat-alloc-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 6px;
        padding: 6px 10px;
        margin-bottom: 6px;
      }
      .trait-option {
        cursor: pointer;
        padding: 7px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        margin-bottom: 6px;
        transition: all 0.12s;
      }
      .trait-option.selected {
        border-color: #e0a945;
        background: rgba(224, 169, 69, 0.15);
      }
    `;
    document.head.appendChild(style);
  }

  private buildLayout(): void {
    // 1. Top Letterbox Bar
    const topBar = document.createElement('div');
    topBar.className = 'letterbox-top';

    this.fpsEl = document.createElement('div');
    this.fpsEl.style.fontSize = '12px';
    this.fpsEl.style.color = '#9aa1b5';
    this.fpsEl.textContent = '60 fps';

    const rightPills = document.createElement('div');
    rightPills.className = 'pill-group';

    const createBtn = document.createElement('button');
    createBtn.className = 'ref-pill-btn accent-create';
    createBtn.textContent = '✨ สร้างตัวเอก';
    createBtn.onclick = () => {
      this.triggerJuice(createBtn);
      this.openCreationModal();
    };

    const villageBtn = document.createElement('button');
    villageBtn.className = 'ref-pill-btn';
    villageBtn.textContent = 'Village';
    villageBtn.onclick = () => {
      this.triggerJuice(villageBtn);
      this.callbacks.onCenterVillage();
    };

    this.seeThroughBtn = document.createElement('button');
    this.seeThroughBtn.className = 'ref-pill-btn';
    this.seeThroughBtn.textContent = 'See-through';
    this.seeThroughBtn.onclick = () => {
      this.triggerJuice(this.seeThroughBtn);
      const active = this.callbacks.onToggleSeeThrough();
      this.seeThroughBtn.classList.toggle('active', active);
    };

    this.watchBtn = document.createElement('button');
    this.watchBtn.className = 'ref-pill-btn active';
    this.watchBtn.textContent = 'Watch';
    this.watchBtn.onclick = () => {
      this.triggerJuice(this.watchBtn);
      const following = this.callbacks.onToggleFollow();
      this.setFollowState(following);
    };

    const mapBtn = document.createElement('button');
    mapBtn.className = 'ref-pill-btn';
    mapBtn.textContent = '🎲 New Map';
    mapBtn.onclick = () => {
      this.triggerJuice(mapBtn);
      this.callbacks.onRegenerateWorld();
    };

    rightPills.append(createBtn, villageBtn, this.seeThroughBtn, this.watchBtn, mapBtn);

    const speeds: { speed: TimeSpeed; label: string }[] = [
      { speed: 0, label: '⏸' },
      { speed: 1, label: '1x' },
      { speed: 2, label: '2x' },
      { speed: 4, label: '4x' },
      { speed: 10, label: '10x' },
    ];

    for (const item of speeds) {
      const btn = document.createElement('button');
      btn.className = `ref-pill-btn ${item.speed === 1 ? 'active' : ''}`;
      btn.textContent = item.label;
      btn.onclick = () => {
        this.triggerJuice(btn);
        this.setSpeedActive(item.speed);
        this.callbacks.onSpeedChange(item.speed);
      };
      this.speedButtons.set(item.speed, btn);
      rightPills.appendChild(btn);
    }

    this.clockPillEl = document.createElement('div');
    this.clockPillEl.className = 'clock-pill';
    this.clockPillEl.textContent = 'Day 1  20:30  Fog';
    rightPills.appendChild(this.clockPillEl);

    topBar.append(this.fpsEl, rightPills);
    this.root.appendChild(topBar);

    // 2. Bottom Letterbox Narrative Caption Bar
    const bottomBar = document.createElement('div');
    bottomBar.className = 'letterbox-bottom';

    this.narrativeCaptionEl = document.createElement('div');
    this.narrativeCaptionEl.className = 'narrative-caption';
    this.narrativeCaptionEl.textContent = 'เอลิน แห่งโมริมาร์ กำลังสำรวจสายหมอกเรืองแสง';
    bottomBar.appendChild(this.narrativeCaptionEl);
    this.root.appendChild(bottomBar);

    // 3. Phase 3: God's Hand Toolbar (Centered above bottom bar)
    const godToolbar = document.createElement('div');
    godToolbar.className = 'dark-glass-panel god-toolbar';

    // Row 1: Weather & Instant Divine Blessing
    const weatherRow = document.createElement('div');
    weatherRow.className = 'god-toolbar-row';

    const wTitle = document.createElement('span');
    wTitle.style.fontSize = '11px';
    wTitle.style.fontWeight = '700';
    wTitle.style.color = '#e0a945';
    wTitle.style.marginRight = '4px';
    wTitle.textContent = '🌦️ สภาพอากาศ:';
    weatherRow.appendChild(wTitle);

    for (const w of this.weatherList) {
      const btn = document.createElement('button');
      btn.className = `ref-pill-btn ${w.id === 'fog' ? 'active' : ''}`;
      btn.textContent = `${w.icon} ${w.name.split(' ')[0]}`;
      btn.title = w.description;
      btn.onclick = () => {
        this.triggerJuice(btn);
        for (const [id, b] of this.weatherButtons.entries()) {
          b.classList.toggle('active', id === w.id);
        }
        this.callbacks.onSelectWeather(w.id);
      };
      this.weatherButtons.set(w.id, btn);
      weatherRow.appendChild(btn);
    }

    const inspireBtn = document.createElement('button');
    inspireBtn.className = 'ref-pill-btn accent-create';
    inspireBtn.textContent = '✨ มอบแรงบันดาลใจ (+INT/Heal)';
    inspireBtn.onclick = () => {
      this.triggerJuice(inspireBtn);
      this.callbacks.onGrantDivineInspiration();
    };
    weatherRow.appendChild(inspireBtn);

    // Row 2: God Brush Tools
    const toolRow = document.createElement('div');
    toolRow.className = 'god-toolbar-row';

    const tTitle = document.createElement('span');
    tTitle.style.fontSize = '11px';
    tTitle.style.fontWeight = '700';
    tTitle.style.color = '#8ef6ff';
    tTitle.style.marginRight = '4px';
    tTitle.textContent = '⚡ หัตถ์พระเจ้า:';
    toolRow.appendChild(tTitle);

    const tools: { id: GodToolId; label: string; hint: string }[] = [
      { id: 'inspect', label: '🖐️ ตรวจสอบ', hint: 'คลิกหรือเลื่อนเมาส์เพื่อตรวจสอบพื้นที่' },
      {
        id: 'spawn_mountain',
        label: '⛰️ เสกภูเขา',
        hint: 'คลิกบนแผนที่เพื่อเสกโขดหินผารูนกั้นทางเดินของบอท',
      },
      {
        id: 'terraform_river',
        label: '🌊 เสกลำธาร',
        hint: 'คลิกบนแผนที่เพื่อเนรมิตลำธารน้ำตื้นสีฟ้าเรืองแสง',
      },
      {
        id: 'spawn_berry',
        label: '🍒 เสกเบอร์รี่',
        hint: 'คลิกบนแผนที่เพื่อปลูกพุ่มเบอร์รี่ป่าลูกสุก',
      },
      {
        id: 'spawn_beast',
        label: '🐺 เสกหมาป่าเงา',
        hint: 'คลิกบนแผนที่เพื่อปล่อยหมาป่าเงาออกมาทดสอบความกล้าของบอท',
      },
      {
        id: 'smite_lightning',
        label: '⚡ สายฟ้าฟาด',
        hint: 'คลิกบนแผนที่เพื่อฟาดสายฟ้าทำลายโขดหินหรือปราบสัตว์ป่า',
      },
      {
        id: 'spawn_blessing',
        label: '💎 แท่นผลึกดารา',
        hint: 'คลิกบนแผนที่เพื่อประทานผลึกดาราให้บอทเดินมารับพร (+STR/+INT)',
      },
    ];

    for (const tl of tools) {
      const btn = document.createElement('button');
      btn.className = `ref-pill-btn ${tl.id === 'inspect' ? 'active' : ''}`;
      btn.textContent = tl.label;
      btn.onclick = () => {
        this.triggerJuice(btn);
        for (const [id, b] of this.godToolButtons.entries()) {
          b.classList.toggle('active', id === tl.id);
        }
        this.godHintEl.textContent = tl.hint;
        this.callbacks.onSelectGodTool(tl.id);
      };
      this.godToolButtons.set(tl.id, btn);
      toolRow.appendChild(btn);
    }

    this.godHintEl = document.createElement('div');
    this.godHintEl.style.fontSize = '10.5px';
    this.godHintEl.style.color = '#9aa1b5';
    this.godHintEl.textContent = 'คลิกเลือกพลังหัตถ์พระเจ้า แล้วคลิกบนแผนที่เพื่อเสกสิ่งกีดขวางหรือมอบพร';

    godToolbar.append(weatherRow, toolRow, this.godHintEl);
    this.root.appendChild(godToolbar);

    // 4. Left Floating Panel (Hero Status, Genetics, Life Stage & Chronicle)
    this.leftPanel = document.createElement('div');
    this.leftPanel.className = 'left-column';

    const heroCard = document.createElement('div');
    heroCard.className = 'dark-glass-panel';

    const header = document.createElement('div');
    header.className = 'hero-header';

    const portraitBox = document.createElement('div');
    portraitBox.className = 'portrait-box';
    portraitBox.title = 'คลิกเพื่อโฟกัสตัวเอก';
    this.portraitCanvas = document.createElement('canvas');
    renderHeroPortraitToCanvas(this.portraitCanvas, '#3b7a57', false);
    portraitBox.appendChild(this.portraitCanvas);
    portraitBox.onclick = () => {
      this.triggerJuice(portraitBox);
      this.callbacks.onCenterHero();
    };

    const metaWrap = document.createElement('div');
    metaWrap.style.flex = '1';

    this.heroNameEl = document.createElement('div');
    this.heroNameEl.style.fontWeight = '700';
    this.heroNameEl.style.fontSize = '14px';
    this.heroNameEl.style.color = '#ffffff';

    const subRow = document.createElement('div');
    subRow.style.display = 'flex';
    subRow.style.alignItems = 'center';
    subRow.style.gap = '6px';
    subRow.style.marginTop = '3px';

    this.heroStageBadgeEl = document.createElement('span');
    this.heroStageBadgeEl.className = 'stage-badge';

    this.heroAgeEl = document.createElement('span');
    this.heroAgeEl.style.fontSize = '11.5px';
    this.heroAgeEl.style.color = '#b8bfd1';

    subRow.append(this.heroStageBadgeEl, this.heroAgeEl);
    metaWrap.append(this.heroNameEl, subRow);
    header.append(portraitBox, metaWrap);

    this.geneticsRowEl = document.createElement('div');
    this.geneticsRowEl.className = 'genetics-bar';

    this.traitsRowEl = document.createElement('div');
    this.traitsRowEl.style.marginBottom = '6px';

    const hungerRow = this.createNeedBar('🍒 ความอิ่ม (Hunger)', '#e63946');
    this.hungerBar = hungerRow.fill;
    this.hungerVal = hungerRow.val;

    const energyRow = this.createNeedBar('⚡ พลังงาน (Energy)', '#e0a945');
    this.energyBar = energyRow.fill;
    this.energyVal = energyRow.val;

    const healthRow = this.createNeedBar('❤️ พลังชีวิต (Health)', '#52b788');
    this.healthBar = healthRow.fill;
    this.healthVal = healthRow.val;

    this.utilitySectionEl = document.createElement('div');
    const brainTitle = document.createElement('div');
    brainTitle.className = 'section-title';
    brainTitle.textContent = '🧠 สมองตัดสินใจ (Utility AI)';
    this.utilityContainer = document.createElement('div');
    this.utilitySectionEl.append(brainTitle, this.utilityContainer);

    heroCard.append(
      header,
      this.geneticsRowEl,
      this.traitsRowEl,
      hungerRow.row,
      energyRow.row,
      healthRow.row,
      this.utilitySectionEl
    );

    // Chronicle Card
    this.chronicleCardEl = document.createElement('div');
    this.chronicleCardEl.className = 'dark-glass-panel chronicle-panel';

    const chronTitle = document.createElement('div');
    chronTitle.className = 'section-title';
    chronTitle.style.marginTop = '0';
    chronTitle.textContent = '📜 บันทึกช่วงชีวิต (Life Chronicle)';

    this.chronicleListEl = document.createElement('div');
    this.chronicleListEl.className = 'chronicle-list';

    this.chronicleCardEl.append(chronTitle, this.chronicleListEl);
    this.leftPanel.append(heroCard, this.chronicleCardEl);
    this.root.appendChild(this.leftPanel);

    // 5. Bottom-Right "What to watch" Card
    const watchCard = document.createElement('div');
    watchCard.className = 'dark-glass-panel watch-card';

    const watchTitle = document.createElement('div');
    watchTitle.style.fontSize = '12px';
    watchTitle.style.fontWeight = '700';
    watchTitle.style.color = '#ffffff';
    watchTitle.textContent = 'What to watch';

    const grid = document.createElement('div');
    grid.className = 'watch-grid';

    const btnHeroFocus = document.createElement('button');
    btnHeroFocus.className = 'ref-pill-btn active';
    btnHeroFocus.textContent = 'Hero life';
    btnHeroFocus.onclick = () => {
      this.triggerJuice(btnHeroFocus);
      this.callbacks.onCenterHero();
    };

    const btnCampFocus = document.createElement('button');
    btnCampFocus.className = 'ref-pill-btn';
    btnCampFocus.textContent = 'Campfire';
    btnCampFocus.onclick = () => {
      this.triggerJuice(btnCampFocus);
      this.callbacks.onCenterVillage();
    };

    const btnToggleHud = document.createElement('button');
    btnToggleHud.className = 'ref-pill-btn';
    btnToggleHud.textContent = 'Toggle HUD';
    btnToggleHud.onclick = () => {
      this.triggerJuice(btnToggleHud);
      const hidden = this.leftPanel.style.display === 'none';
      this.leftPanel.style.display = hidden ? 'flex' : 'none';
      btnToggleHud.classList.toggle('active', !hidden);
    };

    const btnCustomize = document.createElement('button');
    btnCustomize.className = 'ref-pill-btn';
    btnCustomize.textContent = 'Genetics';
    btnCustomize.onclick = () => {
      this.triggerJuice(btnCustomize);
      this.openCreationModal();
    };

    grid.append(btnHeroFocus, btnCampFocus, btnToggleHud, btnCustomize);

    this.tileInspectorEl = document.createElement('div');
    this.tileInspectorEl.style.fontSize = '11px';
    this.tileInspectorEl.style.color = '#b8bfd1';
    this.tileInspectorEl.style.marginTop = '8px';
    this.tileInspectorEl.style.paddingTop = '6px';
    this.tileInspectorEl.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    this.tileInspectorEl.textContent = 'ชี้บนแผนที่เพื่อตรวจสอบไบโอมและทรัพยากร';

    const shortcutHint = document.createElement('div');
    shortcutHint.style.fontSize = '10.5px';
    shortcutHint.style.color = '#7c8499';
    shortcutHint.style.marginTop = '6px';
    shortcutHint.textContent = 'WASD: pan   Wheel: zoom   Click: God hand';

    watchCard.append(watchTitle, grid, this.tileInspectorEl, shortcutHint);
    this.root.appendChild(watchCard);
  }

  private buildCreationModal(): void {
    this.creationModal = document.createElement('div');
    this.creationModal.className = 'modal-backdrop';
    this.root.appendChild(this.creationModal);
    this.renderCreationModalContent();
  }

  private renderCreationModalContent(): void {
    const totalPoints = 20;
    const usedPoints = this.draftCustom.str + this.draftCustom.int + this.draftCustom.agi;
    const remainingPoints = totalPoints - usedPoints;

    this.creationModal.innerHTML = '';
    const dialog = document.createElement('div');
    dialog.className = 'creation-dialog';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';
    header.innerHTML = `
      <div>
        <div style="font-size:16px;font-weight:700;color:#e0a945">✨ God's Creation Menu (กำเนิดตัวเอก)</div>
        <div style="font-size:11.5px;color:#9aa1b5">กำหนดพันธุกรรม ค่าสถานะเริ่มต้น และนิสัยพิเศษก่อนส่งลงสู่เกาะ</div>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ref-pill-btn';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => this.creationModal.classList.remove('open');
    header.appendChild(closeBtn);
    dialog.appendChild(header);

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.gap = '12px';
    topRow.style.marginBottom = '12px';

    const previewBox = document.createElement('div');
    previewBox.className = 'portrait-box';
    previewBox.style.width = '64px';
    previewBox.style.height = '64px';
    const previewCanvas = document.createElement('canvas');
    renderHeroPortraitToCanvas(previewCanvas, this.draftCustom.cloakColor, false);
    previewBox.appendChild(previewCanvas);

    const inputsWrap = document.createElement('div');
    inputsWrap.style.flex = '1';
    inputsWrap.style.display = 'flex';
    inputsWrap.style.flexDirection = 'column';
    inputsWrap.style.gap = '6px';

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.gap = '6px';

    const nameInput = document.createElement('input');
    nameInput.className = 'form-input';
    nameInput.value = this.draftCustom.name;
    nameInput.placeholder = 'ชื่อตัวเอก';
    nameInput.oninput = () => {
      this.draftCustom.name = nameInput.value;
    };

    const randNameBtn = document.createElement('button');
    randNameBtn.className = 'ref-pill-btn';
    randNameBtn.textContent = '🎲 สุ่ม';
    randNameBtn.onclick = () => {
      const pick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
      this.draftCustom.name = pick.name;
      this.draftCustom.clanName = pick.clan;
      this.renderCreationModalContent();
    };

    nameRow.append(nameInput, randNameBtn);

    const clanInput = document.createElement('input');
    clanInput.className = 'form-input';
    clanInput.value = this.draftCustom.clanName;
    clanInput.placeholder = 'ฉายาตระกูล';
    clanInput.oninput = () => {
      this.draftCustom.clanName = clanInput.value;
    };

    inputsWrap.append(nameRow, clanInput);
    topRow.append(previewBox, inputsWrap);
    dialog.appendChild(topRow);

    const colorRow = document.createElement('div');
    colorRow.style.display = 'flex';
    colorRow.style.gap = '6px';
    colorRow.style.marginBottom = '12px';
    for (const c of CLOAK_PALETTES) {
      const cBtn = document.createElement('button');
      cBtn.className = `ref-pill-btn ${this.draftCustom.cloakColor === c.id ? 'active' : ''}`;
      cBtn.style.flex = '1';
      cBtn.style.fontSize = '11px';
      cBtn.textContent = c.label.split(' ')[0];
      cBtn.onclick = () => {
        this.draftCustom.cloakColor = c.id;
        this.renderCreationModalContent();
      };
      colorRow.appendChild(cBtn);
    }
    dialog.appendChild(colorRow);

    const statHeader = document.createElement('div');
    statHeader.className = 'section-title';
    statHeader.textContent = `🧬 ค่าพันธุกรรมเริ่มต้น (แต้มคงเหลือ: ${remainingPoints})`;
    dialog.appendChild(statHeader);

    const statsMeta: { key: 'str' | 'int' | 'agi'; label: string; desc: string }[] = [
      { key: 'str', label: '💪 STR (พละกำลัง)', desc: 'เพิ่ม Max HP, ทนความหนาว และปราบหมาป่าเงาได้' },
      { key: 'int', label: '🧠 INT (สติปัญญา)', desc: 'สั่งสมแต้มภูมิปัญญาไวขึ้นเมื่อผิงไฟ/สำรวจ' },
      { key: 'agi', label: '🦶 AGI (ความว่องไว)', desc: 'เดินเร็วขึ้นและใช้พลังงานน้อยลง' },
    ];

    for (const st of statsMeta) {
      const row = document.createElement('div');
      row.className = 'stat-alloc-row';
      const val = this.draftCustom[st.key];

      const leftInfo = document.createElement('div');
      leftInfo.innerHTML = `<div style="font-size:12.5px;font-weight:700">${st.label}</div><div style="font-size:10.5px;color:#9aa1b5">${st.desc}</div>`;

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.gap = '8px';

      const minusBtn = document.createElement('button');
      minusBtn.className = 'ref-pill-btn';
      minusBtn.textContent = '-';
      minusBtn.onclick = () => {
        if (this.draftCustom[st.key] > 3) {
          this.draftCustom[st.key]--;
          this.renderCreationModalContent();
        }
      };

      const numSpan = document.createElement('span');
      numSpan.style.fontWeight = '700';
      numSpan.style.fontSize = '14px';
      numSpan.style.minWidth = '20px';
      numSpan.style.textAlign = 'center';
      numSpan.style.color = '#e0a945';
      numSpan.textContent = String(val);

      const plusBtn = document.createElement('button');
      plusBtn.className = 'ref-pill-btn';
      plusBtn.textContent = '+';
      plusBtn.onclick = () => {
        if (remainingPoints > 0 && this.draftCustom[st.key] < 12) {
          this.draftCustom[st.key]++;
          this.renderCreationModalContent();
        }
      };

      controls.append(minusBtn, numSpan, plusBtn);
      row.append(leftInfo, controls);
      dialog.appendChild(row);
    }

    const traitHeader = document.createElement('div');
    traitHeader.className = 'section-title';
    traitHeader.textContent = `🌟 นิสัยพิเศษ (เลือกได้สูงสุด 2 นิสัย — เลือกแล้ว ${this.draftCustom.traitIds.length}/2)`;
    dialog.appendChild(traitHeader);

    const traitList = document.createElement('div');
    traitList.style.maxHeight = '145px';
    traitList.style.overflowY = 'auto';

    for (const tr of this.availableTraits) {
      const isSelected = this.draftCustom.traitIds.includes(tr.id);
      const opt = document.createElement('div');
      opt.className = `trait-option ${isSelected ? 'selected' : ''}`;
      opt.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:${isSelected ? '#e0a945' : '#e6e8f0'}">
          ${tr.icon} ${tr.name} ${isSelected ? '✓' : ''}
        </div>
        <div style="font-size:11px;color:#9aa1b5">${tr.description}</div>
      `;
      opt.onclick = () => {
        if (isSelected) {
          this.draftCustom.traitIds = this.draftCustom.traitIds.filter((id) => id !== tr.id);
        } else if (this.draftCustom.traitIds.length < 2) {
          this.draftCustom.traitIds.push(tr.id);
        }
        this.renderCreationModalContent();
      };
      traitList.appendChild(opt);
    }
    dialog.appendChild(traitList);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'ref-pill-btn active';
    confirmBtn.style.width = '100%';
    confirmBtn.style.padding = '9px';
    confirmBtn.style.marginTop = '12px';
    confirmBtn.style.fontSize = '13.5px';
    confirmBtn.textContent = '🌟 ประทานชีวิตสู่เกาะ (Begin Life at Age 1)';
    confirmBtn.onclick = () => {
      this.creationModal.classList.remove('open');
      this.callbacks.onApplyHeroCustomization({ ...this.draftCustom });
    };
    dialog.appendChild(confirmBtn);

    this.creationModal.appendChild(dialog);
  }

  public openCreationModal(): void {
    this.renderCreationModalContent();
    this.creationModal.classList.add('open');
  }

  private createNeedBar(label: string, color: string): {
    row: HTMLElement;
    fill: HTMLElement;
    val: HTMLElement;
  } {
    const row = document.createElement('div');
    row.className = 'need-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'need-label-row';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = label;

    const valSpan = document.createElement('span');
    valSpan.textContent = '100 / 100';

    labelRow.append(nameSpan, valSpan);

    const track = document.createElement('div');
    track.className = 'bar-track';

    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.backgroundColor = color;
    fill.style.width = '100%';

    track.appendChild(fill);
    row.append(labelRow, track);

    return { row, fill, val: valSpan };
  }

  public setFollowState(following: boolean): void {
    this.watchBtn.classList.toggle('active', following);
  }

  public setSpeedActive(speed: TimeSpeed): void {
    for (const [s, btn] of this.speedButtons.entries()) {
      btn.classList.toggle('active', s === speed);
    }
  }

  private triggerJuice(el: HTMLElement): void {
    el.classList.remove('juice-pop');
    void el.offsetWidth;
    el.classList.add('juice-pop');
    setTimeout(() => el.classList.remove('juice-pop'), 150);
  }

  public updateHeroStatus(
    snapshot: HeroStatusSnapshot,
    fps: number,
    dayCount: number,
    clockStr: string
  ): void {
    this.fpsEl.textContent = `${Math.round(fps)} fps  •  รุ่นที่ ${snapshot.generation}`;
    this.clockPillEl.textContent = `Day ${dayCount}   ${clockStr}   ${snapshot.activeWeather.shortLabel}`;
    this.narrativeCaptionEl.textContent = snapshot.narrativeCaption;

    const isElder = snapshot.lifeStage.id === 'elder';
    if (
      snapshot.cloakColor !== this.lastPortraitColor ||
      isElder !== this.lastPortraitElder
    ) {
      this.lastPortraitColor = snapshot.cloakColor;
      this.lastPortraitElder = isElder;
      renderHeroPortraitToCanvas(this.portraitCanvas, snapshot.cloakColor, isElder);
    }

    this.heroNameEl.textContent = `${snapshot.name} ${snapshot.clanName}`;
    this.heroStageBadgeEl.textContent = snapshot.lifeStage.badge;
    this.heroAgeEl.textContent = `อายุ ${snapshot.age}/${snapshot.maxAge} ปี`;

    this.geneticsRowEl.innerHTML = `
      <span>💪 STR <strong>${snapshot.str}</strong></span>
      <span>🧠 INT <strong>${snapshot.int}</strong></span>
      <span>🦶 AGI <strong>${snapshot.agi}</strong></span>
      <span style="color:#8ef6ff">✨ ปัญญา <strong>${snapshot.loreExp}</strong></span>
    `;

    this.traitsRowEl.innerHTML = snapshot.traits
      .map((t) => `<span class="trait-chip">${t.icon} ${t.name.split(' ')[0]}</span>`)
      .join('');

    const hPct = Math.round((snapshot.hunger / snapshot.maxHunger) * 100);
    this.hungerBar.style.width = `${hPct}%`;
    this.hungerVal.textContent = `${Math.round(snapshot.hunger)} / ${snapshot.maxHunger}`;

    const ePct = Math.round((snapshot.energy / snapshot.maxEnergy) * 100);
    this.energyBar.style.width = `${ePct}%`;
    this.energyVal.textContent = `${Math.round(snapshot.energy)} / ${snapshot.maxEnergy}`;

    const hpPct = Math.round((snapshot.health / snapshot.maxHealth) * 100);
    this.healthBar.style.width = `${hpPct}%`;
    this.healthVal.textContent = `${Math.round(snapshot.health)} / ${snapshot.maxHealth}`;

    this.utilityContainer.innerHTML = '';
    for (const item of snapshot.scores) {
      const isWinner = item.id === snapshot.currentActionId;
      const pct = Math.round(item.score * 100);
      const row = document.createElement('div');
      row.style.marginBottom = '4px';

      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:${
          isWinner ? '#e0a945' : '#9aa1b5'
        };font-weight:${isWinner ? '700' : '500'}">
          <span>${isWinner ? '▸ ' : ''}${item.label}</span>
          <span>${pct}%</span>
        </div>
        <div class="bar-track" style="height:5px">
          <div class="bar-fill" style="width:${pct}%;background:${
        isWinner ? '#e0a945' : '#4a5268'
      }"></div>
        </div>
      `;
      this.utilityContainer.appendChild(row);
    }
  }

  public addChronicle(entry: Omit<ChronicleEntry, 'id'>): void {
    const item: ChronicleEntry = { ...entry, id: this.nextLogId++ };
    this.chronicles.unshift(item);
    if (this.chronicles.length > 35) {
      this.chronicles.pop();
    }

    const div = document.createElement('div');
    div.className = `chronicle-item ${item.type}`;
    div.innerHTML = `
      <div style="font-size:10px;color:#9aa1b5;margin-bottom:1px">
        <strong>[อายุ ${item.year} ปี • ${item.lifeStageBadge}]</strong> เวลา ${item.timeStr}
      </div>
      <div>${item.text}</div>
    `;
    this.chronicleListEl.prepend(div);

    while (this.chronicleListEl.children.length > 35) {
      this.chronicleListEl.lastChild?.remove();
    }
  }

  public clearChronicles(): void {
    this.chronicles = [];
    this.chronicleListEl.innerHTML = '';
  }

  public updateTileInspector(tile?: TileData): void {
    if (!tile) {
      this.tileInspectorEl.innerHTML =
        'ชี้บนแผนที่เพื่อตรวจสอบไบโอมและทรัพยากร';
      return;
    }

    let resHtml = 'พื้นที่ว่างธรรมชาติ';
    if (tile.resource) {
      switch (tile.resource.type) {
        case 'campfire':
          resHtml = '🔥 <strong>กองไฟศักดิ์สิทธิ์:</strong> จุดรวมใจและฟื้นฟูพลังงาน';
          break;
        case 'lantern_tree':
          resHtml = '🏮 <strong>ต้นหลิวโคมเรืองแสง:</strong> ร่มเงาพักผ่อนยามค่ำคืน';
          break;
        case 'tree':
          resHtml = '🌲 <strong>ต้นไม้โบราณ:</strong> ที่พักพิงฟื้นฟูพลังงาน';
          break;
        case 'crimson_canopy':
          resHtml = '🍄 <strong>พุ่มฉัตรสีชาด:</strong> พืชพรรณลึกลับแห่งเกาะหมอก';
          break;
        case 'hut':
        case 'round_hut':
          resHtml = '🏠 <strong>กระท่อมไม้:</strong> ที่พักพิงอบอุ่นของหมู่บ้าน';
          break;
        case 'watchtower':
          resHtml = '🗼 <strong>หอคอยเฝ้าระวัง:</strong> ส่องสว่างคอยเตือนภัย';
          break;
        case 'crystal':
          resHtml = '💎 <strong>ผลึกเรืองแสง:</strong> แหล่งพลังงานเวทมนตร์โบราณ';
          break;
        case 'mountain_rock':
          resHtml = '⛰️ <strong>หินผารูนโบราณ:</strong> สิ่งกีดขวางที่พระเจ้าเสกขึ้น';
          break;
        case 'blessing_shrine':
          resHtml = '🌟 <strong>แท่นผลึกดารา:</strong> รอให้ตัวเอกเดินมารับพรศักดิ์สิทธิ์';
          break;
        case 'berry_bush':
          resHtml = tile.resource.hasBerry
            ? '🍒 <strong>พุ่มเบอร์รี่:</strong> ลูกสุกพร้อมเก็บเกี่ยว'
            : `🌱 <strong>พุ่มเบอร์รี่:</strong> งอกใหม่ใน ${Math.ceil(
                tile.resource.regrowTimer
              )} วินาที`;
          break;
      }
    }

    this.tileInspectorEl.innerHTML = `
      <div><strong>(${tile.x}, ${tile.y})</strong> • ${tile.biome.name}</div>
      <div style="margin-top:2px;color:#e0a945">${resHtml}</div>
    `;
  }
}
