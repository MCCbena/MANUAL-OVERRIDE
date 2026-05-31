<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  survivedSec: number
  jumps: number
  movesLeft: number
  movesRight: number
  distance: number
}>()

// ── 各ヒントが「こなされた」かを追跡 ──────────────────
const movedDone  = ref(false)
const jumpedDone = ref(false)
const manualDone = ref(false)
const allDone    = ref(false)

// 操作が行われたら対応ヒントを消す
watch(() => props.movesLeft + props.movesRight, v => { if (v > 0) movedDone.value = true })
watch(() => props.jumps, v => { if (v > 0) jumpedDone.value = true })
watch(() => props.distance, v => {
  if (v > 150) manualDone.value = true  // 早めに説明書ヒントを消す
  if (v > 350) allDone.value = true     // 350px でオーバーレイ全消し
})
watch(() => props.survivedSec, v => {
  if (v > 8) allDone.value = true       // 8秒後に強制消去
})
</script>

<template>
  <Transition name="hints-fade">
    <div v-if="!allDone" class="tutorial-overlay">

      <!-- 移動ヒント -->
      <Transition name="hint-pop">
        <div v-if="!movedDone" class="hint hint-move">
          <div class="hint-step">① 移動</div>
          <div class="hint-keys">
            <kbd class="hint-key">← ArrowLeft</kbd>
            <kbd class="hint-key">→ ArrowRight</kbd>
          </div>
          <div class="hint-pulse" />
        </div>
      </Transition>

      <!-- ジャンプヒント -->
      <Transition name="hint-pop">
        <div v-if="!jumpedDone" class="hint hint-jump">
          <div class="hint-step">② ジャンプ</div>
          <div class="hint-keys">
            <kbd class="hint-key hint-key-wide">SPACE キー</kbd>
          </div>
          <div class="hint-pulse" />
        </div>
      </Transition>

      <!-- 説明書ヒント（右下の説明書を指す矢印） -->
      <Transition name="hint-pop">
        <div v-if="!manualDone" class="hint hint-manual">
          <div class="hint-manual-text">
            <span class="hint-manual-icon">📋</span>
            右下の説明書を確認
          </div>
          <div class="hint-manual-arrow">↘</div>
        </div>
      </Transition>

      <!-- 色ルール -->
      <div class="hint-colors">
        <span class="color-dot danger" />
        <span class="color-label">触れると失敗</span>
        <span class="color-sep">/</span>
        <span class="color-dot safe" />
        <span class="color-label">安全</span>
      </div>

    </div>
  </Transition>
</template>

<style scoped>
.tutorial-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 12;
}

/* ── 移動ヒント（左下） ── */
.hint {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.hint-move {
  bottom: 110px;
  left: 160px;
}

/* ── ジャンプヒント（プレイヤー上） ── */
.hint-jump {
  bottom: 200px;
  left: 120px;
}

.hint-keys { display: flex; gap: 4px; }

.hint-key {
  background: rgba(255,255,255,0.12);
  border: 1.5px solid rgba(255,255,255,0.35);
  border-bottom: 3px solid rgba(255,255,255,0.35);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  min-width: 28px;
  text-align: center;
}
.hint-key-wide { min-width: 64px; }

.hint-label {
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  font-family: monospace;
  letter-spacing: 1px;
}

.hint-step {
  font-size: 12px;
  font-weight: bold;
  color: rgba(255,255,255,0.8);
  font-family: monospace;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

/* キーが脈動 */
.hint-pulse {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.5);
  animation: pulseDot 1.2s ease-in-out infinite;
}
@keyframes pulseDot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1.0; transform: scale(1.3); }
}

/* ── 説明書ヒント（右下寄り） ── */
.hint-manual {
  bottom: 260px;
  right: 260px;
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.hint-manual-text {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  font-family: monospace;
}
.hint-manual-icon { font-size: 13px; }
.hint-manual-arrow {
  font-size: 18px;
  color: rgba(255,255,255,0.4);
  animation: arrowBounce 1s ease-in-out infinite;
}
@keyframes arrowBounce {
  0%, 100% { transform: translate(0,0); }
  50%       { transform: translate(3px, 3px); }
}

/* ── 色ルール（上中央） ── */
.hint-colors {
  position: absolute;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0,0,0,0.45);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 11px;
  font-family: monospace;
}
.color-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
}
.color-dot.danger { background: #e74c3c; box-shadow: 0 0 6px #e74c3c; }
.color-dot.safe   { background: #3498db; box-shadow: 0 0 6px #3498db; }
.color-label { color: rgba(255,255,255,0.7); }
.color-sep   { color: rgba(255,255,255,0.25); }

/* ── トランジション ── */
.hints-fade-leave-active { transition: opacity 0.8s ease; }
.hints-fade-leave-to     { opacity: 0; }

.hint-pop-enter-active { animation: hintIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.hint-pop-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.hint-pop-leave-to     { opacity: 0; transform: translateY(-8px); }
@keyframes hintIn {
  0%   { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}
</style>
