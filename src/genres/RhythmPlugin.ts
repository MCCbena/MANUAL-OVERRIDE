/**
 * genres/RhythmPlugin.ts
 * 'rhythm' ジャンル — プロセカ風リズムゲームの視覚テーマ。
 * 5レーン構成、ジャッジライン、ネオンカラーのパレットを使用。
 */

import { GenrePluginBase } from '../engine/GenrePluginBase'
import type { SpawnEntry } from '../engine/types'
import type { GenreId } from '../domain/types'

export class RhythmPlugin extends GenrePluginBase {
  readonly id: GenreId = 'rhythm'
  
  // プロセカ風カラフルテーマ
  readonly skyColors: readonly [string, string] = ['#0a0015', '#1a0030']
  readonly groundColors: readonly [string, string] = ['#0d0020', '#1a0040']
  readonly farLayerColor = '#0a0018'
  readonly midLayerColor = '#0f0025'
  readonly starColor: string | undefined = '#ff69b4' // ピンク星
  
  // プロセカ風パレット
  readonly palette = {
    danger:   '#ff1493', dangerGlow: '#ff69b4', // 鮮やかなピンク
    safe:     '#00bfff', safeGlow:   '#87cefa', // シアンブルー
  }
  
  // リズムゲームではハザードスポーンは使用しない（ノートを代わりに使用）
  readonly spawnTable: readonly SpawnEntry[] = [
    { shape: 'rect', placement: 'ground', weightStart: 0, weightEnd: 0, wRange: [0], hRange: [0] },
  ]

  // レーン数（5レーン）
  readonly laneCount = 5
  
  override drawFarLayer(_ctx: CanvasRenderingContext2D, _offsetX: number, _W: number, _gY: number): void {
    // リズムゲームでは遠景を描かない（ノートフォーカス）
  }

  override drawMidLayer(ctx: CanvasRenderingContext2D, offsetX: number, W: number, gY: number): void {
    // 背景グリッド線（リズム感演出）
    ctx.globalAlpha = 0.15
    ctx.strokeStyle = '#ff69b4'
    ctx.lineWidth = 1
    
    const spacing = 80
    const start = -(offsetX % spacing)
    
    for (let x = start; x < W; x += spacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, gY)
      ctx.stroke()
    }
    
    // ホリゾンタルライン（奥行き演出）
    for (let y = 0; y < gY; y += spacing * 2) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    
    ctx.globalAlpha = 1
  }

  override drawPlayer(_ctx: CanvasRenderingContext2D, _w: number, _h: number, _onGround: boolean, _runCycle: number): void {
    // リズムゲームではプレイヤーキャラクターを描かない（ノートが主体）
  }

  /** レーンの色を返す */
  getLaneColor(lane: number): string {
    const colors = ['#ff1493', '#00bfff', '#ffd700', '#32cd32', '#9370db']
    return colors[lane % colors.length]
  }
}

export default new RhythmPlugin()
