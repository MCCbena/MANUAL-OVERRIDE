/**
 * game/systems/RhythmFeature.ts
 * プロセカ風リズムゲームの完全なゲームエンジン。
 * - 譜面データからノートを読み込み、ジャッジラインに向かってスクロール
 * - tap/hold/flick ノートに対応
 * - PERFECT/GREAT/NICE/MISS の4段階判定
 * - コンボカウンター、ヘルスバー、スコア計算
 */

import type { FeatureSystem } from '../../engine/FeatureSystem'
import type { MutableWorld, InputSnapshot } from '../../engine/types'
import type { RhythmNote, JudgePopup, NoteType, JudgeLevel } from '../entities'
import { allCharts, getChartList } from '../../data/charts/loader'

// ─── 定数 ──────────────────────────────────────────────────────────────
const LANE_COUNT = 5
const NOTE_SCROLL_SPEED = 800 // px/s（ノートの移動速度）
const JUDGE_LINE_Y_RATIO = 0.82 // ジャッジラインの画面比率

// 判定タイムウィンドウ（ミリ秒）
const JUDGE_WINDOWS: Record<JudgeLevel, number> = {
  perfect: 45,
  great:   90,
  nice:    140,
  miss:    200,
}

// 付与スコア（コンボボーナス込み前の基本値）
const JUDGE_SCORES: Record<JudgeLevel, number> = {
  perfect: 320,
  great:   280,
  nice:    150,
  miss:    0,
}

// コンボ倍率カーブ（exponential）
const COMBO_MULTIPLIER_BASE = 1.0
const COMBO_MULTIPLIER_STEP = 0.02

// レーンごとの色（プロセカ風）
const LANE_COLORS = ['#ff4d6d', '#4dc9f6', '#ffe66d', '#6dff6d', '#c77dff'] as const

export interface RhythmGameState {
  songTime: number          // ミリ秒（曲の進行時間）
  notes: RhythmNote[]       // 全ノートリスト（譜面から生成）
  nextNoteIndex: number     // 次に処理するノートのインデックス
  combo: number             // 現在のコンボ数
  maxCombo: number          // マキシマムコンボ
  perfectCount: number      // PERFECT回数
  greatCount: number        // GREAT回数
  niceCount: number         // NICE回数
  missCount: number         // MISS回数
  health: number            // HP (0-100)
  playScore: number         // プレイスコア
  judgePopups: JudgePopup[] // 表示中の判定ポップアップ
  activeHolds: Map<string, boolean> // アクティブなホールドノート（id → 保持中）
  songFinished: boolean     // 曲終了フラグ
}

export class RhythmFeature implements FeatureSystem {
  readonly handles = ['beat_hazard', 'just_input', 'beat_dash'] as const

  private state: RhythmGameState | null = null
  private currentChartKey: string | null = null
  private lastFrameTime: number = 0

  onInit(world: MutableWorld): void {
    this.state = this._createInitialState()
    // 曲選択：譜面が1つだけなら自動選択、複数あればランダム
    const chartList = getChartList()
    if (chartList.length > 0) {
      this.currentChartKey = chartList[Math.floor(Math.random() * chartList.length)].key
    } else {
      // 譜面がない場合はデモ用簡易ノートでプレイ
      this._generateDemoNotes(world.rules.bpm)
    }
  }

  onManualUpdated(world: MutableWorld): void {
    this.state = this._createInitialState()
    const chartList = getChartList()
    if (chartList.length > 0 && this.currentChartKey) {
      // 既存の曲を再ロード
      const chart = allCharts.get(this.currentChartKey)
      if (chart) {
        this.state.notes = this._buildNotesFromChart(chart, world.rules.bpm)
      }
    } else {
      this._generateDemoNotes(world.rules.bpm)
    }
  }

  private _createInitialState(): RhythmGameState {
    return {
      songTime: 0,
      notes: [],
      nextNoteIndex: 0,
      combo: 0,
      maxCombo: 0,
      perfectCount: 0,
      greatCount: 0,
      niceCount: 0,
      missCount: 0,
      health: 100,
      playScore: 0,
      judgePopups: [],
      activeHolds: new Map(),
      songFinished: false,
    }
  }

