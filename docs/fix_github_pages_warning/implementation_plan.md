# Fix GitHub Pages Warning

VS CodeのGitHub Actions拡張機能による「Value 'github-pages' is not valid」の警告を抑止するための対応計画。

## Proposed Changes

### deploy.yml の修正
- `github-pages` をリテラル文字列から `${{ 'github-pages' }}` という式（Expression）に変更する。
- これにより、ランナー上では正常に `github-pages` として評価されつつ、VS Codeの静的スキーマバリデーションによる誤検知を回避できる。
