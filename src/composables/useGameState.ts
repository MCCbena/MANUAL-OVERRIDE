import { reactive, ref, readonly } from 'vue'
import type { Phase, GenreId, RuntimeRules, FinalScore, ManualVersion, ManualCard, GenreParam, BayesianState,
  ActionStats, PlayStyleResult, ContradictionState, SurpriseEnding, ChoiceRecord as ChoiceRecordType } from '../domain/types'
import { BAYES_DEBUG_TOP_N } from '../domain/types'
import { MANUAL_DECK } from '../data/manualDeck'
import { GENRES } from '../data/genres'
import { buildRuntimeRules, type ChoiceRecord, accumulateWithMultiplier } from '../domain/ruleEngine'
import {
  resolveHighestProbGenre,
  initBayesianState,
  updateBayesianState,
  DEFAULT_BAYES_CONFIG,
} from '../domain/genreResolver'
import { calcThrowScore, calcFinalScore } from '../domain/scoreCalc'
import type { ThrowResult } from '../domain/types'
import { soundManager } from '../plugins/SoundManager'
import { sampleCards, CARD_POOL } from '../data/cardPool'
import { MAX_ROUNDS, DEFAULT_FALLBACK_GENRE, PARAM_JITTER_RANGE } from '../data/gameBalance'
import { detectPlayStyle } from '../domain/playStyleDetector'
import { trackContradictions, shouldTriggerGlitchEnd } from '../domain/contradictionTracker'
import surpriseEndingConditions from '../data/config/surprise-ending-conditions.json'

// genreParams のジッター幅（±20%）
// gameBalance.ts からインポート済み

// ─────────────────────────────────────────────────────────────
// プレイスタイル・矛盾・サプライズエンド（Issue #24）
// ─────────────────────────────────────────────────────────────

/** プレイスタイル検出結果（ゲーム終了時に計算） */
export function computePlayStyle(stats: ActionStats): PlayStyleResult {
  return detectPlayStyle(stats)
}

/** 矛盾状態を計算（選択履歴から） */
export function computeContradiction(history: ChoiceRecord[]): ContradictionState {
  return trackContradictions(history)
}

/** サプライズエンドを判定（矛盾・プレイスタイル・選択履歴から） */
export function computeSurpriseEnding(
  contradiction: ContradictionState,
  playStyle: PlayStyleResult | null,
  choiceHistory: ChoiceRecord[],
): SurpriseEnding | null {
  // 1. glitch エンド：矛盾スコアが閾値を超えていれば即座に発動
  if (shouldTriggerGlitchEnd(contradiction)) {
    return {
      type: 'glitch',
      title: 'ゲームが壊れました',
      description: 'あなたが選んだ矛盾が、ゲームそのものを壊しました。これは誰も予想しなかった結末です。',
      forcedGenre: 'glitch',
    }
  }

  // 選択履歴から累積パラメータを取得（hidden_genre判定用）
  const accumulatedParams = accumulateWithMultiplier(choiceHistory)

  // 2. hidden_genre 判定：条件テーブルに合致するかチェック
  const hiddenEnding = checkHiddenGenre(accumulatedParams, choiceHistory)
  if (hiddenEnding) return hiddenEnding

  // 3. bad_ending 判定：プレイスタイルに基づく結末
  const badEnding = checkBadEnding(playStyle, contradiction.score, choiceHistory.length)
  if (badEnding) return badEnding

  // 4. narrative_twist 判定：選択履歴のパターンによる分岐
  const twistEnding = checkNarrativeTwist(choiceHistory)
  if (twistEnding) return twistEnding

  // どれも該当しなければ通常エンド（null）
  return null
}

/** hidden_genre の条件を満たすかチェック */
function checkHiddenGenre(accumulated: ReturnType<typeof accumulateWithMultiplier>, history: ChoiceRecord[]): SurpriseEnding | null {
  for (const condition of surpriseEndingConditions.hidden_genre) {
    const trigger = condition.trigger

    if (trigger.type === 'genre_params') {
      // 指定されたパラメータの閾値を超えるかチェック
      let meetsThresholds = true
      for (const [param, threshold] of Object.entries(trigger.thresholds)) {
        const value = accumulated[param as GenreParam] ?? 0
        if (value < threshold) {
          meetsThresholds = false
          break
        }
      }

      // 必要なカードIDが選択履歴に含まれているか確認（オプション）
      if (meetsThresholds && trigger.requiredChoices) {
        const selectedIds = new Set(history.map(r => r.choiceId))
        const hasRequired = trigger.requiredChoices.every(id => selectedIds.has(id))
        if (!hasRequired) continue
      }

      if (meetsThresholds) {
        return {
          type: 'hidden_genre',
          title: condition.title,
          description: condition.description,
          forcedGenre: trigger.resultGenre as GenreId,
        }
      }
    }
  }

  return null
}

