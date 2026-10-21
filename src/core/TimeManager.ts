import { TimeSpeed } from './Types';

export class TimeManager {
  private speed: TimeSpeed = 1;
  private elapsedSimSeconds = 0;
  private readonly secondsPerYear: number;
  private readonly daysPerYear = 12;

  constructor(secondsPerYear = 35) {
    this.secondsPerYear = secondsPerYear;
    // Start at evening twilight (20:30) like the reference screenshot so the warm lights & cyan mist shine right away!
    this.elapsedSimSeconds = (20.5 / 24) * (secondsPerYear / 4);
  }

  public setSpeed(speed: TimeSpeed): void {
    this.speed = speed;
  }

  public getSpeed(): TimeSpeed {
    return this.speed;
  }

  public update(rawDeltaMs: number): number {
    const clampedMs = Math.min(rawDeltaMs, 100);
    const simDeltaSec = (clampedMs / 1000) * this.speed;
    this.elapsedSimSeconds += simDeltaSec;
    return simDeltaSec;
  }

  public getElapsedYears(): number {
    return Math.floor(this.elapsedSimSeconds / this.secondsPerYear);
  }

  public getDayCount(): number {
    const secondsPerDay = this.secondsPerYear / 4;
    return Math.floor(this.elapsedSimSeconds / secondsPerDay) + 1;
  }

  public getDayOfYear(): number {
    const yearProgress = (this.elapsedSimSeconds % this.secondsPerYear) / this.secondsPerYear;
    return Math.floor(yearProgress * this.daysPerYear) + 1;
  }

  public getClockTime(): { hours: number; minutes: number; formatted: string; isNight: boolean; ambientDarkness: number } {
    const secondsPerDay = this.secondsPerYear / 4;
    const dayFraction = (this.elapsedSimSeconds % secondsPerDay) / secondsPerDay;
    const totalMinutes = Math.floor(dayFraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    // Smooth day/twilight/night curve (keeps atmospheric twilight even at midday, deeper indigo at night)
    const angle = ((hours + minutes / 60 - 13) / 24) * Math.PI * 2;
    const rawNight = (Math.cos(angle) + 1) * 0.5; // 1 at 13:00, 0 at 01:00
    const ambientDarkness = 0.35 + (1 - rawNight) * 0.42; // 0.35 (twilight day) to 0.77 (deep mystical night)
    const isNight = hours >= 18 || hours < 6;

    return { hours, minutes, formatted, isNight, ambientDarkness };
  }

  public reset(): void {
    this.elapsedSimSeconds = (20.5 / 24) * (this.secondsPerYear / 4);
  }
}
