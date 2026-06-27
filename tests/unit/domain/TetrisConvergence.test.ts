import { describe, it, expect } from 'vitest'
import {
  accumulateGenrePoints,
  resolveGenre,
} from '../../../src/domain/genreResolver'
import GENRES_DATA from '../../../src/data/config/genres.json'
const GENRES = GENRES_DATA.genres

describe('Tetris 収束テスト', () => {
  // tetris-cards.json の genrePoints
  const tetrisCards = [
    { id: 'c-tetris-blocks', genrePoints: { tetris: 4 } },
    { id: 'c-tetris-rotation', genrePoints: { tetris: 3 } },
    { id: 'c-tetris-speed', genrePoints: { tetris: 2 } },
    { id: 'c-tetris-preview', genrePoints: { tetris: 2 } },
    { id: 'c-craft-stack', genrePoints: { tetris: 1, idle: 1 } },
    { id: 'c-combo-clear', genrePoints: { tetris: 2, puzzle: 1 } },
  ]

  it('tetris カードをすべて選択すると tetris に収束する', () => {
    const points = accumulateGenrePoints(tetrisCards)

    expect(points.tetris).toBe(14)

    const genre = resolveGenre({}, GENRES, points, tetrisCards.map(c => c.id))
    expect(genre).toBe('tetris')
  })

  it('threshold を満たさなければ base のまま', () => {
    // tetris ポイント 13 だと threshold 14 を満たさない
    const points = { tetris: 13 }
    const genre = resolveGenre({}, GENRES, points)
    expect(genre).toBe('base')
  })

  it('threshold を刚好満たすと tetris に収束する', () => {
    // tetris ポイント 14 だと刚好 threshold を満たす
    const points = { tetris: 14 }
    const genre = resolveGenre({}, GENRES, points)
    expect(genre).toBe('tetris')
  })

  it('他のジャンルと競合しても tetris が勝つ', () => {
    // tetris ポイント 14 は threshold 14 を満たす
    // puzzle ポイント 1 は threshold を満たさない
    const points = { tetris: 14, puzzle: 1 }
    const genre = resolveGenre({}, GENRES, points)
    expect(genre).toBe('tetris')
  })
})
