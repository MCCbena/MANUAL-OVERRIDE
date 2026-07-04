/**
 * data/charts/types.ts
 * プロセカ風リズムゲームの譜面データ型定義。
 * JSONファイルからインポート可能な形式を定義する。
 */

// ノートタイプ（プロセカ準拠）
export type NoteType = 'tap' | 'hold' | 'flick'

// レーン数（デフォルト5レーン）
export const LANE_COUNT = 5 as const
export type LaneIndex = 0 | 1 | 2 | 3 | 4

// 判定レベル
export type JudgeLevel = 'perfect' | 'great' | 'nice' | 'miss'

// 1つのノート定義
export interface NoteDef {
  /** ノートが発生するタイミング（ミリ秒、BPMからのオフセット） */
  time: number
  /** レーンインデックス (0-4) */
  lane: LaneIndex
  /** ノートタイプ */
  type: NoteType
  /** ホールドノートの長さ（ミリ秒）。tap/flickは0） */
  holdLength?: number
}

// セクション定義（曲のパートごとに区切る）
export interface SectionDef {
  /** セクション名（INTRO, Aメロ, サビ etc.） */
  name: string
  /** このセクションのノートリスト */
  notes: NoteDef[]
}

// 譜面データ全体
export interface ChartData {
  /** 曲タイトル */
  title: string
  /** アーティスト名 */
  artist: string
  /** BPM（ビート・パー・ミニット） */
  bpm: number
  /** 難易度レベル (1-10) */
  difficulty: number
  /** セクションリスト */
  sections: SectionDef[]
  /** ノート総数（メタ情報） */
  noteCount?: number
}

// 実行時ノートエンティティ（譜面から生成される）
export interface RhythmNote {
  id: string
  time: number        // ミリ秒
  lane: LaneIndex
  type: NoteType
  holdLength?: number
  judged: boolean     // 判定済みか
  judgeLevel?: JudgeLevel
  screenX: number     // スクリーン座標（レンダリング用）
}

// 判定結果ポップアップ
export interface JudgePopup {
  level: JudgeLevel
  x: number
  y: number
  life: number        // 表示ライフ (0〜1)
  score: number       // 付与スコア
  comboBonus: number  // コンボボーナス
}

// ゲーム状態
export interface RhythmGameState {
  currentNoteIndex: number    // 次に再生するノートインデックス
  combo: number               // 現在のコンボ数
  maxCombo: number            // マキシマムコンボ
  perfectCount: number        // PERFECT回数
  greatCount: number          // GREAT回数
  niceCount: number           // NICE回数
  missCount: number           // MISS回数
  health: number              // HP (0-100)
  playScore: number           // プレイスコア
  judgePopups: JudgePopup[]   // 表示中の判定ポップアップ
}
