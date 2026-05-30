import type { ScoreVars, ThrowResult, FinalScore } from './types'
import { SCORE_RATIO, THROW_SCORE_WEIGHTS } from '../data/gameBalance'

// ──────────────────────────────────────────────────────────────────────
// 安全なスコア式パーサ
// 許可: 数値リテラル, 変数名(英数字_), 演算子(+-*/), 括弧, 空白
// 禁止: eval, Function, 関数呼び出し, その他全て
// ──────────────────────────────────────────────────────────────────────
const SAFE_PATTERN = /^[\d\s+\-*/().a-z_]+$/i

export function evalScoreFormula(formula: string, vars: ScoreVars): number {
  if (!SAFE_PATTERN.test(formula)) {
    console.warn('[scoreCalc] invalid formula:', formula)
    return 0
  }
  // Function ではなく手書きパーサで評価（eval 禁止）
  try {
    return parseExpr(formula.trim(), vars)
  } catch {
    return 0
  }
}

// ──────────────────────────────────────────────────────────────────────
// 式パーサ（四則演算 + 括弧 + 変数）
// ──────────────────────────────────────────────────────────────────────
function parseExpr(src: string, vars: ScoreVars): number {
  let pos = 0

  const peek = () => src[pos]
  const consume = () => src[pos++]
  const skipSpace = () => { while (src[pos] === ' ') pos++ }

  function parseAddSub(): number {
    let left = parseMulDiv()
    skipSpace()
    while (peek() === '+' || peek() === '-') {
      const op = consume()
      const right = parseMulDiv()
      left = op === '+' ? left + right : left - right
      skipSpace()
    }
    return left
  }

  function parseMulDiv(): number {
    let left = parseUnary()
    skipSpace()
    while (peek() === '*' || peek() === '/') {
      const op = consume()
      const right = parseUnary()
      left = op === '*' ? left * right : right !== 0 ? left / right : 0
      skipSpace()
    }
    return left
  }

  function parseUnary(): number {
    skipSpace()
    if (peek() === '-') { consume(); return -parsePrimary() }
    return parsePrimary()
  }

  function parsePrimary(): number {
    skipSpace()
    if (peek() === '(') {
      consume()
      const val = parseAddSub()
      skipSpace()
      if (peek() === ')') consume()
      return val
    }
    if (/\d/.test(peek() ?? '')) return parseNumber()
    if (/[a-z_]/i.test(peek() ?? '')) return parseVar()
    return 0
  }

  function parseNumber(): number {
    let s = ''
    while (/[\d.]/.test(peek() ?? '')) s += consume()
    return parseFloat(s)
  }

  function parseVar(): number {
    let name = ''
    while (/[a-z0-9_]/i.test(peek() ?? '')) name += consume()
    return (vars as unknown as Record<string, number>)[name] ?? 0
  }

  return parseAddSub()
}

// ──────────────────────────────────────────────────────────────────────
// 投擲スコア計算
// ──────────────────────────────────────────────────────────────────────
export function calcThrowScore(result: ThrowResult): number {
  const w = THROW_SCORE_WEIGHTS
  const airScore = result.airTime * 1000 * w.airTime
  const arcScore = result.arcHeight * w.arcHeight
  const speedPenalty = Math.max(0, result.speed - 800) * w.speedPenalty
  return Math.max(0, airScore + arcScore - speedPenalty)
}

// ──────────────────────────────────────────────────────────────────────
// 最終スコア合算
// ──────────────────────────────────────────────────────────────────────
export function calcFinalScore(playScore: number, throwScore: number): FinalScore {
  const play = Math.round(playScore * SCORE_RATIO.play)
  const thr  = Math.round(throwScore * SCORE_RATIO.throw)
  return { play, throw: thr, total: play + thr }
}
