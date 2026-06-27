# auto-gas-update.ps1
# ガソリン価格を経産省から自動取得してキャッシュ更新するスクリプト
# タスクスケジューラから毎週水曜 14:30 頃に実行する

param(
  [string]$BlogRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$GasDir = "G:\マイドライブ\gas",
  [int]$MaxFiles = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ResultsUrl = "https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html"
$BaseUrl    = "https://www.enecho.meti.go.jp"
$TmpDir     = $env:TEMP

Write-Host "=== ガソリン価格自動更新 ===" -ForegroundColor Cyan

# --- 1. 経産省ページを取得して最新 xlsx URL を抽出 ---
Write-Host "1. 経産省ページを取得中..."
$tmpHtml = Join-Path $TmpDir "enecho-results.html"
if (Test-Path $tmpHtml) { Remove-Item $tmpHtml -Force }
Start-BitsTransfer -Source $ResultsUrl -Destination $tmpHtml -TransferType Download
$html = Get-Content $tmpHtml -Encoding UTF8 -Raw
Remove-Item $tmpHtml -Force

$match = [regex]::Match($html, 'href="(/statistics/petroleum_and_lpgas/pl007/xlsx/(\d{6})\.xlsx)"')
if (-not $match.Success) {
    Write-Error "xlsxリンクが見つかりませんでした（ページ構造が変わった可能性あり）"
    exit 1
}
$xlsxRelPath = $match.Groups[1].Value
$dateCode    = $match.Groups[2].Value
$xlsxUrl     = $BaseUrl + $xlsxRelPath
$xlsxName    = "$dateCode.xlsx"
$destPath    = Join-Path $GasDir $xlsxName
Write-Host "   最新ファイル: $xlsxName"

# --- 2. ダウンロード（存在する場合はスキップ） ---
if (Test-Path $destPath) {
    Write-Host "2. $xlsxName は既に存在します（スキップ）"
} else {
    Write-Host "2. ダウンロード中: $xlsxUrl"
    $tmpXlsx = Join-Path $TmpDir $xlsxName
    if (Test-Path $tmpXlsx) { Remove-Item $tmpXlsx -Force }
    Start-BitsTransfer -Source $xlsxUrl -Destination $tmpXlsx -TransferType Download
    if (-not (Test-Path $GasDir)) { New-Item -ItemType Directory -Path $GasDir -Force | Out-Null }
    Copy-Item $tmpXlsx $destPath -Force
    Remove-Item $tmpXlsx -Force
    Write-Host "   保存: $destPath" -ForegroundColor Green

    # --- 3. 古いファイルを削除（MaxFiles を超えた分）---
    $files = Get-ChildItem $GasDir -Filter "*.xlsx" | Sort-Object Name
    $excess = $files.Count - $MaxFiles
    if ($excess -gt 0) {
        $toDelete = $files | Select-Object -First $excess
        foreach ($f in $toDelete) {
            Remove-Item $f.FullName -Force
            Write-Host "   削除: $($f.Name)（保持上限 $MaxFiles 件）" -ForegroundColor Yellow
        }
    }
}

# --- 4. Node.js でキャッシュ更新 ---
Write-Host "4. gas-price-cache.json を更新中..."
$nodeScript = Join-Path $BlogRoot "scripts\update-gas-price.cjs"
& node $nodeScript $destPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "update-gas-price.cjs が失敗しました（exit $LASTEXITCODE）"
    exit 1
}

Write-Host "=== 完了 ===" -ForegroundColor Green
