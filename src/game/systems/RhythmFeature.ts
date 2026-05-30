/**
 * game/systems/RhythmFeature.ts
 * 'beat_hazard', 'just_input', 'beat_dash' Feature を担当するシステム。
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

    if (!r.features.has('just_input')) return

    const jumpKey  = r.controls.jump
    const shootKey = r.controls.shoot ?? 'z'
    if (input.justPressed.has(jumpKey) || input.justPressed.has(shootKey)) {
      const quality = evaluateTiming(this.state, performance.now())
      if (quality > 0.5) {
        const bonus = Math.round(150 * quality)
        this.state.beatHits++
        world.addScore(bonus)
        const p = world.player
        world.addScorePopup(p.x + p.w, p.y - 30, `JUST! +${bonus}`, '#ff00ff')
        world.addParticle(p.x + p.w / 2, p.y, 0, -80, 0.4, '#ff00ff', 4)
      }
    }
  }

  isBeatInverted(): boolean { return this.state.beatHazardInverted }
  getBeatHits(): number     { return this.state.beatHits }
  getBeatMarkers() { return this.state.beatMarkers }
}
