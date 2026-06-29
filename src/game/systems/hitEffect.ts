/**
 * game/systems/hitEffect.ts
 *
 * 被弾演出（HP減少 + 無敵フレーム + シェイク + パーティクル）の共有実装。
 *
 * RpgFeature / SurvivalFeature の両方で同じ処理を行うため、
 * ここに純粋関数で抽出する（DRY違反の排除）。
 *
 * 注: パーティクル色は呼び出し侧で渡す（RpgFeature = '#ff4444', SurvivalFeature = config).
 */

import type { MutableWorld } from '../../engine/types'
import { VFX } from '../../data/tunables'

/**
 * プレイヤー被弾時の演出を実行する。
 * - HP 1減算（world.modifyPlayerHp 経由)
 * - 生存時は無敵フレーム・画面シェイク・パーティクル発動
 *
 * @param world    ゲーム世界
 * @param hitColor パーティクルの色（呼出侧固有）
 */
export function applyPlayerHitEffect(world: MutableWorld, hitColor: string): void {
  const p = world.player
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
        life, hitColor, size,
      )
    }
  }
}