/** bad_ending の条件を満たすかチェック */
function checkBadEnding(playStyle: PlayStyleResult | null, contradictionScore: number, roundCount: number): SurpriseEnding | null {
  if (!playStyle) return null

  for (const condition of surpriseEndingConditions.bad_ending) {
    const trigger = condition.trigger

    if (trigger.type === 'play_style') {
      // プレイスタイルが一致し、信頼度が閾値以上かチェック
      if (playStyle.style !== trigger.style || playStyle.confidence < trigger.minConfidence) {
        continue
      }

      // 矛盾スコアの上限条件（オプション）
      if (trigger.maxContradictionScore && contradictionScore >= trigger.maxContradictionScore) {
        continue
      }

      // ラウンド数の上限条件（オプション）
      if (trigger.maxRounds && roundCount > trigger.maxRounds) {
        continue
      }

      return {
        type: 'bad_ending',
        title: condition.title,
        description: condition.description,
      }
    }
  }

  return null
}

/** narrative_twist の条件を満たすかチェック */
function checkNarrativeTwist(history: ChoiceRecord[]): SurpriseEnding | null {
  const selectedIds = new Set(history.map(r => r.choiceId))

  for (const condition of surpriseEndingConditions.narrative_twist) {
    const trigger = condition.trigger

    if (trigger.type === 'pattern') {
      // 必須のカードIDが含まれているかチェック
      const hasRequired = trigger.requiredChoices.every(id => selectedIds.has(id))
      if (!hasRequired) continue

      // additionalConditions をチェック（オプション）
      if (trigger.additionalConditions) {
        const ac = trigger.additionalConditions

        // 矛盾スコアの下限条件（簡易実装：contradictionState は直接渡せないため、後で補完可能）
        if (ac.minContradictionScore) {
          // TODO: 矛盾状態をこの関数に渡す必要があるか検討
          continue
        }

        // ラウンド数の下限条件（簡易実装：history の長さをカウント）
        if (ac.minRoundCount && history.length < ac.minRoundCount) {
          continue
        }

        // 最大パラメータ値の上限条件（例：tempo <= maxTempoValue）
        if (ac.maxTempoValue) {
          const accumulated = accumulateWithMultiplier(history)
          if ((accumulated.tempo ?? 0) > ac.maxTempoValue) {
            continue
          }
        }

        // 他の条件（badEndingNotTriggered など）は後で拡張可能
      }

      return {
        type: 'narrative_twist',
        title: condition.title,
        description: condition.description,
      }
    }
  }

  return null
}

