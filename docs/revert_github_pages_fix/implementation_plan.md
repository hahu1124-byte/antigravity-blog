# Revert GitHub Pages Warning Fix

先ほど適用したVS Code拡張機能の警告回避策（`${{ 'github-pages' }}`）が期待通りに機能しなかったため、元の設定に復元する。

## Proposed Changes

### deploy.yml の修正
- `github-pages` を式（Expression）から元のリテラル文字列（`github-pages`）に戻す。
- 警告は出たままとなるが、CIの動作自体には問題ないため許容する。
