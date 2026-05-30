/**
 * framework/ManualValidator.ts
 *
 * MANUAL_DECK の整合性チェック。
 * - すべての choices[].next が実在するキーを指しているか
 * - 循環参照がないか
 * - ルートキー '1.0' が存在するか
 *
 * 開発時に呼ぶことでデータ破損を早期検知できる。
 */

import type { ManualVersion } from '../domain/types'

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateDeck(deck: Record<string, ManualVersion>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // ── ルートキーの存在確認 ──────────────────────────────────────
  if (!deck['1.0']) {
    errors.push('ルートキー "1.0" が存在しません。MANUAL_DECK には必ず "1.0" エントリーが必要です。')
  }

  // ── choices[].next の参照チェック ─────────────────────────────
  for (const [key, ver] of Object.entries(deck)) {
    for (const choice of ver.choices) {
      if (!deck[choice.next]) {
        errors.push(
          `"${key}" → choice "${choice.id}" の next "${choice.next}" が見つかりません。`
        )
      }
      if (choice.next === key) {
        errors.push(`"${key}" の選択肢が自分自身を next に指定しています（直接循環）。`)
      }
    }
  }

  // ── 到達不可能なエントリーの検出（警告） ──────────────────────
  const reachable = new Set<string>()
  function traverse(key: string, visited: Set<string>): void {
    if (reachable.has(key) || visited.has(key)) return
    reachable.add(key)
    visited.add(key)
    const ver = deck[key]
    if (!ver) return
    for (const c of ver.choices) traverse(c.next, new Set(visited))
  }
  traverse('1.0', new Set())

  for (const key of Object.keys(deck)) {
    if (!reachable.has(key)) {
      warnings.push(`"${key}" はどこからも参照されていません（到達不可能）。`)
    }
  }

  // ── 深い循環参照の検出 ─────────────────────────────────────────
  function hasCycle(start: string): boolean {
    const visited = new Set<string>()
    const stack: string[] = [start]
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (visited.has(cur)) return true
      visited.add(cur)
      const ver = deck[cur]
      if (ver) stack.push(...ver.choices.map(c => c.next))
    }
    return false
  }
  for (const key of Object.keys(deck)) {
    // hasCycle は start を通る循環の存在確認のため、
    // choices の next から再び start に戻れるかをチェック
    const ver = deck[key]
    if (!ver) continue
    for (const c of ver.choices) {
      const pathVisited = new Set<string>()
      function canReach(from: string, target: string): boolean {
        if (from === target) return true
        if (pathVisited.has(from)) return false
        pathVisited.add(from)
        return (deck[from]?.choices ?? []).some(cc => canReach(cc.next, target))
      }
      if (canReach(c.next, key)) {
        errors.push(`循環参照を検出: "${key}" → "${c.next}" がやがて "${key}" に戻ります。`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * 開発環境でのみ検証を実行し、問題があればコンソールに出力する。
 */
export function devValidate(deck: Record<string, ManualVersion>): void {
  if (import.meta.env?.PROD) return   // 本番では実行しない

  const result = validateDeck(deck)

  for (const w of result.warnings) {
    console.warn('[ManualValidator] ⚠️', w)
  }
  for (const e of result.errors) {
    console.error('[ManualValidator] ❌', e)
  }
  if (!result.ok) {
    console.error('[ManualValidator] デッキに問題があります。上記のエラーを確認してください。')
  } else if (result.warnings.length === 0) {
    console.info('[ManualValidator] ✅ デッキの整合性チェック: 問題なし')
  }
}
