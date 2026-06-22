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
import { RHYTHM_TUNING, UI, BACKGROUND } from '../../data/tunables'

export class RhythmFeature implements FeatureSystem {
  readonly handles = ['beat_hazard', 'just_input', 'beat_dash'] as const

  private state: RhythmState

  constructor(bpm = RHYTHM_TUNING.defaultBpm) {
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
      if (quality > RHYTHM_TUNING.justInputMinQuality) {
        const bonus = Math.round(RHYTHM_TUNING.justInputScoreBase * quality)
        this.state.beatHits++
        world.addBeatHit()
        world.addScore(bonus)
        const p = world.player
        world.addScorePopup(p.x + p.w, p.y + RHYTHM_TUNING.justInputPopupOffsetY, `JUST! +${bonus}`, '#ff00ff')
        world.addParticle(p.x + p.w / 2, p.y, 0, RHYTHM_TUNING.justInputParticleVy, RHYTHM_TUNING.justInputParticleLife, '#ff00ff', RHYTHM_TUNING.justInputParticleSize)
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, world: MutableWorld): void {
    if (!world.rules.features.has('beat_hazard')) return
    if (this.state.beatMarkers.length === 0) return

    const gY = world.canvas.height - BACKGROUND.groundHeight

    ctx.save()
    for (const m of this.state.beatMarkers) {
      const alpha = (m.t / UI.beatMarkerAlphaDivisor) * UI.beatMarkerMaxAlpha
      ctx.globalAlpha = alpha
      ctx.strokeStyle = UI.beatMarkerColor
      ctx.lineWidth = UI.beatMarkerLineW
      ctx.setLineDash(UI.beatMarkerDash)
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
