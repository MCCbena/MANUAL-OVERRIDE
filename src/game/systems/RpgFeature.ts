/**
 * game/systems/RpgFeature.ts
 * RPG / 育成系フィーチャーを担当。
 *
 * onPlayerHit() — hp feature が有効なとき: HP 減少・無敵フレーム・シェイク・パーティクル
 * update()      — item_pickup feature が有効なとき: アイテム収集・EXP / HP 回復
 *
 * 注: アイテム配列の死亡/画面外クリーンアップは sideScroller.ts が担当。
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'
import { rectsOverlap } from '../entities'
import { SPAWN } from '../../data/tunables'
import { getActiveSystems } from '../../engine/GameRegistry'
import { applyPlayerHitEffect } from './hitEffect'

export class RpgFeature implements FeatureSystem {
  readonly handles = ['hp', 'exp', 'item_pickup', 'shield'] as const

  /** hp feature: 被弾時に HP 減算・無敵・シェイク・パーティクルを処理 */
  onPlayerHit(world: MutableWorld): void {
    if (!world.rules.features.has('hp')) return
    /* survival_hp が有効の場合、SurvivalFeature が被弾処理を独立して担当。
       両方が発火しないよう、ここではスキップする。
    */
    if (world.rules.features.has('survival_hp')) return
    applyPlayerHitEffect(world, '#ff4444')
  }

  /** item_pickup feature: アイテムのパルスアニメ・収集判定・EXP / HP 付与 */
  update(world: MutableWorld, _input: InputSnapshot, dt: number): void {
    if (!world.rules.features.has('item_pickup')) return
    /* survival_item が有効の場合、SurvivalFeature がアイテム収集を独立して担当。
       処理が二重にならないよう skip する。
    */
    if (world.rules.features.has('survival_item')) return
    const p = world.player
    for (const item of world.items) {
      if (!item.alive) continue
      item.pulse += dt * SPAWN.itemPulseRate
      const iRect = { ...item.rect, x: item.rect.x - world.cameraX }
      if (!rectsOverlap(p.rect, iRect, 0)) continue
      item.alive = false
      world.addScoreVarsItemCollected()
      if (item.type === 'exp') {
        p.exp += SPAWN.expItemExpGain
        world.addScore(SPAWN.expItemScore)
        world.addScorePopup(item.x - world.cameraX, item.y, '+EXP', '#ffcc00')
      } else if (item.type === 'hp' && p.hp < p.maxHp) {
        p.hp++
        world.addScorePopup(item.x - world.cameraX, item.y, '+HP', '#ff8888')
      }
      // onItemPickup フック発火
      for (const sys of getActiveSystems(world.rules.features)) {
        sys.onItemPickup?.(world, item.type)
      }
    }
    // 死亡/画面外の除去は sideScroller の filter で行う
  }
}