  private _generateDemoNotes(bpm: number): void {
    if (!this.state) return
    const beatInterval = (60 / bpm) * 1000
    const notes: RhythmNote[] = []
    
    // 簡易デモ譜面（30秒分）
    for (let i = 0; i < 60; i++) {
      const time = 2000 + i * beatInterval
      const lane = (i % LANE_COUNT) as number
      notes.push({
        id: `demo_${i}`,
        time,
        lane,
        type: 'tap',
        judged: false,
      })
    }
    
    this.state.notes = notes
    this.state.nextNoteIndex = 0
    this.state.songTime = 0
  }

  private _buildNotesFromChart(chart: { title: string; artist: string; bpm: number; sections: Array<{ name: string; notes: Array<{ time: number; lane: number; type: 'tap' | 'hold' | 'flick'; holdLength?: number }> }>, difficulty: number }, bpmOverride?: number): RhythmNote[] {
    const bpm = bpmOverride ?? chart.bpm
    const notes: RhythmNote[] = []
    let idCounter = 0

    for (const section of chart.sections) {
      for (const noteDef of section.notes) {
        notes.push({
          id: `note_${idCounter++}`,
          time: noteDef.time,
          lane: noteDef.lane,
          type: noteDef.type as NoteType,
          holdLength: noteDef.holdLength,
          judged: false,
        })
      }
    }

    // 時間でソート
    notes.sort((a, b) => a.time - b.time)
    return notes
  }

  private _judgeNote(noteId: string): JudgeLevel | null {
    if (!this.state) return null
    const note = this.state.notes.find(n => n.id === noteId)
    if (!note || note.judged) return null

    const timeDiff = Math.abs(this.state.songTime - note.time)
    
    if (timeDiff <= JUDGE_WINDOWS.perfect) return 'perfect'
    if (timeDiff <= JUDGE_WINDOWS.great)   return 'great'
    if (timeDiff <= JUDGE_WINDOWS.nice)    return 'nice'
    if (timeDiff <= JUDGE_WINDOWS.miss)    return 'miss'
    return null
  }

  private _doJudge(world: MutableWorld, level: JudgeLevel, noteId: string): void {
    if (!this.state || !this.currentChartKey) return
    
    const chart = allCharts.get(this.currentChartKey)
    if (!chart) return

    const s = this.state
    const comboMultiplier = COMBO_MULTIPLIER_BASE + Math.min(s.combo * COMBO_MULTIPLIER_STEP, 4.0)
    const baseScore = JUDGE_SCORES[level]
    const score = Math.round(baseScore * comboMultiplier)

    switch (level) {
      case 'perfect':
        s.perfectCount++
        s.health = Math.min(100, s.health + 2)
        break
      case 'great':
        s.greatCount++
        s.health = Math.min(100, s.health + 1)
        break
      case 'nice':
        s.niceCount++
        break
      case 'miss':
        s.missCount++
        s.combo = 0
        s.health = Math.max(0, s.health - 5)
        if (s.health <= 0) {
          // ゲームオーバー
          return
        }
        break
    }

    if (level !== 'miss') {
      s.combo++
      if (s.combo > s.maxCombo) s.maxCombo = s.combo
      s.playScore += score
    } else {
      world.resetCombo()
    }

    // ノートを判定済みとしてマーク
    const note = s.notes.find(n => n.id === noteId)
    if (note) {
      note.judged = true
      note.judgeLevel = level
    }

    // ポップアップ表示
    const laneWidth = world.canvas.width / LANE_COUNT
    const judgeX = laneWidth * (note?.lane ?? 2) + laneWidth / 2
    const judgeY = world.canvas.height * JUDGE_LINE_Y_RATIO - 40
    s.judgePopups.push({
      level,
      x: judgeX,
      y: judgeY,
      life: 1.0,
      score,
      comboBonus: Math.round(s.combo * COMBO_MULTIPLIER_STEP),
    })

    // パーティクルエフェクト
    if (level !== 'miss') {
      const color = level === 'perfect' ? '#ffd700' : level === 'great' ? '#ff69b4' : '#87cefa'
      world.addParticle(judgeX, judgeY, 0, -200, 0.5, color, 6)
    }
  }

