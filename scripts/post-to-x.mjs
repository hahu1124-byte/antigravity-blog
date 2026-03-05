#!/usr/bin/env node
/**
 * X (Twitter) 自動投稿スクリプト
 * ブログ記事デプロイ後に、新しく追加された記事のみを X に投稿する
 *
 * 新着検出方法:
 *   git diff で前回のコミットと blog-data.json を比較し、
 *   新しく追加されたスラッグを検出する
 *
 * 環境変数:
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *
 * 使い方:
 *   node scripts/post-to-x.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 設定
const BLOG_DATA_PATH = join(ROOT, 'src', 'blog-data.json');
const SITE_URL = 'https://www.antigravity-portal.com/blog';

// 環境変数チェック
const API_KEY = process.env.X_API_KEY;
const API_SECRET = process.env.X_API_SECRET;
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    console.log('⚠️ X API キーが設定されていません。スキップします。');
    process.exit(0);
}

// git diff で前回コミットの blog-data.json からスラッグ一覧を取得
function getPreviousSlugs() {
    try {
        const prev = execSync('git show HEAD~1:src/blog-data.json', {
            cwd: ROOT,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return JSON.parse(prev).map(p => p.slug);
    } catch {
        // 初回コミットや blog-data.json が前回存在しない場合
        console.log('📝 前回のblog-data.jsonが見つかりません（初回 or ファイル未存在）。全記事を既存として扱います。');
        return null;
    }
}

// OAuth 1.0a 署名生成
function createOAuth1Header(method, url) {
    const oauthParams = {
        oauth_consumer_key: API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: ACCESS_TOKEN,
        oauth_version: '1.0',
    };

    const paramString = Object.keys(oauthParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join('&');

    const signatureBase = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(paramString),
    ].join('&');

    const signingKey = `${encodeURIComponent(API_SECRET)}&${encodeURIComponent(ACCESS_TOKEN_SECRET)}`;
    const signature = crypto
        .createHmac('sha1', signingKey)
        .update(signatureBase)
        .digest('base64');

    oauthParams.oauth_signature = signature;

    return 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
        .join(', ');
}

// ツイート投稿
function postTweet(text) {
    return new Promise((resolve, reject) => {
        const url = 'https://api.twitter.com/2/tweets';
        const body = JSON.stringify({ text });
        const authHeader = createOAuth1Header('POST', url);

        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 201) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`X API エラー (${res.statusCode}): ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// メイン処理
async function main() {
    // 現在の記事一覧
    const currentPosts = JSON.parse(readFileSync(BLOG_DATA_PATH, 'utf-8'));
    const currentSlugs = currentPosts.map(p => p.slug);

    // 前回のスラッグ一覧を取得
    const previousSlugs = getPreviousSlugs();

    // 前回データが取得できない場合（初回デプロイ等）→ 投稿しない
    if (previousSlugs === null) {
        console.log('📝 初回デプロイのため X 投稿をスキップします。');
        return;
    }

    // 新しく追加されたスラッグを検出
    const newSlugs = currentSlugs.filter(s => !previousSlugs.includes(s));

    if (newSlugs.length === 0) {
        console.log('📝 新しい記事はありません。X 投稿をスキップします。');
        return;
    }

    // 新しい記事の詳細を取得
    const newPosts = currentPosts.filter(p => newSlugs.includes(p.slug));

    console.log(`📢 ${newPosts.length} 件の新しい記事を X に投稿します...`);

    // 最大3件まで投稿（大量追加時の制限）
    const toPost = newPosts.slice(0, 3);

    for (const post of toPost) {
        const articleUrl = `${SITE_URL}/${post.slug}/`;
        const tags = post.tags.slice(0, 3).map(t => `#${t.replace(/\s/g, '')}`).join(' ');
        const tweetText = `📝 新着記事: ${post.title}\n\n${articleUrl}\n\n${tags}`;

        try {
            const result = await postTweet(tweetText);
            console.log(`✅ 投稿成功: ${post.title} (ID: ${result.data.id})`);
        } catch (err) {
            console.error(`❌ 投稿失敗: ${post.title} — ${err.message}`);
        }

        // レート制限対策: 2秒間隔
        if (toPost.indexOf(post) < toPost.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (newPosts.length > 3) {
        console.log(`⚠️ ${newPosts.length - 3} 件の記事は投稿上限(3件)により省略されました`);
    }
}

main().catch(err => {
    console.error('❌ エラー:', err.message);
    // X投稿の失敗でデプロイ自体を失敗させない
    process.exit(0);
});
