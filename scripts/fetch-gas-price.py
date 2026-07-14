#!/usr/bin/env python3
"""
経産省 石油製品価格調査の最新xlsxをダウンロードする。

results.html 自体がAWS WAFの人間検証対象のため、TLS fingerprintを
Chromeに偽装する curl_cffi で取得する。素のrequests/curlは403・202で弾かれる。

保存先ディレクトリを引数で受け取り、URLから判定したファイル名（例: 260708.xlsx）で
そのディレクトリに保存する。実際に保存したフルパスを標準出力に1行だけ出力する。

Usage:
    python3 scripts/fetch-gas-price.py <output_dir>
"""
import os
import re
import sys
import time

# Windows環境のデフォルトコンソールエンコーディング(cp932)だと
# 日本語ログ出力でUnicodeEncodeErrorが起き非ゼロ終了してしまうため、明示的にUTF-8化する
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from curl_cffi import requests

RESULTS_URL = "https://www.enecho.meti.go.jp/statistics/petroleum_and_lpgas/pl007/results.html"
BASE_URL = "https://www.enecho.meti.go.jp"
IMPERSONATE = "chrome120"
MAX_RETRIES = 3
RETRY_WAIT_SECONDS = 10


def fetch_with_retry(url, headers, expect_binary=False):
    last_status = None
    for attempt in range(MAX_RETRIES):
        resp = requests.get(url, impersonate=IMPERSONATE, headers=headers)
        last_status = resp.status_code
        ct = resp.headers.get("content-type", "")
        ok = resp.status_code == 200 and (
            "spreadsheet" in ct if expect_binary else "html" in ct
        )
        if ok:
            return resp
        print(f"[fetch-gas-price]  リトライ {attempt + 1}/{MAX_RETRIES}（status={last_status}）", file=sys.stderr)
        time.sleep(RETRY_WAIT_SECONDS)
    raise RuntimeError(f"取得失敗（最終ステータス: {last_status}）: {url}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch-gas-price.py <output_dir>", file=sys.stderr)
        sys.exit(1)

    output_dir = sys.argv[1]
    os.makedirs(output_dir, exist_ok=True)

    print(f"[fetch-gas-price] results.html を取得中: {RESULTS_URL}", file=sys.stderr)
    page = fetch_with_retry(RESULTS_URL, headers={})

    # 「結果詳細版（EXCEL形式）」= xlsx/YYMMDD.xlsx（週次ファイル s5.xlsx 等は除外）
    match = re.search(r'href="([^"]*?/xlsx/(\d{6})\.xlsx)"', page.text)
    if not match:
        print("[fetch-gas-price] xlsxリンクが見つかりませんでした", file=sys.stderr)
        sys.exit(1)

    xlsx_path = match.group(1)
    filename = os.path.basename(xlsx_path)
    xlsx_url = xlsx_path if xlsx_path.startswith("http") else BASE_URL + xlsx_path
    print(f"[fetch-gas-price] 最新xlsx URL: {xlsx_url}", file=sys.stderr)

    xlsx_resp = fetch_with_retry(
        xlsx_url,
        headers={"Referer": RESULTS_URL},
        expect_binary=True,
    )

    output_path = os.path.join(output_dir, filename)
    with open(output_path, "wb") as f:
        f.write(xlsx_resp.content)

    print(f"[fetch-gas-price] 保存完了: {output_path} ({len(xlsx_resp.content)} bytes)", file=sys.stderr)
    # update-gas-price.cjs がパースするファイルを特定できるよう、フルパスをstdoutに1行出力
    print(os.path.abspath(output_path))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[fetch-gas-price] エラー: {e}", file=sys.stderr)
        sys.exit(1)
