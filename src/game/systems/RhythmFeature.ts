/**
 * game/systems/RhythmFeature.ts
 * 'beat_hazard', 'just_input', 'beat_dash' Feature を担当。
 *
 * 変更点（framework強化）:
 * - beatHits/beatHazardInverted を world 経由で GameStats に書き込む
 * - ビートマーカーの描画を render() に移し sideScroller から分離
 * - onManualUpdated で BPM 変更時に内部状態をリセット
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'
import { createRhythmState, updateRhythm, evaluateTiming } from './rhythmSystem'
import type { RhythmState } from './rhythmSystem'

export class RhythmFeature implements FeatureSystem {
  readonly handles = ['beat_hazard', 'just_input', 'beat_dash'] as const

  private state: RhythmState

  constructor(bpm = 120) {
    this.state = createRhythmState(bpm)
  }

  onInit(world: MutableWorld): void {
    this.state = createRhythmState(world.rules.bpm)
  }

  update(world: MutableWorld, input: InputSnapshot, dt: number): void {
    const r = world.rules
    updateRhythm(this.state, dt, r, r.hazardColors, r.safeColors)

    // 反転フラグを GameStats に同期（衝突判定で参照される）
    world.setBeatHazardInverted(this.state.beatHazardInverted)

    if (!r.features.has('just_input')) return

    const jumpKey  = r.controls.jump
    const shootKey = r.controls.shoot ?? 'z'
    if (input.justPressed.has(jumpKey) || input.justPressed.has(shootKey)) {
      const quality = evaluateTiming(this.state, performance.now())
      if (quality > 0.5) {
        const bonus = Math.round(150 * quality)
        this.state.beatHits++
        world.addBeatHit()
        world.addScore(bonus)
        const p = world.player
        world.addScorePopup(p.x + p.w, p.y - 30, `JUST! +${bonus}`, '#ff00ff')
        world.addParticle(p.x + p.w / 2, p.y, 0, -80, 0.4, '#ff00ff', 4)
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, world: MutableWorld): void {
    if (!world.rules.features.has('beat_hazard')) return
    if (this.state.beatMarkers.length === 0) return

    const gY = world.canvas.height - 80

    ctx.save()
    for (const m of this.state.beatMarkers) {
      const alpha = (m.t / 400) * 0.3
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(m.x, 0)
      ctx.lineTo(m.x, gY)
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.restore()
  }

  onManualUpdated(world: MutableWorld): void {
    this.state = createRhythmState(world.rules.bpm)
  }
}
