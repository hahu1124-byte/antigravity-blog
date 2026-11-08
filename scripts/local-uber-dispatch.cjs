#!/usr/bin/env node
/**
 * ローカルWindows専用: 毎朝 6:00 に日次 Uber レポートの GitHub Actions を起動するだけのスクリプト。
 *
 * GitHub Actions の schedule は混んでいると数時間遅れる（2026-10〜11 は JST 7:39〜11:42 に開始）。
 * 手で起動（workflow_dispatch）した実行は待たされないので、ここから起動して 6 時台に作る。
 * Actions 側の schedule は PC が止まっていた朝の保険として残してあり、その日の記事があれば何もしない。
 *
 * タスクスケジューラ「AntigravityBlog_UberDailyDispatch」（毎日 6:00・StartWhenAvailable）から
 * silent_uber_dispatch.vbs 経由で実行される。単体実行も可:
 *   node scripts/local-uber-dispatch.cjs            # その日の記事が無ければ起動
 *   node scripts/local-uber-dispatch.cjs --dry-run  # 起動せずに判定だけ
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'hahu1124-byte/antigravity-blog';
const WORKFLOW = 'uber-daily-report.yml';
const LOG_FILE = 'H:/gravity/.agent/tmp/uber-daily-dispatch.log';
const RETRIES = 5; // 起動直後でネットワークがまだ無いときのため
const RETRY_WAIT_SEC = 60;
const DRY_RUN = process.argv.includes('--dry-run');

function stamp() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg) {
  const line = `[${stamp()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {
    /* ログが書けなくても起動は続ける */
  }
}

function sleep(sec) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, sec * 1000);
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// その日（JST）の記事がリモートにあるか。true / false、確かめられなければ例外
function articleExists(yyyymm, yyyymmdd) {
  const p = `repos/${REPO}/contents/src/articles/${yyyymm}/${yyyymmdd}_uber_daily.html`;
  try {
    gh(['api', p, '--silent']);
    return true;
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    if (/HTTP 404|Not Found/i.test(out)) return false;
    throw new Error(out.trim() || e.message);
  }
}

function main() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yyyymm = jst.toISOString().slice(0, 7).replace('-', '');
  const yyyymmdd = jst.toISOString().slice(0, 10).replace(/-/g, '');

  for (let i = 1; i <= RETRIES; i++) {
    try {
      if (articleExists(yyyymm, yyyymmdd)) {
        log(`✅ ${yyyymmdd} の記事はもうあるので起動しない`);
        return;
      }
      if (DRY_RUN) {
        log(`[dry-run] ${yyyymmdd} の記事が無い → 起動するところ`);
        return;
      }
      gh(['workflow', 'run', WORKFLOW, '-R', REPO]);
      log(`🚀 ${yyyymmdd} の日次レポートを起動した（${WORKFLOW}）`);
      return;
    } catch (e) {
      log(`⚠️ 失敗 ${i}/${RETRIES}: ${String(e.message).split('\n')[0]}`);
      if (i < RETRIES) sleep(RETRY_WAIT_SEC);
    }
  }
  log('❌ 起動できなかった（Actions の schedule が後で作る）');
  process.exit(1);
}

main();
