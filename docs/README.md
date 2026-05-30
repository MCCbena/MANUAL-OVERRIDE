# 取扱説明書を読むゲーム — Framework ドキュメント

横スクロールを起点にジャンルが変容するゲームの技術フレームワーク概要です。

---

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [architecture.md](architecture.md) | レイヤー構成・データフロー・ファイルマップ |
| [genre-system.md](genre-system.md) | 21ジャンル一覧・収束アルゴリズム・GenreParams |
| [feature-ids.md](feature-ids.md) | 全 FeatureId リファレンス（カテゴリ別） |
| [genre-plugin.md](genre-plugin.md) | GenrePlugin の実装方法・全フック一覧 |
| [feature-system.md](feature-system.md) | FeatureSystem の実装方法・全フック一覧 |
| [manual-json.md](manual-json.md) | 説明書 JSON スキーマ完全リファレンス |

---

## クイックスタート

### 新ジャンルを追加する

```
1. src/domain/types.ts   → GenreId に追加
2. src/data/genres.ts    → GENRES 配列に GenreDef を追加
3. src/genres/           → GenrePlugin クラスを新規作成
4. src/genres/index.ts   → registerGenre(new MyPlugin()) を1行追加
5. src/data/manuals/     → 対応ルートの JSON を追加・修正
```

詳細: [genre-plugin.md](genre-plugin.md)

### 新フィーチャーを追加する

```
1. src/domain/types.ts        → FeatureId に追加
2. src/game/systems/          → FeatureSystem クラスを新規作成
3. src/game/systems/index.ts  → registerFeature(new MyFeature()) を1行追加
4. src/data/genres.ts         → 該当ジャンルの enableFeatures に追加
```

詳細: [feature-system.md](feature-system.md)

### 説明書ルートを追加する

```
src/data/manuals/*.json に新しいブランチファイルを追加するだけ。
コードの変更不要。
```

詳細: [manual-json.md](manual-json.md)

---

## 設計原則

- **JSON ドリブン** — ジャンル定義・スコア式・説明書テキストはすべてデータ
- **プラグイン分離** — ジャンルとフィーチャーは `GameRegistry` を通じて疎結合
- **オフライン完結** — ビルド後の `dist/` だけで動作。サーバー不要
- **sideScroller は物理だけ** — ゲームロジックは FeatureSystem / GenrePlugin に委譲