export function useGameState() {
  const phase = ref<Phase>('title')
  const lockedGenre = ref<GenreId | null>(null)
  const finalScore = ref<FinalScore | null>(null)

  // サプライズエンド関連（Issue #24）
  const playStyle = ref<PlayStyleResult | null>(null)
  const contradiction = ref<ContradictionState>({ pairs: [], score: 0, hasEffect: false })
  const surpriseEnding = ref<SurpriseEnding | null>(null)

  // カードラウンド管理
  const roundCount = ref(0)
  const activeCards = ref<ManualCard[]>([])
  const lastShownCardIds = ref(new Set<string>())

  // 選択履歴（genreResolver に渡す）
  const choiceHistory = reactive<ChoiceRecord[]>([])

  // 説明書本文（選択のたびに追記される）
  const accumulatedManualText = ref<string[]>([...MANUAL_DECK['1.0'].manualText])

  // 現在の障害物設定（カードで上書き可能）
  const currentHazards = ref({ ...MANUAL_DECK['1.0'].hazards })

  // 最後に選んだカードの runtimeConfig（buildRuntimeRules に渡す）
  const lastRuntimeConfig = ref<ManualVersion['runtimeConfig']>(undefined)

  // ベイズ状態（事後確率分布を追跡）
  const bayesState = reactive<BayesianState>(initBayesianState(GENRES))

  // 現在有効なルール（ゲームループが参照）
  const rules = reactive<RuntimeRules>(
    buildRuntimeRules(MANUAL_DECK['1.0'], [], null)
  )

  function _buildFakeManual(): ManualVersion {
    return {
      version: `${roundCount.value}/${MAX_ROUNDS}`,
      manualText: accumulatedManualText.value,
      choices: [],
      hazards: currentHazards.value,
      runtimeConfig: lastRuntimeConfig.value,
      learningRules: MANUAL_DECK['1.0'].learningRules,
    }
  }

  function _rebuildRules() {
    const next = buildRuntimeRules(
      _buildFakeManual(),
      choiceHistory,
      lockedGenre.value,
    )
    Object.assign(rules, next)
  }

  function _syncBayesState(newState: BayesianState) {
    bayesState.converged = newState.converged
    bayesState.convergedGenre = newState.convergedGenre
    bayesState.updateCount = newState.updateCount
    for (const genre of GENRES) {
      bayesState.posteriors[genre.id] = newState.posteriors[genre.id] ?? 0
    }
  }

  // ─── フェーズ遷移 ─────────────────────────────────────────
  function startGame() {
    phase.value = 'tutorialIntro'
    _syncBayesState(initBayesianState(GENRES))
    _rebuildRules()
  }

  function startTutorial() {
    phase.value = 'tutorial'
  }

  // 説明書更新トリガー: カードをサンプリングして updating フェーズへ。
  // カードが1枚も取れなかった場合は false を返す。
  function triggerUpdate(): boolean {
    const cards = sampleCards(2, lastShownCardIds.value, bayesState.posteriors)
    if (cards.length === 0) return false
    activeCards.value = cards
    lastShownCardIds.value = new Set(cards.map(c => c.id))
    phase.value = 'updating'
    return true
  }

  // プレイヤーがカードを選んだとき
  function choose(cardId: string): string | undefined {
    const card = activeCards.value.find(c => c.id === cardId)
    if (!card) return 'カードが見つかりません'

    soundManager.onChoiceSelect()

    // genreParams のジッター（±PARAM_JITTER_RANGE の幅でランダムブレ）
    const jitter = 1 + (Math.random() - 0.5) * PARAM_JITTER_RANGE
    const jitteredParams: Partial<Record<GenreParam, number>> = {}
    for (const [k, v] of Object.entries(card.genreParams ?? {}) as [GenreParam, number][]) {
      jitteredParams[k] = v * jitter
    }

    choiceHistory.push({
      choiceId: cardId,
      genreParams: jitteredParams,
      paramMultiplier: card.paramMultiplier,
      genrePoints: card.genrePoints,
    })

    // 矛盾カード処理
    if (card.conflictsWith?.length) {
      for (const conflictId of card.conflictsWith) {
        const wasSelected = choiceHistory.some(h => h.choiceId === conflictId)
        if (!wasSelected) continue
        const conflictedCard = CARD_POOL.find(c => c.id === conflictId)
        if (!conflictedCard) continue
        for (const line of conflictedCard.manualText) {
          const idx = accumulatedManualText.value.indexOf(line)
          if (idx >= 0) accumulatedManualText.value[idx] = `~~${line}~~`
        }
      }
    }

    // 説明書本文に追記
    for (const line of card.manualText) {
      if (!accumulatedManualText.value.includes(line) && !accumulatedManualText.value.includes(`~~${line}~~`)) {
        accumulatedManualText.value.push(line)
      }
    }

    // 障害物設定を上書き
    if (card.hazards) {
      currentHazards.value = { ...card.hazards }
    }

    // runtimeConfig を更新
    if (card.runtimeConfig) {
      lastRuntimeConfig.value = card.runtimeConfig
    }

    roundCount.value++

    // ベイズ更新
    const accumulated = accumulateWithMultiplier(choiceHistory)
    const newState = updateBayesianState(bayesState, accumulated, GENRES)
    _syncBayesState(newState)

    // デバッグログ
    const sorted = GENRES
      .filter(g => g.id !== 'base')
      .sort((a, b) => (newState.posteriors[b.id] ?? 0) - (newState.posteriors[a.id] ?? 0))
      .slice(0, BAYES_DEBUG_TOP_N)
      .map(g => `  ${g.id.padEnd(14)} ${((newState.posteriors[g.id] ?? 0) * 100).toFixed(1)}%`)
      .join('\n')
    console.warn(`[BAYES] round #${roundCount.value} | cardId=${cardId}`)
    console.warn(`[BAYES] Top${BAYES_DEBUG_TOP_N}:\n${sorted}`)
    console.warn(`[BAYES] converged=${newState.converged} | genre=${newState.convergedGenre ?? '—'} | criteria=minProb${(DEFAULT_BAYES_CONFIG.minProb * 100).toFixed(0)}% ratio>=${DEFAULT_BAYES_CONFIG.dominanceRatio}x`)

    // ジャンル確定済みなら説明書更新のみ
    if (lockedGenre.value !== null) {
      _rebuildRules()
      phase.value = 'genreLocked'
      return undefined
    }

    // ジャンル収束チェック
    if (roundCount.value >= MAX_ROUNDS || newState.converged) {
      lockedGenre.value = newState.convergedGenre ?? resolveHighestProbGenre(accumulated, GENRES)
      if (lockedGenre.value === 'base') {
        lockedGenre.value = DEFAULT_FALLBACK_GENRE as GenreId
      }
      // ジャンル確定文を説明書本文に追記
      const genreDef = GENRES.find(g => g.id === lockedGenre.value)
      if (genreDef?.manualReveal) {
        accumulatedManualText.value.push('', genreDef.manualReveal)
      }
      soundManager.onGenreLock(lockedGenre.value)
      _rebuildRules()
      phase.value = 'genreLocked'
    } else {
      _rebuildRules()
      phase.value = 'playing'
    }
    return undefined
  }

  function startThrowing() {
    soundManager.onThrowStart()
    phase.value = 'throwing'
  }

  function finalizeThrowing(throwResult: ThrowResult, playScoreRaw: number, gameStats?: ActionStats) {
    soundManager.onThrowLand()

    // 矛盾状態を計算
    const contradictionState = computeContradiction(choiceHistory)
    contradiction.value = contradictionState

    // プレイスタイル検出（ゲーム統計が渡された場合）
    if (gameStats) {
      playStyle.value = computePlayStyle(gameStats)
    }

    // サプライズエンド判定
    const ending = computeSurpriseEnding(contradictionState, playStyle.value ?? {
      style: 'balanced',
      confidence: 0,
      scores: { aggressive: 0, defensive: 0, explorer: 0, balanced: 0, chaotic: 0, passive: 0 },
    }, choiceHistory)
    surpriseEnding.value = ending

    // glitch エンドがトリガーされたらジャンルを強制書き換え
    if (ending?.forcedGenre) {
      lockedGenre.value = ending.forcedGenre as GenreId
    }

    const throwScore = calcThrowScore(throwResult)
    finalScore.value = calcFinalScore(playScoreRaw, throwScore)
    phase.value = 'ending'
  }

  function restart() {
    phase.value = 'title'
    roundCount.value = 0
    activeCards.value = []
    lastShownCardIds.value = new Set()
    choiceHistory.splice(0)
    lockedGenre.value = null
    finalScore.value = null
    accumulatedManualText.value = [...MANUAL_DECK['1.0'].manualText]
    currentHazards.value = { ...MANUAL_DECK['1.0'].hazards }
    lastRuntimeConfig.value = undefined
    playStyle.value = null
    contradiction.value = { pairs: [], score: 0, hasEffect: false }
    surpriseEnding.value = null
    _syncBayesState(initBayesianState(GENRES))
    _rebuildRules()
  }

  // ManualPanel / ThrowOverlay に渡す表示用オブジェクト
  const currentManual = () => _buildFakeManual()

  const lockedGenreDef = () => GENRES.find(g => g.id === lockedGenre.value) ?? null

  return {
    phase: readonly(phase),
    rules: readonly(rules) as RuntimeRules,
    choiceHistory: readonly(choiceHistory),
    lockedGenre: readonly(lockedGenre),
    finalScore: readonly(finalScore),
    activeCards: readonly(activeCards),
    roundCount: readonly(roundCount),
    maxRounds: MAX_ROUNDS,
    bayesState: readonly(bayesState) as BayesianState,
    // Issue #24: サプライズエンド関連
    playStyle: readonly(playStyle),
    contradiction: readonly(contradiction),
    surpriseEnding: readonly(surpriseEnding),
    currentManual,
    lockedGenreDef,
    startGame,
    startTutorial,
    triggerUpdate,
    choose,
    startThrowing,
    finalizeThrowing,
    restart,
  }
}
