import { Howler } from 'howler';

/**
 * Cozy Soundscape & Spatial Audio Manager (Phase 8.2)
 * Synthesizes warm, tactile wooden UI clicks, wood-chopping "ป๊อกๆ",
 * celestial miracle chimes, thunder rumbles, and spatial ambient loops
 * (ocean breeze, daytime birdsong, nighttime crickets, crackling campfire).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private ambientTimer = 0;
  private crackleTimer = 0;
  private masterGain: GainNode | null = null;

  constructor() {
    Howler.volume(0.65);
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.45;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Soft tactile wooden button click */
  public playClickWood(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.045);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /** Tactile "ป๊อก!" wood chop / hammer strike */
  public playChopWood(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.065);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /** Joyful cozy chime when a building completes or Era advances */
  public playBuildComplete(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }

  /** Celestial "วิ้ง!" shimmer for divine miracles & blessings */
  public playDivineMiracle(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const notes = [587.33, 880, 1174.66, 1318.5, 1760];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  /** Thunderous rumble for lightning smite & disasters */
  public playLightningSmite(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.55;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(65, now + 0.52);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  /**
   * Updates spatial ambient soundscape based on camera zoom, distance to campfire, and time of day.
   */
  public updateSpatialAmbience(
    zoom: number,
    distToFireTiles: number,
    isNight: boolean,
    isWinter: boolean,
    dt: number
  ): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running' || !this.masterGain) return;

    // 1. Cozy Campfire Crackle when zoomed in near the village fire
    this.crackleTimer += dt;
    if (distToFireTiles < 14 && zoom >= 1.2 && this.crackleTimer >= 0.35 + Math.random() * 0.55) {
      this.crackleTimer = 0;
      const proximity = Math.max(0, 1 - distToFireTiles / 14) * Math.min(1, (zoom - 0.8) / 1.5);
      if (proximity > 0.08 && Math.random() < 0.65) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900 + Math.random() * 1200, now);
        gain.gain.setValueAtTime(0.035 * proximity, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.022);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.025);
      }
    }

    // 2. Daytime Birdsong or Nighttime Cricket Chirp
    this.ambientTimer += dt;
    if (this.ambientTimer >= 4.2 + Math.random() * 3.5) {
      this.ambientTimer = 0;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (!isNight && !isWinter) {
        // Gentle forest bird double-chirp
        osc.type = 'sine';
        const baseFreq = 1650 + Math.random() * 450;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, now + 0.09);
        osc.frequency.setValueAtTime(baseFreq * 1.05, now + 0.13);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.24);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (isNight) {
        // Soft cricket trill
        osc.type = 'sine';
        osc.frequency.setValueAtTime(3400 + Math.random() * 200, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.022, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    }
  }
}

export const soundscape = new AudioManager();
