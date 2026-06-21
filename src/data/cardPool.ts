import type { ManualCard } from '../domain/types'

const _rawModules = import.meta.glob(
  ['./cards/*.json', '!./cards/TEMPLATE.json'],
  { eager: true },
)

export const CARD_POOL: ManualCard[] = []

for (const mod of Object.values(_rawModules)) {
  const data = mod as { cards?: ManualCard[] }
  if (Array.isArray(data.cards)) {
    CARD_POOL.push(...data.cards)
  }
}

/**
 * 重み付きランダムサンプリングで n 枚選ぶ。
 * excludeIds に含まれるカードは候補から除外する（直前の選択肢を再出現させない）。
 * splice で選出済み要素を除去することで O(n) に収める。
 */
export function sampleCards(n: number, excludeIds?: Set<string>): ManualCard[] {
  const available = excludeIds
    ? CARD_POOL.filter(c => !excludeIds.has(c.id))
    : [...CARD_POOL]

  if (available.length <= n) return [...available]

  const pool = [...available]
  const result: ManualCard[] = []

  while (result.length < n && pool.length > 0) {
    const totalWeight = pool.reduce((s, c) => s + (c.weight ?? 1), 0)
    let rand = Math.random() * totalWeight
    let idx = pool.findIndex(c => { rand -= c.weight ?? 1; return rand <= 0 })
    if (idx === -1) idx = pool.length - 1
    result.push(...pool.splice(idx, 1))
  }

  return result
}
