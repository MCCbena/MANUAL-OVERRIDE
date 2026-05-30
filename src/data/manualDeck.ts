/**
 * manualDeck.ts
 *
 * MANUAL_DECK の構築エントリーポイント。
 *
 * ─────────────────────────────────────────────────────
 * 新しいブランチを追加する方法（2通り）:
 *
 * ① JSON ファイルを追加（推奨: コンテンツのみ、TS 不要）
 *    src/data/manuals/ に *.json を作成するだけ。
 *    import.meta.glob が自動収集するので他の変更不要。
 *    → フォーマット: src/data/manuals/TEMPLATE.json を参照
 *
 * ② TypeScript の ManualBuilder を使う（動的生成・条件分岐が必要な場合）
 *    import { ManualBuilder, extendDeck } from '../framework'
 *    const [key, ver] = new ManualBuilder('my-key', '2.5').text('...').build()
 *    extendDeck(MANUAL_DECK, [[key, ver]])
 * ─────────────────────────────────────────────────────
 */

import { loadFromGlob, devValidate } from '../framework'

// src/data/manuals/*.json を自動収集（ビルド時に静的バンドル）
// TEMPLATE.json は除外（サンプルファイル）
// 新しい JSON ファイルを追加するだけで自動的にデッキに組み込まれる
const _rawModules = import.meta.glob(
  ['./manuals/*.json', '!./manuals/TEMPLATE.json'],
  { eager: true },
)

export const MANUAL_DECK = loadFromGlob(_rawModules)

// 開発中のみ整合性チェックを実行（本番ビルドでは除去される）
devValidate(MANUAL_DECK)
