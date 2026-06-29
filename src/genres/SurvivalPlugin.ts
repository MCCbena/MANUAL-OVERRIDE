/**
 * genres/SurvivalPlugin.ts
 * 'survival' ジャンル（サバイバルゲーム）のプラグイン。
 *
 * 荒廃した森林。暗い緑・茶色で生存感を演出。
 * HPアイテム・食料・武器が出現、左右両方向から敵が迫る。
 *
 * drawGenreHUD  — hungerバー / XP進行バー / レベル / 武器ダメージ表示
 * onHazardDestroyed — 敵撃破時に食料/武器をドロップ
 */

import { GenrePluginBase } from '../engine/GenrePluginBase'
import type { SpawnEntry, MutableWorld } from '../engine/types'
import type { GenreId } from '../domain/types'
import type { Hazard } from '../game/entities'
import { Item, ITEM_WIDTH, ITEM_HEIGHT } from '../game/entities'
import { SURVIVAL } from '../data/tunables'

export class SurvivalPlugin extends GenrePluginBase {
  readonly id: GenreId = 'survival'

  readonly skyColors    = ['#050e05', '#0a1a08'] as const
  readonly groundColors = ['#0d1a09', '#070f05'] as const
  readonly farLayerColor  = '#0a1a08'
  readonly midLayerColor  = '#081408'
  readonly starColor: string | undefined = undefined  // Abstract from GenrePluginBase; unused for survival (no stars)

  readonly palette = {
    danger: '#cc4400', dangerGlow: '#ff7722',
    safe:   '#22aa44', safeGlow:   '#66ff88',
  }

  readonly hazardConfig = {
    glowBlur: 8,
    pulseSpeed: 0.9,
    pulseAmplitude: 0.06,
  }

  readonly groundLineAlpha = 0.12
  readonly groundDashAlpha = 0.06

  readonly particleColors = {
    hit:   '#ff6600',
    death: ['#cc3300', '#ff6600', '#884400', '#442200'] as readonly string[],
    jump:  'rgba(80,120,40,0.6)',
    land:  'rgba(60,100,30,0.5)',
  }

  // HPアイテムが多め、障害物はタフ寄り。左方向から来る敵も混在。
  readonly spawnTable: readonly SpawnEntry[] = [
    // 右から来る通常敵
    { shape: 'rect',   placement: 'ground', weightStart: 8, weightEnd: 6, wRange: [28, 52], hRange: [38, 65], safeChance: 0.30 },
    { shape: 'pillar', placement: 'ground', weightStart: 3, weightEnd: 5, wRange: [16, 24], hRange: [70, 130], safeChance: 0.20 },
    { shape: 'spike',  placement: 'ground', weightStart: 2, weightEnd: 4, wRange: [25, 42], hRange: [35, 55], safeChance: 0.15 },
    { shape: 'rect',   placement: 'air',    weightStart: 0, weightEnd: 2, wRange: [26, 45], hRange: [25, 40], safeChance: 0.25 },
    // 左から来る敵（両方向攻撃対応）
    { shape: 'rect',   placement: 'ground', weightStart: 0, weightEnd: 4, wRange: [28, 48], hRange: [38, 65], safeChance: 0.20, direction: 'left' },
    { shape: 'spike',  placement: 'ground', weightStart: 0, weightEnd: 3, wRange: [25, 38], hRange: [35, 55], safeChance: 0.15, direction: 'left' },
  ]

  onGenreLocked(world: MutableWorld): void {
    // ジャンル確定時に状態を初期化
    const p = world.player
    const maxHp = SURVIVAL.maxPlayerHp
    p.hp = maxHp
    p.maxHp = maxHp
    p.hunger = SURVIVAL.maxHunger
    p.level = 1
    p.weaponDamage = SURVIVAL.meleeDamage
  }

