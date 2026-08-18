#!/usr/bin/env node
/**
 * ガソリン価格キャッシュ更新スクリプト
 *
 * scripts/fetch-gas-price.py（curl_cffiでAWS WAFを回避しxlsxを直接取得）を
 * 呼び出し、取得したxlsxをパースして gas-price-cache.json を更新する。
 * xlsx実体は G:\マイドライブ\gas\（無ければ scripts/gas-archive\）に1年分アーカイブする。
 *
 * 取得に失敗しても異常終了はしない（既存キャッシュを使い続ける）。
 * generate-uber-daily.mjs から呼ばれる想定。単体実行も可:
 *   node scripts/update-gas-price.cjs
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE_FILE = path.join(ROOT, 'scripts/gas-price-cache.json');
const FETCH_SCRIPT = path.join(__dirname, 'fetch-gas-price.py');
const G_DRIVE_ARCHIVE_DIR = 'G:/マイドライブ/gas';
const FALLBACK_ARCHIVE_DIR = path.join(ROOT, 'scripts/gas-archive');
const MAX_AGE_DAYS = 365;
const REGION = '愛知';

function resolveArchiveDir() {
  try {
    fs.mkdirSync(G_DRIVE_ARCHIVE_DIR, { recursive: true });
    fs.accessSync(G_DRIVE_ARCHIVE_DIR, fs.constants.W_OK);
    return G_DRIVE_ARCHIVE_DIR;
  } catch {
    fs.mkdirSync(FALLBACK_ARCHIVE_DIR, { recursive: true });
    return FALLBACK_ARCHIVE_DIR;
  }
}

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

function runFetchScript(archiveDir) {
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const bin of candidates) {
    try {
      const stdout = execFileSync(bin, [FETCH_SCRIPT, archiveDir], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      const savedPath = stdout.trim().split('\n').pop();
      if (savedPath && fs.existsSync(savedPath)) return savedPath;
    } catch (e) {
      console.error(`⚠️ ${bin} での取得に失敗: ${e.message}`);
      if (e.stderr) console.error(e.stderr.toString());
    }
  }
  return null;
}

function parseXlsx(xlsxPath) {
  const buf = fs.readFileSync(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  // 都道府県別シートを使用（2枚目）
  const sheetName = wb.SheetNames.find(n => n.includes('都道府県')) || wb.SheetNames[1] || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 空行打ち切り
  let lastRow = 0;
  let emptyCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].some(c => c !== '' && c != null)) { lastRow = i; emptyCount = 0; }
    else { emptyCount++; if (emptyCount >= 10) break; }
  }

  // 日付行を探す（Excelシリアル値 → 日付変換）
  let surveyDate = '';
  for (let i = 0; i < Math.min(10, data.length); i++) {
    for (const cell of data[i]) {
      if (typeof cell === 'number' && cell > 40000 && cell < 60000) {
        const d = new Date((cell - 25569) * 86400000);
        const candidate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!surveyDate || candidate > surveyDate) surveyDate = candidate;
      }
    }
  }

  // 愛知の行を探す
  // カラム構造（都道府県別シート）:
  //   [1] 地域名
  //   [2] ハイオク（前週） [3] ハイオク（今週）
  //   [4] レギュラー（前週） [5] レギュラー（今週）
  //   [6] 軽油（前週） [7] 軽油（今週）
  //   [8] 灯油 店頭（前週） [9] 灯油 店頭（今週）
  let found = null;
  for (let i = 0; i <= lastRow; i++) {
    const row = data[i];
    const name = String(row[1] || '').replace(/\s+/g, '');
    if (name.includes(REGION)) {
      found = {
        regular: row[5], premium: row[3], diesel: row[7], kerosene: row[9],
        regularPrev: row[4], premiumPrev: row[2], dieselPrev: row[6], kerosenePrev: row[8],
      };
      break;
    }
  }

  if (!found) {
    throw new Error(`${REGION} のデータが見つかりませんでした`);
  }

  return {
    fetchDate: surveyDate || new Date().toISOString().slice(0, 10),
    region: REGION,
    source: '経済産業省 石油製品価格調査（週次）',
    regular: String(found.regular),
    premium: String(found.premium),
    diesel: String(found.diesel),
    kerosene: String(found.kerosene),
    regularPrev: String(found.regularPrev),
    premiumPrev: String(found.premiumPrev),
    dieselPrev: String(found.dieselPrev),
    kerosenePrev: String(found.kerosenePrev),
    note: '灯油は18L店頭価格。毎週水曜に経産省が発表するxlsxから自動取得。前週値はxlsx内の前週列を利用（追加取得不要）。',
  };
}

function main() {
  console.log('⛽ ガソリン価格取得を開始...');

  const archiveDir = resolveArchiveDir();
  console.log(`  📂 アーカイブ先: ${archiveDir}`);

  const xlsxPath = runFetchScript(archiveDir);
  if (!xlsxPath) {
    console.error('⚠️ xlsx取得に失敗しました。既存のキャッシュをそのまま使用します。');
    return;
  }

  let cache;
  try {
    cache = parseXlsx(xlsxPath);
  } catch (e) {
    console.error(`⚠️ xlsxパースに失敗しました: ${e.message}`);
    console.error('   既存のキャッシュをそのまま使用します。');
    return;
  } finally {
    pruneOldFiles(archiveDir);
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  console.log('✅ gas-price-cache.json を更新しました');
  console.log(`  📅 調査日: ${cache.fetchDate}`);
  console.log(`  ⛽ レギュラー: ${cache.regular} 円/L`);
  console.log(`  ⛽ ハイオク:   ${cache.premium} 円/L`);
  console.log(`  🛢️  軽油:       ${cache.diesel} 円/L`);
  console.log(`  🔥 灯油(18L):  ${cache.kerosene} 円`);
}

main();