  update(world: MutableWorld, input: InputSnapshot, dt: number): void {
    if (!this.state || this.state.songFinished) return
    
    const r = world.rules
    const s = this.state
    const dtMs = dt * 1000

    // 曲の進行時間を更新
    s.songTime += dtMs

    // ノートが画面外に出たらMISSとして処理
    for (let i = s.nextNoteIndex; i < s.notes.length; i++) {
      const note = s.notes[i]
      if (!note.judged && s.songTime - note.time > JUDGE_WINDOWS.miss) {
        this._doJudge(world, 'miss', note.id)
        // ホールドノートの終了処理
        if (note.type === 'hold' && s.activeHolds.has(note.id)) {
          s.activeHolds.delete(note.id)
        }
      }
    }

    // 曲終了判定（最後のノートが画面外を過ぎたか）
    const lastNote = s.notes[s.notes.length - 1]
    if (lastNote && !lastNote.judged && s.songTime > lastNote.time + JUDGE_WINDOWS.miss) {
      this._doJudge(world, 'miss', lastNote.id)
      s.songFinished = true
    }

    // ポップアップのライフを更新
    for (let i = s.judgePopups.length - 1; i >= 0; i--) {
      s.judgePopups[i].life -= dt * 2
      if (s.judgePopups[i].life <= 0) {
        s.judgePopups.splice(i, 1)
      }
    }

    // 入力判定（tap/flick ノート）
    const jumpKey = r.controls.jump
    const shootKey = r.controls.shoot ?? 'z'
    
    if (input.justPressed.has(jumpKey) || input.justPressed.has(shootKey)) {
      // 現在のビートに近いノートを探す
      let closestNote: RhythmNote | null = null
      let closestDist = Infinity
      
      for (const note of s.notes) {
        if (note.judged) continue
        const dist = Math.abs(s.songTime - note.time)
        if (dist < closestDist && dist <= JUDGE_WINDOWS.perfect) {
          closestDist = dist
          closestNote = note
        }
      }

      if (closestNote) {
        const level = this._judgeNote(closestNote.id)
        if (level) {
          this._doJudge(world, level, closestNote.id)
          
          // ホールドノートの開始
          if (closestNote.type === 'hold' && level !== 'miss') {
            s.activeHolds.set(closestNote.id, true)
          }
        }
      } else {
        // ノートがない場所で押した場合はコンボ切れ（オプション）
        if (r.features.has('just_input')) {
          // just_input モードでは外押しも許容
        }
      }
    }

    // ホールドノートの継続判定
    for (const [noteId, isActive] of s.activeHolds) {
      const note = s.notes.find(n => n.id === noteId)
      if (!note || !isActive) continue
      
      // ホールドキーが離されたかチェック
      const holdKey = r.controls.shoot ?? 'z'
      if (!input.keys.has(holdKey)) {
        // 解放時に判定
        const releaseTimeDiff = Math.abs(s.songTime - (note.time + (note.holdLength ?? 500)))
        if (releaseTimeDiff <= JUDGE_WINDOWS.great) {
          s.playScore += Math.round(JUDGE_SCORES.great * COMBO_MULTIPLIER_BASE)
        } else if (releaseTimeDiff <= JUDGE_WINDOWS.nice) {
          s.playScore += Math.round(JUDGE_SCORES.nice * COMBO_MULTIPLIER_BASE)
        } else {
          this._doJudge(world, 'miss', noteId)
        }
        s.activeHolds.delete(noteId)
      }
    }

    // スコアポップアップの更新（world 経由）
    for (const popup of s.judgePopups) {
      const color = popup.level === 'perfect' ? '#ffd700' 
                  : popup.level === 'great' ? '#ff69b4' 
                  : popup.level === 'nice' ? '#87cefa' : '#ff4444'
      world.addScorePopup(popup.x, popup.y - (1 - popup.life) * 30, `${popup.level.toUpperCase()} +${popup.score}`, color)
    }
  }

