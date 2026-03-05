#!/usr/bin/env node
/**
 * Bluesky 自動投稿スクリプト
 * ブログ記事デプロイ後に、新しく追加された記事のみを Bluesky に投稿する
 *
 * 新着検出方法:
 *   git diff で前回のコミットと blog-data.json を比較し、
 *   新しく追加されたスラッグを検出する（post-to-x.mjs と同じロジック）
 *
 * 環境変数:
 *   BLUESKY_IDENTIFIER — Blueskyハンドル（例: yourname.bsky.social）
 *   BLUESKY_APP_PASSWORD — アプリパスワード（Bluesky設定画面で生成）
 *
 * 使い方:
 *   node scripts/post-to-bluesky.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 設定
const BLOG_DATA_PATH = join(ROOT, 'src', 'blog-data.json');
const SITE_URL = 'https://www.antigravity-portal.com/blog';
const BLUESKY_API = 'bsky.social';

// 環境変数チェック
const IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;

if (!IDENTIFIER || !APP_PASSWORD) {
    console.log('⚠️ Bluesky認証情報が設定されていません。スキップします。');
    process.exit(0);
}

// --- ユーティリティ: HTTPS リクエスト ---
function httpsRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// --- Bluesky API: セッション作成（ログイン）---
async function createSession() {
    const body = JSON.stringify({
        identifier: IDENTIFIER,
        password: APP_PASSWORD,
    });

    const res = await httpsRequest({
        hostname: BLUESKY_API,
        path: '/xrpc/com.atproto.server.createSession',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (res.status !== 200) {
        throw new Error(`Blueskyログイン失敗 (${res.status}): ${JSON.stringify(res.data)}`);
    }

    return {
        accessJwt: res.data.accessJwt,
        did: res.data.did,
    };
}

// --- リンクカード用: URLからOGPメタデータ取得 ---
async function fetchOgpMeta(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        https.get({
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: { 'User-Agent': 'AntigravityBot/1.0' },
        }, (res) => {
            // リダイレクト対応
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchOgpMeta(res.headers.location).then(resolve);
            }
            let html = '';
            res.on('data', chunk => html += chunk);
            res.on('end', () => {
                const title = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"/i)?.[1]
                    || html.match(/<title>([^<]*?)<\/title>/i)?.[1]
                    || '';
                const description = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/i)?.[1]
                    || html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i)?.[1]
                    || '';
                resolve({ title, description, uri: url });
            });
        }).on('error', () => resolve({ title: '', description: '', uri: url }));
    });
}

// --- テキスト内のURLのバイト位置を検出してfacets生成 ---
function detectLinkFacets(text) {
    const facets = [];
    const urlRegex = /https?:\/\/[^\s]+/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        const beforeBytes = Buffer.byteLength(text.slice(0, match.index), 'utf-8');
        const urlBytes = Buffer.byteLength(match[0], 'utf-8');
        facets.push({
            index: {
                byteStart: beforeBytes,
                byteEnd: beforeBytes + urlBytes,
            },
            features: [{
                $type: 'app.bsky.richtext.facet#link',
                uri: match[0],
            }],
        });
    }
    return facets;
}

// --- テキスト内のハッシュタグのバイト位置を検出してfacets生成 ---
function detectHashtagFacets(text) {
    const facets = [];
    const tagRegex = /#([^\s#]+)/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        const beforeBytes = Buffer.byteLength(text.slice(0, match.index), 'utf-8');
        const tagBytes = Buffer.byteLength(match[0], 'utf-8');
        facets.push({
            index: {
                byteStart: beforeBytes,
                byteEnd: beforeBytes + tagBytes,
            },
            features: [{
                $type: 'app.bsky.richtext.facet#tag',
                tag: match[1],
            }],
        });
    }
    return facets;
}

// --- Bluesky API: ポスト作成 ---
async function createPost(session, text, articleUrl) {
    // facets（リンク + ハッシュタグのリッチテキスト）
    const facets = [
        ...detectLinkFacets(text),
        ...detectHashtagFacets(text),
    ];

    // リンクカード（external embed）
    const ogp = await fetchOgpMeta(articleUrl);
    const embed = {
        $type: 'app.bsky.embed.external',
        external: {
            uri: ogp.uri,
            title: ogp.title,
            description: ogp.description,
        },
    };

    const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        facets,
        embed,
        langs: ['ja'],
    };

    const body = JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
    });

    const res = await httpsRequest({
        hostname: BLUESKY_API,
        path: '/xrpc/com.atproto.repo.createRecord',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.accessJwt}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (res.status !== 200) {
        throw new Error(`Bluesky投稿失敗 (${res.status}): ${JSON.stringify(res.data)}`);
    }

    return res.data;
}

// --- git diff で前回コミットのスラッグ一覧を取得 ---
function getPreviousSlugs() {
    try {
        const prev = execSync('git show HEAD~1:src/blog-data.json', {
            cwd: ROOT,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return JSON.parse(prev).map(p => p.slug);
    } catch {
        console.log('📝 前回のblog-data.jsonが見つかりません（初回 or ファイル未存在）。全記事を既存として扱います。');
        return null;
    }
}

// --- メイン処理 ---
async function main() {
    // 現在の記事一覧
    const currentPosts = JSON.parse(readFileSync(BLOG_DATA_PATH, 'utf-8'));
    const currentSlugs = currentPosts.map(p => p.slug);

    // 前回のスラッグ一覧を取得
    const previousSlugs = getPreviousSlugs();

    // 前回データが取得できない場合（初回デプロイ等）→ 投稿しない
    if (previousSlugs === null) {
        console.log('📝 初回デプロイのためBluesky投稿をスキップします。');
        return;
    }

    // 新しく追加されたスラッグを検出
    const newSlugs = currentSlugs.filter(s => !previousSlugs.includes(s));

    if (newSlugs.length === 0) {
        console.log('📝 新しい記事はありません。Bluesky投稿をスキップします。');
        return;
    }

    // 新しい記事の詳細を取得
    const newPosts = currentPosts.filter(p => newSlugs.includes(p.slug));

    console.log(`🦋 ${newPosts.length} 件の新しい記事を Bluesky に投稿します...`);

    // Blueskyにログイン
    const session = await createSession();
    console.log(`✅ Blueskyログイン成功 (${IDENTIFIER})`);

    // 最大3件まで投稿（大量追加時の制限）
    const toPost = newPosts.slice(0, 3);

    for (const post of toPost) {
        const articleUrl = `${SITE_URL}/${post.slug}/`;
        const tags = post.tags.slice(0, 3).map(t => `#${t.replace(/\s/g, '')}`).join(' ');

        // Blueskyは300文字制限 — タイトル・URL・タグで構成
        const postText = `📝 新着記事: ${post.title}\n\n${articleUrl}\n\n${tags}`;

        // 300文字超過チェック
        if (postText.length > 300) {
            // タイトルを短縮
            const maxTitleLen = 300 - `📝 新着記事: \n\n${articleUrl}\n\n${tags}`.length - 3;
            const shortTitle = post.title.slice(0, maxTitleLen) + '…';
            const shortText = `📝 新着記事: ${shortTitle}\n\n${articleUrl}\n\n${tags}`;
            try {
                const result = await createPost(session, shortText, articleUrl);
                console.log(`✅ 投稿成功: ${shortTitle} (URI: ${result.uri})`);
            } catch (err) {
                console.error(`❌ 投稿失敗: ${post.title} — ${err.message}`);
            }
        } else {
            try {
                const result = await createPost(session, postText, articleUrl);
                console.log(`✅ 投稿成功: ${post.title} (URI: ${result.uri})`);
            } catch (err) {
                console.error(`❌ 投稿失敗: ${post.title} — ${err.message}`);
            }
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
    // Bluesky投稿の失敗でデプロイ自体を失敗させない
    process.exit(0);
});
