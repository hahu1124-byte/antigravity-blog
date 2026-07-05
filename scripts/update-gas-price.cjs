#!/usr/bin/env node
/**
 * ガソリン価格キャッシュ更新スクリプト
 *
 * 経産省の石油製品価格調査 xlsx ファイルを読み取り、
 * gas-price-cache.json を更新する。
 *
 * Usage:
 *   node scripts/update-gas-price.cjs "G:/マイドライブ/gas/260624.xlsx"
 *
 * 自動実行は auto-gas-update.ps1 経由で呼び出す。
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE_FILE = path.join(ROOT, 'scripts/gas-price-cache.json');
const HGIT = 'h:/gravity/.agent/scripts/hgit.sh';
const REGION = '愛知';

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error('❌ xlsx ファイルパスを引数で指定してください。');
  console.error('   node scripts/update-gas-price.cjs "path/to/file.xlsx"');
  console.error('   自動取得は auto-gas-update.ps1 を使用してください。');
  process.exit(1);
}

console.log(`📂 読み込み: ${xlsxPath}`);

// --- xlsx 読み取り ---
const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer' });

// 都道府県別シートを使用（2枚目）
const sheetName = wb.SheetNames.find(n => n.includes('都道府県')) || wb.SheetNames[1] || wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// --- 空行打ち切り ---
let lastRow = 0;
let emptyCount = 0;
for (let i = 0; i < data.length; i++) {
  if (data[i].some(c => c !== '' && c != null)) { lastRow = i; emptyCount = 0; }
  else { emptyCount++; if (emptyCount >= 10) break; }
}

// --- 日付行を探す（Excel シリアル値 → 日付変換） ---
let surveyDate = '';
for (let i = 0; i < Math.min(10, data.length); i++) {
  const row = data[i];
  for (const cell of row) {
    if (typeof cell === 'number' && cell > 40000 && cell < 60000) {
      const d = new Date((cell - 25569) * 86400000);
      const latest = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!surveyDate || latest > surveyDate) surveyDate = latest;
    }
  }
}

// --- 愛知の行を探す ---
// カラム構造（都道府県別シート）:
//   [1] 地域名
//   [2] ハイオク（前週） [3] ハイオク（今週）
//   [4] レギュラー（前週） [5] レギュラー（今週）
//   [6] 軽油（前週） [7] 軽油（今週）
//   [8] 灯油 店頭（前週） [9] 灯油 店頭（今週）
//   [10] 灯油 配達（前週） [11] 灯油 配達（今週）

let found = null;
for (let i = 0; i <= lastRow; i++) {
  const row = data[i];
  const name = String(row[1] || '').replace(/\s+/g, '');
  if (name.includes(REGION)) {
    found = {
      regular: row[5],
      premium: row[3],
      diesel: row[7],
      kerosene: row[9],
    };
    break;
  }
}

if (!found) {
  console.error(`❌ ${REGION} のデータが見つかりませんでした。`);
  console.log('利用可能な地域:');
  for (let i = 6; i <= lastRow; i++) {
    const name = String(data[i]?.[1] || '').replace(/\s+/g, '');
    if (name) console.log(`  - ${name}`);
  }
  process.exit(1);
}

// --- キャッシュ更新 ---
const cache = {
  fetchDate: surveyDate || new Date().toISOString().slice(0, 10),
  region: REGION,
  source: '経済産業省 石油製品価格調査（週次）',
  regular: String(found.regular),
  premium: String(found.premium),
  diesel: String(found.diesel),
  kerosene: String(found.kerosene),
  note: '灯油は18L店頭価格。毎週水曜に経産省が発表するxlsxから自動取得。'
};

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

console.log('');
console.log('✅ gas-price-cache.json を更新しました！');
console.log('');
console.log(`  📅 調査日: ${cache.fetchDate}`);
console.log(`  ⛽ レギュラー: ${cache.regular} 円/L`);
console.log(`  ⛽ ハイオク:   ${cache.premium} 円/L`);
console.log(`  🛢️  軽油:       ${cache.diesel} 円/L`);
console.log(`  🔥 灯油(18L):  ${cache.kerosene} 円`);
console.log('');

// キャッシュ更新のコミット忘れを防ぐため、ここで自動コミット・プッシュまで行う。
try {
  execFileSync('bash', [HGIT, ROOT, 'add', 'scripts/gas-price-cache.json'], { stdio: 'inherit' });
  execFileSync('bash', [HGIT, ROOT, 'commit', '-m', `⛽ Update gas prices (調査日: ${cache.fetchDate})`], { stdio: 'inherit' });
  execFileSync('bash', [HGIT, ROOT, 'push'], { stdio: 'inherit' });
  console.log('✅ gas-price-cache.json を自動コミット・プッシュしました。');
} catch (e) {
  console.error('⚠️ 自動コミット・プッシュに失敗しました。手動で `git add scripts/gas-price-cache.json && git commit && git push` を実行してください。');
  console.error(e.message);
}

process.exit(0);
