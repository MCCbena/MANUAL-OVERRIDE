# 新しい分岐を追加する方法

## 方法① JSON ファイル（推奨）

`src/data/manuals/` に `*.json` ファイルを作成するだけで自動収集される。

### 手順

1. `TEMPLATE.json` をコピーして名前を変える（例: `rpg-branch.json`）
2. 中身を編集する
3. 既存バージョンの `choices[].next` から新しいキーへ参照を張る

### ファイル構造

```json
{
  "id": "my-branch",
  "description": "開発者向けメモ（省略可）",
  "entries": [
    {
      "key": "2.0-my-branch",          // MANUAL_DECK のキー（一意であること）
      "version": "2.0",                // 説明書ヘッダーに表示
      "manualText": [
        "説明書の1行目。",
        "2行目。4〜6行が見やすい。"
      ],
      "image": "my_image.png",         // public/manuals/ に画像を置く（省略可）
      "imageAlt": "代替テキスト",
      "controls": {
        "jump": "Space",
        "moveLeft": "ArrowLeft",
        "moveRight": "ArrowRight",
        "shoot": "z"                   // 射撃が必要なら追加
      },
      "hazards": {
        "colors": ["red"],
        "safeColors": ["blue"]
      },
      "choices": [
        {
          "label": "プレイヤーに見せるテキスト（ジャンル方向は隠す）",
          "next": "3.0-my-branch-a",   // 次のバージョンキー
          "genreParams": { "tempo": 2 },
          "hint": "開発者メモ: RUNNER方向"  // プレイヤーには非表示
        }
      ]
    }
  ]
}
```

### `genreParams` の意味

| キー | 効果 | 主に影響するジャンル |
|---|---|---|
| `tempo` | 速度感・オートラン寄り | RUNNER |
| `range` | 遠距離・射撃寄り | STG |
| `enemy` | 敵・戦闘寄り | STG |
| `combo` | 連続攻撃・コンボ寄り | PUZZLE |
| `growth` | 成長・収集寄り | RPG |
| `rhythm` | リズム・BPM寄り | RHYTHM |

各ジャンルの閾値は `src/data/genres.ts` に定義されている。

### 画像の置き場所

```
public/
  manuals/
    my_image.png   ← ここに置く
```

JSON で `"image": "my_image.png"` と書くと自動的に `/manuals/my_image.png` に解決される。

---

## 方法② TypeScript の ManualBuilder API

プログラム的に生成したい場合（条件分岐・ランダム等）。

```typescript
// src/data/manualDeck.ts の末尾に追記する例:
import { ManualBuilder, extendDeck } from '../framework'

const [key, ver] = new ManualBuilder('2.0-special', '2.0')
  .texts([
    '特別バージョンのテキストです。',
    '条件に応じて内容が変わります。',
  ])
  .image('special.png', '特別版イラスト')
  .controls({ jump: 'Space', moveLeft: 'ArrowLeft', moveRight: 'ArrowRight' })
  .hazards({ colors: ['red'], safeColors: ['blue'] })
  .choice('高速化する', { tempo: 3 }, '3.0-fast')
  .choice('別の方向へ', { range: 2 }, '3.0-other')
  .build()

extendDeck(MANUAL_DECK, [[key, ver]])
```

---

## バリデーション

開発サーバー起動時またはビルド時に自動チェックが走る。

| チェック内容 | 重大度 |
|---|---|
| `choices[].next` が存在しないキーを指している | ❌ エラー |
| ルートキー `"1.0"` が存在しない | ❌ エラー |
| 循環参照（A→B→A のようなループ） | ❌ エラー |
| どこからも参照されていないエントリー | ⚠️ 警告 |

ブラウザのコンソールで確認できる。

---

## フレームワーク API リファレンス

```typescript
import { ManualBuilder, loadFromGlob, buildFromFiles, extendDeck, validateDeck } from '../framework'

// Builder
new ManualBuilder(key, versionLabel)
  .text(line)            // 本文1行追加
  .texts(lines[])        // 複数行まとめて追加
  .image(path, alt?)     // イラスト設定
  .controls({...})       // 操作キー設定（部分更新可）
  .hazards({...})        // 危険/安全色設定
  .choice(label, genreParams, next, id?, hint?)  // 選択肢追加
  .build()               // → [key, ManualVersion]

// Loader
loadFromGlob(import.meta.glob(...))  // glob結果から構築
buildFromFiles([file1, file2, ...])   // 静的インポートから構築
extendDeck(deck, [[key, ver], ...])  // 既存デッキに追加

// Validator
validateDeck(deck)   // → { ok, errors, warnings }
devValidate(deck)    // 開発時のみコンソール出力
```
