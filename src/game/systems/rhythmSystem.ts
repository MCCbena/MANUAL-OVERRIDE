import type { RuntimeRules } from '../../domain/types'
import type { BeatMarker } from '../entities'

export interface RhythmState {
  beatInterval: number   // ms per beat
  nextBeat: number       // 次のビートまでのms
  beatCount: number
  beatMarkers: BeatMarker[]
  beatHazardInverted: boolean  // このビートは危険色が反転中か
  beatHits: number             // ジャスト入力の成功回数
  justWindowMs: number         // ジャスト入力の許容ウィンドウ
  lastJustMs: number           // 前回のビートオフセット
}

export function createRhythmState(bpm: number): RhythmState {
  const beatInterval = (60 / bpm) * 1000
  return {
    beatInterval,
    nextBeat: beatInterval,
    beatCount: 0,
    beatMarkers: [],
    beatHazardInverted: false,
    beatHits: 0,
    justWindowMs: 80,
    lastJustMs: -1,
  }
}

export function updateRhythm(
  state: RhythmState,
  dt: number,
  rules: RuntimeRules,
  _hazardColors: Set<string>,
  _safeColors: Set<string>,
): void {
  if (!rules.features.has('beat_hazard')) return

  const dtMs = dt * 1000
  state.nextBeat -= dtMs
  state.beatMarkers.forEach(m => m.t -= dtMs)
  state.beatMarkers = state.beatMarkers.filter(m => m.t > 0)

  if (state.nextBeat <= 0) {
    state.nextBeat += state.beatInterval
    state.beatCount++

    // 偶数拍で危険色を反転
    state.beatHazardInverted = state.beatCount % 2 === 0

    // ビートマーカー生成
    state.beatMarkers.push({ t: 400, x: Math.random() * 600 + 100, strength: 1 })

    // ビートに合わせて hazardColors を反転（rules は immutable なので Set を直接変更はせず、
    // sideScroller 側が beatHazardInverted を見て判断）
  }
}

// プレイヤーの入力がビートとどれだけ合っているか（0〜1、高いほど良い）
export function evaluateTiming(state: RhythmState, _currentMs: number): number {
  const phase = (state.beatInterval - state.nextBeat) % state.beatInterval
  const distToNearest = Math.min(phase, state.beatInterval - phase)
  if (distToNearest <= state.justWindowMs) {
    return 1 - distToNearest / state.justWindowMs
  }
  return 0
}
