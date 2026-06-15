# Walkthrough: VS Code警告の抑止

## 対応内容
VS CodeのYAML/GitHub Actions拡張機能にて `Value 'github-pages' is not valid` という警告が常時表示される問題を解決しました。

### 技術的な詳細
- 拡張機能のスキーマバリデーションは、文字列リテラルに対してリポジトリ内に存在する環境名との照合を行います。
- `github-pages` 環境が未作成、または拡張機能が認識していない場合に警告が出ます。
- 回避策として、値を `${{ 'github-pages' }}` のように式（Expression）として記述しました。式は実行時に動的に評価されるため、静的なスキーマチェックをバイパスでき、結果として警告が消えます。
- GitHub Actionsの仕様上、環境名には式を使用可能なため、実際のデプロイ動作には影響しません。

### 変更されたファイル
- `h:\gravity\projects\antigravity-blog\.github\workflows\deploy.yml`
