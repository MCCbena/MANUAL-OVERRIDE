import type { BgmConfig } from '../domain/types'

export interface SoundHooks {
  onJump(): void
  onLand(): void
  onShoot(): void
  onHit(): void
  onDeath(): void
  onGenreLock(genreId: string): void
  onChoiceReveal(): void
  onChoiceSelect(): void
  onThrowStart(): void
  onThrowLand(): void
  onBeat(bpm: number): void
  onCombo(count: number): void
}

class SoundManager implements SoundHooks {
  private _impl: Partial<SoundHooks> = {}

  // ─── BGM管理 ───────────────────────────────────────────────
  private _bgmAudio: HTMLAudioElement | null = null
  private _bgmFadeTimer: number | null = null

  /**
   * BGMを再生する。既存BGMはフェードアウトしてから切り替える。
   * 音声ファイルが存在しない場合は静かに失敗する。
   */
  playBgm(config: BgmConfig): void {
    const { src, loop = true, volume = 0.5, fadeInMs = 1200 } = config

    // 既存BGMをフェードアウト
    if (this._bgmAudio) {
      const old = this._bgmAudio
      this._fadeVolume(old, 0, 400, () => {
        old.pause()
        old.src = ''
      })
    }
    if (this._bgmFadeTimer !== null) {
      clearInterval(this._bgmFadeTimer)
      this._bgmFadeTimer = null
    }

    const audio = new Audio(src)
    audio.loop = loop
    audio.volume = 0
    this._bgmAudio = audio

    audio.play().then(() => {
      this._fadeVolume(audio, volume, fadeInMs, null)
    }).catch(() => {
      // ファイルが存在しない or 再生不可 → 静かにスキップ
    })
  }

  /**
   * BGMをフェードアウトして停止する。
   */
  stopBgm(fadeOutMs = 800): void {
    if (!this._bgmAudio) return
    const audio = this._bgmAudio
    this._bgmAudio = null
    this._fadeVolume(audio, 0, fadeOutMs, () => {
      audio.pause()
      audio.src = ''
    })
  }

  /** volume を to まで durationMs かけてリニアにフェードする */
  private _fadeVolume(
    audio: HTMLAudioElement,
    to: number,
    durationMs: number,
    onDone: (() => void) | null,
  ): void {
    if (this._bgmFadeTimer !== null) clearInterval(this._bgmFadeTimer)

    const STEPS = 20
    const stepMs = durationMs / STEPS
    const from = audio.volume
    const delta = (to - from) / STEPS
    let step = 0

    this._bgmFadeTimer = window.setInterval(() => {
      step++
      audio.volume = Math.max(0, Math.min(1, from + delta * step))
      if (step >= STEPS) {
        clearInterval(this._bgmFadeTimer!)
        this._bgmFadeTimer = null
        audio.volume = to
        onDone?.()
      }
    }, stepMs)
  }

  // ─── SEフック ─────────────────────────────────────────────
  register(impl: Partial<SoundHooks>) {
    this._impl = impl
  }

  onJump() { this._impl.onJump?.() }
  onLand() { this._impl.onLand?.() }
  onShoot() { this._impl.onShoot?.() }
  onHit() { this._impl.onHit?.() }
  onDeath() { this._impl.onDeath?.() }
  onGenreLock(genreId: string) { this._impl.onGenreLock?.(genreId) }
  onChoiceReveal() { this._impl.onChoiceReveal?.() }
  onChoiceSelect() { this._impl.onChoiceSelect?.() }
  onThrowStart() { this._impl.onThrowStart?.() }
  onThrowLand() { this._impl.onThrowLand?.() }
  onBeat(bpm: number) { this._impl.onBeat?.(bpm) }
  onCombo(count: number) { this._impl.onCombo?.(count) }
}

export const soundManager = new SoundManager()
