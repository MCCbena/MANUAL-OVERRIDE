import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputManager } from '../../../src/game/InputManager'

describe('InputManager - Stat Tracking Bug Fixes', () => {
  let inputManager: InputManager

  beforeEach(() => {
    inputManager = new InputManager()
  })

  it('初期状態ではキーが押されていない', () => {
    expect(inputManager.keys.has('ArrowRight')).toBe(false)
    expect(inputManager.keys.has('ArrowLeft')).toBe(false)
    expect(inputManager.keys.has('ArrowUp')).toBe(false)
    expect(inputManager.keys.has('ArrowDown')).toBe(false)
  })

  it('キーを押すと keys に追加される', () => {
    inputManager.keys.add('ArrowRight')
    expect(inputManager.keys.has('ArrowRight')).toBe(true)
  })

  it('キーを離すと keys から削除される', () => {
    inputManager.keys.add('ArrowRight')
    inputManager.keys.delete('ArrowRight')
    expect(inputManager.keys.has('ArrowRight')).toBe(false)
  })

  it('justPressed は tick() 後にクリアされる', () => {
    inputManager.keys.add('ArrowRight')
    inputManager.tick()
    expect(inputManager.justPressed.has('ArrowRight')).toBe(true)
    
    inputManager.tick()
    expect(inputManager.justPressed.has('ArrowRight')).toBe(false)
  })

  it('justReleased はキーを離したフレームで設定される', () => {
    inputManager.keys.add('ArrowRight')
    inputManager.tick()
    inputManager.keys.delete('ArrowRight')
    inputManager.tick()
    expect(inputManager.justReleased.has('ArrowRight')).toBe(true)
  })

  it('snapshot() は現在の入力状態を返す', () => {
    inputManager.keys.add('ArrowRight')
    const snapshot = inputManager.snapshot()
    expect(snapshot.keys.has('ArrowRight')).toBe(true)
    expect(snapshot.justPressed).toBe(inputManager.justPressed)
    expect(snapshot.justReleased).toBe(inputManager.justReleased)
  })

  it('dispose() でイベントリスナーが解除される', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    inputManager.dispose()
    expect(removeEventListener).toHaveBeenCalledTimes(2)
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function))
  })
})
