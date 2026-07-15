#!/usr/bin/env node
/**
 * ローカルWindows専用: xlsx実体を G:\マイドライブ\gas\ にアーカイブするだけのスクリプト。
 * gas-price-cache.json の更新は GitHub Actions 側（update-gas-price.yml）の責務であり、
 * このスクリプトでは行わない（クラウドランナーは G:\マイドライブ に到達できないため、
 * xlsx実体のアーカイブだけはローカルのタスクスケジューラから実行する）。
 *
 * 毎週水曜 18:30 頃、Windowsタスクスケジューラから実行される想定。単体実行も可:
 *   node scripts/local-gas-archive.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const FETCH_SCRIPT = path.join(__dirname, 'fetch-gas-price.py');
const ARCHIVE_DIR = 'G:/マイドライブ/gas';
const MAX_AGE_DAYS = 365;

function pruneOldFiles(archiveDir) {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(archiveDir).filter(f => f.toLowerCase().endsWith('.xlsx'));

  for (const f of files) {
    const full = path.join(archiveDir, f);
    if (fs.statSync(full).mtimeMs < cutoff) {
      try { fs.unlinkSync(full); } catch { /* 削除失敗は無視 */ }
    }
  }
}

function main() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  console.log(`📂 アーカイブ先: ${ARCHIVE_DIR}`);

  try {
    const stdout = execFileSync('python', [FETCH_SCRIPT, ARCHIVE_DIR], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    console.log(stdout.trim());
  } catch (e) {
    console.error(`⚠️ xlsx取得に失敗しました: ${e.message}`);
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
  }

  pruneOldFiles(ARCHIVE_DIR);
  console.log('✅ xlsxアーカイブ完了');
}

main();
