import { ExercisePoseProfile } from "./exercisePoseProfiles";
import { resolveSide } from "./jointAngles";

export type RepState = "extended" | "contracted" | "returning";

export interface RepCounterState {
  state: RepState;
  repCount: number;
  lastRepTimeMs: number;
}

export interface RepMatcherOptions {
  keyAngles: string[];
  hysteresis?: number;
  minRepIntervalS?: number;
  staleAfterS?: number;
  rangeDecayTauS?: number;
  minRangeDeg?: number;
  smoothTauS?: number;
}

/**
 * Adaptive repetition matcher based on Maryam's adaptive ROM envelope algorithm.
 * Counts reps from the user's own range of motion calibrated dynamically on the fly.
 */
export class RepMatcher {
  public keyAngles: string[];
  public hysteresis: number;
  public minRepIntervalS: number;
  public staleAfterS: number;
  public rangeDecayTauS: number;
  public minRangeDeg: number;
  public smoothTauS: number;

  public repCount: number = 0;
  private _lastRepTimeS: number = 0;
  private _lastUpdateS: number | null = null;

  private _smoothed: Record<string, number | null> = {};
  private _lo: Record<string, number | null> = {};
  private _hi: Record<string, number | null> = {};
  private _wasContracted: Record<string, boolean> = {};
  private _isExtended: Record<string, boolean> = {};
  private _lastSeenS: Record<string, number> = {};

  constructor(options: RepMatcherOptions) {
    this.keyAngles = [...options.keyAngles];
    this.hysteresis = options.hysteresis ?? 0.20;
    this.minRepIntervalS = options.minRepIntervalS ?? 0.5;
    this.staleAfterS = options.staleAfterS ?? 2.0;
    this.rangeDecayTauS = options.rangeDecayTauS ?? 10.0;
    this.minRangeDeg = options.minRangeDeg ?? 15.0;
    this.smoothTauS = options.smoothTauS ?? 0.15;
    this.reset();
  }

  public reset(): void {
    this.repCount = 0;
    this._lastRepTimeS = 0;
    this._lastUpdateS = null;
    this._smoothed = {};
    this._lo = {};
    this._hi = {};
    this._wasContracted = {};
    this._isExtended = {};
    this._lastSeenS = {};
    for (const joint of this.keyAngles) {
      this._smoothed[joint] = null;
      this._lo[joint] = null;
      this._hi[joint] = null;
      this._wasContracted[joint] = false;
      this._isExtended[joint] = false;
      this._lastSeenS[joint] = -Infinity;
    }
  }

  public isCalibrated(joint: string): boolean {
    const lo = this._lo[joint];
    const hi = this._hi[joint];
    return (
      lo !== undefined &&
      lo !== null &&
      hi !== undefined &&
      hi !== null &&
      hi - lo >= this.minRangeDeg
    );
  }

  public calibratedRange(joint: string): [number, number] | null {
    const lo = this._lo[joint];
    const hi = this._hi[joint];
    if (
      lo !== undefined &&
      lo !== null &&
      hi !== undefined &&
      hi !== null &&
      hi - lo >= this.minRangeDeg
    ) {
      return [lo, hi];
    }
    return null;
  }

  public update(angles: Record<string, number>, nowS: number): boolean {
    const dt = this._lastUpdateS === null ? 0 : Math.max(0, nowS - this._lastUpdateS);
    this._lastUpdateS = nowS;

    const alpha = this.rangeDecayTauS > 0 ? Math.min(1.0, dt / this.rangeDecayTauS) : 0.0;
    const beta = this.smoothTauS > 0 ? Math.min(1.0, dt / this.smoothTauS) : 1.0;

    for (const joint of this.keyAngles) {
      const raw = resolveSide(angles, joint);
      if (raw === undefined || isNaN(raw)) {
        continue;
      }
      this._lastSeenS[joint] = nowS;

      const prev = this._smoothed[joint];
      const v = prev === undefined || prev === null ? raw : prev + (raw - prev) * beta;
      this._smoothed[joint] = v;

      const lo = this._lo[joint];
      const hi = this._hi[joint];
      if (lo === undefined || lo === null || hi === undefined || hi === null) {
        this._lo[joint] = v;
        this._hi[joint] = v;
        continue;
      }

      // Expand instantly on new extreme; decay toward current value otherwise
      this._lo[joint] = v < lo ? v : lo + (v - lo) * alpha;
      this._hi[joint] = v > hi ? v : hi - (hi - v) * alpha;

      if (!this.isCalibrated(joint)) {
        continue;
      }

      const curLo = this._lo[joint]!;
      const curHi = this._hi[joint]!;
      const band = (curHi - curLo) * this.hysteresis;

      if (v <= curLo + band) {
        this._wasContracted[joint] = true;
      }
      this._isExtended[joint] = v >= curHi - band;
    }

    const active = this.keyAngles.filter(
      (a) => this.isCalibrated(a) && nowS - (this._lastSeenS[a] ?? -Infinity) <= this.staleAfterS
    );

    if (active.length === 0) {
      return false;
    }

    const fullCycle =
      active.every((a) => this._isExtended[a]) && active.every((a) => this._wasContracted[a]);

    if (fullCycle && nowS - this._lastRepTimeS >= this.minRepIntervalS) {
      this.repCount += 1;
      this._lastRepTimeS = nowS;
      for (const joint of this.keyAngles) {
        this._wasContracted[joint] = false;
      }
      return true;
    }

    return false;
  }
}

/**
 * Backward-compatibility transition wrapper for profile-based callers.
 */
export function updateRepCounter(
  currentState: RepCounterState,
  angle: number,
  profile: ExercisePoseProfile,
  currentTimeMs: number
): RepCounterState {
  const { state, repCount, lastRepTimeMs } = currentState;
  const { contractedThreshold, returningThreshold, extendedThreshold, cooldownMs } = profile;

  switch (state) {
    case "extended":
      if (angle <= contractedThreshold) {
        return {
          state: "contracted",
          repCount,
          lastRepTimeMs,
        };
      }
      break;

    case "contracted":
      if (angle >= extendedThreshold) {
        const isOutsideCooldown = lastRepTimeMs === 0 || currentTimeMs - lastRepTimeMs >= cooldownMs;
        return {
          state: "extended",
          repCount: isOutsideCooldown ? repCount + 1 : repCount,
          lastRepTimeMs: isOutsideCooldown ? currentTimeMs : lastRepTimeMs,
        };
      } else if (angle >= returningThreshold) {
        return {
          state: "returning",
          repCount,
          lastRepTimeMs,
        };
      }
      break;

    case "returning":
      if (angle >= extendedThreshold) {
        const isOutsideCooldown = lastRepTimeMs === 0 || currentTimeMs - lastRepTimeMs >= cooldownMs;
        return {
          state: "extended",
          repCount: isOutsideCooldown ? repCount + 1 : repCount,
          lastRepTimeMs: isOutsideCooldown ? currentTimeMs : lastRepTimeMs,
        };
      } else if (angle <= contractedThreshold) {
        return {
          state: "contracted",
          repCount,
          lastRepTimeMs,
        };
      }
      break;
  }

  return currentState;
}
