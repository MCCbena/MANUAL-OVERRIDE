import { describe, it, expect } from 'vitest'
import { Player, Hazard, Bullet, Item, rectsOverlap } from '../../../src/game/entities'

describe('Player', () => {
  it('rect が正しい位置を返す', () => {
    const player = new Player(100, 400)
    const rect = player.rect
    expect(rect.x).toBe(100)
    expect(rect.y).toBe(400 - player.h)
    expect(rect.w).toBe(player.w)
    expect(rect.h).toBe(player.h)
  })

  it('初期 colorTouchMisses は未定義（SideScroller で管理）', () => {
    const player = new Player(100, 400)
    expect((player as unknown as Record<string, unknown>).colorTouchMisses).toBeUndefined()
  })

  it('初期 hp が 3', () => {
    const player = new Player(100, 400)
    expect(player.hp).toBe(3)
  })

  it('初期 maxHp が 3', () => {
    const player = new Player(100, 400)
    expect(player.maxHp).toBe(3)
  })

  it('初期 jumpsLeft が 1', () => {
    const player = new Player(100, 400)
    expect(player.jumpsLeft).toBe(1)
  })

  it('初期 onGround が false', () => {
    const player = new Player(100, 400)
    expect(player.onGround).toBe(false)
  })

  it('初期 invincible が 0', () => {
    const player = new Player(100, 400)
    expect(player.invincible).toBe(0)
  })
})

describe('Hazard', () => {
  it('isSafe が false の hazard を作成できる', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666', 'rect', 1, false)
    expect(h.isSafe).toBe(false)
  })

  it('isSafe が true の hazard を作成できる', () => {
    const h = new Hazard(100, 200, 30, 30, '#00ff00', '#66ff66', 'rect', 1, true)
    expect(h.isSafe).toBe(true)
  })

  it('デフォルト形状は rect', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666')
    expect(h.shape).toBe('rect')
  })

  it('デフォルト hp は 1', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666')
    expect(h.hp).toBe(1)
    expect(h.maxHp).toBe(1)
  })

  it('hp を設定できる', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666', 'rect', 5)
    expect(h.hp).toBe(5)
    expect(h.maxHp).toBe(5)
  })

  it('floatAmp が 0 の場合 rect は float しない', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666', 'rect', 1, false, 0)
    const rect = h.rect
    expect(rect.y).toBe(200)
  })

  it('floatAmp が positive で pulse=PI/2 の場合 rect が下方に移動する', () => {
    const h = new Hazard(100, 200, 30, 30, '#ff0000', '#ff6666', 'rect', 1, false, 10)
    h.pulse = Math.PI / 2 // sin(PI/2) = 1
    const rect = h.rect
    expect(rect.y).toBe(210) // y + floatAmp * sin(pulse) = 200 + 10
  })
})

describe('Bullet', () => {
  it('初期状態で alive が true', () => {
    const b = new Bullet(100, 200, 500, 0)
    expect(b.alive).toBe(true)
  })

  it('速度が正しく設定される', () => {
    const b = new Bullet(100, 200, 500, -300)
    expect(b.vx).toBe(500)
    expect(b.vy).toBe(-300)
  })

  it('rect が正しい', () => {
    const b = new Bullet(100, 200, 500, 0)
    const rect = b.rect
    expect(rect.x).toBe(100)
    expect(rect.y).toBe(200)
    expect(rect.w).toBe(b.w)
    expect(rect.h).toBe(b.h)
  })
})

describe('Item', () => {
  it('exp タイプを作成できる', () => {
    const item = new Item(100, 200, 'exp')
    expect(item.type).toBe('exp')
    expect(item.alive).toBe(true)
  })

  it('hp タイプを作成できる', () => {
    const item = new Item(100, 200, 'hp')
    expect(item.type).toBe('hp')
  })

  it('pulse はランダム', () => {
    const item = new Item(100, 200, 'exp')
    expect(item.pulse).toBeGreaterThanOrEqual(0)
    expect(item.pulse).toBeLessThan(Math.PI * 2)
  })
})

describe('rectsOverlap', () => {
  it('重なっている矩形は true を返す', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    const b = { x: 5, y: 5, w: 10, h: 10 }
    expect(rectsOverlap(a, b)).toBe(true)
  })

  it('重なっていない矩形は false を返す', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    const b = { x: 20, y: 20, w: 10, h: 10 }
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('接している矩形は grace により true になる場合がある', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    const b = { x: 10, y: 0, w: 10, h: 10 }
    // grace=4 なので、a の右辺は 4, b の左辺は 14-4=10 → 重ならない
    // ただし grace が小さい場合でも接している場合は false
    expect(rectsOverlap(a, b)).toBe(false)
  })

  it('含んでいる矩形は true を返す', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }
    const b = { x: 25, y: 25, w: 50, h: 50 }
    expect(rectsOverlap(a, b)).toBe(true)
  })
})
