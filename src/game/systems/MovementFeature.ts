/**
 * game/systems/MovementFeature.ts
 * 'auto_run', 'slow_precise', 'double_jump', 'long_air' Feature を担当。
 * sideScroller.ts のインライン移動ロジックを Feature として分離。
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'

export class MovementFeature implements FeatureSystem {
  readonly handles = ['auto_run', 'slow_precise', 'double_jump', 'long_air'] as const

  onInit(world: MutableWorld): void {
    const p = world.player
    if (world.rules.features.has('double_jump')) {
      p.jumpsLeft = Math.max(p.jumpsLeft, 2)
    }
  }

  // 移動ロジックの大部分は sideScroller 本体で引き続き処理（物理は中央管理）。
  // このシステムはフラグのセットアップ・初期化担当。
  // 将来的に移動ロジックをここに全移管できる構造にしておく。
  update(_world: MutableWorld, _input: InputSnapshot, _dt: number): void {
    // 実際の移動計算は sideScroller._update() で行う（物理との結合度が高いため）。
    // このシステムは feature のオン/オフを GameRegistry を通じてエンジンに
    // 知らせる役割を果たす（getActiveSystems で存在確認に使う）。
  }
}
