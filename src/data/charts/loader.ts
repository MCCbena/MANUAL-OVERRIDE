/**
 * data/charts/loader.ts
 *譜面JSONファイルをViteのglob importで自動ロードする。
 * src/data/charts/*.json に谱面ファイルを追加するだけで自動検出される。
 */

import type { ChartData } from './types'

// Vite glob import で谱面 JSON ファイルを自動収集
const chartModules = import.meta.glob<ChartData>('./charts/*.json', { eager: true })

/** 全谱面データのリスト（ファイル名キー付き） */
export const allCharts: Map<string, ChartData> = new Map()

// 各モジュールから谱面データを抽出して登録
for (const [path, module] of Object.entries(chartModules)) {
  if (path === './charts/index.ts') continue
  // default export または直接 export を取得
  const chart: ChartData | undefined = (module as { default?: ChartData }).default ?? (module as unknown as ChartData)
  if (chart && typeof chart.title === 'string' && typeof chart.bpm === 'number') {
    // ファイルパスからキーを生成（例: './charts/my_song.json' → 'my_song'）
    const key = path.replace(/^\.\/charts\//, '').replace(/\.json$/, '')
    allCharts.set(key, chart)
  } else {
    console.warn(`[ChartLoader] Invalid chart data in ${path}`)
  }
}

/** 谱面リストをタイトル順に取得 */
export function getChartList(): Array<{ key: string; title: string; artist: string; bpm: number; difficulty: number }> {
  return [...allCharts.values()]
    .map((chart, i) => ({
      key: [...allCharts.keys()][i],
      title: chart.title,
      artist: chart.artist,
      bpm: chart.bpm,
      difficulty: chart.difficulty,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** 指定キーの谱面データを取得 */
export function getChart(key: string): ChartData | undefined {
  return allCharts.get(key)
}

/** 全谱面のタイトル一覧を取得 */
export function getChartTitles(): string[] {
  return [...allCharts.keys()]
}
