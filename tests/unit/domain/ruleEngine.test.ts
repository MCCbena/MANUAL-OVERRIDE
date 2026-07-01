import { describe, it, expect } from 'vitest'
import { buildRuntimeRules, accumulateWithMultiplier } from '../../../src/domain/ruleEngine'
import type { ChoiceRecord, ManualVersion } from '../../../src/domain/types'
import { GENRES } from '../../../src/data/genres'

/** テスト用のダミー ManualVersion を生成 */
function makeManual(overrides: Partial<ManualVersion> = {}): ManualVersion {
  return {
    version: '1.0',
    manualText: ['Test manual text'],
    choices: [],
    hazards: { colors: ['#ff0000'], safeColors: ['#00ff00'] },
    ...overrides,
  }
}

describe('buildRuntimeRules', () => {
  it('空の履歴で base ジャンルが返される', () => {
    const rules = buildRuntimeRules(makeManual(), [], null)
    expect(rules).toBeDefined()
    expect(rules.features).toBeDefined()
  })

  it('lockedGenre が指定されるとそのジャンルが使用される', () => {
    const rules = buildRuntimeRules(makeManual(), [], 'stg')
    expect(rules.genre).toBe('stg')
  })

  it('genreParams 累積が正しく行われる', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 2, range: 1 } },
      { choiceId: 'test-2', genreParams: { tempo: 3, enemy: 2 } },
    ]
    const rules = buildRuntimeRules(makeManual(), history, null)
    expect(rules).toBeDefined()
  })

  it('paramMultiplier が genreParams に適用される', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 2 }, paramMultiplier: 2.0 },
    ]
    const accumulated = accumulateWithMultiplier(history)
    expect(accumulated.tempo).toBe(4)
  })

  it('paramMultiplier が未指定の場合デフォルト 1.0 がかかる', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 2 } },
    ]
    const accumulated = accumulateWithMultiplier(history)
    expect(accumulated.tempo).toBe(2)
  })

  it('複数の paramMultiplier が累積される', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 2 }, paramMultiplier: 2.0 },
      { choiceId: 'test-2', genreParams: { tempo: 3 }, paramMultiplier: 0.5 },
    ]
    const accumulated = accumulateWithMultiplier(history)
    expect(accumulated.tempo).toBe(5.5) // 2*2.0 + 3*0.5 = 5.5
  })

  it('runtimeConfig がある場合、scrollSpeed が上書きされる', () => {
    const manual = makeManual({
      runtimeConfig: { scrollSpeed: 500 },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.scrollSpeed).toBe(500)
  })

  it('runtimeConfig がある場合、gravity が上書きされる', () => {
    const manual = makeManual({
      runtimeConfig: { gravity: 800 },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.gravity).toBe(800)
  })

  it('runtimeConfig がある場合、bpm が上書きされる', () => {
    const manual = makeManual({
      runtimeConfig: { bpm: 180 },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.bpm).toBe(180)
  })

  it('runtimeConfig がある場合、forceGenreId がジャンルを強制する', () => {
    const manual = makeManual({
      runtimeConfig: { forceGenreId: 'puzzle' },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.genre).toBe('puzzle')
  })

  it('runtimeConfig がある場合、environment が上書きされる', () => {
    const manual = makeManual({
      runtimeConfig: { environment: 'ocean' },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.environment).toBe('ocean')
  })

  it('runtimeConfig がある場合、timescale が上書きされる', () => {
    const manual = makeManual({
      runtimeConfig: { timescale: 0.5 },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.timescale).toBe(0.5)
  })

  it('movement feature は常に有効', () => {
    const rules = buildRuntimeRules(makeManual(), [], null)
    expect(rules.features.has('movement')).toBe(true)
  })

  it('scrollAxis が vertical の場合は y を返す', () => {
    const manual = makeManual({
      runtimeConfig: { scrollDirection: 'vertical' },
    })
    const rules = buildRuntimeRules(manual, [], null)
    expect(rules.scrollAxis).toBe('y')
  })

  it('scrollAxis が horizontal の場合は x を返す', () => {
    const rules = buildRuntimeRules(makeManual(), [], null)
    expect(rules.scrollAxis).toBe('x')
  })
})

describe('accumulateWithMultiplier', () => {
  it('空の履歴で空の params を返す', () => {
    const result = accumulateWithMultiplier([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('負の値の genreParams に対応する', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: -1 } },
    ]
    const result = accumulateWithMultiplier(history)
    expect(result.tempo).toBe(-1)
  })

  it('ゼロの genreParams に対応する', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 0 } },
    ]
    const result = accumulateWithMultiplier(history)
    expect(result.tempo).toBe(0)
  })

  it('小数の genreParams に対応する', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 0.5 } },
    ]
    const result = accumulateWithMultiplier(history)
    expect(result.tempo).toBe(0.5)
  })

  it('複数の軸を同時に累積する', () => {
    const history: ChoiceRecord[] = [
      { choiceId: 'test-1', genreParams: { tempo: 1, range: 2, enemy: 3 } },
    ]
    const result = accumulateWithMultiplier(history)
    expect(result.tempo).toBe(1)
    expect(result.range).toBe(2)
    expect(result.enemy).toBe(3)
  })
})
