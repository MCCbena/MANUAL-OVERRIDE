/**
 * game/systems/ShootFeature.ts
 * 'shoot', 'three_way', 'enemy_hp' Feature を担当するシステム。
 * 既存の shootSystem.ts のロジックを FeatureSystem インターフェースで包む。
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'
import { createShootState, updateShoot } from './shootSystem'
import type { ShootState } from './shootSystem'

export class ShootFeature implements FeatureSystem {
  readonly handles = ['shoot', 'three_way', 'enemy_hp'] as const

  private state: ShootState = createShootState()

  onInit(): void {
    this.state = createShootState()
  }

  update(world: MutableWorld, input: InputSnapshot, dt: number): void {
    const p = world.player
    const shootKey = world.rules.controls.shoot ?? 'z'
    const shootJust = input.justPressed.has(shootKey)

    const scoreGain = updateShoot(
      this.state,
      world.hazards,
      shootJust,
      p.x, p.y, p.h,
      world.rules,
      dt,
    )

    if (scoreGain > 0) {
      world.addScore(scoreGain)
      world.addScorePopup(p.x + p.w + 4, p.y - 18, `+${scoreGain}`, '#ffdd00')
    }

    // bullets を world.bullets に同期（読み取り専用なので cast）
    ;(world.bullets as typeof this.state.bullets).length = 0
    ;(world.bullets as typeof this.state.bullets).push(...this.state.bullets)
  }

  getKills(): number { return this.state.kills }
  getCombo(): number { return this.state.combo }
}