  render(ctx: CanvasRenderingContext2D, world: MutableWorld): void {
    if (!this.state || !this.currentChartKey) return
    
    const s = this.state
    const chart = allCharts.get(this.currentChartKey)
    if (!chart) return

    const W = world.canvas.width
    const H = world.canvas.height
    const laneWidth = W / LANE_COUNT
    const judgeY = H * JUDGE_LINE_Y_RATIO
    const bpm = chart.bpm

    // ─── レーン背景の描画 ──────────────────────────────────────
    for (let i = 0; i < LANE_COUNT; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${i % 2 === 0 ? 0.03 : 0.06})`
      ctx.fillRect(i * laneWidth, 0, laneWidth, H)
    }

    // ─── レーン区切り線 ──────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = i * laneWidth
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }

    // ─── ジャッジラインの描画 ──────────────────────────────
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.shadowColor = '#ff69b4'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(0, judgeY)
    ctx.lineTo(W, judgeY)
    ctx.stroke()
    ctx.shadowBlur = 0

    // ─── ノートの描画 ──────────────────────────────────────
    const noteHeight = 25
    for (const note of s.notes) {
      if (note.judged && note.type !== 'hold') continue
      
      // ノートのY座標を時間から計算（上方向にスクロール）
      const timeDiff = note.time - s.songTime
      const noteY = judgeY - (timeDiff / 1000) * NOTE_SCROLL_SPEED

      // 画面外なら描画Skip
      if (noteY < -50 || noteY > H + 50) continue

      const x = note.lane * laneWidth
      const color = LANE_COLORS[note.lane]
      
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      
      if (note.type === 'tap' || note.type === 'flick') {
        // タップ/フリックノート（四角）
        const margin = laneWidth * 0.15
        ctx.fillRect(x + margin, noteY - noteHeight / 2, laneWidth - margin * 2, noteHeight)
      } else if (note.type === 'hold') {
        // ホールドノート（長い四角）
        const holdLengthPx = (note.holdLength ?? 500) / 1000 * NOTE_SCROLL_SPEED
        const isHolding = s.activeHolds.has(note.id) && !note.judged
        
        if (!isHolding) {
          // ホールド開始マーカー
          const margin = laneWidth * 0.15
          ctx.fillRect(x + margin, noteY - noteHeight / 2, laneWidth - margin * 2, noteHeight)
          
          // ホールドトラック（未到達部分）
          if (note.holdLength && note.holdLength > 0) {
            ctx.fillStyle = `${color}44`
            const trackEndY = noteY + holdLengthPx
            ctx.fillRect(x + laneWidth * 0.2, noteY + noteHeight / 2, laneWidth * 0.6, holdLengthPx - noteHeight)
          }
        } else {
          // ホールド中（fill）
          const margin = laneWidth * 0.15
          ctx.fillRect(x + margin, judgeY - noteHeight / 2, laneWidth - margin * 2, noteHeight)
        }
      }
      
      ctx.shadowBlur = 0
      
      // ノートにフォーカスエフェクト（ジャッジラインに近い）
      const timeDiffAbs = Math.abs(timeDiff)
      if (timeDiffAbs < JUDGE_WINDOWS.perfect * 2) {
        const focusAlpha = 1 - timeDiffAbs / (JUDGE_WINDOWS.perfect * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${focusAlpha * 0.8})`
        ctx.lineWidth = 2
        const margin = laneWidth * 0.1
        ctx.strokeRect(x + margin, noteY - noteHeight / 2 - 2, laneWidth - margin * 2, noteHeight + 4)
      }
    }

    // ─── 判定ポップアップの描画 ──────────────────────────────
    for (const popup of s.judgePopups) {
      const alpha = popup.life
      ctx.globalAlpha = alpha
      
      let color: string
      switch (popup.level) {
        case 'perfect': color = '#ffd700'; break
        case 'great':   color = '#ff69b4'; break
        case 'nice':    color = '#87cefa'; break
        case 'miss':    color = '#ff4444'; break
      }

      // テキスト
      ctx.fillStyle = color
      ctx.font = `bold ${16 + (1 - popup.life) * 8}px "Segoe UI", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(popup.level.toUpperCase(), popup.x, popup.y)
      
      // スコア
      ctx.font = `${12}px "Segoe UI", sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`+${popup.score}`, popup.x, popup.y + 18)

      ctx.globalAlpha = 1
    }

    // ─── HUD の描画 ──────────────────────────────────────
    this._drawHUD(ctx, world, W, H, s, chart)
  }

  private _drawHUD(
    ctx: CanvasRenderingContext2D,
    world: MutableWorld,
    W: number,
    H: number,
    state: RhythmGameState,
    chart: { title: string; artist: string },
  ): void {
    // ─── ヘルスバー ──────────────────────────────────────
    const healthBarWidth = 200
    const healthBarHeight = 16
    const healthX = W - healthBarWidth - 20
    const healthY = 20
    
    // バックグラウンド
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(healthX - 2, healthY - 2, healthBarWidth + 4, healthBarHeight + 4)
    
    // ヒットポイント
    const healthPercent = state.health / 100
    const hpColor = healthPercent > 0.5 ? '#32cd32' : healthPercent > 0.25 ? '#ffd700' : '#ff4444'
    ctx.fillStyle = hpColor
    ctx.fillRect(healthX, healthY, healthBarWidth * healthPercent, healthBarHeight)
    
    // HPテキスト
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`HP ${state.health}`, healthX + healthBarWidth / 2, healthY + 12)

    // ─── コンボカウンター ──────────────────────────────
    if (state.combo > 0) {
      const comboScale = Math.min(1 + state.combo * 0.01, 1.5)
      ctx.save()
      ctx.translate(W / 2, H * 0.3)
      ctx.scale(comboScale, comboScale)
      
      // コンボ数
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 48px "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ff69b4'
      ctx.shadowBlur = 20
      ctx.fillText(`${state.combo}`, 0, 0)
      
      // COMBOテキスト
      ctx.font = 'bold 18px "Segoe UI", sans-serif'
      ctx.shadowBlur = 10
      ctx.fillText('COMBO', 0, 35)
      
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // ─── スコア ──────────────────────────────────────
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px "Segoe UI", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`Score: ${state.playScore.toLocaleString()}`, 20, 35)

    // ─── マックスコンボ ──────────────────────────────
    if (state.maxCombo > 0) {
      ctx.fillStyle = '#ffd700'
      ctx.font = '14px "Segoe UI", sans-serif'
      ctx.fillText(`Max Combo: ${state.maxCombo}`, 20, 58)
    }

    // ─── 判定統計 ──────────────────────────────
    const statsY = H - 60
    ctx.font = '14px "Segoe UI", sans-serif'
    ctx.textAlign = 'right'
    
    const perfectColor = '#ffd700'
    const greatColor = '#ff69b4'
    const niceColor = '#87cefa'
    const missColor = '#ff4444'

    ctx.fillStyle = perfectColor
    ctx.fillText(`PERFECT: ${state.perfectCount}`, W - 20, statsY)
    
    ctx.fillStyle = greatColor
    ctx.fillText(`GREAT: ${state.greatCount}`, W - 20, statsY + 20)
    
    ctx.fillStyle = niceColor
    ctx.fillText(`NICE: ${state.niceCount}`, W - 20, statsY + 40)

    if (state.missCount > 0) {
      ctx.fillStyle = missColor
      ctx.fillText(`MISS: ${state.missCount}`, W - 20, H - 15)
    }

    // ─── カレントノート情報 ──────────────────────
    const nextNote = state.notes.find(n => !n.judged && n.time > state.songTime)
    if (nextNote) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.font = '12px "Segoe UI", sans-serif'
      ctx.textAlign = 'left'
      const timeUntilNext = ((nextNote.time - state.songTime) / 1000).toFixed(2)
      ctx.fillText(`Next: ${timeUntilNext}s`, 20, H - 15)
    }

    // ─── 曲情報 ──────────────────────────────
    if (chart) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.font = 'bold 16px "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${chart.title} - ${chart.artist}`, W / 2, H - 15)
    }

    // ─── ゲームオーバー表示 ──────────────────────
    if (state.health <= 0 && !state.songFinished) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, W, H)
      
      ctx.fillStyle = '#ff4444'
      ctx.font = 'bold 64px "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ff0000'
      ctx.shadowBlur = 30
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20)
      
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px "Segoe UI", sans-serif'
      ctx.shadowBlur = 0
      ctx.fillText(`Final Score: ${state.playScore.toLocaleString()}`, W / 2, H / 2 + 30)
    }

    // ─── 曲終了表示 ──────────────────────────────
    if (state.songFinished && state.health > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, W, H)
      
      // 結果画面
      const totalNotes = state.perfectCount + state.greatCount + state.niceCount + state.missCount
      const accuracy = totalNotes > 0 
        ? ((state.perfectCount * 100 + state.greatCount * 80 + state.niceCount * 50) / (totalNotes * 100) * 100).toFixed(1)
        : '0.0'

      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 48px "Segoe UI", sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20
      ctx.fillText('CLEAR!', W / 2, H / 2 - 60)
      
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 32px "Segoe UI", sans-serif'
      ctx.shadowBlur = 10
      ctx.fillText(`Score: ${state.playScore.toLocaleString()}`, W / 2, H / 2 - 10)
      
      ctx.font = '20px "Segoe UI", sans-serif'
      ctx.fillStyle = '#ffd700'
      ctx.fillText(`Accuracy: ${accuracy}%`, W / 2, H / 2 + 30)
      
      ctx.fillStyle = '#ff69b4'
      ctx.font = '18px "Segoe UI", sans-serif'
      ctx.fillText(`Max Combo: ${state.maxCombo}`, W / 2, H / 2 + 65)

      // 判定詳細
      ctx.font = '16px "Segoe UI", sans-serif'
      ctx.fillStyle = '#ffd700'
      ctx.fillText(`PERFECT x${state.perfectCount}`, W / 2 - 100, H / 2 + 105)
      ctx.fillStyle = '#ff69b4'
      ctx.fillText(`GREAT x${state.greatCount}`, W / 2 + 100, H / 2 + 105)
      ctx.fillStyle = '#87cefa'
      ctx.fillText(`NICE x${state.niceCount}`, W / 2 - 100, H / 2 + 130)
      if (state.missCount > 0) {
        ctx.fillStyle = '#ff4444'
        ctx.fillText(`MISS x${state.missCount}`, W / 2 + 100, H / 2 + 130)
      }
    }
  }

  /** 現在の曲キーを取得 */
  getCurrentChartKey(): string | null {
    return this.currentChartKey
  }

  /** 次の曲に切り替え */
  nextSong(world: MutableWorld): void {
    const chartList = getChartList()
    if (chartList.length === 0) return
    
    // ランダムに次の曲を選択（前と同じ曲は避ける）
    let newKey: string
    do {
      newKey = chartList[Math.floor(Math.random() * chartList.length)].key
    } while (newKey === this.currentChartKey && chartList.length > 1)

    this.currentChartKey = newKey
    const chart = allCharts.get(newKey)!
    if (!this.state || !chart) return
    
    // 状態リセット
    this.state.notes = this._buildNotesFromChart(chart, world.rules.bpm)
    this.state.nextNoteIndex = 0
    this.state.songTime = 0
    this.state.combo = 0
    this.state.maxCombo = 0
    this.state.perfectCount = 0
    this.state.greatCount = 0
    this.state.niceCount = 0
    this.state.missCount = 0
    this.state.health = 100
    this.state.playScore = 0
    this.state.judgePopups = []
    this.state.activeHolds.clear()
    this.state.songFinished = false
  }

  /** 曲をリスタート */
  restartSong(world: MutableWorld): void {
    if (!this.currentChartKey || !this.state) return
    
    const chart = allCharts.get(this.currentChartKey)!
    if (!chart) return
    
    this.state.notes = this._buildNotesFromChart(chart, world.rules.bpm)
    this.state.nextNoteIndex = 0
    this.state.songTime = 0
    this.state.combo = 0
    this.state.maxCombo = 0
    this.state.perfectCount = 0
    this.state.greatCount = 0
    this.state.niceCount = 0
    this.state.missCount = 0
    this.state.health = 100
    this.state.playScore = 0
    this.state.judgePopups = []
    this.state.activeHolds.clear()
    this.state.songFinished = false
  }

  /** ゲームオーバーかどうか */
  isGameOver(): boolean {
    return this.state?.health <= 0 ?? false
  }

  /** クリア済みかどうか */
  isClear(): boolean {
    return this.state?.songFinished && (this.state?.health ?? 0) > 0 ?? false
  }

  /** 現在のスコアを取得 */
  getPlayScore(): number {
    return this.state?.playScore ?? 0
  }

  /** コンボ数を取得 */
  getCombo(): number {
    return this.state?.combo ?? 0
  }

  /** マックスコンボを取得 */
  getHealth(): number {
    return this.state?.health ?? 100
  }
}
