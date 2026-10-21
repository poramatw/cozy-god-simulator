import Phaser from 'phaser';
import {
  AncestralLegend,
  DisasterId,
  EpisodicMemory,
  SeasonId,
} from '../agent/DeepCognitionEngine';
import {
  ChronicleEntry,
  EraId,
  GodToolId,
  HeroCustomization,
  HeroStatusSnapshot,
  TileData,
  TimeSpeed,
  TraitConfig,
  WeatherConfig,
  WeatherId,
} from '../core/Types';
import { ERAS_ROADMAP } from '../kingdom';

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
  onAdvanceEra: () => void;
  onSelectEra: (eraIndex: number) => void;
}

const CLOAK_PRESETS = [
  { name: 'Emerald Sage', hex: '#3b7a57' },
  { name: 'Royal Cobalt', hex: '#2563eb' },
  { name: 'Crimson Valor', hex: '#b91c1c' },
  { name: 'Amethyst Mystic', hex: '#6d28d9' },
  { name: 'Imperial Gold', hex: '#d97706' },
  { name: 'Obsidian Ranger', hex: '#334155' },
];

type DrawerTabId = 'hero' | 'mind' | 'epochs' | 'chronicle';
type DockTabId = 'miracles' | 'climate' | 'disasters';

const SVG_ICONS = {
  wood: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2"><path d="M12 3L4 15h16L12 3z"/><path d="M12 15v6"/></svg>`,
  stone: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.2"><polygon points="12 3 21 9 18 20 6 20 3 9 12 3"/></svg>`,
  food: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2"><path d="M12 2v20M17 5c-2.5 2.5-5 2.5-5 2.5S9.5 7.5 7 5M17 11c-2.5 2.5-5 2.5-5 2.5S9.5 13.5 7 11"/></svg>`,
  pop: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>`,
  lore: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  era: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>`,
  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

export class HudOverlay {
  private scene: Phaser.Scene;
  private root: HTMLElement;
  private callbacks: HudCallbacks;
  private traits: TraitConfig[];
  private weatherEvents: WeatherConfig[];
  private chronicleEntries: ChronicleEntry[] = [];
  private nextEntryId = 1;
  private activeWeatherId: WeatherId = 'fog';
  private isFollowingHero = true;
  private isSeeThrough = true;
  private isHudHidden = false;
  private isDrawerCollapsed = false;
  private lastPortraitTextureKey = '';

  private draftCustom: HeroCustomization = {
    name: 'เอเรน',
    clanName: 'แห่งโมริมาร์',
    str: 5,
    int: 5,
    agi: 5,
    traitIds: ['fleet_footed', 'forest_child'],
    cloakColor: '#3b7a57',
  };
  private maxPointBudget = 18;

  // Top Bar Elements
  private eraBadgeNameEl!: HTMLElement;
  private resWoodEl!: HTMLElement;
  private resStoneEl!: HTMLElement;
  private resFoodEl!: HTMLElement;
  private resPopEl!: HTMLElement;
  private resLoreEl!: HTMLElement;
  private clockLabelEl!: HTMLElement;
  private followBtnEl!: HTMLButtonElement;
  private seeThroughBtnEl!: HTMLButtonElement;

  // Left Drawer Elements
  private drawerEl!: HTMLElement;
  private drawerCollapseBtn!: HTMLButtonElement;
  private tabPanes!: Record<DrawerTabId, HTMLElement>;
  private tabButtons!: Record<DrawerTabId, HTMLButtonElement>;

  // Hero Tab Elements
  private portraitCanvas!: HTMLCanvasElement;
  private heroNameEl!: HTMLElement;
  private heroGenBadgeEl!: HTMLElement;
  private heroStageBadgeEl!: HTMLElement;
  private heroAgeTextEl!: HTMLElement;
  private heroAgeBarEl!: HTMLElement;
  private heroActionBadgeEl!: HTMLElement;
  private hungerValEl!: HTMLElement;
  private hungerBarEl!: HTMLElement;
  private energyValEl!: HTMLElement;
  private energyBarEl!: HTMLElement;
  private healthValEl!: HTMLElement;
  private healthBarEl!: HTMLElement;
  private statStrEl!: HTMLElement;
  private statIntEl!: HTMLElement;
  private statAgiEl!: HTMLElement;
  private traitsTagsEl!: HTMLElement;
  private utilityScoresEl!: HTMLElement;

  // Mind Tab Elements
  private mindPhilosophyTitleEl!: HTMLElement;
  private mindPhilosophyCreedEl!: HTMLElement;
  private mindMonologueEl!: HTMLElement;
  private mindCotListEl!: HTMLElement;
  private mindMemoriesListEl!: HTMLElement;

  // Epochs & Kingdom Tab Elements
  private eraTimelineListEl!: HTMLElement;
  private activeBuildBoxEl!: HTMLElement;
  private buildingsListEl!: HTMLElement;

  // Chronicle Tab Elements
  private chronicleListEl!: HTMLElement;

  // Bottom Dock Elements
  private bottomDockEl!: HTMLElement;
  private narrativeBannerEl!: HTMLElement;
  private tileInspectorEl!: HTMLElement;
  private disasterAlertBannerEl!: HTMLElement;

  // Modal Elements
  private modalBackdropEl!: HTMLElement;

  constructor(
    scene: Phaser.Scene,
    callbacks: HudCallbacks,
    traits: TraitConfig[],
    weatherEvents: WeatherConfig[]
  ) {
    this.scene = scene;
    const container = document.getElementById('ui-layer');
    if (!container) {
      throw new Error('#ui-layer not found');
    }
    this.root = container;
    this.callbacks = callbacks;
    this.traits = traits;
    this.weatherEvents = weatherEvents;
    this.injectStudioStyles();
    this.buildLayout();
  }

  private injectStudioStyles(): void {
    if (document.getElementById('studio-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'studio-hud-styles';
    style.textContent = `
      .studio-hud-root {
        font-family: 'Chakra Petch', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #e2e8f0;
        user-select: none;
        font-variant-numeric: tabular-nums;
      }
      .studio-glass {
        background: rgba(11, 15, 23, 0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(203, 213, 225, 0.14);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65);
      }
      .studio-topbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 46px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        z-index: 40;
        pointer-events: auto;
        border-bottom: 1px solid rgba(212, 175, 106, 0.24);
        background: linear-gradient(180deg, rgba(10, 14, 22, 0.96) 0%, rgba(12, 17, 27, 0.90) 100%);
      }
      .studio-brand-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .studio-brand-title {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #f8fafc;
      }
      .studio-era-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 4px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.38);
        color: #fbbf24;
        font-size: 11.5px;
        font-weight: 600;
      }
      .studio-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 4px;
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 600;
        color: #cbd5e1;
        background: rgba(30, 41, 59, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.22);
        cursor: pointer;
        transition: all 0.14s ease;
      }
      .studio-btn:hover {
        background: rgba(51, 65, 85, 0.9);
        color: #f8fafc;
        border-color: rgba(212, 175, 106, 0.45);
      }
      .studio-btn.active, .studio-btn.gold {
        background: rgba(217, 119, 6, 0.22);
        color: #fcd34d;
        border-color: rgba(245, 158, 11, 0.55);
      }
      .studio-res-ledger {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 4px 14px;
        border-radius: 4px;
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(148, 163, 184, 0.15);
      }
      .studio-res-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
      }
      .studio-res-label {
        color: #94a3b8;
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .studio-res-val {
        color: #f8fafc;
        font-weight: 700;
      }
      .studio-drawer {
        position: fixed;
        top: 58px;
        left: 12px;
        width: 348px;
        max-height: calc(100vh - 140px);
        display: flex;
        flex-direction: column;
        border-radius: 6px;
        z-index: 35;
        pointer-events: auto;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      }
      .studio-drawer.collapsed {
        transform: translateX(-336px);
      }
      .studio-drawer-tabs {
        display: grid;
        grid-template-columns: repeat(4, 1fr) 32px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(15, 23, 42, 0.85);
        border-radius: 6px 6px 0 0;
        overflow: hidden;
      }
      .studio-tab-btn {
        padding: 9px 4px;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #94a3b8;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .studio-tab-btn:hover {
        color: #e2e8f0;
        background: rgba(255, 255, 255, 0.03);
      }
      .studio-tab-btn.active {
        color: #fbbf24;
        border-bottom-color: #f59e0b;
        background: rgba(245, 158, 11, 0.08);
      }
      .studio-drawer-body {
        padding: 12px;
        overflow-y: auto;
        max-height: calc(100vh - 195px);
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
      }
      .studio-section-title {
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
        margin: 10px 0 6px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .studio-vital-row {
        margin-bottom: 7px;
      }
      .studio-vital-head {
        display: flex;
        justify-content: space-between;
        font-size: 11.5px;
        margin-bottom: 3px;
      }
      .studio-bar-track {
        height: 6px;
        background: rgba(30, 41, 59, 0.9);
        border-radius: 3px;
        overflow: hidden;
      }
      .studio-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.2s ease;
      }
      .studio-dock {
        position: fixed;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        z-index: 35;
        pointer-events: auto;
      }
      .studio-dock-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 6px;
      }
      .studio-era-card {
        padding: 8px 10px;
        border-radius: 5px;
        border: 1px solid rgba(148, 163, 184, 0.16);
        background: rgba(15, 23, 42, 0.55);
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .studio-era-card:hover {
        border-color: rgba(245, 158, 11, 0.45);
        background: rgba(30, 41, 59, 0.75);
      }
      .studio-era-card.active {
        border-color: #f59e0b;
        background: rgba(245, 158, 11, 0.12);
      }
    `;
    document.head.appendChild(style);
  }

  private buildLayout(): void {
    this.root.innerHTML = '';
    this.root.classList.add('studio-hud-root');

    // 1. TOP COMMAND & EPOCH RIBBON
    const topBar = document.createElement('header');
    topBar.className = 'studio-topbar';
    topBar.innerHTML = `
      <div class="studio-brand-group">
        <span class="studio-brand-title">CHRONICLES OF MORIMAR</span>
        <div class="studio-era-pill">
          ${SVG_ICONS.era}
          <span id="hud-era-name">ยุคหิน (Stone Age)</span>
        </div>
        <button class="studio-btn gold" id="btn-advance-era" title="วิวัฒนาการโลกสู่ยุคถัดไปทันที">
          วิวัฒนาการยุค ▸
        </button>
      </div>

      <div class="studio-res-ledger">
        <div class="studio-res-item" title="ไม้ซุง (Timber)">
          ${SVG_ICONS.wood}
          <span class="studio-res-label">ไม้</span>
          <span class="studio-res-val" id="res-wood">20</span>
        </div>
        <div class="studio-res-item" title="แร่หิน (Stone)">
          ${SVG_ICONS.stone}
          <span class="studio-res-label">หิน</span>
          <span class="studio-res-val" id="res-stone">10</span>
        </div>
        <div class="studio-res-item" title="เสบียงอาหาร (Grain & Berries)">
          ${SVG_ICONS.food}
          <span class="studio-res-label">เสบียง</span>
          <span class="studio-res-val" id="res-food">18</span>
        </div>
        <div class="studio-res-item" title="ประชากรผู้ติดตาม (Population)">
          ${SVG_ICONS.pop}
          <span class="studio-res-label">ประชากร</span>
          <span class="studio-res-val" id="res-pop">0/2</span>
        </div>
        <div class="studio-res-item" title="ภูมิปัญญาอารยธรรม (Lore)">
          ${SVG_ICONS.lore}
          <span class="studio-res-label">ภูมิปัญญา</span>
          <span class="studio-res-val" id="res-lore">0</span>
        </div>
        <div style="width:1px;height:16px;background:rgba(148,163,184,0.2)"></div>
        <span id="hud-clock-label" style="font-size:11.5px;color:#cbd5e1;font-weight:500;">
          ฤดูใบไม้ผลิ • 22°C • วันที่ 1 • 08:00
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:5px;">
        <button class="studio-btn active" id="btn-follow-hero" title="ล็อกกล้องตามตัวเอก">ตามตัวเอก</button>
        <button class="studio-btn" id="btn-center-village" title="ไปที่ใจกลางเมือง">เมือง</button>
        <button class="studio-btn" id="btn-zoom-world" title="ดูแผนที่ทวีปทั้งหมด">ทวีป</button>
        <button class="studio-btn" id="btn-zoom-out" title="ซูมออก">−</button>
        <button class="studio-btn" id="btn-zoom-in" title="ซูมเข้า">+</button>
        <button class="studio-btn active" id="btn-see-through" title="โปร่งแสงต้นไม้บังตา">${SVG_ICONS.eye}</button>
        <div style="width:1px;height:16px;background:rgba(148,163,184,0.2);margin:0 2px;"></div>
        <button class="studio-btn" data-speed="0">⏸</button>
        <button class="studio-btn active" data-speed="1">1x</button>
        <button class="studio-btn" data-speed="2">2x</button>
        <button class="studio-btn" data-speed="4">4x</button>
        <button class="studio-btn" data-speed="10">10x</button>
        <button class="studio-btn" id="btn-toggle-hud" title="ซ่อนหรือแสดงหน้าต่าง UI">ซ่อน UI</button>
      </div>
    `;
    this.root.appendChild(topBar);

    this.eraBadgeNameEl = topBar.querySelector('#hud-era-name') as HTMLElement;
    this.resWoodEl = topBar.querySelector('#res-wood') as HTMLElement;
    this.resStoneEl = topBar.querySelector('#res-stone') as HTMLElement;
    this.resFoodEl = topBar.querySelector('#res-food') as HTMLElement;
    this.resPopEl = topBar.querySelector('#res-pop') as HTMLElement;
    this.resLoreEl = topBar.querySelector('#res-lore') as HTMLElement;
    this.clockLabelEl = topBar.querySelector('#hud-clock-label') as HTMLElement;
    this.followBtnEl = topBar.querySelector('#btn-follow-hero') as HTMLButtonElement;
    this.seeThroughBtnEl = topBar.querySelector('#btn-see-through') as HTMLButtonElement;

    // Disaster Banner (hidden unless active)
    this.disasterAlertBannerEl = document.createElement('div');
    this.disasterAlertBannerEl.style.cssText =
      'display:none;position:fixed;top:54px;left:50%;transform:translateX(-50%);padding:6px 16px;border-radius:4px;background:rgba(185,28,28,0.92);border:1px solid #f87171;color:#fef2f2;font-size:12px;font-weight:700;z-index:45;pointer-events:none;';
    this.root.appendChild(this.disasterAlertBannerEl);

    // 2. SINGLE LEFT COLLAPSIBLE STUDIO DRAWER
    this.drawerEl = document.createElement('aside');
    this.drawerEl.className = 'studio-drawer studio-glass';
    this.drawerEl.innerHTML = `
      <div class="studio-drawer-tabs">
        <button class="studio-tab-btn active" data-tab="hero">ตัวเอก</button>
        <button class="studio-tab-btn" data-tab="mind">จิตวิเคราะห์</button>
        <button class="studio-tab-btn" data-tab="epochs">ยุคสมัย (5 ยุค)</button>
        <button class="studio-tab-btn" data-tab="chronicle">พงศาวดาร</button>
        <button class="studio-tab-btn" id="btn-collapse-drawer" title="พับ/กางแถบข้อมูล">◀</button>
      </div>
      <div class="studio-drawer-body">
        <!-- TAB 1: HERO & VITALS -->
        <div id="tab-pane-hero">
          <div style="display:flex;gap:12px;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(148,163,184,0.14);">
            <div style="width:62px;height:62px;border-radius:6px;background:rgba(15,23,42,0.9);border:1px solid rgba(212,175,106,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <canvas id="hero-portrait-canvas" width="56" height="56" style="width:52px;height:52px;"></canvas>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                <span id="hero-name" style="font-size:14px;font-weight:700;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">เอเรน แห่งโมริมาร์</span>
                <span id="hero-gen-badge" style="font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(56,189,248,0.15);color:#38bdf8;font-weight:700;">รุ่นที่ 1</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:11.5px;">
                <span id="hero-stage-badge" style="color:#fbbf24;font-weight:600;">วัยทารก</span>
                <span id="hero-age-text" style="color:#94a3b8;">1 / 60 ปี</span>
              </div>
              <div class="studio-bar-track" style="margin-top:5px;height:4px;">
                <div class="studio-bar-fill" id="hero-age-bar" style="width:2%;background:#fbbf24;"></div>
              </div>
            </div>
          </div>

          <div style="margin-top:8px;padding:6px 9px;border-radius:4px;background:rgba(15,23,42,0.65);border-left:2px solid #38bdf8;font-size:11.5px;color:#e2e8f0;" id="hero-action-badge">
            กำลังสำรวจดินแดน
          </div>

          <div class="studio-section-title">ความต้องการพื้นฐาน (Vitals)</div>
          <div class="studio-vital-row">
            <div class="studio-vital-head">
              <span style="color:#cbd5e1;">ความอิ่มท้อง (Satiety)</span>
              <span id="val-hunger" style="font-weight:700;color:#f59e0b;">85%</span>
            </div>
            <div class="studio-bar-track">
              <div class="studio-bar-fill" id="bar-hunger" style="width:85%;background:linear-gradient(90deg,#d97706,#fbbf24);"></div>
            </div>
          </div>
          <div class="studio-vital-row">
            <div class="studio-vital-head">
              <span style="color:#cbd5e1;">พลังงาน (Stamina)</span>
              <span id="val-energy" style="font-weight:700;color:#38bdf8;">90%</span>
            </div>
            <div class="studio-bar-track">
              <div class="studio-bar-fill" id="bar-energy" style="width:90%;background:linear-gradient(90deg,#0284c7,#38bdf8);"></div>
            </div>
          </div>
          <div class="studio-vital-row">
            <div class="studio-vital-head">
              <span style="color:#cbd5e1;">พลังชีวิต (Vitality)</span>
              <span id="val-health" style="font-weight:700;color:#10b981;">100/100</span>
            </div>
            <div class="studio-bar-track">
              <div class="studio-bar-fill" id="bar-health" style="width:100%;background:linear-gradient(90deg,#059669,#34d399);"></div>
            </div>
          </div>

          <div class="studio-section-title">ค่าสถานะและอุปนิสัย (Attributes)</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
            <div style="padding:6px;border-radius:4px;background:rgba(15,23,42,0.65);border:1px solid rgba(148,163,184,0.12);text-align:center;">
              <div style="font-size:10px;color:#94a3b8;">STR (กำลัง)</div>
              <div id="stat-str" style="font-size:14px;font-weight:700;color:#f87171;">5</div>
            </div>
            <div style="padding:6px;border-radius:4px;background:rgba(15,23,42,0.65);border:1px solid rgba(148,163,184,0.12);text-align:center;">
              <div style="font-size:10px;color:#94a3b8;">INT (ปัญญา)</div>
              <div id="stat-int" style="font-size:14px;font-weight:700;color:#c084fc;">5</div>
            </div>
            <div style="padding:6px;border-radius:4px;background:rgba(15,23,42,0.65);border:1px solid rgba(148,163,184,0.12);text-align:center;">
              <div style="font-size:10px;color:#94a3b8;">AGI (ว่องไว)</div>
              <div id="stat-agi" style="font-size:14px;font-weight:700;color:#34d399;">5</div>
            </div>
          </div>
          <div id="hero-traits-tags" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;"></div>

          <div class="studio-section-title">น้ำหนักการตัดสินใจ (Utility AI)</div>
          <div id="utility-scores" style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;"></div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button class="studio-btn gold" id="btn-open-custom">ปรับแต่งสายเลือด</button>
            <button class="studio-btn" id="btn-next-heir">สืบทอดทายาทรุ่นต่อไป</button>
          </div>
        </div>

        <!-- TAB 2: DEEP COGNITION & LORE -->
        <div id="tab-pane-mind" style="display:none;">
          <div style="padding:9px;border-radius:5px;background:rgba(30,41,59,0.65);border:1px solid rgba(192,132,252,0.3);margin-bottom:10px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#c084fc;font-weight:700;">ปรัชญาประจำตระกูล (Worldview)</div>
            <div id="mind-phil-title" style="font-size:13px;font-weight:700;color:#f8fafc;margin-top:2px;">วิถีแห่งพงไพร</div>
            <div id="mind-phil-creed" style="font-size:11.5px;color:#cbd5e1;margin-top:3px;font-style:italic;">""</div>
          </div>

          <div class="studio-section-title">เสียงสะท้อนในใจ (Inner Monologue)</div>
          <div id="mind-monologue" style="padding:8px 10px;border-radius:4px;background:rgba(15,23,42,0.75);border-left:2px solid #f59e0b;font-size:11.5px;color:#fde68a;margin-bottom:10px;"></div>

          <div class="studio-section-title">ลำดับความคิดเชิงลึก (Chain-of-Thought)</div>
          <div id="mind-cot-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px;"></div>

          <div class="studio-section-title">ความทรงจำระยะยาว (IndexedDB Lore)</div>
          <div id="mind-memories-list" style="display:flex;flex-direction:column;gap:5px;"></div>
        </div>

        <!-- TAB 3: 5-ERA WORLD EVOLUTION & KINGDOM -->
        <div id="tab-pane-epochs" style="display:none;">
          <div class="studio-section-title">
            <span>วิวัฒนาการอารยธรรม 5 ยุค (คลิกเพื่อเปลี่ยนยุคได้ทันที)</span>
          </div>
          <div id="era-timeline-list" style="margin-bottom:12px;"></div>

          <div id="kingdom-active-build" style="display:none;padding:8px 10px;border-radius:4px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);font-size:11.5px;color:#fcd34d;margin-bottom:10px;"></div>

          <div class="studio-section-title">ผังสิ่งปลูกสร้างในอาณาจักร</div>
          <div id="kingdom-buildings-list" style="display:flex;flex-direction:column;gap:5px;"></div>
        </div>

        <!-- TAB 4: CHRONICLE LOG -->
        <div id="tab-pane-chronicle" style="display:none;">
          <div class="studio-section-title">บันทึกประวัติศาสตร์แห่งโมริมาร์</div>
          <div id="chronicle-list" style="display:flex;flex-direction:column;gap:5px;"></div>
        </div>
      </div>
    `;
    this.root.appendChild(this.drawerEl);

    this.drawerCollapseBtn = this.drawerEl.querySelector('#btn-collapse-drawer') as HTMLButtonElement;
    this.tabPanes = {
      hero: this.drawerEl.querySelector('#tab-pane-hero') as HTMLElement,
      mind: this.drawerEl.querySelector('#tab-pane-mind') as HTMLElement,
      epochs: this.drawerEl.querySelector('#tab-pane-epochs') as HTMLElement,
      chronicle: this.drawerEl.querySelector('#tab-pane-chronicle') as HTMLElement,
    };
    this.tabButtons = {
      hero: this.drawerEl.querySelector('[data-tab="hero"]') as HTMLButtonElement,
      mind: this.drawerEl.querySelector('[data-tab="mind"]') as HTMLButtonElement,
      epochs: this.drawerEl.querySelector('[data-tab="epochs"]') as HTMLButtonElement,
      chronicle: this.drawerEl.querySelector('[data-tab="chronicle"]') as HTMLButtonElement,
    };

    this.portraitCanvas = this.drawerEl.querySelector('#hero-portrait-canvas') as HTMLCanvasElement;
    this.heroNameEl = this.drawerEl.querySelector('#hero-name') as HTMLElement;
    this.heroGenBadgeEl = this.drawerEl.querySelector('#hero-gen-badge') as HTMLElement;
    this.heroStageBadgeEl = this.drawerEl.querySelector('#hero-stage-badge') as HTMLElement;
    this.heroAgeTextEl = this.drawerEl.querySelector('#hero-age-text') as HTMLElement;
    this.heroAgeBarEl = this.drawerEl.querySelector('#hero-age-bar') as HTMLElement;
    this.heroActionBadgeEl = this.drawerEl.querySelector('#hero-action-badge') as HTMLElement;
    this.hungerValEl = this.drawerEl.querySelector('#val-hunger') as HTMLElement;
    this.hungerBarEl = this.drawerEl.querySelector('#bar-hunger') as HTMLElement;
    this.energyValEl = this.drawerEl.querySelector('#val-energy') as HTMLElement;
    this.energyBarEl = this.drawerEl.querySelector('#bar-energy') as HTMLElement;
    this.healthValEl = this.drawerEl.querySelector('#val-health') as HTMLElement;
    this.healthBarEl = this.drawerEl.querySelector('#bar-health') as HTMLElement;
    this.statStrEl = this.drawerEl.querySelector('#stat-str') as HTMLElement;
    this.statIntEl = this.drawerEl.querySelector('#stat-int') as HTMLElement;
    this.statAgiEl = this.drawerEl.querySelector('#stat-agi') as HTMLElement;
    this.traitsTagsEl = this.drawerEl.querySelector('#hero-traits-tags') as HTMLElement;
    this.utilityScoresEl = this.drawerEl.querySelector('#utility-scores') as HTMLElement;

    this.mindPhilosophyTitleEl = this.drawerEl.querySelector('#mind-phil-title') as HTMLElement;
    this.mindPhilosophyCreedEl = this.drawerEl.querySelector('#mind-phil-creed') as HTMLElement;
    this.mindMonologueEl = this.drawerEl.querySelector('#mind-monologue') as HTMLElement;
    this.mindCotListEl = this.drawerEl.querySelector('#mind-cot-list') as HTMLElement;
    this.mindMemoriesListEl = this.drawerEl.querySelector('#mind-memories-list') as HTMLElement;

    this.eraTimelineListEl = this.drawerEl.querySelector('#era-timeline-list') as HTMLElement;
    this.activeBuildBoxEl = this.drawerEl.querySelector('#kingdom-active-build') as HTMLElement;
    this.buildingsListEl = this.drawerEl.querySelector('#kingdom-buildings-list') as HTMLElement;
    this.chronicleListEl = this.drawerEl.querySelector('#chronicle-list') as HTMLElement;

    // 3. SLEEK BOTTOM GOD COMMAND DOCK
    this.bottomDockEl = document.createElement('div');
    this.bottomDockEl.className = 'studio-dock';
    this.bottomDockEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="narrative-caption-text" class="studio-glass" style="padding:4px 12px;border-radius:4px;font-size:11.5px;color:#cbd5e1;max-width:560px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          กำลังเฝ้ามองการเดินทางของชีวิต...
        </div>
        <div id="tile-inspector-pill" class="studio-glass" style="padding:4px 10px;border-radius:4px;font-size:11px;color:#94a3b8;">
          ชี้เมาส์บนแผนที่เพื่อดูข้อมูลพื้นที่
        </div>
      </div>

      <div class="studio-dock-bar studio-glass">
        <div style="display:flex;gap:3px;padding-right:8px;border-right:1px solid rgba(148,163,184,0.2);">
          <button class="studio-btn active" data-dock-tab="miracles">อำนาจพระเจ้า</button>
          <button class="studio-btn" data-dock-tab="climate">ฤดูกาลและอากาศ</button>
          <button class="studio-btn" data-dock-tab="disasters">ภัยพิบัติและโลก</button>
        </div>

        <!-- DOCK PANE 1: MIRACLES & TERRAFORMING -->
        <div id="dock-pane-miracles" style="display:flex;align-items:center;gap:5px;">
          <button class="studio-btn active" data-god-tool="inspect">ส่องดูพื้นที่</button>
          <button class="studio-btn" data-god-tool="spawn_mountain">เสกภูเขาหิน</button>
          <button class="studio-btn" data-god-tool="terraform_river">ขุดลำธาร</button>
          <button class="studio-btn" data-god-tool="spawn_berry">ปลูกเบอร์รี่</button>
          <button class="studio-btn" data-god-tool="spawn_blessing">เสกผลึกดารา</button>
          <button class="studio-btn" data-god-tool="spawn_beast">ปล่อยหมาป่า</button>
          <button class="studio-btn" data-god-tool="smite_lightning">สายฟ้าสวรรค์</button>
          <button class="studio-btn gold" id="btn-divine-inspire">ประทานพรปัญญา</button>
        </div>

        <!-- DOCK PANE 2: SEASONS & WEATHER -->
        <div id="dock-pane-climate" style="display:none;align-items:center;gap:5px;">
          <button class="studio-btn active" data-season="spring">ใบไม้ผลิ</button>
          <button class="studio-btn" data-season="summer">ฤดูร้อน</button>
          <button class="studio-btn" data-season="autumn">ใบไม้ร่วง</button>
          <button class="studio-btn" data-season="winter">ฤดูหนาว</button>
          <div style="width:1px;height:16px;background:rgba(148,163,184,0.2);margin:0 3px;"></div>
          <div id="weather-buttons-row" style="display:flex;gap:4px;"></div>
        </div>

        <!-- DOCK PANE 3: DISASTERS & WORLD RESET -->
        <div id="dock-pane-disasters" style="display:none;align-items:center;gap:5px;">
          <button class="studio-btn" data-disaster="wildfire">ไฟป่าหมื่นลี้</button>
          <button class="studio-btn" data-disaster="blizzard">พายุหิมะยะเยือก</button>
          <button class="studio-btn" data-disaster="meteor_shower">ฝนดาวตกดารา</button>
          <button class="studio-btn" data-disaster="earthquake">แผ่นดินไหว</button>
          <div style="width:1px;height:16px;background:rgba(148,163,184,0.2);margin:0 3px;"></div>
          <button class="studio-btn" id="btn-new-world">สร้างทวีปใหม่</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.bottomDockEl);

    this.narrativeBannerEl = this.bottomDockEl.querySelector('#narrative-caption-text') as HTMLElement;
    this.tileInspectorEl = this.bottomDockEl.querySelector('#tile-inspector-pill') as HTMLElement;

    const weatherRow = this.bottomDockEl.querySelector('#weather-buttons-row') as HTMLElement;
    for (const w of this.weatherEvents) {
      const btn = document.createElement('button');
      btn.className = `studio-btn ${w.id === this.activeWeatherId ? 'active' : ''}`;
      btn.dataset.weather = w.id;
      btn.textContent = w.name;
      weatherRow.appendChild(btn);
    }

    this.buildCustomizationModal();
    this.bindEvents();
  }

  private buildCustomizationModal(): void {
    this.modalBackdropEl = document.createElement('div');
    this.modalBackdropEl.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(5,8,14,0.78);backdrop-filter:blur(6px);z-index:100;align-items:center;justify-content:center;pointer-events:auto;';
    this.modalBackdropEl.innerHTML = `
      <div class="studio-glass" style="width:440px;max-width:94vw;border-radius:8px;padding:18px;border:1px solid rgba(212,175,106,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:15px;font-weight:700;color:#f8fafc;">พันธุกรรมและสายเลือดผู้บุกเบิก</span>
          <button class="studio-btn" id="btn-close-modal">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
          <div>
            <label style="font-size:11px;color:#94a3b8;">ชื่อตัวเอก</label>
            <input id="inp-hero-name" type="text" value="${this.draftCustom.name}" maxlength="18" style="width:100%;margin-top:3px;padding:6px 8px;border-radius:4px;background:#0f172a;border:1px solid rgba(148,163,184,0.3);color:#f8fafc;font-family:inherit;font-size:12px;" />
          </div>
          <div>
            <label style="font-size:11px;color:#94a3b8;">นามตระกูล</label>
            <input id="inp-clan-name" type="text" value="${this.draftCustom.clanName}" maxlength="22" style="width:100%;margin-top:3px;padding:6px 8px;border-radius:4px;background:#0f172a;border:1px solid rgba(148,163,184,0.3);color:#f8fafc;font-family:inherit;font-size:12px;" />
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:6px;">
          <span style="color:#94a3b8;">จัดสรรแต้มพรสวรรค์เริ่มต้น</span>
          <span id="modal-points-left" style="color:#fbbf24;font-weight:700;">แต้มคงเหลือ: 3</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
          <div style="padding:8px;border-radius:4px;background:rgba(15,23,42,0.8);text-align:center;">
            <div style="font-size:11px;color:#f87171;font-weight:700;">STR (กำลัง)</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:5px;">
              <button class="studio-btn" data-stat="str" data-dir="-1">−</button>
              <span id="draft-str" style="font-size:14px;font-weight:700;">5</span>
              <button class="studio-btn" data-stat="str" data-dir="1">+</button>
            </div>
          </div>
          <div style="padding:8px;border-radius:4px;background:rgba(15,23,42,0.8);text-align:center;">
            <div style="font-size:11px;color:#c084fc;font-weight:700;">INT (ปัญญา)</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:5px;">
              <button class="studio-btn" data-stat="int" data-dir="-1">−</button>
              <span id="draft-int" style="font-size:14px;font-weight:700;">5</span>
              <button class="studio-btn" data-stat="int" data-dir="1">+</button>
            </div>
          </div>
          <div style="padding:8px;border-radius:4px;background:rgba(15,23,42,0.8);text-align:center;">
            <div style="font-size:11px;color:#34d399;font-weight:700;">AGI (ว่องไว)</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:5px;">
              <button class="studio-btn" data-stat="agi" data-dir="-1">−</button>
              <span id="draft-agi" style="font-size:14px;font-weight:700;">5</span>
              <button class="studio-btn" data-stat="agi" data-dir="1">+</button>
            </div>
          </div>
        </div>

        <div style="font-size:11.5px;color:#94a3b8;margin-bottom:6px;">สีชุดประจำตระกูล (แสดงผลบนตัวละครทุกยุค)</div>
        <div id="cloak-swatches" style="display:flex;gap:8px;margin-bottom:12px;"></div>

        <div style="font-size:11.5px;color:#94a3b8;margin-bottom:6px;">อุปนิสัยประจำตัว (เลือกได้สูงสุด 2 อย่าง)</div>
        <div id="traits-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;"></div>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button class="studio-btn" id="btn-random-custom">สุ่มสายเลือด</button>
          <button class="studio-btn gold" id="btn-apply-custom">จุติตัวเอกลงสู่ทวีป</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.modalBackdropEl);
    this.renderModalInternals();
  }

  private renderModalInternals(): void {
    const used = this.draftCustom.str + this.draftCustom.int + this.draftCustom.agi;
    const left = this.maxPointBudget - used;
    const ptsEl = this.modalBackdropEl.querySelector('#modal-points-left') as HTMLElement;
    if (ptsEl) ptsEl.textContent = `แต้มคงเหลือ: ${left}`;

    (this.modalBackdropEl.querySelector('#draft-str') as HTMLElement).textContent = String(
      this.draftCustom.str
    );
    (this.modalBackdropEl.querySelector('#draft-int') as HTMLElement).textContent = String(
      this.draftCustom.int
    );
    (this.modalBackdropEl.querySelector('#draft-agi') as HTMLElement).textContent = String(
      this.draftCustom.agi
    );

    const swatchRow = this.modalBackdropEl.querySelector('#cloak-swatches') as HTMLElement;
    swatchRow.innerHTML = CLOAK_PRESETS.map(
      (c) => `
      <button type="button" data-cloak="${c.hex}" title="${c.name}" style="width:26px;height:26px;border-radius:50%;background:${c.hex};border:2px solid ${
        this.draftCustom.cloakColor === c.hex ? '#fbbf24' : 'rgba(255,255,255,0.2)'
      };cursor:pointer;"></button>
    `
    ).join('');

    const traitsGrid = this.modalBackdropEl.querySelector('#traits-grid') as HTMLElement;
    traitsGrid.innerHTML = this.traits
      .map((t) => {
        const active = this.draftCustom.traitIds.includes(t.id);
        return `
        <div data-trait="${t.id}" style="padding:7px;border-radius:4px;border:1px solid ${
          active ? '#f59e0b' : 'rgba(148,163,184,0.2)'
        };background:${
          active ? 'rgba(245,158,11,0.14)' : 'rgba(15,23,42,0.65)'
        };cursor:pointer;">
          <div style="font-size:11.5px;font-weight:700;color:#f8fafc;">${t.icon} ${t.name}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${t.description}</div>
        </div>
      `;
      })
      .join('');
  }

  private bindEvents(): void {
    // Advance Era button
    this.root.querySelector('#btn-advance-era')?.addEventListener('click', () => {
      this.callbacks.onAdvanceEra();
    });

    // Camera & TopBar buttons
    this.followBtnEl.addEventListener('click', () => {
      this.isFollowingHero = this.callbacks.onToggleFollow();
      this.setFollowState(this.isFollowingHero);
    });

    this.root.querySelector('#btn-center-village')?.addEventListener('click', () => {
      this.callbacks.onCenterVillage();
    });

    this.root.querySelector('#btn-zoom-world')?.addEventListener('click', () => {
      this.callbacks.onZoomFullWorld();
    });

    this.root.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      this.callbacks.onZoomDelta(0.35);
    });

    this.root.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      this.callbacks.onZoomDelta(-0.35);
    });

    this.seeThroughBtnEl.addEventListener('click', () => {
      this.isSeeThrough = this.callbacks.onToggleSeeThrough();
      this.seeThroughBtnEl.classList.toggle('active', this.isSeeThrough);
    });

    // Speed buttons
    this.root.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spd = Number((btn as HTMLElement).dataset.speed) as TimeSpeed;
        this.callbacks.onSpeedChange(spd);
        this.root.querySelectorAll('[data-speed]').forEach((b) => {
          b.classList.toggle('active', Number((b as HTMLElement).dataset.speed) === spd);
        });
      });
    });

    // Hide/Show HUD
    const toggleHudBtn = this.root.querySelector('#btn-toggle-hud') as HTMLButtonElement;
    toggleHudBtn.addEventListener('click', () => {
      this.isHudHidden = !this.isHudHidden;
      this.drawerEl.style.display = this.isHudHidden ? 'none' : 'flex';
      this.bottomDockEl.style.display = this.isHudHidden ? 'none' : 'flex';
      toggleHudBtn.textContent = this.isHudHidden ? 'แสดง UI' : 'ซ่อน UI';
      toggleHudBtn.classList.toggle('active', this.isHudHidden);
    });

    // Left Drawer Tabs & Collapse
    (Object.keys(this.tabButtons) as DrawerTabId[]).forEach((tabId) => {
      this.tabButtons[tabId].addEventListener('click', () => {
        if (this.isDrawerCollapsed) {
          this.isDrawerCollapsed = false;
          this.drawerEl.classList.remove('collapsed');
          this.drawerCollapseBtn.textContent = '◀';
        }
        (Object.keys(this.tabButtons) as DrawerTabId[]).forEach((k) => {
          this.tabButtons[k].classList.toggle('active', k === tabId);
          this.tabPanes[k].style.display = k === tabId ? 'block' : 'none';
        });
      });
    });

    this.drawerCollapseBtn.addEventListener('click', () => {
      this.isDrawerCollapsed = !this.isDrawerCollapsed;
      this.drawerEl.classList.toggle('collapsed', this.isDrawerCollapsed);
      this.drawerCollapseBtn.textContent = this.isDrawerCollapsed ? '▶' : '◀';
    });

    // Hero Tab Buttons
    this.root.querySelector('#btn-open-custom')?.addEventListener('click', () => {
      this.modalBackdropEl.style.display = 'flex';
    });

    this.root.querySelector('#btn-next-heir')?.addEventListener('click', () => {
      this.callbacks.onTriggerLegacyHeir();
    });

    // Bottom Dock Tab Switcher
    this.bottomDockEl.querySelectorAll('[data-dock-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.dockTab as DockTabId;
        this.bottomDockEl.querySelectorAll('[data-dock-tab]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.dockTab === tab);
        });
        (this.bottomDockEl.querySelector('#dock-pane-miracles') as HTMLElement).style.display =
          tab === 'miracles' ? 'flex' : 'none';
        (this.bottomDockEl.querySelector('#dock-pane-climate') as HTMLElement).style.display =
          tab === 'climate' ? 'flex' : 'none';
        (this.bottomDockEl.querySelector('#dock-pane-disasters') as HTMLElement).style.display =
          tab === 'disasters' ? 'flex' : 'none';
      });
    });

    // God Tools
    this.bottomDockEl.querySelectorAll('[data-god-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.godTool as GodToolId;
        this.callbacks.onSelectGodTool(tool);
        this.bottomDockEl.querySelectorAll('[data-god-tool]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.godTool === tool);
        });
      });
    });

    this.bottomDockEl.querySelector('#btn-divine-inspire')?.addEventListener('click', () => {
      this.callbacks.onGrantDivineInspiration();
    });

    // Seasons & Weather
    this.bottomDockEl.querySelectorAll('[data-season]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sId = (btn as HTMLElement).dataset.season as SeasonId;
        this.callbacks.onSelectSeason(sId);
        this.bottomDockEl.querySelectorAll('[data-season]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.season === sId);
        });
      });
    });

    this.bottomDockEl.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wId = (btn as HTMLElement).dataset.weather as WeatherId;
        this.activeWeatherId = wId;
        this.callbacks.onSelectWeather(wId);
        this.bottomDockEl.querySelectorAll('[data-weather]').forEach((b) => {
          b.classList.toggle('active', (b as HTMLElement).dataset.weather === wId);
        });
      });
    });

    // Disasters & New World
    this.bottomDockEl.querySelectorAll('[data-disaster]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dId = (btn as HTMLElement).dataset.disaster as DisasterId;
        this.callbacks.onTriggerDisaster(dId);
      });
    });

    this.bottomDockEl.querySelector('#btn-new-world')?.addEventListener('click', () => {
      this.callbacks.onRegenerateWorld();
    });

    // Modal Events
    this.modalBackdropEl.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.modalBackdropEl.style.display = 'none';
    });

    this.modalBackdropEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const statBtn = target.closest('[data-stat]') as HTMLElement | null;
      if (statBtn) {
        const stat = statBtn.dataset.stat as 'str' | 'int' | 'agi';
        const dir = Number(statBtn.dataset.dir);
        const used = this.draftCustom.str + this.draftCustom.int + this.draftCustom.agi;
        if (dir > 0 && used < this.maxPointBudget && this.draftCustom[stat] < 10) {
          this.draftCustom[stat]++;
        } else if (dir < 0 && this.draftCustom[stat] > 3) {
          this.draftCustom[stat]--;
        }
        this.renderModalInternals();
        return;
      }

      const cloakBtn = target.closest('[data-cloak]') as HTMLElement | null;
      if (cloakBtn && cloakBtn.dataset.cloak) {
        this.draftCustom.cloakColor = cloakBtn.dataset.cloak;
        this.renderModalInternals();
        return;
      }

      const traitCard = target.closest('[data-trait]') as HTMLElement | null;
      if (traitCard && traitCard.dataset.trait) {
        const tid = traitCard.dataset.trait;
        if (this.draftCustom.traitIds.includes(tid)) {
          if (this.draftCustom.traitIds.length > 1) {
            this.draftCustom.traitIds = this.draftCustom.traitIds.filter((x) => x !== tid);
          }
        } else if (this.draftCustom.traitIds.length < 2) {
          this.draftCustom.traitIds.push(tid);
        }
        this.renderModalInternals();
      }
    });

    this.modalBackdropEl.querySelector('#btn-random-custom')?.addEventListener('click', () => {
      const names = ['เอเรน', 'คีร่า', 'เซธ', 'ไลล่า', 'อารอน', 'เฟรย่า', 'เรเวน'];
      const clans = ['แห่งโมริมาร์', 'ผู้พิทักษ์พงไพร', 'สายเลือดดารา', 'แห่งหุบเขาสีคราม'];
      this.draftCustom.name = names[Math.floor(Math.random() * names.length)];
      this.draftCustom.clanName = clans[Math.floor(Math.random() * clans.length)];
      (this.modalBackdropEl.querySelector('#inp-hero-name') as HTMLInputElement).value =
        this.draftCustom.name;
      (this.modalBackdropEl.querySelector('#inp-clan-name') as HTMLInputElement).value =
        this.draftCustom.clanName;
      this.draftCustom.cloakColor =
        CLOAK_PRESETS[Math.floor(Math.random() * CLOAK_PRESETS.length)].hex;
      this.renderModalInternals();
    });

    this.modalBackdropEl.querySelector('#btn-apply-custom')?.addEventListener('click', () => {
      const nameInp = this.modalBackdropEl.querySelector('#inp-hero-name') as HTMLInputElement;
      const clanInp = this.modalBackdropEl.querySelector('#inp-clan-name') as HTMLInputElement;
      this.draftCustom.name = nameInp.value.trim() || 'เอเรน';
      this.draftCustom.clanName = clanInp.value.trim() || 'แห่งโมริมาร์';
      this.modalBackdropEl.style.display = 'none';
      this.callbacks.onApplyHeroCustomization({ ...this.draftCustom });
    });
  }

  public setFollowState(following: boolean): void {
    this.isFollowingHero = following;
    this.followBtnEl.classList.toggle('active', following);
  }

  private renderHeroPortrait(stageId: string, eraId: EraId, cloakColor: string): void {
    const texKey = `hero_${stageId}_0`;
    const cacheSignature = `${texKey}_${eraId}_${cloakColor}`;
    if (this.lastPortraitTextureKey === cacheSignature) return;
    if (!this.scene.textures.exists(texKey)) return;

    const tex = this.scene.textures.get(texKey);
    const sourceImage = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    if (!sourceImage) return;

    const ctx = this.portraitCanvas.getContext('2d');
    if (!ctx) return;

    this.lastPortraitTextureKey = cacheSignature;
    ctx.clearRect(0, 0, 56, 56);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceImage, 0, 0, 56, 56);
  }

  public updateHeroStatus(
    snapshot: HeroStatusSnapshot,
    _fps: number,
    dayCount: number,
    clockStr: string
  ): void {
    const k = snapshot.kingdom;
    const sm = snapshot.seasonMeta;

    // 1. Update Top Ribbon
    this.eraBadgeNameEl.textContent = k.eraName;
    this.resWoodEl.textContent = String(k.wood);
    this.resStoneEl.textContent = String(k.stone);
    this.resFoodEl.textContent = String(k.food);
    this.resPopEl.textContent = `${k.population}/${k.maxPopulation}`;
    this.resLoreEl.textContent = String(snapshot.loreExp);
    this.clockLabelEl.textContent = `${sm.name} • ${sm.temperatureC}°C • วันที่ ${dayCount} • ${clockStr}`;

    // Disaster Banner
    if (snapshot.activeDisaster !== 'none') {
      const names: Record<DisasterId, string> = {
        none: '',
        wildfire: 'กำลังเกิดไฟป่าหมื่นลี้! เปลวเพลิงกำลังเผาผลาญแมกไม้',
        blizzard: 'พายุหิมะยะเยือกถล่มทวีป! อุณหภูมิติดลบ ต้องรีบผิงไฟ',
        meteor_shower: 'ฝนดาวตกดาราสวรรค์! อุกกาบาตและผลึกศักดิ์สิทธิ์ตกจากฟากฟ้า',
        earthquake: 'แผ่นดินไหวครั้งใหญ่! เปลือกโลกสั่นสะเทือนและผุดโขดหินใหม่',
      };
      this.disasterAlertBannerEl.style.display = 'block';
      this.disasterAlertBannerEl.textContent = names[snapshot.activeDisaster];
    } else {
      this.disasterAlertBannerEl.style.display = 'none';
    }

    // 2. Update Hero Tab
    this.renderHeroPortrait(snapshot.lifeStage.id, k.currentEra, snapshot.cloakColor);
    this.heroNameEl.textContent = `${snapshot.name} ${snapshot.clanName}`;
    this.heroGenBadgeEl.textContent = `รุ่นที่ ${snapshot.generation}`;
    this.heroStageBadgeEl.textContent = snapshot.lifeStage.name;
    this.heroAgeTextEl.textContent = `${snapshot.age} / ${snapshot.maxAge} ปี`;
    const agePct = Math.min(100, Math.round((snapshot.age / snapshot.maxAge) * 100));
    this.heroAgeBarEl.style.width = `${agePct}%`;
    this.heroActionBadgeEl.textContent = snapshot.actionStateText;

    const hPct = Math.round((snapshot.hunger / snapshot.maxHunger) * 100);
    const ePct = Math.round((snapshot.energy / snapshot.maxEnergy) * 100);
    const hpPct = Math.round((snapshot.health / snapshot.maxHealth) * 100);

    this.hungerValEl.textContent = `${hPct}%`;
    this.hungerBarEl.style.width = `${hPct}%`;
    this.energyValEl.textContent = `${ePct}%`;
    this.energyBarEl.style.width = `${ePct}%`;
    this.healthValEl.textContent = `${Math.round(snapshot.health)}/${snapshot.maxHealth}`;
    this.healthBarEl.style.width = `${hpPct}%`;

    this.statStrEl.textContent = String(snapshot.str);
    this.statIntEl.textContent = String(snapshot.int);
    this.statAgiEl.textContent = String(snapshot.agi);

    this.traitsTagsEl.innerHTML = snapshot.traits
      .map(
        (t) =>
          `<span style="font-size:10.5px;padding:2px 7px;border-radius:3px;background:rgba(30,41,59,0.85);border:1px solid rgba(148,163,184,0.2);color:#cbd5e1;">${t.name}</span>`
      )
      .join('');

    this.utilityScoresEl.innerHTML = snapshot.scores
      .map((item, idx) => {
        const pct = Math.min(100, Math.round(item.score * 100));
        const isBest = idx === 0;
        return `
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;">
            <span style="width:128px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${
              isBest ? '#fbbf24' : '#94a3b8'
            };font-weight:${isBest ? '700' : '400'};">${item.label}</span>
            <div class="studio-bar-track" style="flex:1;height:5px;">
              <div class="studio-bar-fill" style="width:${pct}%;background:${
          isBest ? '#f59e0b' : '#475569'
        };"></div>
            </div>
            <span style="width:30px;text-align:right;color:${
              isBest ? '#fbbf24' : '#64748b'
            };font-weight:700;">${pct}%</span>
          </div>
        `;
      })
      .join('');

    // 3. Update Mind & Lore Tab
    const dt = snapshot.deepThought;
    if (dt) {
      this.mindPhilosophyTitleEl.textContent = dt.dominantPhilosophy.name;
      this.mindPhilosophyCreedEl.textContent = `"${dt.dominantPhilosophy.maxim}"`;
      this.mindMonologueEl.textContent = dt.currentMonologue;

      this.mindCotListEl.innerHTML = dt.reasoningChain
        .map(
          (step) => `
          <div style="padding:5px 8px;border-radius:4px;background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.12);font-size:11px;color:#cbd5e1;">
            ${step}
          </div>
        `
        )
        .join('');

      const memHtml = dt.recentMemories
        .slice(0, 4)
        .map(
          (m: EpisodicMemory) => `
          <div style="padding:6px 8px;border-radius:4px;background:rgba(15,23,42,0.65);border-left:2px solid #c084fc;font-size:11px;">
            <div style="display:flex;justify-content:space-between;color:#e2e8f0;font-weight:700;">
              <span>${m.title}</span>
              <span style="color:#94a3b8;font-size:10px;">รุ่น ${m.generation} • อายุ ${m.age}</span>
            </div>
            <div style="color:#94a3b8;margin-top:2px;font-size:10.5px;">${m.reflection}</div>
          </div>
        `
        )
        .join('');

      const legHtml = dt.ancestralLegends
        .slice(0, 2)
        .map(
          (l: AncestralLegend) => `
          <div style="padding:6px 8px;border-radius:4px;background:rgba(245,158,11,0.1);border-left:2px solid #f59e0b;font-size:11px;">
            <div style="color:#fcd34d;font-weight:700;">จารึกบรรพชนรุ่นที่ ${l.generation}: ${l.heroName}</div>
            <div style="color:#cbd5e1;font-size:10.5px;margin-top:2px;">"${l.maxim}"</div>
          </div>
        `
        )
        .join('');

      this.mindMemoriesListEl.innerHTML =
        legHtml + memHtml ||
        `<div style="font-size:11px;color:#64748b;">กำลังบันทึกความทรงจำลงฐานข้อมูล...</div>`;
    }

    // 4. Update 5-Era World Evolution & Kingdom Tab
    this.eraTimelineListEl.innerHTML = ERAS_ROADMAP.map((era) => {
      const isCurrent = era.index === k.eraIndex;
      const isPassed = era.index < k.eraIndex;
      return `
        <div class="studio-era-card ${isCurrent ? 'active' : ''}" data-select-era="${era.index}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;font-weight:700;color:${
              isCurrent ? '#fbbf24' : isPassed ? '#34d399' : '#e2e8f0'
            };">
              ${era.index + 1}. ${era.name}
            </span>
            <span style="font-size:10px;padding:1px 6px;border-radius:3px;background:${
              isCurrent
                ? 'rgba(245,158,11,0.25)'
                : isPassed
                ? 'rgba(16,185,129,0.2)'
                : 'rgba(51,65,85,0.7)'
            };color:${isCurrent ? '#fcd34d' : isPassed ? '#6ee7b7' : '#94a3b8'};">
              ${isCurrent ? 'ยุคปัจจุบันของโลก' : isPassed ? 'ผ่านแล้ว' : `ใช้ภูมิปัญญา ${era.loreRequired}`}
            </span>
          </div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:3px;">${era.subtitle}</div>
        </div>
      `;
    }).join('');

    this.eraTimelineListEl.querySelectorAll('[data-select-era]').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = Number((card as HTMLElement).dataset.selectEra);
        this.callbacks.onSelectEra(idx);
      });
    });

    if (k.activeSite) {
      this.activeBuildBoxEl.style.display = 'block';
      this.activeBuildBoxEl.innerHTML = `กำลังก่อสร้าง <strong>${k.activeSite.name}</strong> (${k.activeSite.percent}%)`;
    } else {
      this.activeBuildBoxEl.style.display = 'none';
    }

    this.buildingsListEl.innerHTML = k.buildingsList
      .map((b) => {
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-radius:4px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.12);font-size:11px;">
            <div>
              <div style="font-weight:700;color:${b.unlocked ? '#e2e8f0' : '#64748b'};">${
          b.config.name
        } (${b.count}/${b.config.maxCount})</div>
              <div style="font-size:10px;color:#94a3b8;">ไม้ ${b.config.woodCost} • หิน ${
          b.config.stoneCost
        } • INT ${b.config.requiredInt}</div>
            </div>
            <span style="font-size:10.5px;color:${
              b.canAfford ? '#34d399' : b.unlocked ? '#fbbf24' : '#64748b'
            };font-weight:600;">
              ${b.canAfford ? 'พร้อมสร้าง' : b.unlocked ? 'รอวัตถุดิบ' : `ใช้ภูมิปัญญา ${b.config.requiredLore}`}
            </span>
          </div>
        `;
      })
      .join('');

    // 5. Update Narrative Bar
    this.narrativeBannerEl.textContent = snapshot.narrativeCaption;
  }

  public updateTileInspector(tile?: TileData): void {
    if (!tile) {
      this.tileInspectorEl.textContent = 'ชี้เมาส์บนแผนที่เพื่อดูข้อมูลพื้นที่';
      return;
    }
    const resLabel = tile.resource ? ` • ${tile.resource.type}` : '';
    this.tileInspectorEl.textContent = `พิกัด (${tile.x}, ${tile.y}) • ${tile.biome.name}${resLabel}`;
  }

  public addChronicle(entry: Omit<ChronicleEntry, 'id'>): void {
    const fullEntry: ChronicleEntry = {
      ...entry,
      id: this.nextEntryId++,
    };
    this.chronicleEntries.unshift(fullEntry);
    if (this.chronicleEntries.length > 45) {
      this.chronicleEntries.pop();
    }
    this.renderChronicles();
  }

  public clearChronicles(): void {
    this.chronicleEntries = [];
    this.renderChronicles();
  }

  private renderChronicles(): void {
    const borderColors: Record<ChronicleEntry['type'], string> = {
      info: '#38bdf8',
      food: '#10b981',
      sleep: '#818cf8',
      warn: '#f87171',
      milestone: '#fbbf24',
    };

    this.chronicleListEl.innerHTML = this.chronicleEntries
      .map(
        (c) => `
        <div style="padding:6px 8px;border-radius:4px;background:rgba(15,23,42,0.65);border-left:2px solid ${
          borderColors[c.type]
        };font-size:11px;">
          <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:10px;margin-bottom:2px;">
            <span>ปีที่ ${c.year} • วันที่ ${c.day}</span>
            <span>${c.timeStr}</span>
          </div>
          <div style="color:#e2e8f0;">${c.text}</div>
        </div>
      `
      )
      .join('');
  }
}
