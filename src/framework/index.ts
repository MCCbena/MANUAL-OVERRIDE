/**
 * framework/index.ts
 * マニュアルデッキ拡張フレームワークの公開 API。
 *
 * 新しいブランチを追加する方法は 2 通り：
 *
 * ① JSON ファイルを追加（コンテンツのみ、TS 不要）
 *    → src/data/manuals/ に *.json を追加するだけで自動収集される
 *
 * ② ManualBuilder で TypeScript から定義（プログラム的に生成したい場合）
 *    → build() で得たタプルを extendDeck() に渡す
 */

export { ManualBuilder } from './ManualBuilder'
export { loadFromGlob, buildFromFiles, extendDeck } from './ManualLoader'
export { validateDeck, devValidate } from './ManualValidator'
export type { ManualDeckFile, ManualEntryJSON, ChoiceJSON } from './types'
