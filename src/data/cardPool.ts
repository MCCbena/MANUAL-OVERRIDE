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
 */
export function sampleCards(n: number, excludeIds?: Set<string>): ManualCard[] {
  const available = excludeIds
    ? CARD_POOL.filter(c => !excludeIds.has(c.id))
    : [...CARD_POOL]

  if (available.length <= n) return [...available]

  const result: ManualCard[] = []
  const used = new Set<string>()

  while (result.length < n) {
    const pool = available.filter(c => !used.has(c.id))
    if (pool.length === 0) break

    const totalWeight = pool.reduce((s, c) => s + (c.weight ?? 1), 0)
    let rand = Math.random() * totalWeight

    for (const card of pool) {
      rand -= card.weight ?? 1
      if (rand <= 0) {
        result.push(card)
        used.add(card.id)
        break
      }
    }
  }

  return result
}
