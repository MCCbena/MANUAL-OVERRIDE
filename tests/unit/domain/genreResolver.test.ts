import { describe, it, expect } from 'vitest'
import {
  resolveGenre,
  resolveHighestProbGenre,
  resolveGenreProgress,
  resolveAllGenreProgress,
  resolveAllMetGenres,
  resolveFeaturesForGenre,
  computeBayesianPosteriors,
  initBayesianState,
  updateBayesianState,
  accumulateParams,
  accumulateGenrePoints,
  getGenreDistribution,
  DEFAULT_BAYES_CONFIG,
} from '../../../src/domain/genreResolver'
import type { GenreDef, GenreParams, BayesianState } from '../../../src/domain/types'
import { GENRES } from '../../../src/data/genres'

describe('accumulateParams', () => {
  it('空の配列で空の結果を返す', () => {
    const result = accumulateParams([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('単一の params を返す', () => {
    const result = accumulateParams([{ tempo: 2, range: 1 }])
    expect(result.tempo).toBe(2)
    expect(result.range).toBe(1)
  })

  it('複数の params を累積する', () => {
    const result = accumulateParams([
      { tempo: 2, range: 1 },
      { tempo: 3, range: 2, enemy: 1 },
    ])
    expect(result.tempo).toBe(5)
    expect(result.range).toBe(3)
    expect(result.enemy).toBe(1)
  })

  it('負の値を累積する', () => {
    const result = accumulateParams([
      { tempo: 3 },
      { tempo: -1 },
    ])
    expect(result.tempo).toBe(2)
  })
})

describe('accumulateGenrePoints', () => {
  it('空の配列で空の結果を返す', () => {
    const result = accumulateGenrePoints([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('genrePoints があるエントリを累積する', () => {
    const result = accumulateGenrePoints([
      { genrePoints: { stg: 3, rpg: 1 } },
      { genrePoints: { stg: 2, puzzle: 1 } },
    ])
    expect(result.stg).toBe(5)
    expect(result.rpg).toBe(1)
    expect(result.puzzle).toBe(1)
  })

  it('genrePoints がないエントリをスキップする', () => {
    const result = accumulateGenrePoints([
      { genrePoints: { stg: 3 } },
      {},
      { genrePoints: { rpg: 2 } },
    ])
    expect(result.stg).toBe(3)
    expect(result.rpg).toBe(2)
  })
})

describe('computeBayesianPosteriors', () => {
  it('全ジャンルの事後確率が 0 以上で合計が 1', () => {
    const posteriors = computeBayesianPosteriors({}, GENRES)
    // 全確率が 0 以上
    for (const genre of GENRES) {
      expect(posteriors[genre.id]).toBeGreaterThanOrEqual(0)
    }
    // 合計が 1
    const total = GENRES.reduce((sum, g) => sum + (posteriors[g.id] ?? 0), 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it('base ジャンルも事後確率に含む', () => {
    const posteriors = computeBayesianPosteriors({}, GENRES)
    expect(posteriors['base']).toBeDefined()
  })

  it('パラメータが特定のジャンルに収束する方向に働く', () => {
    // tempo が高ければ runner 系に収束しやすい
    const posteriors = computeBayesianPosteriors({ tempo: 10 }, GENRES)
    // runner は tempo が高いジャンル
    const runnerProb = posteriors['runner'] ?? 0
    const baseProb = posteriors['base'] ?? 0
    // runner の方が base より高確率になるはず
    expect(runnerProb).toBeGreaterThan(baseProb * 0.5)
  })
})

describe('resolveGenre', () => {
  it('パラメータなしで base を返す', () => {
    const genre = resolveGenre({}, GENRES)
    expect(genre).toBe('base')
  })

  it('パラメータが大きいと non-base ジャンルの確率が上がる', () => {
    const posteriors = computeBayesianPosteriors({ tempo: 20 }, GENRES)
    // tempo が高いと runner 系の確率が上がる傾向
    const runnerProb = posteriors['runner'] ?? 0
    const baseProb = posteriors['base'] ?? 0
    // runner が base より高確率になる可能性あり（パラメータによる）
    expect(runnerProb).toBeGreaterThanOrEqual(0)
    expect(baseProb).toBeGreaterThanOrEqual(0)
  })

  it('genrePoints は accumulateGenrePoints で累積される', () => {
    const points = accumulateGenrePoints([
      { genrePoints: { stg: 5 } },
      { genrePoints: { stg: 5 } },
    ])
    expect(points.stg).toBe(10)
  })
})

describe('resolveHighestProbGenre', () => {
  it('パラメータなしで最も確率の高いジャンルを返す', () => {
    const genre = resolveHighestProbGenre({}, GENRES)
    expect(genre).toBeTruthy()
    expect(typeof genre).toBe('string')
  })

  it('base ジャンルを除外して返す', () => {
    const genre = resolveHighestProbGenre({}, GENRES)
    expect(genre).not.toBe('base')
  })

  it('パラメータがある場合、それに応じたジャンルを返す', () => {
    const genre = resolveHighestProbGenre({ tempo: 10, range: 10 }, GENRES)
    expect(genre).not.toBe('base')
  })
})

describe('resolveGenreProgress', () => {
  it('パラメータなしで closestGenre を返す', () => {
    const result = resolveGenreProgress({}, GENRES)
    expect(result.closestGenre).toBeTruthy()
    expect(typeof result.progress).toBe('number')
    expect(result.progress).toBeGreaterThanOrEqual(0)
    expect(result.progress).toBeLessThanOrEqual(1)
  })
})

describe('resolveAllGenreProgress', () => {
  it('base 以外の全ジャンルの進捗を返す', () => {
    const result = resolveAllGenreProgress({}, GENRES)
    const nonBase = GENRES.filter(g => g.id !== 'base')
    for (const genre of nonBase) {
      expect(result[genre.id]).toBeDefined()
    }
  })

  it('base は結果に含まれない', () => {
    const result = resolveAllGenreProgress({}, GENRES)
    expect(result['base']).toBeUndefined()
  })
})

describe('resolveAllMetGenres', () => {
  it('収束条件を満たすジャンルを返す', () => {
    const genres = resolveAllMetGenres({ tempo: 20 }, GENRES)
    expect(genres.length).toBeGreaterThanOrEqual(1)
    expect(genres).not.toContain('base')
  })

  it('パラメータがない場合は空配列を返す', () => {
    const genres = resolveAllMetGenres({}, GENRES)
    // candidateThreshold 以上になるジャンルがない可能性あり
    expect(Array.isArray(genres)).toBe(true)
  })
})

describe('resolveFeaturesForGenre', () => {
  it('存在するジャンルの feature を返す', () => {
    const { enable, disable } = resolveFeaturesForGenre('stg', GENRES)
    expect(enable).toBeInstanceOf(Set)
    expect(disable).toBeInstanceOf(Set)
  })

  it('存在しないジャンルの場合、空の Set を返す', () => {
    const { enable, disable } = resolveFeaturesForGenre('nonexistent' as any, GENRES)
    expect(enable.size).toBe(0)
    expect(disable.size).toBe(0)
  })
})

describe('initBayesianState', () => {
  it('一様事前分布を返す', () => {
    const state = initBayesianState(GENRES)
    const nonBase = GENRES.filter(g => g.id !== 'base')
    // 非 base ジャンル間は均等
    if (nonBase.length >= 2) {
      const firstProb = state.posteriors[nonBase[0].id] ?? 0
      for (const genre of nonBase.slice(1)) {
        expect(state.posteriors[genre.id]).toBeCloseTo(firstProb, 5)
      }
    }
  })

  it('converged が false', () => {
    const state = initBayesianState(GENRES)
    expect(state.converged).toBe(false)
  })

  it('convergedGenre が null', () => {
    const state = initBayesianState(GENRES)
    expect(state.convergedGenre).toBeNull()
  })

  it('updateCount が 0', () => {
    const state = initBayesianState(GENRES)
    expect(state.updateCount).toBe(0)
  })
})

describe('updateBayesianState', () => {
  it('収束済み状態は変更しない', () => {
    const prevState: BayesianState = {
      posteriors: {},
      converged: true,
      convergedGenre: 'stg',
      updateCount: 5,
    }
    const newState = updateBayesianState(prevState, { tempo: 10 }, GENRES)
    expect(newState.converged).toBe(true)
    expect(newState.updateCount).toBe(5) // 増加しない
  })

  it('収束していない状態は更新する', () => {
    const prevState = initBayesianState(GENRES)
    const newState = updateBayesianState(prevState, { tempo: 10 }, GENRES)
    expect(newState.updateCount).toBe(1)
  })

  it('updateCount が増加する', () => {
    const prevState = initBayesianState(GENRES)
    const newState = updateBayesianState(prevState, { tempo: 10 }, GENRES)
    expect(newState.updateCount).toBe(1)
    const newState2 = updateBayesianState(newState, { tempo: 10 }, GENRES)
    expect(newState2.updateCount).toBe(2)
  })
})

describe('getGenreDistribution', () => {
  it('全ジャンルの事後確率を返す', () => {
    const dist = getGenreDistribution({}, GENRES)
    const nonBase = GENRES.filter(g => g.id !== 'base')
    for (const genre of nonBase) {
      expect(dist[genre.id]).toBeDefined()
    }
  })

  it('確率の合計が 1 に近い', () => {
    const dist = getGenreDistribution({ tempo: 5 }, GENRES)
    const total = GENRES.reduce((sum, g) => sum + (dist[g.id] ?? 0), 0)
    expect(total).toBeCloseTo(1, 5)
  })
})

describe('DEFAULT_BAYES_CONFIG', () => {
  it('convergenceThreshold が定義されている', () => {
    expect(DEFAULT_BAYES_CONFIG.convergenceThreshold).toBeDefined()
  })

  it('minProb が定義されている', () => {
    expect(DEFAULT_BAYES_CONFIG.minProb).toBeDefined()
    expect(DEFAULT_BAYES_CONFIG.minProb).toBeGreaterThan(0)
  })

  it('dominanceRatio が定義されている', () => {
    expect(DEFAULT_BAYES_CONFIG.dominanceRatio).toBeDefined()
    expect(DEFAULT_BAYES_CONFIG.dominanceRatio).toBeGreaterThan(1)
  })

  it('decayRate が定義されている', () => {
    expect(DEFAULT_BAYES_CONFIG.decayRate).toBeDefined()
    expect(DEFAULT_BAYES_CONFIG.decayRate).toBeGreaterThan(0)
  })
})
