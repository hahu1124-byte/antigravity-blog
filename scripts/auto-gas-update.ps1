# auto-gas-update.ps1
# ガソリン価格を経産省から自動取得してキャッシュ更新するスクリプト
# タスクスケジューラから毎週水曜 21:00 に実行する

param(
  [string]$BlogRoot  = (Split-Path $PSScriptRoot -Parent),
  [string]$GasDir    = "G:\マイドライブ\gas",
  [string]$Fallback  = "H:\gravity\projects\antigravity-blog\scripts\gas-archive",
  [int]$MaxFiles     = 5,
  [int]$BitsTimeoutSec = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 経産省サイト無応答時にタスクが無期限ブロックされないよう、非同期BITS転送+ポーリングでタイムアウトを課す
function Invoke-BitsTransferWithTimeout {
    param(
        [string]$Source,
        [string]$Destination,
        [int]$TimeoutSec
    )
    $job = Start-BitsTransfer -Source $Source -Destination $Destination -TransferType Download -Asynchronous
    $waited = 0
    try {
        while ($job.JobState -in @('Connecting', 'Transferring', 'Queued') -and $waited -lt $TimeoutSec) {
            Start-Sleep -Seconds 2
            $waited += 2
            $job = Get-BitsTransfer -JobId $job.JobId
        }
        if ($job.JobState -eq 'Transferred') {
            Complete-BitsTransfer -BitsJob $job
        } else {
            throw "BITS transfer timed out or failed: $Source (state: $($job.JobState), waited: ${waited}s)"
        }
    } finally {
        if (Get-BitsTransfer -JobId $job.JobId -ErrorAction SilentlyContinue) {
            Remove-BitsTransfer -BitsJob $job -ErrorAction SilentlyContinue
        }
    }
}

$ResultsUrl = "https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html"
$BaseUrl    = "https://www.enecho.meti.go.jp"
$TmpDir     = $env:TEMP
$tmpHtml    = Join-Path $TmpDir "enecho-results.html"
$tmpXlsx    = $null

Write-Host "=== Gas Price Auto Update ===" -ForegroundColor Cyan

try {
    # --- 1. 経産省ページを取得して最新 xlsx URL を抽出 ---
    Write-Host "1. Fetching results page..."
    if (Test-Path $tmpHtml) { Remove-Item $tmpHtml -Force }
    Invoke-BitsTransferWithTimeout -Source $ResultsUrl -Destination $tmpHtml -TimeoutSec $BitsTimeoutSec
    $html = Get-Content $tmpHtml -Encoding UTF8 -Raw

    $match = [regex]::Match($html, 'href="(/statistics/petroleum_and_lpgas/pl007/xlsx/(\d{6})\.xlsx)"')
    if (-not $match.Success) {
        throw "xlsx link not found (page structure may have changed)"
    }
    $xlsxRelPath = $match.Groups[1].Value
    $dateCode    = $match.Groups[2].Value
    $xlsxUrl     = $BaseUrl + $xlsxRelPath
    $xlsxName    = "$dateCode.xlsx"
    $tmpXlsx     = Join-Path $TmpDir $xlsxName
    Write-Host "   Latest file: $xlsxName"

    # --- 2. xlsx を %TEMP% にダウンロード ---
    Write-Host "2. Downloading xlsx..."
    if (Test-Path $tmpXlsx) { Remove-Item $tmpXlsx -Force }
    Invoke-BitsTransferWithTimeout -Source $xlsxUrl -Destination $tmpXlsx -TimeoutSec $BitsTimeoutSec
    Write-Host "   Downloaded: $tmpXlsx"

    # --- 3. キャッシュ更新（%TEMP のファイルを直接使用 - 保存先に依存しない） ---
    Write-Host "3. Updating gas-price-cache.json..."
    $nodeScript = Join-Path $BlogRoot "scripts\update-gas-price.cjs"
    & node $nodeScript $tmpXlsx
    if ($LASTEXITCODE -ne 0) {
        throw "update-gas-price.cjs failed (exit $LASTEXITCODE)"
    }

    # --- 4. xlsx をアーカイブ保存（G: -> フォールバック の優先順位） ---
    Write-Host "4. Archiving xlsx..."
    $saved = $false

    # G: ドライブ（Google Drive マウント）を試みる
    try {
        if (-not (Test-Path $GasDir)) { New-Item -ItemType Directory -Path $GasDir -Force | Out-Null }
        $destPath = Join-Path $GasDir $xlsxName
        if (-not (Test-Path $destPath)) {
            Copy-Item $tmpXlsx $destPath -Force
            Write-Host "   Saved to G: drive: $destPath" -ForegroundColor Green

            # 古いファイルを削除（MaxFiles を超えた分）
            $files = Get-ChildItem $GasDir -Filter "*.xlsx" | Sort-Object Name
            $excess = $files.Count - $MaxFiles
            if ($excess -gt 0) {
                $files | Select-Object -First $excess | ForEach-Object {
                    Remove-Item $_.FullName -Force
                    Write-Host "   Deleted old file: $($_.Name) (limit: $MaxFiles)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "   Already exists on G: drive (skip)"
        }
        $saved = $true
    } catch {
        Write-Host "   G: drive unavailable: $_" -ForegroundColor Yellow
    }

    # フォールバック: H: ローカルへ保存
    if (-not $saved) {
        try {
            if (-not (Test-Path $Fallback)) { New-Item -ItemType Directory -Path $Fallback -Force | Out-Null }
            $destPath = Join-Path $Fallback $xlsxName
            if (-not (Test-Path $destPath)) {
                Copy-Item $tmpXlsx $destPath -Force
                Write-Host "   Saved to fallback: $destPath" -ForegroundColor Cyan

                $files = Get-ChildItem $Fallback -Filter "*.xlsx" | Sort-Object Name
                $excess = $files.Count - $MaxFiles
                if ($excess -gt 0) {
                    $files | Select-Object -First $excess | ForEach-Object {
                        Remove-Item $_.FullName -Force
                        Write-Host "   Deleted old file: $($_.Name) (limit: $MaxFiles)" -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "   Already exists in fallback (skip)"
            }
        } catch {
            Write-Host "   Fallback save also failed: $_" -ForegroundColor Red
        }
    }

    Write-Host "=== Done ===" -ForegroundColor Green

} finally {
    # 一時ファイルを確実に削除（エラー時も含む）
    if (Test-Path $tmpHtml) { Remove-Item $tmpHtml -Force -ErrorAction SilentlyContinue }
    if ($tmpXlsx -and (Test-Path $tmpXlsx)) { Remove-Item $tmpXlsx -Force -ErrorAction SilentlyContinue }
}
