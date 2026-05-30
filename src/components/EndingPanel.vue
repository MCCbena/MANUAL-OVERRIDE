<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { FinalScore, GenreId } from '../domain/types'
import { GENRES } from '../data/genres'

const props = defineProps<{
  finalScore: FinalScore
  genre: GenreId
  choiceCount: number
}>()

const emit = defineEmits<{ (e: 'restart'): void }>()

const genreDef = GENRES.find(g => g.id === props.genre)
const genreLabel = genreDef?.label ?? 'ゲーム'

const otherGenres = GENRES.filter(g => g.id !== props.genre && g.id !== 'base')

// ── カウントアップ ───────────────────────────────
const displayPlay  = ref(0)
const displayThrow = ref(0)
const displayTotal = ref(0)
const gradeVisible = ref(false)
const altVisible   = ref(false)

function grade(total: number): string {
  if (total >= 8000) return 'S'
  if (total >= 5000) return 'A'
  if (total >= 2500) return 'B'
  if (total >= 1000) return 'C'
  return 'D'
}

const gradeStr = computed(() => grade(props.finalScore.total))

// ジャンルごとのアクセントカラー
const accentColors: Record<string, string> = {
  runner: '#4488ff',
  stg:    '#44aaff',
  rpg:    '#aa8844',
  puzzle: '#444444',
  rhythm: '#cc44ff',
}
const accentColor = accentColors[props.genre] ?? '#cc2222'

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function animateCount(target: number, setter: (v: number) => void, delay: number, duration = 900): void {
  setTimeout(() => {
    const start = performance.now()
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1)
      setter(Math.round(easeOut(t) * target))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, delay)
}

onMounted(() => {
  animateCount(props.finalScore.play,  v => displayPlay.value  = v, 400)
  animateCount(props.finalScore.throw, v => displayThrow.value = v, 900)
  animateCount(props.finalScore.total, v => displayTotal.value = v, 1400, 600)
  setTimeout(() => { gradeVisible.value = true }, 2200)
  setTimeout(() => { altVisible.value   = true }, 2700)
})
</script>

<template>
  <div class="ending-overlay">
    <div class="ending-card">
      <!-- ジャンル確定 -->
      <div class="ending-genre-section">
        <div class="ending-genre-label">ゲームが完成しました</div>
        <div class="ending-genre-name" :style="{ '--accent': accentColor }">
          {{ genreLabel }}
        </div>
        <div class="ending-genre-sub">
          {{ choiceCount }} 回の選択で作りました
        </div>
      </div>

      <!-- スコア内訳 -->
      <div class="ending-score-box">
        <div class="score-row">
          <span class="score-label">プレイスコア</span>
          <span class="score-value">{{ displayPlay.toLocaleString() }}</span>
        </div>
        <div class="score-row">
          <span class="score-label">投擲スコア</span>
          <span class="score-value">{{ displayThrow.toLocaleString() }}</span>
        </div>
        <div class="score-divider" />
        <div class="score-row total">
          <span class="score-label">合計</span>
          <span class="score-value">{{ displayTotal.toLocaleString() }}</span>
        </div>
      </div>

      <!-- グレード -->
      <Transition name="grade-stamp">
        <div v-if="gradeVisible" class="ending-grade" :style="{ '--accent': accentColor }">
          {{ gradeStr }}
        </div>
      </Transition>

      <!-- 別ルート示唆 -->
      <Transition name="fade-up">
        <div v-if="altVisible" class="ending-alt">
          <div class="alt-label">別の選択をしていたら…</div>
          <div class="alt-routes">
            <span
              v-for="g in otherGenres"
              :key="g.id"
              class="alt-chip"
            >{{ g.label }}</span>
          </div>
          <div class="alt-hint">になっていたかもしれません。</div>
        </div>
      </Transition>

      <button class="restart-btn" @click="emit('restart')">もう一度遊ぶ</button>
    </div>
  </div>
</template>

<style scoped>
.ending-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(5px);
}

.ending-card {
  background: #fafaf5;
  border: 2px solid #1a1a1a;
  border-radius: 3px;
  padding: 30px 38px 24px;
  max-width: 460px;
  width: 92%;
  box-shadow:
    8px 8px 0 #1a1a1a,
    0 0 60px rgba(0,0,0,0.6);
  font-family: 'Courier New', Courier, monospace;
  text-align: center;
  animation: cardIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  position: relative;

  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 22px,
    rgba(0,0,0,0.022) 22px, rgba(0,0,0,0.022) 23px
  );
}

@keyframes cardIn {
  0%   { opacity: 0; transform: translateY(24px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── ジャンルセクション ── */
.ending-genre-section {
  margin-bottom: 22px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 16px;
}

.ending-genre-label {
  font-size: 10px;
  color: #aaa;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.ending-genre-name {
  font-size: 28px;
  font-weight: bold;
  color: var(--accent, #cc2222);
  letter-spacing: 1px;
  line-height: 1.2;
  margin-bottom: 6px;
  animation: genreReveal 0.6s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes genreReveal {
  0%   { opacity: 0; transform: scale(0.88); }
  100% { opacity: 1; transform: scale(1); }
}

.ending-genre-sub {
  font-size: 11px;
  color: #999;
  letter-spacing: 0.5px;
}

/* ── スコアボックス ── */
.ending-score-box {
  background: rgba(0,0,0,0.03);
  border: 1px solid #ddd;
  border-radius: 2px;
  padding: 14px 18px;
  margin-bottom: 16px;
  text-align: left;
}

.score-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 3px 0;
  font-size: 13px;
  color: #444;
}

.score-label {
  color: #888;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.score-value {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  color: #222;
}

.score-divider {
  height: 1px;
  background: #ccc;
  margin: 6px 0;
}

.score-row.total .score-label {
  font-size: 12px;
  color: #555;
  font-weight: bold;
  letter-spacing: 1px;
}

.score-row.total .score-value {
  font-size: 20px;
  color: #111;
}

/* ── グレード ── */
.ending-grade {
  font-size: 72px;
  font-weight: bold;
  color: var(--accent, #cc2222);
  line-height: 1;
  margin: 0 0 16px;
  text-shadow: 3px 3px 0 rgba(0,0,0,0.1);
}

.grade-stamp-enter-active {
  animation: gradeStamp 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
}
@keyframes gradeStamp {
  0%   { opacity: 0; transform: scale(2.2) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(0.9) rotate(1deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}

/* ── 別ルート示唆 ── */
.ending-alt {
  margin-bottom: 20px;
  font-size: 11px;
  color: #888;
}
.alt-label { margin-bottom: 8px; }
.alt-routes {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
  margin-bottom: 8px;
}
.alt-chip {
  background: #222;
  color: #eee;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 10.5px;
  letter-spacing: 0.3px;
}
.alt-hint { font-style: italic; color: #bbb; }

.fade-up-enter-active { animation: fadeUp 0.45s ease both; }
@keyframes fadeUp {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ── リスタートボタン ── */
.restart-btn {
  background: #1a1a1a;
  color: #fff;
  border: none;
  padding: 11px 36px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  border-radius: 2px;
  letter-spacing: 1.5px;
  transition: background 0.15s, transform 0.1s;
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
}
.restart-btn:hover { background: #cc0000; }
.restart-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0,0,0,0.3); }
</style>
