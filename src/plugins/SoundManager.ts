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

  register(impl: Partial<SoundHooks>) {
    this._impl = impl
  }

  onJump() {
    this._impl.onJump?.()
  }

  onLand() {
    this._impl.onLand?.()
  }

  onShoot() {
    this._impl.onShoot?.()
  }

  onHit() {
    this._impl.onHit?.()
  }

  onDeath() {
    this._impl.onDeath?.()
  }

  onGenreLock(genreId: string) {
    this._impl.onGenreLock?.(genreId)
  }

  onChoiceReveal() {
    this._impl.onChoiceReveal?.()
  }

  onChoiceSelect() {
    this._impl.onChoiceSelect?.()
  }

  onThrowStart() {
    this._impl.onThrowStart?.()
  }

  onThrowLand() {
    this._impl.onThrowLand?.()
  }

  onBeat(bpm: number) {
    this._impl.onBeat?.(bpm)
  }

  onCombo(count: number) {
    this._impl.onCombo?.(count)
  }
}

export const soundManager = new SoundManager()
