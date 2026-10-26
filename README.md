# エネルギー換算ツール

量子化学・分光でよく使うエネルギー単位を「変換元 → 変換先」の選択式で換算する Web ツールです。

対応単位：**Hartree / eV / kcal/mol / kJ/mol / cm⁻¹ / nm / K**

- 内部では eV を基準に換算します（nm だけは光子の波長としてエネルギーに反比例）。
- 換算係数はハードコードせず、物理定数（**CODATA 2022** / SI 定義値）から導出しています。
- 入力・単位変更のたびにリアルタイムで再計算します。

## 構成

```
/
├── index.html
├── style.css
├── src/
│   ├── convert.ts   # 換算ロジック（DOM 非依存）
│   └── app.ts       # UI 処理
├── dist/            # tsc 出力（コミット済み・Pages が配信）
│   ├── convert.js
│   └── app.js
├── tests/
│   └── convert.test.ts
├── tsconfig.json
├── package.json
└── .github/workflows/test.yml
```

TypeScript ソースは `src/`、それを `tsc` でコンパイルした `dist/convert.js` /
`dist/app.js` をコミットし、GitHub Pages がそのまま配信します。

## 開発

依存のインストール：

```sh
npm install
```

型検査 + ビルド（`dist/convert.js` / `dist/app.js` を生成）：

```sh
npm run build
```

テスト（相対誤差 1e-9 以内で換算・表示フォーマットを検証）：

```sh
npm test
```

### ローカルで動作確認する

ES module を使うため、`index.html` をファイル（`file://`）として直接開くと
import が CORS でブロックされます。簡易サーバー経由で開いてください：

```sh
npm run build          # まず dist/ に JS を生成
python -m http.server  # もしくは `npx serve` など
# → http://localhost:8000 を開く
```

## 公開（GitHub Pages）

1. `npm run build` でコンパイル後の JS を生成してコミットする。
2. リポジトリの **Settings → Pages** で、Source を `main` ブランチ / `root` に設定する。

## ライセンス

[MIT](./LICENSE) © dmb4565
