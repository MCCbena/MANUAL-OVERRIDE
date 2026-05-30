<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Choice } from '../domain/types'

const props = defineProps<{
  choices: Choice[]
  version: string
}>()

const emit = defineEmits<{
  (e: 'choose', choiceId: string): void
}>()

const selected = ref<string | null>(null)
const revealed = ref(false)

onMounted(() => {
  // カードが入ってきてから選択肢を表示するまでの遅延
  setTimeout(() => { revealed.value = true }, 120)
})

function pick(choiceId: string) {
  if (selected.value) return
  selected.value = choiceId
  setTimeout(() => emit('choose', choiceId), 480)
}
</script>

<template>
  <div class="choice-overlay">
    <!-- ノイズライン演出 -->
    <div class="scanline-overlay" />

    <div class="choice-card" :class="{ revealed }">
      <!-- ヘッダー -->
      <div class="choice-header">
        <div class="choice-stamp">UPDATE</div>
        <div class="choice-ver">ver.{{ version }} → ?</div>
        <div class="choice-prompt">
          説明書の内容を選んでください
        </div>
      </div>

      <!-- 選択肢 -->
      <div class="choice-options">
        <button
          v-for="(c, idx) in choices"
          :key="c.id"
          class="choice-btn"
          :class="{
            selected: selected === c.id,
            faded:    selected !== null && selected !== c.id,
            staggered: revealed,
          }"
          :style="{ '--delay': idx * 80 + 'ms' }"
          @click="pick(c.id)"
        >
          <span class="choice-index">{{ String.fromCharCode(65 + idx) }}</span>
          <span class="choice-label">{{ c.label }}</span>
          <span class="choice-arrow">→</span>
        </button>
      </div>

      <!-- フッター注記 -->
      <div class="choice-footnote">選んだ内容によってゲームが変わります</div>
    </div>
  </div>
</template>

<style scoped>
.choice-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  backdrop-filter: blur(3px);
}

/* スキャンラインノイズ */
.scanline-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 3px,
    rgba(0, 0, 0, 0.06) 3px,
    rgba(0, 0, 0, 0.06) 4px
  );
  pointer-events: none;
}

/* カード */
.choice-card {
  background: #fff;
  border: 2px solid #1a1a1a;
  border-radius: 3px;
  padding: 26px 30px 20px;
  max-width: 400px;
  width: 92%;
  box-shadow:
    6px 6px 0 #1a1a1a,
    0 0 40px rgba(0,0,0,0.5);
  font-family: 'Courier New', Courier, monospace;
  animation: cardEntrance 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;

  /* 微細な紙質 */
  background-image: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 22px,
    rgba(0,0,0,0.022) 22px, rgba(0,0,0,0.022) 23px
  );
}

@keyframes cardEntrance {
  0%   { opacity: 0; transform: translateY(-18px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* ヘッダー */
.choice-header {
  text-align: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 14px;
}

.choice-stamp {
  display: inline-block;
  background: #cc0000;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 3px;
  padding: 3px 10px;
  margin-bottom: 8px;
  transform: rotate(-1.5deg);
  box-shadow: 1px 1px 0 rgba(0,0,0,0.3);
}

.choice-ver {
  font-size: 11px;
  color: #999;
  letter-spacing: 1.5px;
  margin-bottom: 6px;
}

.choice-prompt {
  font-size: 14px;
  color: #222;
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* 選択肢リスト */
.choice-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.choice-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 2px solid #222;
  padding: 13px 16px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border-radius: 2px;
  transition: background 0.18s, border-color 0.18s, transform 0.1s;
  position: relative;
  overflow: hidden;

  /* 初期は非表示 */
  opacity: 0;
  transform: translateY(8px);
}

.choice-btn.staggered {
  animation: optionReveal 0.35s cubic-bezier(0.22, 1, 0.36, 1) var(--delay, 0ms) both;
}

@keyframes optionReveal {
  0%   { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

.choice-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #222;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.22s ease;
}

.choice-btn:hover::after { transform: scaleX(1); }
.choice-btn:hover .choice-label,
.choice-btn:hover .choice-index,
.choice-btn:hover .choice-arrow { color: #fff; position: relative; z-index: 1; }

.choice-btn:active { transform: translateY(1px); }

.choice-btn.selected {
  background: #cc0000;
  border-color: #aa0000;
  animation: selectedFlash 0.35s ease;
}
.choice-btn.selected .choice-label,
.choice-btn.selected .choice-index,
.choice-btn.selected .choice-arrow { color: #fff; }

@keyframes selectedFlash {
  0%   { background: #fff; }
  40%  { background: #ffcccc; }
  100% { background: #cc0000; }
}

.choice-btn.faded {
  opacity: 0.22;
  pointer-events: none;
}

.choice-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #222;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  border-radius: 2px;
  flex-shrink: 0;
  transition: background 0.18s, color 0.18s;
}

.choice-btn.selected .choice-index { background: rgba(255,255,255,0.2); }

.choice-label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  transition: color 0.18s;
}

.choice-arrow {
  font-size: 14px;
  color: #bbb;
  transition: color 0.18s;
}

/* フッター */
.choice-footnote {
  font-size: 10px;
  color: #bbb;
  text-align: center;
  letter-spacing: 0.5px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}
</style>
