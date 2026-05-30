import { ref } from 'vue'
import type { ManualVersion } from '../domain/types'

export function useManual(_currentManual: () => ManualVersion) {
  const history = ref<ManualVersion[]>([])
  const diffLines = ref<Array<{ text: string; type: 'added' | 'removed' | 'unchanged' }>>([])
  const isAnimating = ref(false)

  function recordUpdate(nextManual: ManualVersion) {
    const prev = history.value[history.value.length - 1]
    history.value.push(nextManual)
    if (history.value.length > 4) history.value.shift()

    // 初回（prev なし）は差分アニメーション不要
    if (!prev) {
      diffLines.value = []
      isAnimating.value = false
      return
    }

    const prevLines = prev.manualText
    const nextLines = nextManual.manualText
    const diff: typeof diffLines.value = []

    // 削除行（prev にあって next にない）
    for (const line of prevLines) {
      if (!nextLines.includes(line)) diff.push({ text: line, type: 'removed' })
    }
    // 追加行（next にあって prev にない）
    for (const line of nextLines) {
      if (!prevLines.includes(line)) diff.push({ text: line, type: 'added' })
    }
    // 不変行（next の順序に合わせて末尾に）
    for (const line of nextLines) {
      if (prevLines.includes(line)) diff.push({ text: line, type: 'unchanged' })
    }

    diffLines.value = diff
    isAnimating.value = true
    setTimeout(() => { isAnimating.value = false }, 1500)
  }

  return { history, diffLines, isAnimating, recordUpdate }
}