  drawFarLayer(ctx: CanvasRenderingContext2D, offsetX: number, W: number, gY: number): void {
    // 霧がかかった暗い丘シルエット
    ctx.globalAlpha = 0.18
    ctx.fillStyle = this.farLayerColor
    ctx.beginPath()
    ctx.moveTo(0, gY)
    const step = 30
    for (let sx = -step; sx <= W + step; sx += step) {
      const wx = sx - offsetX
      const mh = Math.sin(wx * 0.004) * 70 + Math.sin(wx * 0.009) * 35 + Math.sin(wx * 0.019) * 18 + 95
      ctx.lineTo(sx, gY - mh)
    }
    ctx.lineTo(W + step, gY)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  drawMidLayer(ctx: CanvasRenderingContext2D, offsetX: number, W: number, gY: number): void {
    // 枯れ木のシルエット
    ctx.globalAlpha = 0.5
    ctx.fillStyle = this.midLayerColor
    const sector = Math.floor(offsetX / 180)
    for (let s = sector - 1; s <= sector + 5; s++) {
      const h = (s * 1783) & 0xffff
      const tx = s * 180 - offsetX + (h % 100)
      const treeH = 55 + (h >> 4) % 60
      const trunkW = 5 + (h >> 8) % 5
      // 幹
      ctx.fillRect(tx - trunkW / 2, gY - treeH, trunkW, treeH * 0.8)
      // 枝（歪んだ）
      const branchCount = 2 + (h & 0x3)
      ctx.strokeStyle = this.midLayerColor
      ctx.lineWidth = 2.5
      for (let b = 0; b < branchCount; b++) {
        const bh2 = (s * 41 + b * 97) & 0xff
        const branchY = gY - treeH * 0.4 - b * treeH * 0.12
        const bLen = 15 + bh2 % 20
        const bDir = bh2 < 128 ? -1 : 1
        ctx.beginPath()
        ctx.moveTo(tx, branchY)
        ctx.lineTo(tx + bDir * bLen, branchY - bLen * 0.5)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  drawPlayer(ctx: CanvasRenderingContext2D, w: number, h: number, onGround: boolean, runCycle: number): void {
    const t = runCycle * Math.PI * 2
    const legSwing = onGround ? Math.sin(t) * 10 : 0

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(w / 2, h + 2, w * 0.38, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // 体（サバイバー・ダークカラー）
    ctx.fillStyle = '#3a5228'
    this._roundRect(ctx, 3, h * 0.4, w - 6, h * 0.38, 3)
    ctx.fill()

    // リュック
    ctx.fillStyle = '#2a3c1a'
    ctx.fillRect(w * 0.1, h * 0.35, w * 0.22, h * 0.36)

    // 頭
    ctx.fillStyle = '#c4945a'
    ctx.beginPath()
    ctx.arc(w * 0.58, h * 0.22, h * 0.2, 0, Math.PI * 2)
    ctx.fill()

    // ヘルメット
    ctx.fillStyle = '#2a4a18'
    ctx.beginPath()
    ctx.arc(w * 0.58, h * 0.17, h * 0.16, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(w * 0.4, h * 0.17, w * 0.36, 5)

    // 目
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath()
    ctx.arc(w * 0.67, h * 0.22, 2.5, 0, Math.PI * 2)
    ctx.fill()

    // 脚
    ctx.lineWidth = 5.5; ctx.strokeStyle = '#2a3c1a'; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.76); ctx.lineTo(w * 0.28 - legSwing * 0.4, h * 0.98); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w * 0.60, h * 0.76); ctx.lineTo(w * 0.72 + legSwing * 0.4, h * 0.98); ctx.stroke()
  }

  // ─── ジャンル固有HUD: HP / hungerバー / XPバー / レベル / 武器ダメージ ─
  drawGenreHUD(ctx: CanvasRenderingContext2D, world: MutableWorld, W: number, _H: number): void {
    const p = world.player
    const padding = SURVIVAL.hudPanelPadding
    const radius = SURVIVAL.hudPanelRadius
    const barW = SURVIVAL.hudBarWidth
    const barH = SURVIVAL.hudBarHeight
    const textSz = SURVIVAL.hudTextSize
    const x = W - barW - SURVIVAL.hudTopOffset
    let y = SURVIVAL.hudTopOffset
    /* パネル高さは構成要素から計算: HP(テキスト+バー) + hunger(テキスト+バー) + XP(テキスト+バー) + ATK(テキスト)
       - HP: textSz + 4 + barH + 6
       - hunger: textSz + 4 + barH + 6
       - XP: textSz + 4 + barH + 6
       - ATK: textSz
    */
    const panelHeight3 = (textSz + 4 + barH + 6) * 3 + textSz

    // 背景パネル
    ctx.fillStyle = SURVIVAL.hudPanelBgColor
    this._roundRect(ctx, x - padding, y - radius, barW + padding * 2, panelHeight3, radius)
    ctx.fill()

    // ── HPバー ──
    ctx.font = `bold ${textSz}px "Courier New", monospace`
    ctx.fillStyle = SURVIVAL.hudLabelColor
    ctx.fillText('HP', x, y + textSz)
    ctx.fillStyle = SURVIVAL.hudHpTextColor
    ctx.fillText(`${p.hp}/${p.maxHp}`, x + barW - 30, y + textSz)
    y += textSz + 4

    const hpRatio = p.hp / p.maxHp
    const hpColor = hpRatio > 0.5 ? SURVIVAL.hudHpBarColorHigh : hpRatio > 0.25 ? SURVIVAL.hudHpBarColorMid : SURVIVAL.hudHpBarColorLow
    ctx.fillStyle = SURVIVAL.hudBarBgColor
    ctx.fillRect(x, y, barW, barH)
    ctx.fillStyle = hpColor
    ctx.fillRect(x, y, barW * hpRatio, barH)
    y += barH + 6

    // ── hungerバー ──
    ctx.fillStyle = SURVIVAL.hudLabelColor
    ctx.fillText('HUNGER', x, y + textSz)
    y += textSz + 4

    const hungerRatio = p.hunger / SURVIVAL.maxHunger
    const hungerColor = hungerRatio > 0.5 ? SURVIVAL.hudHungerColorHigh : hungerRatio > 0.25 ? SURVIVAL.hudHungerColorMid : SURVIVAL.hudHungerColorLow
    ctx.fillStyle = SURVIVAL.hudBarBgColor
    ctx.fillRect(x, y, barW, barH)
    ctx.fillStyle = hungerColor
    ctx.fillRect(x, y, barW * hungerRatio, barH)
    y += barH + 6

    // ── XPバー ──
    // p.currentLevelXp / p.nextLevelXp は SurvivalFeature で同期済み
    const xpRatio = p.nextLevelXp > 0 ? Math.min(1, p.currentLevelXp / p.nextLevelXp) : 0

    ctx.fillStyle = SURVIVAL.hudLabelColor
    ctx.fillText(`Lv.${p.level}`, x, y + textSz)
    ctx.fillStyle = SURVIVAL.hudXpTextColor
    ctx.fillText(`${p.currentLevelXp}/${p.nextLevelXp}`, x + barW - 40, y + textSz)
    y += textSz + 4

    ctx.fillStyle = SURVIVAL.hudBarBgColor
    ctx.fillRect(x, y, barW, barH)
    ctx.fillStyle = SURVIVAL.hudXpBarColor
    ctx.fillRect(x, y, barW * xpRatio, barH)
    y += barH + 6

    // ── 武器ダメージ ──
    ctx.fillStyle = SURVIVAL.hudAtkTextColor
    ctx.fillText(`ATK: ${p.weaponDamage}`, x, y + textSz)
  }

  // ─── 敵撃破時に食料/武器/HPドロップ ───────────────────────────────
  onHazardDestroyed(world: MutableWorld, hazard: Hazard): void {
    const sx = hazard.x + hazard.w / 2
    const sy = hazard.y

    // アイテムをhazard中央に配置するため w/2 オフセット
    // 縦にスタックする（ITEM_HEIGHT ずつずらす）
    const halfItemW = ITEM_WIDTH / 2

    // 食料ドロップ
    if (Math.random() < SURVIVAL.foodDropChance) {
      world.spawnItem(new Item(sx - halfItemW, sy, 'food'))
    }

    // 武器ドロップ（食料より上にドロップ)
    if (Math.random() < SURVIVAL.weaponDropChance) {
      world.spawnItem(new Item(sx - halfItemW, sy - ITEM_HEIGHT, 'weapon'))
    }

    // HPドロップ（武器より上にドロップ）
    if (Math.random() < SURVIVAL.hpDropChance) {
      world.spawnItem(new Item(sx - halfItemW, sy - ITEM_HEIGHT * 2, 'hp'))
    }
  }
}

export default new SurvivalPlugin()
