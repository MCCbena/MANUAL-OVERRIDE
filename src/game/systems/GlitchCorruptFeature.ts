/**
 * game/systems/GlitchCorruptFeature.ts
 *
 * 「壊れたゲーム」のゲームプレイを表現する Feature。
 * - 入力反転: 一定間隔で左右入力が逆転（1〜3秒間）
 * - ハザード速度ランダム化: 一定確率でハザードの速度を2倍に
 * - スコアちらつき: 一定確率でスコア表示がランダム数値に変わる（0.5秒間）
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'

// 入力反転の最小・最大持続時間（秒）
const INPUT_REVERSAL_MIN_SEC = 1.0
const INPUT_REVERSAL_MAX_SEC = 3.0
// 入力反転のクールダウン（反転終了後、次の反転までの最小間隔）
const INPUT_REVERSAL_COOLDOWN_SEC = 2.0
// ハザード速度倍化の確率（0〜1）
const HAZARD_SPEED_DOUBLE_CHANCE = 0.15
// ハザード速度倍化の持続時間（秒）
const HAZARD_SPEED_DOUBLE_DURATION = 1.0
// スコアちらつき確率
const SCORE_FLICKER_CHANCE = 0.1
// スコアちらつき持続時間（秒）
const SCORE_FLICKER_DURATION = 0.5

export class GlitchCorruptFeature implements FeatureSystem {
  readonly handles = ['glitch_corrupt'] as const

  private nextReversalTime = 3.0
  private reversalRemaining = 0
  private reversalCooldown = 0
  private hazardSpeedDoubles: Map<number, number> = new Map()
  private scoreFlickerRemaining = 0
  private scoreFlickerValue = 0
  private scoreAtFlickerStart = 0
  private _isInputReversed = false

  update(world: MutableWorld, _input: InputSnapshot, dt: number): void {
    this._tickTimers(dt, world)
    this._maybeDoubleHazardSpeed(world, dt)
    this._maybeFlickerScore(world, dt)
  }

  onManualUpdated(): void {
    this.nextReversalTime = INPUT_REVERSAL_MIN_SEC +
      Math.random() * (INPUT_REVERSAL_MAX_SEC - INPUT_REVERSAL_MIN_SEC)
    this.reversalRemaining = 0
    this.reversalCooldown = 0
    this.hazardSpeedDoubles.clear()
    this.scoreFlickerRemaining = 0
    this._isInputReversed = false
  }

  // ─── 内部 ────────────────────────────────────────────────────────

  private _tickTimers(dt: number, world: MutableWorld): void {
    if (this.reversalRemaining > 0) {
      this.reversalRemaining -= dt
      if (this.reversalRemaining <= 0) {
        this.reversalRemaining = 0
        this.reversalCooldown = INPUT_REVERSAL_COOLDOWN_SEC
        this._isInputReversed = false
      }
    }

    if (this.reversalCooldown > 0) {
      this.reversalCooldown -= dt
      if (this.reversalCooldown <= 0) {
        this.reversalCooldown = 0
        this.nextReversalTime = INPUT_REVERSAL_MIN_SEC +
          Math.random() * (INPUT_REVERSAL_MAX_SEC - INPUT_REVERSAL_MIN_SEC)
      }
    }

    if (this.reversalRemaining <= 0 && this.reversalCooldown <= 0) {
      this.nextReversalTime -= dt
      if (this.nextReversalTime <= 0) {
        this._startReversal()
      }
    }

    const now = performance.now()
    for (const [id, until] of this.hazardSpeedDoubles) {
      if (now >= until) {
        this.hazardSpeedDoubles.delete(id)
      }
    }

    if (this.scoreFlickerRemaining > 0) {
      this.scoreFlickerRemaining -= dt
      if (this.scoreFlickerRemaining <= 0) {
        this.scoreFlickerRemaining = 0
        world.addScore(this.scoreAtFlickerStart - this.scoreFlickerValue)
      }
    }
  }

  private _startReversal(): void {
    const duration = INPUT_REVERSAL_MIN_SEC +
      Math.random() * (INPUT_REVERSAL_MAX_SEC - INPUT_REVERSAL_MIN_SEC)
    this.reversalRemaining = duration
    this.reversalCooldown = 0
    this.nextReversalTime = 999
    this._isInputReversed = true
  }

  private _maybeDoubleHazardSpeed(world: MutableWorld, _dt: number): void {
    if (Math.random() >= HAZARD_SPEED_DOUBLE_CHANCE) return
    if (world.hazards.length === 0) return

    const idx = Math.floor(Math.random() * world.hazards.length)
    const hazard = world.hazards[idx]
    const now = performance.now()
    const until = now + HAZARD_SPEED_DOUBLE_DURATION * 1000
    this.hazardSpeedDoubles.set(_hazardId(hazard), until)
  }

  private _maybeFlickerScore(world: MutableWorld, _dt: number): void {
    if (this.scoreFlickerRemaining > 0) return
    if (Math.random() >= SCORE_FLICKER_CHANCE) return

    this.scoreAtFlickerStart = 0
    this.scoreFlickerValue = Math.floor(Math.random() * 99999)
    this.scoreFlickerRemaining = SCORE_FLICKER_DURATION
    world.addScore(this.scoreFlickerValue)
  }

  /** 入力反転状態を設定（テスト用） */
  setInputReversal(active: boolean): void {
    this._isInputReversed = active
  }

  /** 現在の入力反転状態を返す（テスト用） */
  get isInputReversed(): boolean {
    return this._isInputReversed
  }
}

function _hazardId(h: { x: number; y: number }): number {
  return Math.floor(h.x * 31 + h.y * 17)
}
