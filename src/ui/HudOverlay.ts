import Phaser from 'phaser';
import { DisasterId, SeasonId } from '../agent/DeepCognitionEngine';
import { renderHeroPortraitToCanvas } from '../core/PixelTextures';
import {
  ChronicleEntry,
  GodToolId,
  HeroCustomization,
  HeroStatusSnapshot,
  LifeStageId,
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
  onZoomDelta: (delta: number) => void;
  onZoomFullWorld: () => void;
  onApplyHeroCustomization: (custom: HeroCustomization) => void;
  onSelectWeather: (weatherId: WeatherId) => void;
  onSelectSeason: (seasonId: SeasonId) => void;
  onTriggerDisaster: (disasterId: DisasterId) => void;
  onSelectGodTool: (toolId: GodToolId) => void;
  onGrantDivineInspiration: () => void;
  onTriggerLegacyHeir: () => void;
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
  private scene: Phaser.Scene;
  private root: HTMLDivElement;
  private callbacks: HudCallbacks;
  private availableTraits: TraitConfig[];
  private weatherList: WeatherConfig[];
  private chronicles: ChronicleEntry[] = [];
  private nextLogId = 1;
  private allPanelsHidden = false;

  // Top Letterbox Elements
  private fpsEl!: HTMLElement;
  private seeThroughBtn!: HTMLButtonElement;
  private watchBtn!: HTMLButtonElement;
  private speedButtons = new Map<TimeSpeed, HTMLButtonElement>();
  private clockPillEl!: HTMLElement;

  // Bottom Letterbox Narrative Caption
  private narrativeCaptionEl!: HTMLElement;

  // Collapsible Floating Containers
  private leftPanel!: HTMLElement;
  private rightColumn!: HTMLElement;
  private godToolbar!: HTMLElement;

  // God Toolbar Elements (Phase 3)
  private weatherButtons = new Map<WeatherId, HTMLButtonElement>();
  private godToolButtons = new Map<GodToolId, HTMLButtonElement>();
  private godHintEl!: HTMLElement;

  // Left Floating Status & Chronicle Panel
  private portraitCanvas!: HTMLCanvasElement;
  private lastPortraitColor = '';
  private lastPortraitStage: LifeStageId | '' = '';
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
  private deepPhilosophyEl!: HTMLElement;
  private deepMonologueEl!: HTMLElement;
  private deepReasoningListEl!: HTMLElement;
  private deepMemoriesListEl!: HTMLElement;
  private chronicleListEl!: HTMLElement;

  // Right Floating Kingdom & Inspector Panels (Phase 4)
  private kingdomStockpileEl!: HTMLElement;
  private kingdomActiveSiteEl!: HTMLElement;
  private kingdomTechListEl!: HTMLElement;
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
    scene: Phaser.Scene,
    callbacks: HudCallbacks,
    availableTraits: TraitConfig[],
    weatherList: WeatherConfig[]
  ) {
    this.scene = scene;
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
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        pointer-events: auto;
        z-index: 25;
      }

      .letterbox-bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 44px;
        background: #06070b;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 20px;
        pointer-events: auto;
        z-index: 25;
      }

      .narrative-caption {
        font-size: 15px;
        font-weight: 500;
        color: #f2f4fa;
        letter-spacing: 0.3px;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
      }

      .pill-group {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }

      .ref-pill-btn {
        pointer-events: auto;
        cursor: pointer;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 11.5px;
        font-weight: 600;
        color: #d5d9e6;
        background: #1a1c26;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 5px;
        padding: 4px 9px;
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
        box-shadow: 0 0 10px rgba(224, 169, 69, 0.32);
      }

      .ref-pill-btn.accent-create {
        border-color: rgba(142, 246, 255, 0.45);
        color: #8ef6ff;
      }

      .clock-pill {
        background: #14161f;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 5px;
        padding: 4px 10px;
        font-size: 11.5px;
        color: #c7ccd9;
        margin-left: 2px;
      }

      .dark-glass-panel {
        pointer-events: auto;
        background: rgba(12, 14, 22, 0.88);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 12px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
      }

      .panel-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
      }

      .panel-title-text {
        font-size: 11.5px;
        font-weight: 700;
        color: #e0a945;
        letter-spacing: 0.4px;
      }

      .collapse-toggle-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        border-radius: 4px;
        width: 22px;
        height: 20px;
        font-size: 12px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .collapse-toggle-btn:hover {
        background: rgba(224, 169, 69, 0.25);
        color: #ffffff;
      }

      .panel-body {
        margin-top: 8px;
      }

      .panel-body.collapsed {
        display: none !important;
      }

      /* Phase 3: God's Hand Toolbar */
      .god-toolbar {
        position: absolute;
        bottom: 52px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 320px;
        max-width: 90vw;
        z-index: 24;
      }

      .god-toolbar-row {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
        justify-content: center;
        margin-bottom: 5px;
      }

      .left-column {
        position: absolute;
        top: 54px;
        left: 12px;
        width: 305px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: calc(100vh - 108px);
        z-index: 22;
      }

      .right-column {
        position: absolute;
        top: 54px;
        right: 12px;
        width: 295px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: calc(100vh - 108px);
        z-index: 22;
      }

      .hero-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .portrait-box {
        width: 54px;
        height: 54px;
        background: radial-gradient(circle, #24384a 0%, #10131d 100%);
        border: 1px solid rgba(224, 169, 69, 0.55);
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        overflow: hidden;
      }

      .portrait-box canvas {
        width: 50px;
        height: 50px;
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
        margin-bottom: 5px;
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
        height: 6px;
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
        letter-spacing: 0.4px;
        color: #e0a945;
        margin: 6px 0 4px 0;
      }

      .chronicle-list {
        overflow-y: auto;
        max-height: 150px;
        font-size: 11px;
        display: flex;
        flex-direction: column;
        gap: 4px;
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

      .stockpile-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        background: rgba(255, 255, 255, 0.04);
        border-radius: 6px;
        padding: 6px;
        text-align: center;
        font-size: 11px;
        margin-bottom: 6px;
      }

      .tech-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 5px;
        padding: 4px 7px;
        margin-bottom: 4px;
        font-size: 11px;
      }

      .tech-item.unlocked {
        border-color: rgba(224, 169, 69, 0.35);
      }

      .watch-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-top: 4px;
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

  private createCollapsibleCard(
    title: string,
    initiallyCollapsed = false
  ): { card: HTMLDivElement; body: HTMLDivElement } {
    const card = document.createElement('div');
    card.className = 'dark-glass-panel';

    const headerBar = document.createElement('div');
    headerBar.className = 'panel-header-bar';

    const titleEl = document.createElement('span');
    titleEl.className = 'panel-title-text';
    titleEl.textContent = title;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'collapse-toggle-btn';
    toggleBtn.textContent = initiallyCollapsed ? '+' : '–';
    toggleBtn.title = 'ย่อ / ขยายหน้าต่างนี้';

    const body = document.createElement('div');
    body.className = `panel-body ${initiallyCollapsed ? 'collapsed' : ''}`;

    const toggleFn = () => {
      const isCollapsed = body.classList.toggle('collapsed');
      toggleBtn.textContent = isCollapsed ? '+' : '–';
    };

    headerBar.onclick = toggleFn;
    card.append(headerBar, body);
    headerBar.append(titleEl, toggleBtn);

    return { card, body };
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

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'ref-pill-btn';
    zoomOutBtn.textContent = '🔍-';
    zoomOutBtn.title = 'ซูมออก (Zoom Out)';
    zoomOutBtn.onclick = () => {
      this.triggerJuice(zoomOutBtn);
      this.callbacks.onZoomDelta(-0.35);
    };

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'ref-pill-btn';
    zoomInBtn.textContent = '🔍+';
    zoomInBtn.title = 'ซูมเข้า (Zoom In)';
    zoomInBtn.onclick = () => {
      this.triggerJuice(zoomInBtn);
      this.callbacks.onZoomDelta(0.35);
    };

    const fullWorldBtn = document.createElement('button');
    fullWorldBtn.className = 'ref-pill-btn';
    fullWorldBtn.textContent = '🗺️ ทั้งทวีป';
    fullWorldBtn.title = 'ซูมดูแผนที่ Open World ทั้งทวีป';
    fullWorldBtn.onclick = () => {
      this.triggerJuice(fullWorldBtn);
      this.callbacks.onZoomFullWorld();
    };

    const villageBtn = document.createElement('button');
    villageBtn.className = 'ref-pill-btn';
    villageBtn.textContent = '🏕️ หมู่บ้าน';
    villageBtn.onclick = () => {
      this.triggerJuice(villageBtn);
      this.callbacks.onCenterVillage();
    };

    this.seeThroughBtn = document.createElement('button');
    this.seeThroughBtn.className = 'ref-pill-btn';
    this.seeThroughBtn.textContent = '🌲 โปร่งแสง';
    this.seeThroughBtn.onclick = () => {
      this.triggerJuice(this.seeThroughBtn);
      const active = this.callbacks.onToggleSeeThrough();
      this.seeThroughBtn.classList.toggle('active', active);
    };

    this.watchBtn = document.createElement('button');
    this.watchBtn.className = 'ref-pill-btn active';
    this.watchBtn.textContent = '🎯 ตามตัวเอก';
    this.watchBtn.onclick = () => {
      this.triggerJuice(this.watchBtn);
      const following = this.callbacks.onToggleFollow();
      this.setFollowState(following);
    };

    const hideAllUiBtn = document.createElement('button');
    hideAllUiBtn.className = 'ref-pill-btn';
    hideAllUiBtn.textContent = '👁️ ซ่อน/แสดง UI';
    hideAllUiBtn.onclick = () => {
      this.triggerJuice(hideAllUiBtn);
      this.allPanelsHidden = !this.allPanelsHidden;
      const disp = this.allPanelsHidden ? 'none' : '';
      this.leftPanel.style.display = disp;
      this.rightColumn.style.display = disp;
      this.godToolbar.style.display = disp;
      hideAllUiBtn.classList.toggle('active', this.allPanelsHidden);
    };

    const mapBtn = document.createElement('button');
    mapBtn.className = 'ref-pill-btn';
    mapBtn.textContent = '🎲 เกาะใหม่';
    mapBtn.onclick = () => {
      this.triggerJuice(mapBtn);
      this.callbacks.onRegenerateWorld();
    };

    rightPills.append(
      createBtn,
      zoomOutBtn,
      zoomInBtn,
      fullWorldBtn,
      villageBtn,
      this.seeThroughBtn,
      this.watchBtn,
      hideAllUiBtn,
      mapBtn
    );

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
    this.narrativeCaptionEl.textContent = 'เอลิน แห่งโมริมาร์ กำลังสำรวจทวีปเรืองแสง';
    bottomBar.appendChild(this.narrativeCaptionEl);
    this.root.appendChild(bottomBar);

    // 3. Phase 3: Collapsible God's Hand Toolbar (Centered above bottom bar)
    const godPanel = this.createCollapsibleCard('⚡ หัตถ์พระเจ้า & สภาพอากาศ (God Powers)', false);
    this.godToolbar = godPanel.card;
    this.godToolbar.classList.add('god-toolbar');

    const weatherRow = document.createElement('div');
    weatherRow.className = 'god-toolbar-row';

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
    inspireBtn.textContent = '✨ ประทานพร (+INT/ไม้/หิน)';
    inspireBtn.onclick = () => {
      this.triggerJuice(inspireBtn);
      this.callbacks.onGrantDivineInspiration();
    };
    weatherRow.appendChild(inspireBtn);

    const toolRow = document.createElement('div');
    toolRow.className = 'god-toolbar-row';

    const tools: { id: GodToolId; label: string; hint: string }[] = [
      { id: 'inspect', label: '🖐️ ตรวจดู', hint: 'คลิกหรือเลื่อนเมาส์เพื่อตรวจสอบพื้นที่' },
      {
        id: 'spawn_mountain',
        label: '⛰️ เสกภูเขา',
        hint: 'คลิกบนแผนที่เพื่อเสกโขดหินผารูน (แหล่งสกัดหินและสิ่งกีดขวาง)',
      },
      {
        id: 'terraform_river',
        label: '🌊 เสกลำธาร',
        hint: 'คลิกบนแผนที่เพื่อเนรมิตลำธารน้ำตื้น',
      },
      {
        id: 'spawn_berry',
        label: '🍒 เสกเบอร์รี่',
        hint: 'คลิกบนแผนที่เพื่อปลูกพุ่มเบอร์รี่ป่าลูกสุก',
      },
      {
        id: 'spawn_beast',
        label: '🐺 เสกหมาป่า',
        hint: 'คลิกบนแผนที่เพื่อปล่อยหมาป่าเงาออกมาทดสอบความกล้าของบอท',
      },
      {
        id: 'smite_lightning',
        label: '⚡ สายฟ้าฟาด',
        hint: 'คลิกบนแผนที่เพื่อฟาดสายฟ้าทำลายโขดหินหรือปราบสัตว์ป่า',
      },
      {
        id: 'spawn_blessing',
        label: '💎 ผลึกดารา',
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
    this.godHintEl.style.textAlign = 'center';
    this.godHintEl.textContent = 'คลิกเลือกพลังหัตถ์พระเจ้า แล้วคลิกบนแผนที่เพื่อเสกสิ่งกีดขวางหรือมอบพร';

    // Row 3: Seasons & Natural Disasters
    const seasonDisasterRow = document.createElement('div');
    seasonDisasterRow.className = 'god-toolbar-row';

    const seasons: { id: SeasonId; label: string }[] = [
      { id: 'spring', label: '🌸 ใบไม้ผลิ' },
      { id: 'summer', label: '☀️ ฤดูร้อน' },
      { id: 'autumn', label: '🍂 ใบไม้ร่วง' },
      { id: 'winter', label: '❄️ ฤดูหนาว' },
    ];
    for (const s of seasons) {
      const btn = document.createElement('button');
      btn.className = 'ref-pill-btn';
      btn.textContent = s.label;
      btn.onclick = () => {
        this.triggerJuice(btn);
        this.callbacks.onSelectSeason(s.id);
      };
      seasonDisasterRow.appendChild(btn);
    }

    const disasters: { id: DisasterId; label: string }[] = [
      { id: 'wildfire', label: '🔥 ไฟป่า' },
      { id: 'blizzard', label: '🌨️ พายุหิมะคลั่ง' },
      { id: 'meteor_shower', label: '☄️ ฝนดาวตก' },
      { id: 'earthquake', label: '🌋 แผ่นดินไหว' },
    ];
    for (const d of disasters) {
      const btn = document.createElement('button');
      btn.className = 'ref-pill-btn';
      btn.style.borderColor = 'rgba(255, 89, 100, 0.45)';
      btn.style.color = '#ffb3b8';
      btn.textContent = d.label;
      btn.onclick = () => {
        this.triggerJuice(btn);
        this.callbacks.onTriggerDisaster(d.id);
      };
      seasonDisasterRow.appendChild(btn);
    }

    godPanel.body.append(weatherRow, seasonDisasterRow, toolRow, this.godHintEl);
    this.root.appendChild(this.godToolbar);

    // 4. Left Floating Column (Collapsible Hero Status + Collapsible Life Chronicle)
    this.leftPanel = document.createElement('div');
    this.leftPanel.className = 'left-column';

    const heroPanel = this.createCollapsibleCard('👤 สถานะตัวเอก & สมอง AI (Hero & Brain)', false);

    const header = document.createElement('div');
    header.className = 'hero-header';

    const portraitBox = document.createElement('div');
    portraitBox.className = 'portrait-box';
    portraitBox.title = 'คลิกเพื่อโฟกัสตัวเอก (รูปตรงตามช่วงวัยปัจจุบัน)';
    this.portraitCanvas = document.createElement('canvas');
    renderHeroPortraitToCanvas(this.portraitCanvas, '#3b7a57', 'infant', this.scene);
    portraitBox.appendChild(this.portraitCanvas);
    portraitBox.onclick = () => {
      this.triggerJuice(portraitBox);
      this.callbacks.onCenterHero();
    };

    const metaWrap = document.createElement('div');
    metaWrap.style.flex = '1';

    this.heroNameEl = document.createElement('div');
    this.heroNameEl.style.fontWeight = '700';
    this.heroNameEl.style.fontSize = '13.5px';
    this.heroNameEl.style.color = '#ffffff';

    const subRow = document.createElement('div');
    subRow.style.display = 'flex';
    subRow.style.alignItems = 'center';
    subRow.style.gap = '6px';
    subRow.style.marginTop = '3px';

    this.heroStageBadgeEl = document.createElement('span');
    this.heroStageBadgeEl.className = 'stage-badge';

    this.heroAgeEl = document.createElement('span');
    this.heroAgeEl.style.fontSize = '11px';
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
    brainTitle.textContent = '🧠 คะแนนตัดสินใจ (Utility AI)';
    this.utilityContainer = document.createElement('div');
    this.utilitySectionEl.append(brainTitle, this.utilityContainer);

    heroPanel.body.append(
      header,
      this.geneticsRowEl,
      this.traitsRowEl,
      hungerRow.row,
      energyRow.row,
      healthRow.row,
      this.utilitySectionEl
    );

    // Collapsible Deep Thinking, Philosophy & Personal Lore Card
    const deepPanel = this.createCollapsibleCard(
      '🧘 ปรัชญาชีวิต ความคิดเชิงลึก & Lore (Deep Brain)',
      false
    );
    this.deepPhilosophyEl = document.createElement('div');
    this.deepPhilosophyEl.style.marginBottom = '6px';

    this.deepMonologueEl = document.createElement('div');
    this.deepMonologueEl.style.background = 'rgba(224, 169, 69, 0.12)';
    this.deepMonologueEl.style.borderLeft = '3px solid #e0a945';
    this.deepMonologueEl.style.borderRadius = '0 5px 5px 0';
    this.deepMonologueEl.style.padding = '5px 8px';
    this.deepMonologueEl.style.fontSize = '11px';
    this.deepMonologueEl.style.fontStyle = 'italic';
    this.deepMonologueEl.style.color = '#f8fafc';
    this.deepMonologueEl.style.marginBottom = '6px';

    this.deepReasoningListEl = document.createElement('div');
    this.deepReasoningListEl.style.fontSize = '10.5px';
    this.deepReasoningListEl.style.color = '#cbd5e1';
    this.deepReasoningListEl.style.marginBottom = '6px';

    this.deepMemoriesListEl = document.createElement('div');
    this.deepMemoriesListEl.style.maxHeight = '105px';
    this.deepMemoriesListEl.style.overflowY = 'auto';
    this.deepMemoriesListEl.style.fontSize = '10.5px';

    deepPanel.body.append(
      this.deepPhilosophyEl,
      this.deepMonologueEl,
      this.deepReasoningListEl,
      this.deepMemoriesListEl
    );

    // Collapsible Chronicle Card
    const chronPanel = this.createCollapsibleCard('📜 บันทึกช่วงชีวิต (Life Chronicle)', true);
    this.chronicleListEl = document.createElement('div');
    this.chronicleListEl.className = 'chronicle-list';
    chronPanel.body.appendChild(this.chronicleListEl);

    this.leftPanel.append(heroPanel.card, deepPanel.card, chronPanel.card);
    this.root.appendChild(this.leftPanel);

    // 5. Right Floating Column: Phase 4 Kingdom & Tech Tree + Map Controls
    this.rightColumn = document.createElement('div');
    this.rightColumn.className = 'right-column';

    const kingdomPanel = this.createCollapsibleCard('🏰 อาณาจักร & Tech Tree (Phase 4)', false);

    this.kingdomStockpileEl = document.createElement('div');
    this.kingdomStockpileEl.className = 'stockpile-grid';

    this.kingdomActiveSiteEl = document.createElement('div');
    this.kingdomActiveSiteEl.style.marginBottom = '6px';

    this.kingdomTechListEl = document.createElement('div');
    this.kingdomTechListEl.style.maxHeight = '165px';
    this.kingdomTechListEl.style.overflowY = 'auto';

    const legacyBtn = document.createElement('button');
    legacyBtn.className = 'ref-pill-btn accent-create';
    legacyBtn.style.width = '100%';
    legacyBtn.style.marginTop = '6px';
    legacyBtn.textContent = '🌟 สืบทอดทายาทรุ่นถัดไป (Legacy Heir)';
    legacyBtn.onclick = () => {
      this.triggerJuice(legacyBtn);
      this.callbacks.onTriggerLegacyHeir();
    };

    kingdomPanel.body.append(
      this.kingdomStockpileEl,
      this.kingdomActiveSiteEl,
      this.kingdomTechListEl,
      legacyBtn
    );

    const watchPanel = this.createCollapsibleCard('🧭 สำรวจพื้นที่ & มุมกล้อง (Inspector)', false);

    const grid = document.createElement('div');
    grid.className = 'watch-grid';

    const btnHeroFocus = document.createElement('button');
    btnHeroFocus.className = 'ref-pill-btn';
    btnHeroFocus.textContent = '🎯 โฟกัสตัวเอก';
    btnHeroFocus.onclick = () => {
      this.triggerJuice(btnHeroFocus);
      this.callbacks.onCenterHero();
    };

    const btnCampFocus = document.createElement('button');
    btnCampFocus.className = 'ref-pill-btn';
    btnCampFocus.textContent = '🔥 โฟกัสหมู่บ้าน';
    btnCampFocus.onclick = () => {
      this.triggerJuice(btnCampFocus);
      this.callbacks.onCenterVillage();
    };

    const btnZoomContinent = document.createElement('button');
    btnZoomContinent.className = 'ref-pill-btn';
    btnZoomContinent.textContent = '🗺️ ซูมดูทั้งทวีป';
    btnZoomContinent.onclick = () => {
      this.triggerJuice(btnZoomContinent);
      this.callbacks.onZoomFullWorld();
    };

    const btnCustomize = document.createElement('button');
    btnCustomize.className = 'ref-pill-btn';
    btnCustomize.textContent = '🧬 พันธุกรรม';
    btnCustomize.onclick = () => {
      this.triggerJuice(btnCustomize);
      this.openCreationModal();
    };

    grid.append(btnHeroFocus, btnCampFocus, btnZoomContinent, btnCustomize);

    this.tileInspectorEl = document.createElement('div');
    this.tileInspectorEl.style.fontSize = '11px';
    this.tileInspectorEl.style.color = '#b8bfd1';
    this.tileInspectorEl.style.marginTop = '8px';
    this.tileInspectorEl.style.paddingTop = '6px';
    this.tileInspectorEl.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    this.tileInspectorEl.textContent = 'ชี้บนแผนที่เพื่อตรวจสอบไบโอมและทรัพยากร';

    const shortcutHint = document.createElement('div');
    shortcutHint.style.fontSize = '10px';
    shortcutHint.style.color = '#7c8499';
    shortcutHint.style.marginTop = '5px';
    shortcutHint.textContent = 'WASD/ลากเมาส์: เลื่อนจอ • ลูกกลิ้งเมาส์: ซูมเข้า/ออก';

    watchPanel.body.append(grid, this.tileInspectorEl, shortcutHint);

    this.rightColumn.append(kingdomPanel.card, watchPanel.card);
    this.root.appendChild(this.rightColumn);
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
        <div style="font-size:11.5px;color:#9aa1b5">กำหนดพันธุกรรม ค่าสถานะเริ่มต้น และนิสัยพิเศษก่อนส่งลงสู่ทวีป</div>
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
    renderHeroPortraitToCanvas(previewCanvas, this.draftCustom.cloakColor, 'adult', this.scene);
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
      { key: 'str', label: '💪 STR (พละกำลัง)', desc: 'เพิ่มความเร็วสร้างเมือง, ตัดไม้/สกัดหินไว และปราบหมาป่าได้' },
      { key: 'int', label: '🧠 INT (สติปัญญา)', desc: 'ปลดล็อกสิ่งปลูกสร้าง Tech Tree ขั้นสูงและสั่งสมภูมิปัญญาไวขึ้น' },
      { key: 'agi', label: '🦶 AGI (ความว่องไว)', desc: 'เดินสำรวจทวีปเร็วขึ้นและใช้พลังงานน้อยลง' },
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
    confirmBtn.textContent = '🌟 ประทานชีวิตสู่ทวีป (Begin Life at Age 1)';
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
    this.fpsEl.textContent = `${Math.round(fps)} fps • รุ่นที่ ${snapshot.generation}`;
    const sMeta = snapshot.seasonMeta;
    const disText =
      snapshot.activeDisaster !== 'none' ? ` • ⚠️ ${snapshot.activeDisaster.toUpperCase()}` : '';
    this.clockPillEl.textContent = `Day ${dayCount} • ${sMeta.icon} ${
      sMeta.name.split(' ')[0]
    } (${sMeta.temperatureC}°C) • ${clockStr} • ${snapshot.activeWeather.shortLabel}${disText}`;
    this.narrativeCaptionEl.textContent = snapshot.narrativeCaption;

    // Update Deep Thinking, Philosophy & Personal Lore Panel
    const dt = snapshot.deepThought;
    if (dt) {
      const phil = dt.dominantPhilosophy;
      this.deepPhilosophyEl.innerHTML = `
        <div style="font-size:11px;font-weight:700;color:#8ef6ff">${dt.ageRoleTitle}</div>
        <div style="font-size:10px;color:#9aa1b5;margin-bottom:4px">${dt.ageBehaviorSummary}</div>
        <div style="background:rgba(255,255,255,0.04);padding:4px 7px;border-radius:5px;font-size:10.5px">
          <strong style="color:#e0a945">${phil.icon} ปรัชญาประจำใจ: ${phil.name.split(' ')[0]}</strong>
          <div style="font-size:9.8px;color:#b8bfd1;margin-top:1px">"${phil.maxim}"</div>
        </div>
      `;
      this.deepMonologueEl.textContent = `💭 ความคิดในใจ: ${dt.currentMonologue}`;

      this.deepReasoningListEl.innerHTML =
        `<div class="section-title">🔗 ลำดับการคิดวิเคราะห์ (Chain of Thought)</div>` +
        dt.reasoningChain
          .map(
            (r) =>
              `<div style="margin-bottom:2px;padding-left:4px;border-left:2px solid #47b5cf">${r}</div>`
          )
          .join('');

      const memHtml = dt.recentMemories
        .slice(0, 4)
        .map(
          (m) => `
          <div style="background:rgba(255,255,255,0.03);padding:3px 6px;border-radius:4px;margin-bottom:3px">
            <strong style="color:#fcd34d">📌 [อายุ ${m.age} ปี] ${m.title}</strong>
            <div style="font-size:9.8px;color:#9aa1b5">${m.reflection}</div>
          </div>
        `
        )
        .join('');

      const ancHtml =
        dt.ancestralLegends.length > 0
          ? `<div class="section-title">📖 คัมภีร์บรรพบุรุษ (Dynasty Lore)</div>` +
            dt.ancestralLegends
              .slice(0, 2)
              .map(
                (a) => `
              <div style="background:rgba(142,246,255,0.08);padding:3px 6px;border-radius:4px;margin-bottom:3px">
                <strong style="color:#8ef6ff">👑 รุ่นที่ ${a.generation}: ${a.heroName}</strong>
                <div style="font-size:9.5px;color:#cbd5e1">${a.epitaph}</div>
              </div>
            `
              )
              .join('')
          : '';

      this.deepMemoriesListEl.innerHTML =
        `<div class="section-title">🧠 ความทรงจำฝังใจ (Episodic Memory)</div>` +
        (memHtml || '<div style="color:#6c738a">กำลังบันทึกความทรงจำแรกของชีวิต...</div>') +
        ancHtml;
    }

    // Sync HUD portrait strictly with the character's current life stage sprite!
    if (
      snapshot.cloakColor !== this.lastPortraitColor ||
      snapshot.lifeStage.id !== this.lastPortraitStage
    ) {
      this.lastPortraitColor = snapshot.cloakColor;
      this.lastPortraitStage = snapshot.lifeStage.id;
      renderHeroPortraitToCanvas(
        this.portraitCanvas,
        snapshot.cloakColor,
        snapshot.lifeStage.id,
        this.scene
      );
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
        <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:2px;color:${
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

    // Update Phase 4 Kingdom & Tech Tree Panel
    const k = snapshot.kingdom;
    this.kingdomStockpileEl.innerHTML = `
      <div><div style="color:#9aa1b5;font-size:10px">🪵 ไม้</div><strong style="color:#f59e0b">${k.wood}</strong></div>
      <div><div style="color:#9aa1b5;font-size:10px">🪨 หิน</div><strong style="color:#cbd5e1">${k.stone}</strong></div>
      <div><div style="color:#9aa1b5;font-size:10px">👥 ผู้ติดตาม</div><strong style="color:#8ef6ff">${k.population}/${k.maxPopulation}</strong></div>
      <div><div style="color:#9aa1b5;font-size:10px">👑 เจริญ</div><strong style="color:#e0a945">${k.prosperity}</strong></div>
    `;

    if (k.activeSite) {
      this.kingdomActiveSiteEl.innerHTML = `
        <div style="background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.4);border-radius:5px;padding:5px 8px;font-size:11px">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#fcd34d;font-weight:700">
            <span>🔨 กำลังก่อสร้าง: ${k.activeSite.icon} ${k.activeSite.name}</span>
            <span>${k.activeSite.percent}%</span>
          </div>
          <div class="bar-track" style="height:6px">
            <div class="bar-fill" style="width:${k.activeSite.percent}%;background:#f59e0b"></div>
          </div>
        </div>
      `;
    } else {
      this.kingdomActiveSiteEl.innerHTML = `
        <div style="font-size:10.5px;color:#9aa1b5;padding:2px 0">
          💡 บอทและผู้ติดตามจะตัดไม้/สกัดหินและสร้างสิ่งปลูกสร้างที่ปลดล็อกแล้วโดยอัตโนมัติ
        </div>
      `;
    }

    this.kingdomTechListEl.innerHTML = '';
    for (const item of k.buildingsList) {
      const b = item.config;
      const div = document.createElement('div');
      div.className = `tech-item ${item.unlocked ? 'unlocked' : ''}`;
      const statusBadge =
        item.count >= b.maxCount
          ? `<span style="color:#52b788;font-weight:700">ครบ ${item.count}/${b.maxCount}</span>`
          : item.unlocked
          ? `<span style="color:#e0a945">${item.count}/${b.maxCount} (🪵${b.woodCost} 🪨${b.stoneCost})</span>`
          : `<span style="color:#6c738a">🔒 INT ${b.requiredInt} • ปัญญา ${b.requiredLore}</span>`;

      div.innerHTML = `
        <div>
          <div style="font-weight:700;color:${item.unlocked ? '#f2f4fa' : '#7c8499'}">
            ${b.icon} ${b.name}
          </div>
          <div style="font-size:9.5px;color:#8c95aa">${b.description}</div>
        </div>
        <div style="text-align:right;white-space:nowrap;margin-left:6px">
          ${statusBadge}
        </div>
      `;
      this.kingdomTechListEl.appendChild(div);
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
      this.tileInspectorEl.innerHTML = 'ชี้บนแผนที่เพื่อตรวจสอบไบโอมและทรัพยากร';
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
          resHtml = '🌲 <strong>ต้นไม้โบราณ:</strong> แหล่งตัดไม้และร่มเงาพักผ่อน';
          break;
        case 'crimson_canopy':
          resHtml = '🍄 <strong>พุ่มฉัตรสีชาด:</strong> พืชพรรณลึกลับและแหล่งไม้';
          break;
        case 'hut':
          resHtml = '🏡 <strong>บ้านไม้ซุงโครงหิน:</strong> ที่พักอาศัยชั้นดีของหมู่บ้าน';
          break;
        case 'round_hut':
          resHtml = '🛖 <strong>กระท่อมไม้หลังคามุงจาก:</strong> บ้านพักอบอุ่นของชาวบ้าน';
          break;
        case 'farm_plot':
          resHtml = tile.resource.hasBerry
            ? '🌾 <strong>แปลงเกษตรกรรม:</strong> พืชผลสุกพร้อมเก็บเกี่ยว!'
            : '🌱 <strong>แปลงเกษตรกรรม:</strong> กำลังเติบโตงอกงาม';
          break;
        case 'stone_smithy':
          resHtml = '⚒️ <strong>โรงตีเหล็กและเตาหลอม:</strong> ศูนย์กลางช่างฝีมือแห่งอาณาจักร';
          break;
        case 'construction_site':
          resHtml = '🔨 <strong>เขตก่อสร้าง:</strong> อยู่ระหว่างการตอกค้อนสร้างอาคาร';
          break;
        case 'watchtower':
          resHtml = '🗼 <strong>หอคอยเฝ้าระวัง:</strong> ส่องสว่างคอยเตือนภัย';
          break;
        case 'crystal':
          resHtml = '💎 <strong>ผลึกเรืองแสง:</strong> แหล่งแร่หินและพลังงานเวทมนตร์';
          break;
        case 'mountain_rock':
          resHtml = '⛰️ <strong>โขดหินผารูน:</strong> แหล่งสกัดหินชั้นดีของอาณาจักร';
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
