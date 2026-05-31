/**
 * gameBalance.ts
 *
 * ゲーム進行の核となるバランスパラメータ。スコア計算、テンポ、難易度に直結する値。
 * tunables.ts と異なり、ここの値はゲーム全体のリズムに影響する。
 *
 * 注意: このファイルを編集する場合、tunables.ts の DIFFICULTY セクションとの整合性を保つこと。
 */

import type { Controls } from '../domain/types'

// 説明書更新が発動する走行距離（px）
// DIFFICULTY.updateDistances と同じ値を保つこと
export const UPDATE_DISTANCES = [1100, 2400, 3900] as const

/** 最終スコア = プレイスコア * 70% + 投擲スコア * 30% */
export const SCORE_RATIO = { play: 0.7, throw: 0.3 } as const

/** 投擲フェーズのスコア重み配分 */
export const THROW_SCORE_WEIGHTS = {
  airTime: 0.5,      // 滞空時間重視
  arcHeight: 0.4,    // 弧の高さ重視
  speedPenalty: 0.1, // 速度ペナルティ
} as const

/** 基本スクロール速度。actualSpeed = BASE + tempo * TEMPO_SPEED_BONUS */
export const BASE_SCROLL_SPEED = 270

/** tempo値の影響度。DIFFICULTY.tempoSpeedBonus と同値を保つ */
export const TEMPO_SPEED_BONUS = 30

/** ハザードスポーン曲線パラメータ。distance の指数関数で間隔を短縮 */
export const HAZARD_SPAWN = {
  baseInterval: 3000,  // 開始時の基本間隔（ms）
  minInterval: 1000,   // 最小間隔（加速の上限）
  decayRate: 0.00012,  // 減衰率。大きいほど加速が早い
} as const

/** プレイヤー物理パラメータ。tunables.ts の PHYSICS と同じ値 */
export const PLAYER_PHYSICS = {
  width: 36,
  height: 52,
  jumpVelocity: -680,        // ジャンプ初速
  jumpCutMultiplier: 0.42,   // 早離し時の速度倍率
  gravity: 1800,             // 通常重力
  fallGravityMult: 1.75,     // 落下時の重力倍率
  groundY: 0,
  runSpeed: 240,
  coyoteFrames: 9,           // コヨーテタイム（フレーム数）
  jumpBufferFrames: 10,      // ジャンプバッファ（フレーム数）
}

/** デフォルトコントロール */
export const DEFAULT_CONTROLS: Controls = {
  jump: 'Space',
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
}
