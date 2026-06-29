/**
 * game/systems/SurvivalFeature.ts
 * サバイバルゲーム固有のフィーチャー。
 *
 * survival_hunger — 時間経過でhunger減衰、臨界域でHPダメージ
 * survival_melee  — Zキーで近接攻撃（左右両方向）
 * survival_level  — 敵撃破でXP獲得、レベルアップでHP回復・武器強化
 *
 * 注: food/weaponアイテムの収集判定もこのFeatureで処理する。
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'
import { rectsOverlap, Hazard } from '../entities'
import { SURVIVAL, VFX } from '../../data/tunables'
import { applyPlayerHitEffect } from './hitEffect'
import { getActiveSystems } from '../../engine/GameRegistry'

interface SurvivalState {
  meleeCooldown: number
  meleeActive: number   // 攻撃判定残り時間
  lastHungerDamage: number
  accumulatedXp: number  // レベルアップ超過分の蓄積XP
  nextLevelXp: number
}

export class SurvivalFeature implements FeatureSystem {
  readonly handles = ['survival_hunger', 'survival_melee', 'survival_level', 'survival_hp', 'survival_item'] as const

  private state: SurvivalState = this._fresh()

  private _fresh(): SurvivalState {
    return {
      meleeCooldown: 0,
      meleeActive: 0,
      lastHungerDamage: 0,
      accumulatedXp: 0,
      nextLevelXp: SURVIVAL.xpPerLevel,
    }
  }

  onInit(world: MutableWorld): void {
    this.state = this._fresh()
    this._resetPlayer(world)
  }

  onManualUpdated(world: MutableWorld, _versionKey: string): void {
    this.state = this._fresh()
    this._resetPlayer(world)
  }

  onDisable(world: MutableWorld): void {
    this.state = this._fresh()
    this._resetPlayer(world)
  }

  private _resetPlayer(world: MutableWorld): void {
    const p = world.player
    const maxHp = SURVIVAL.maxPlayerHp
    p.hp = maxHp
    p.maxHp = maxHp
    p.hunger = SURVIVAL.maxHunger
    p.level = 1
    p.weaponDamage = SURVIVAL.meleeDamage
    p.currentLevelXp = 0
    /* nextLevelXp はレベル1固定。レベルアップ時に動的に計算する。
       xpPerLevel * scale^(level-1) でスケール。
    */
    p.nextLevelXp = SURVIVAL.xpPerLevel
  }

  update(world: MutableWorld, input: InputSnapshot, dt: number): void {
    this._updateMeleeTimers(dt)
    this._updateHunger(world, dt)
    this._handleMeleeAttack(world, input)
    this._resolveMeleeCollisions(world)
    if (world.rules.features.has('survival_item')) {
      this._processItemPickups(world)
    }
  }

  render(ctx: CanvasRenderingContext2D, world: MutableWorld): void {
    if (this.state.meleeActive <= 0) return
    this._drawMeleeSwing(ctx, world)
  }

  // survival_hp: 被弾時に HP 減算・無敵フレーム・シェイク・パーティクルを処理
  onPlayerHit(world: MutableWorld): void {
    /* RpgFeature.onPlayerHit と同等の処理だが、
       survival_hp が有効な場合に SurvivalFeature が独立して処理する。
       両方（RpgFeature と SurvivalFeature）が active なら二重に発火しないよう、
       survival_hp 時は RpgFeature 側がガードしてスキップする（互いに排反）。
    */
    if (!world.rules.features.has('survival_hp')) return
    applyPlayerHitEffect(world, SURVIVAL.hitParticleColor)
  }

  // ─── 内部: タイマー更新 ──────────────────────────────────────────
  private _updateMeleeTimers(dt: number): void {
    this.state.meleeCooldown -= dt
    this.state.meleeActive -= dt
  }

  // ─── 内部: hunger減衰とHPダメージ ────────────────────────────────
  private _updateHunger(world: MutableWorld, dt: number): void {
    if (!world.rules.features.has('survival_hunger')) return
    const p = world.player

    // 時間経過でhunger減衰
    p.hunger -= SURVIVAL.hungerDecayRate * dt
    if (p.hunger < 0) p.hunger = 0

    // 臨界域以下で定期的なHPダメージ
    // dtが大きい場合（タブ切り替え復帰時等）に複数回のダメージを正しく処理する
    if (p.hunger <= SURVIVAL.hungerCriticalThreshold) {
      this.state.lastHungerDamage += dt
      const interval = SURVIVAL.hungerDamageInterval
      // 経過時間から発火回数を計算する（複数回発火可能）
      const numHits = Math.floor(this.state.lastHungerDamage / interval)
      if (numHits > 0) {
        this.state.lastHungerDamage -= numHits * interval
        for (let i = 0; i < numHits; i++) {
          world.modifyPlayerHp(-SURVIVAL.hungerDamageAmount)
          if (i === 0) {
            // 最初のhits-only の演出コストを抑制
            world.triggerShake(VFX.hitShakeIntensity * 0.5)
            world.addScorePopup(p.x + p.w / 2, p.y - 10, 'starving...', SURVIVAL.hudHungerColorLow)
          }
        }
      }
    } else {
      this.state.lastHungerDamage = 0
    }
  }

  // ─── 内部: メリー攻撃入力 ────────────────────────────────────────
  private _handleMeleeAttack(world: MutableWorld, input: InputSnapshot): void {
    if (!world.rules.features.has('survival_melee')) return
    const shootKey = world.rules.controls.shoot?.toLowerCase() ?? 'z'

    if (!input.justPressed.has(shootKey)) return
    if (this.state.meleeCooldown > 0) return

    this.state.meleeCooldown = SURVIVAL.meleeCooldown
    this.state.meleeActive = SURVIVAL.meleeCooldown * SURVIVAL.meleeActiveRatio
  }

  // ─── 内部: メリー攻撃 × 障害物 衝突判定 ─────────────────────────
  private _resolveMeleeCollisions(world: MutableWorld): void {
    if (this.state.meleeActive <= 0) return
    if (!world.rules.features.has('survival_melee')) return

    const p = world.player
    const range = SURVIVAL.meleeRange
    const damage = p.weaponDamage

    // プレイヤー中心から左右両方向の攻撃範囲
    const meleeLeft = p.x - range
    const meleeRight = p.x + p.w + range
    const meleeTop = p.y - range * SURVIVAL.meleeVerticalRatio
    const meleeBottom = p.y + p.h + range * SURVIVAL.meleeVerticalRatio
    const meleeRect = { x: meleeLeft, y: meleeTop, w: meleeRight - meleeLeft, h: meleeBottom - meleeTop }

    for (let i = world.hazards.length - 1; i >= 0; i--) {
      const h = world.hazards[i]
      if (h.isSafe || h.hp <= 0) continue
      if (!rectsOverlap(meleeRect, h.rect, SURVIVAL.meleeCollisionGrace)) continue

      h.hp -= damage
      // 攻撃パーティクル
      for (let i = 0; i < SURVIVAL.meleeHitParticleCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = SURVIVAL.meleeHitParticleSpeedMin + Math.random() * (SURVIVAL.meleeHitParticleSpeedMax - SURVIVAL.meleeHitParticleSpeedMin)
        world.addParticle(
          h.x + h.w / 2 - world.cameraX, h.y + h.h / 2,
          Math.cos(angle) * speed, Math.sin(angle) * speed,
          SURVIVAL.meleeHitParticleLife, SURVIVAL.meleeHitParticleColor, SURVIVAL.meleeHitParticleSize,
        )
      }

      if (h.hp <= 0) {
        this._onEnemyKilled(world, h)
      }
    }
  }

  // ─── 内部: 敵撃破時のXP付与とレベルアップ ────────────────────────
  private _onEnemyKilled(world: MutableWorld, _hazard: Hazard): void {
    if (!world.rules.features.has('survival_level')) return
    const p = world.player

    p.exp += SURVIVAL.xpPerKill
    this.state.accumulatedXp += SURVIVAL.xpPerKill
    p.currentLevelXp += SURVIVAL.xpPerKill

    // レベルアップ判定
    // xpPerLevel <= 0 または xpLevelScale <= 1 の場合、nextLevelXpが減少しないため無限ループする
    // ConfigValidator で xpPerLevel >= 1, xpLevelScale >= 1 を保証しているため、
    // nextLevelXpは毎ループで増加する。ただし、1フレームでの連続レベルアップを制限するガード
    const MAX_LEVEL_UPS_PER_FRAME = 100
    let guard = MAX_LEVEL_UPS_PER_FRAME
    while (this.state.accumulatedXp >= this.state.nextLevelXp && guard > 0) {
      guard--
      this.state.accumulatedXp -= this.state.nextLevelXp
      p.currentLevelXp -= this.state.nextLevelXp
      p.level++
      this.state.nextLevelXp = Math.floor(SURVIVAL.xpPerLevel * Math.pow(SURVIVAL.xpLevelScale, p.level - 1))
      p.nextLevelXp = this.state.nextLevelXp

      // レベルアップ効果
      if (p.hp < p.maxHp) {
        const heal = Math.min(SURVIVAL.levelUpHealHp, p.maxHp - p.hp)
        p.hp += heal
      }
      p.weaponDamage += SURVIVAL.levelUpDamageBonus

      // レベルアップ演出
      this._spawnLevelUpEffect(world)
    }
  }

  // ─── 内部: レベルアップ演出 ──────────────────────────────────────
  private _spawnLevelUpEffect(world: MutableWorld): void {
    const p = world.player
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    const colors = SURVIVAL.levelUpParticleColors

    for (let i = 0; i < SURVIVAL.levelUpParticleCount; i++) {
      const angle = (i / SURVIVAL.levelUpParticleCount) * Math.PI * 2
      const speed = SURVIVAL.levelUpParticleSpeedMin + Math.random() * (SURVIVAL.levelUpParticleSpeedMax - SURVIVAL.levelUpParticleSpeedMin)
      const color = colors[Math.floor(Math.random() * colors.length)]
      world.addParticle(
        cx, cy,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        SURVIVAL.levelUpParticleLife, color, SURVIVAL.levelUpParticleSize,
      )
    }

    world.addScorePopup(cx, p.y - 20, `Lv.${p.level}!`, SURVIVAL.levelUpPopupColor)
    world.triggerShake(VFX.hitShakeIntensity * SURVIVAL.levelUpShakeIntensity)
  }

  // ─── 内部: food/weapon/hp アイテム収集 ──────────────────────────
  private _processItemPickups(world: MutableWorld): void {
    const p = world.player
    for (const item of world.items) {
      if (!item.alive) continue
      if (item.type !== 'food' && item.type !== 'weapon' && item.type !== 'hp') continue

      const iRect = { ...item.rect, x: item.rect.x - world.cameraX }
      if (!rectsOverlap(p.rect, iRect, 0)) continue

      item.alive = false
      world.addScoreVarsItemCollected()

      if (item.type === 'food') {
        p.hunger = Math.min(SURVIVAL.maxHunger, p.hunger + SURVIVAL.foodRestore)
        world.addScorePopup(item.x - world.cameraX, item.y, `+${SURVIVAL.foodRestore} hunger`, SURVIVAL.foodPopupColor)
      } else if (item.type === 'weapon') {
        p.weaponDamage += SURVIVAL.weaponUpgradeAmount
        world.addScorePopup(item.x - world.cameraX, item.y, `+${SURVIVAL.weaponUpgradeAmount} ATK`, SURVIVAL.weaponPopupColor)
      } else if (item.type === 'hp' && p.hp < p.maxHp) {
        const heal = SURVIVAL.hpRestore
        const actualHeal = Math.min(heal, p.maxHp - p.hp)
        p.hp += actualHeal
        world.addScorePopup(item.x - world.cameraX, item.y, `+${actualHeal} HP`, SURVIVAL.hpPopupColor)
      }

      // onItemPickup フック発火
      for (const sys of getActiveSystems(world.rules.features)) {
        sys.onItemPickup?.(world, item.type)
      }
    }
  }

  // ─── 内部: メリー攻撃の描画 ──────────────────────────────────────
  private _drawMeleeSwing(ctx: CanvasRenderingContext2D, world: MutableWorld): void {
    const p = world.player
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    const range = SURVIVAL.meleeRange
    const arc = SURVIVAL.meleeArc

    ctx.save()
    ctx.globalAlpha = this.state.meleeActive / (SURVIVAL.meleeCooldown * SURVIVAL.meleeActiveRatio)
    ctx.strokeStyle = SURVIVAL.meleeSwingStrokeColor
    ctx.lineWidth = SURVIVAL.meleeSwingLineWidth
    ctx.shadowColor = SURVIVAL.meleeSwingShadowColor
    ctx.shadowBlur = SURVIVAL.meleeSwingShadowBlur

    // 右方向の弧
    ctx.beginPath()
    ctx.arc(cx, cy, range, -arc / 2, arc / 2)
    ctx.stroke()

    // 左方向の弧
    ctx.beginPath()
    ctx.arc(cx, cy, range, Math.PI - arc / 2, Math.PI + arc / 2)
    ctx.stroke()

    ctx.restore()
  }
}
