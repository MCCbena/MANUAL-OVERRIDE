/**
 * domain/LearningSystem.ts
 *
 * プレイヤーの行動統計を監視し、LearningRule のトリガーを評価する。
 * 効果が発動したら LearningEffect の配列を返す。
 *
 * 設計方針:
 *  - 純粋関数 evaluateLearningRules() を中心に置き、副作用は呼び出し元に委ねる
 *  - triggered フラグで同一ルールの二重発動を防ぐ
 *
 * 統合方法:
 *  1. sideScroller.ts の getStats() で ActionStats を取得
 *  2. 説明書バージョンに learningRules: LearningRule[] を定義（ManualVersion 拡張時）
 *  3. updateRules() 内または定期ポーリングで evaluateLearningRules() を呼ぶ
 *  4. 返り値の LearningEffect[] を RuntimeRules のミューテーションに適用する
 */

import type { LearningRule, LearningTrigger, LearningEffect, ActionStats } from './types'

/**
 * トリガー条件を ActionStats に対して評価する。
 * ticks が 0 の場合は常に false（ゲーム開始直後を除く）。
 */
function evaluateTrigger(trigger: LearningTrigger, stats: ActionStats): boolean {
  if (stats.ticks === 0) return false

  let rate = 0
  switch (trigger.type) {
    case 'jumpRate':  rate = stats.jumps / stats.ticks;           break
    case 'rightRate': rate = stats.moveRight / stats.ticks;       break
    case 'leftRate':  rate = stats.moveLeft / stats.ticks;        break
    case 'shotRate':  rate = stats.shots / stats.ticks;           break
    case 'dashRate':  rate = (stats.dashes ?? 0) / stats.ticks;   break
  }

  return (trigger.triggerAbove ?? true)
    ? rate > trigger.threshold
    : rate < trigger.threshold
}

/**
 * すべての未発動ルールを評価し、新たに発動したエフェクトを返す。
 * triggered フラグを true に書き換えるため、rules 配列は変更される（in-place）。
 *
 * @param rules    ManualVersion に付随する LearningRule[] （変更される）
 * @param stats    SideScroller.getStats() から取得した ActionStats
 * @returns        今フレームで新たに発動した LearningEffect の配列
 */
export function evaluateLearningRules(
  rules: LearningRule[],
  stats: ActionStats,
): LearningEffect[] {
  const fired: LearningEffect[] = []
  for (const rule of rules) {
    if (rule.triggered) continue
    if (evaluateTrigger(rule.trigger, stats)) {
      rule.triggered = true
      fired.push(rule.effect)
    }
  }
  return fired
}

/**
 * LearningEffect の type から人間可読ラベルを返す（デバッグ/ログ用）。
 */
export function describeEffect(effect: LearningEffect): string {
  switch (effect.type) {
    case 'disableAction': return `アクション "${effect.payload}" を無効化`
    case 'invertHazard':  return `ハザード色反転（${effect.durationSec ?? '永続'}秒）`
    case 'forceFeature':  return `フィーチャー "${effect.payload}" を強制有効化`
    case 'changeKey':     return `キー再マッピング → "${effect.payload}"`
  }
}
