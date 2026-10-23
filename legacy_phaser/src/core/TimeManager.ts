import { TimeSpeed } from './Types';

export class TimeManager {
  private speed: TimeSpeed = 1;
  private heroElapsedSimSeconds = 0;
  private worldElapsedSimSeconds = 0;
  private maxWorldYears = 300; // 0 = Endless, otherwise e.g. 150, 300, 600
  private readonly secondsPerYear: number;
  private readonly daysPerYear = 12;

  constructor(secondsPerYear = 20) {
    this.secondsPerYear = secondsPerYear;
    const startOffset = (20.5 / 24) * (secondsPerYear / 4);
    this.heroElapsedSimSeconds = startOffset;
    this.worldElapsedSimSeconds = startOffset;
  }

  public setSpeed(speed: TimeSpeed): void {
    this.speed = speed;
  }

  public getSpeed(): TimeSpeed {
    return this.speed;
  }

  public setMaxWorldYears(years: number): void {
    this.maxWorldYears = Math.max(0, years);
  }

  public getMaxWorldYears(): number {
    return this.maxWorldYears;
  }

  public extendWorldLifespan(extraYears: number): void {
    if (this.maxWorldYears > 0) {
      this.maxWorldYears += extraYears;
    }
  }

  public update(rawDeltaMs: number): number {
    const clampedMs = Math.min(rawDeltaMs, 100);
    const simDeltaSec = (clampedMs / 1000) * this.speed;
    this.heroElapsedSimSeconds += simDeltaSec;
    this.worldElapsedSimSeconds += simDeltaSec;
    return simDeltaSec;
  }

  public getElapsedYears(): number {
    return Math.floor(this.heroElapsedSimSeconds / this.secondsPerYear);
  }

  public getWorldYear(): number {
    return Math.floor(this.worldElapsedSimSeconds / this.secondsPerYear) + 1;
  }

  public isWorldEnded(): boolean {
    if (this.maxWorldYears <= 0) return false;
    return this.getWorldYear() >= this.maxWorldYears;
  }

  public getDayCount(): number {
    const secondsPerDay = this.secondsPerYear / 4;
    return Math.floor(this.worldElapsedSimSeconds / secondsPerDay) + 1;
  }

  public getDayOfYear(): number {
    const yearProgress = (this.worldElapsedSimSeconds % this.secondsPerYear) / this.secondsPerYear;
    return Math.floor(yearProgress * this.daysPerYear) + 1;
  }

  public getClockTime(): {
    hours: number;
    minutes: number;
    formatted: string;
    isNight: boolean;
    ambientDarkness: number;
  } {
    const secondsPerDay = this.secondsPerYear / 4;
    const dayFraction = (this.worldElapsedSimSeconds % secondsPerDay) / secondsPerDay;
    const totalMinutes = Math.floor(dayFraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const angle = ((hours + minutes / 60 - 13) / 24) * Math.PI * 2;
    const rawNight = (Math.cos(angle) + 1) * 0.5;
    const ambientDarkness = 0.35 + (1 - rawNight) * 0.42;
    const isNight = hours >= 18 || hours < 6;

    return { hours, minutes, formatted, isNight, ambientDarkness };
  }

  /** Resets only the Hero's personal age timer (used when an Heir takes over in the same World) */
  public resetHeroAgeTimer(): void {
    this.heroElapsedSimSeconds = 0;
  }

  /** Resets both World and Hero timers (used when creating a brand new World) */
  public reset(): void {
    const startOffset = (20.5 / 24) * (this.secondsPerYear / 4);
    this.heroElapsedSimSeconds = startOffset;
    this.worldElapsedSimSeconds = startOffset;
  }
}
