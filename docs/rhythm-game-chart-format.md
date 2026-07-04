# プロセカ風リズムゲーム 譜面フォーマット

## 概要

MANUAL-OVERRIDEのリズムゲームジャンルは、プロセカ（プロジェクトセカイ）風のノートスクロール式リズムゲームです。
譜面データはJSON形式で`src/data/charts/`ディレクトリに配置し、ビルド時に自動的に読み込まれます。

## ファイル構造

```
src/data/charts/
├── types.ts              # 型定義
├── loader.ts             # 自動ロードロジック
├── demo_easy.json        # イージー譜面（例）
└── demo_hard.json        # ハード譜面（例）
```

## JSONフォーマット

### ルートオブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `title` | string | ✓ | 曲タイトル |
| `artist` | string | ✓ | アーティスト名 |
| `bpm` | number | ✓ | BPM（ビート・パー・ミニット） |
| `difficulty` | number | ✓ | 難易度 (1-10) |
| `sections` | SectionDef[] | ✓ | セクションリスト |
| `noteCount` | number | ✗ | ノート総数（メタ情報、自動計算可） |

### SectionDef

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | string | ✓ | セクション名（INTRO, A-Meteru, Chorus等） |
| `notes` | NoteDef[] | ✓ | ノートリスト |

### NoteDef

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `time` | number | ✓ | 発生タイミング（ミリ秒、曲開始からの絶対時間） |
| `lane` | number | ✓ | レーンインデックス (0-4) |
| `type` | string | ✓ | ノートタイプ (`"tap"` \| `"hold"` \| `"flick"`) |
| `holdLength` | number | ✗ | ホールド長（ミリ秒）。`type: "hold"` のみ必須 |

## 判定システム

4段階の判定があります：

| 判定レベル | タイムウィンドウ | 基本スコア | HP変化 |
|-----------|-----------------|-----------|--------|
| PERFECT | ±45ms | 320 | +2 |
| GREAT | ±90ms | 280 | +1 |
| NICE | ±140ms | 150 | 0 |
| MISS | ±200ms | 0 | -5 |

### コンボシステム

- 連続ヒットでコンボ数が上昇
- コンボ倍率: `1.0 + (combo × 0.02)` （最大4.0倍）
- MISSでコンボリセット
- ヘルスバーが0になるとゲームオーバー

## レーン構成

5レーン構成（プロセカ準拠）：

```
[0] [1] [2] [3] [4]
 P  R  G  Y  V
 pink cyan yellow green violet
```

各レーンの色は`RhythmFeature.ts`の`LANE_COLORS`配列で定義されています。

## ノートタイプ

### tap（タップ）
- 単発ノート
- ジャッジラインに到達したタイミングでボタンを押す
- 最も基本的なノート

### hold（ホールド）
- 長押しノート
- `holdLength` でホールド時間を指定（ミリ秒）
- 押下開始時と解放時の両方で判定
- ホールド中はトラックが描画される

### flick（フリック）
- スライドノート
- タップと同様のタイミングで操作
- ビジュアルエフェクトが異なる

## 譜面の書き方

### 基本的な例

```json
{
  "title": "My Song",
  "artist": "Artist Name",
  "bpm": 140,
  "difficulty": 5,
  "sections": [
    {
      "name": "Intro",
      "notes": []
    },
    {
      "name": "Verse",
      "notes": [
        {"time": 4000, "lane": 2, "type": "tap"},
        {"time": 6000, "lane": 1, "type": "tap"},
        {"time": 8000, "lane": 3, "type": "tap"}
      ]
    },
    {
      "name": "Chorus",
      "notes": [
        {"time": 12000, "lane": 0, "type": "hold", "holdLength": 800},
        {"time": 13000, "lane": 4, "type": "flick"},
        {"time": 14000, "lane": 2, "type": "tap"}
      ]
    }
  ]
}
```

### 複雑なパターン

```json
{
  "name": "Fast Section",
  "notes": [
    {"time": 20000, "lane": 0, "type": "tap"},
    {"time": 20100, "lane": 1, "type": "tap"},
    {"time": 20200, "lane": 2, "type": "tap"},
    {"time": 20300, "lane": 3, "type": "flick"},
    {"time": 20400, "lane": 4, "type": "tap"}
  ]
}
```

### ホールドノートの例

```json
{
  "name": "Hold Section",
  "notes": [
    {"time": 30000, "lane": 2, "type": "hold", "holdLength": 1500},
    {"time": 32000, "lane": 0, "type": "hold", "holdLength": 800}
  ]
}
```

## 自動ロード

`src/data/charts/loader.ts`が`import.meta.glob`を使用して`charts/*.json`を自動的に読み込みます。
新しい譜面ファイルを追加するだけで、ビルド時に自動的に検出されます。

### 曲の選択

- 譜面が1つのみの場合：その曲が自動で選択される
- 複数の場合：ランダムに選択される
- 譜面がない場合：デモノート（簡易パターン）でプレイ可能

## 制御キー

| キー | 操作 |
|------|------|
| `Space` | タップ/ホールド開始 |
| `Z` | ショートカット（tap/flick判定用） |

## カスタマイズ

### 判定ウィンドウの変更

`RhythmFeature.ts`の定数を変更：

```typescript
const JUDGE_WINDOWS: Record<JudgeLevel, number> = {
  perfect: 45,  // ms
  great:   90,  // ms
  nice:    140, // ms
  miss:    200, // ms
}
```

### ノート速度の変更

```typescript
const NOTE_SCROLL_SPEED = 800 // px/s
```

### レーン数の変更

```typescript
const LANE_COUNT = 5 // または 4, 6, 7 など
```

## テスト

譜面ファイルを追加した後、ゲームを起動して以下を確認：

1. 曲が自動でロードされる
2. ノートがジャッジラインに向かってスクロールする
3. タイミングよくボタンを押すと判定が表示される
4. コンボカウンターとスコアが更新される
5. ホールドノートが正しく操作できる

## トラブルシューティング

### ノートが表示されない

- `time` フィールドが正しく設定されているか確認
- JSONファイルの構文エラーがないか確認
- ブラウザーの開発者ツールでコンソールエラーを確認

### 判定がずれる

- BPMとノートの`time`値が一致しているか確認
- スクロール速度が適切か確認
- タイムウィンドウの設定が正しいか確認

## 参考リンク

- [プロジェクトセカイ 公式サイト](https://projectsekai.jp/)
- [譜面作成ツール（外部）](https://github.com/search?q=project+sekai+chart+editor)
