import { describe, it, expect } from 'vitest'
import { evalScoreFormula, calcThrowScore, calcFinalScore, getLastFormulaError } from '../../../src/domain/scoreCalc'
import type { ThrowResult, ScoreVars } from '../../../src/domain/types'

const emptyVars: ScoreVars = {
  distance: 0, kills: 0, combo: 0, exp: 0, beatHits: 0,
  survivedSec: 0, accuracy: 0, maxCombo: 0, deaths: 0,
  itemsCollected: 0, bossKills: 0, stealthBonus: 0, colorTouches: 0,
  colorTouchMisses: 0,
}

describe('evalScoreFormula', () => {
  it('基本的な計算式を評価する', () => {
    const vars: ScoreVars = { ...emptyVars, distance: 1000, kills: 5, survivedSec: 10 }
    const result = evalScoreFormula('distance * 0.5 + kills * 100', vars)
    expect(result).toBe(1000) // 1000 * 0.5 + 5 * 100 = 500 + 500 = 1000
  })

  it('変数が未定義の場合 0 を返す', () => {
    const result = evalScoreFormula('unknownVar * 100', emptyVars)
    expect(result).toBe(0)
  })

  it('括弧を含む式を評価する', () => {
    const vars: ScoreVars = { ...emptyVars, distance: 100, kills: 10, survivedSec: 5 }
    const result = evalScoreFormula('(kills + 5) * 50', vars)
    expect(result).toBe(750) // (10 + 5) * 50 = 750
  })

  it('負の値を返す式は max(0, ...) で補正される', () => {
    const result = evalScoreFormula('distance * -100', emptyVars)
    // Math.max(0, -0) → 0 (ただし -0 !== 0 に注意)
    expect(result === 0 || Object.is(result, 0)).toBe(true)
  })

  it('不正な式はデフォルト式で代替する', () => {
    const vars: ScoreVars = { ...emptyVars, distance: 100 }
    const result = evalScoreFormula('eval("bad")', vars)
    // 不正な式 → デフォルト式 'distance * 0.5 + kills * 100' で評価
    expect(result).toBe(50) // 100 * 0.5 + 0 * 100 = 50
  })

  it(' getLastFormulaError はエラー後にメッセージを返す', () => {
    evalScoreFormula('eval("bad")', emptyVars)
    const error = getLastFormulaError()
    expect(error).toBeTruthy()
    expect(error).toContain('不正なスコア式')
  })

  it(' getLastFormulaError は取り出し後に null になる', () => {
    evalScoreFormula('eval("bad")', emptyVars)
    getLastFormulaError() // 取り出し
    expect(getLastFormulaError()).toBeNull()
  })

  it('colorTouchMisses 変数を含む式を評価する', () => {
    const vars: ScoreVars = {
      ...emptyVars, distance: 500, kills: 3, survivedSec: 10,
      accuracy: 0.8, itemsCollected: 1, colorTouches: 5, colorTouchMisses: 2,
    }
    const result = evalScoreFormula('distance * 0.5 + kills * 100 - colorTouchMisses * 50', vars)
    expect(result).toBe(450) // 250 + 300 - 100 = 450
  })

  it('division by zero で 0 を返す', () => {
    const result = evalScoreFormula('distance / 0', emptyVars)
    expect(result).toBe(0)
  })

  it('複雑な式を評価する', () => {
    const vars: ScoreVars = {
      ...emptyVars, distance: 2000, kills: 10, combo: 5, exp: 100, beatHits: 8,
      survivedSec: 30, accuracy: 0.9, maxCombo: 5, deaths: 1,
      itemsCollected: 3, bossKills: 1, stealthBonus: 50, colorTouches: 10, colorTouchMisses: 1,
    }
    const result = evalScoreFormula(
      'distance * 0.5 + kills * 100 + combo * 50 + exp * 0.1 + beatHits * 30',
      vars,
    )
    // 1000 + 1000 + 250 + 10 + 240 = 2500
    expect(result).toBe(2500)
  })
})

describe('calcThrowScore', () => {
  it('基本的な投擲スコアを計算する', () => {
    const result: ThrowResult = { airTime: 2, arcHeight: 300, speed: 500 }
    const score = calcThrowScore(result)
    // airTime: 2 * 1000 * 0.5 = 1000
    // arcHeight: 300 * 0.4 = 120
    // speedPenalty: max(0, 500 - 800) * 0.1 = 0
    expect(score).toBe(1120)
  })

  it('速度ペナルティが適用される', () => {
    const result: ThrowResult = { airTime: 1, arcHeight: 100, speed: 1000 }
    const score = calcThrowScore(result)
    // airTime: 1 * 1000 * 0.5 = 500
    // arcHeight: 100 * 0.4 = 40
    // speedPenalty: (1000 - 800) * 0.1 = 20
    expect(score).toBe(520)
  })

  it('スコアが負にならない', () => {
    const result: ThrowResult = { airTime: 0, arcHeight: 0, speed: 2000 }
    const score = calcThrowScore(result)
    // airTime: 0
    // arcHeight: 0
    // speedPenalty: (2000 - 800) * 0.1 = 120
    // max(0, 0 + 0 - 120) = 0
    expect(score).toBe(0)
  })

  it('滞空時間が長いほど高スコア', () => {
    const base: ThrowResult = { airTime: 1, arcHeight: 100, speed: 500 }
    const longer: ThrowResult = { airTime: 3, arcHeight: 100, speed: 500 }
    expect(calcThrowScore(longer)).toBeGreaterThan(calcThrowScore(base))
  })

  it('弧が高いほど高スコア', () => {
    const low: ThrowResult = { airTime: 1, arcHeight: 50, speed: 500 }
    const high: ThrowResult = { airTime: 1, arcHeight: 500, speed: 500 }
    expect(calcThrowScore(high)).toBeGreaterThan(calcThrowScore(low))
  })
})

describe('calcFinalScore', () => {
  it('最終スコアを計算する', () => {
    const result = calcFinalScore(1000, 500)
    // play: 1000 * 0.7 = 700
    // throw: 500 * 0.3 = 150
    // total: 850
    expect(result.play).toBe(700)
    expect(result.throw).toBe(150)
    expect(result.total).toBe(850)
  })

  it('0点の場合', () => {
    const result = calcFinalScore(0, 0)
    expect(result.total).toBe(0)
  })

  it('投擲スコアが大きい場合', () => {
    const result = calcFinalScore(100, 2000)
    // play: 100 * 0.7 = 70, throw: 2000 * 0.3 = 600, total: 670
    expect(result.total).toBe(670)
  })
})
