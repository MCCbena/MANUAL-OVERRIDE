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
import { VFX, SPAWN } from '../../data/tunables'
import { getActiveSystems } from '../../engine/GameRegistry'

export class RpgFeature implements FeatureSystem {
  readonly handles = ['hp', 'exp', 'item_pickup', 'shield'] as const

  // シールドの内部状態（永続的な設定ではない一時的なガード）
  private _hasShieldActive: boolean = false

  /** hp feature: 被弾時に HP 減算・シールド・無敵・シェイク・パーティクルを処理 */
  onPlayerHit(world: MutableWorld): void {
    if (!world.rules.features.has('hp')) return
    const p = world.player

    // shield feature: ダメージを1回ガード（クールダウンなし、連続被弾時は消費後即無効）
    if (this._hasShieldActive && p.hp > 0) {
      // シールド発動: ダメージを軽減（HP 減算なし）、演出のみ
      p.invincible = VFX.invincibleDuration
      world.triggerShake(VFX.hitShakeIntensity * 0.5)
      // シールドブロックパーティクル（白・拡散）
      for (let i = 0; i < VFX.hitParticleCount * 2; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = VFX.hitParticleSpeedMin + Math.random() * (VFX.hitParticleSpeedMax - VFX.hitParticleSpeedMin)
        const life  = VFX.hitParticleLifeMin + Math.random() * VFX.hitParticleLifeRange
        const size  = VFX.hitParticleSizeBase + Math.random() * VFX.hitParticleSizeRange
        world.addParticle(
          p.x + p.w / 2, p.y + p.h / 2,
          Math.cos(angle) * speed * 1.5, Math.sin(angle) * speed * 1.5 + VFX.hitParticleYBoost,
          life, '#88ddff', size,
        )
      }
      // shield は1回で消費（内部状態をリセット）
      this._hasShieldActive = false
      return
    }

    world.modifyPlayerHp(-1)
    if (p.hp > 0) {
      p.invincible = VFX.invincibleDuration
      world.triggerShake(VFX.hitShakeIntensity)
      for (let i = 0; i < VFX.hitParticleCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = VFX.hitParticleSpeedMin + Math.random() * (VFX.hitParticleSpeedMax - VFX.hitParticleSpeedMin)
        const life  = VFX.hitParticleLifeMin + Math.random() * VFX.hitParticleLifeRange
        const size  = VFX.hitParticleSizeBase + Math.random() * VFX.hitParticleSizeRange
        world.addParticle(
          p.x + p.w / 2, p.y + p.h / 2,
          Math.cos(angle) * speed, Math.sin(angle) * speed + VFX.hitParticleYBoost,
          life, '#ff4444', size,
        )
      }
    }
  }

  onManualUpdated(_world: MutableWorld, _versionKey: string): void {
    // シールド状態をリセット（説明書再評価時に初期化）
    this._hasShieldActive = false
  }

  /** メンテナンス用：シールドの有効/無効を設定する */
  setShieldActive(active: boolean): void {
    this._hasShieldActive = active
  }

  /** item_pickup feature: アイテムのパルスアニメ・収集判定・EXP / HP 付与 */
  update(world: MutableWorld, _input: InputSnapshot, dt: number): void {
    if (!world.rules.features.has('item_pickup')) return
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
