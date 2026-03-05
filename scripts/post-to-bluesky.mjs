#!/usr/bin/env node
/**
 * Bluesky 自動投稿スクリプト
 * ブログ記事 + Note記事の新着を検出し、Blueskyに自動投稿する
 *
 * 対象ソース:
 *   1. ブログ記事 — src/blog-data.json から取得
 *   2. Note記事 — Note.com RSSフィードから取得
 *
 * 投稿済み管理:
 *   posted-items.json に投稿済みURLを記録。
 *   次回実行時にスキップする。
 *
 * 環境変数:
 *   BLUESKY_IDENTIFIER — Blueskyハンドル（例: hahu1124.bsky.social）
 *   BLUESKY_APP_PASSWORD — アプリパスワード
 *   NOTE_USERNAME — Note.comユーザー名（例: hahu1124）
 *
 * 使い方:
 *   node scripts/post-to-bluesky.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 設定
const BLOG_DATA_PATH = join(ROOT, 'src', 'blog-data.json');
const POSTED_ITEMS_PATH = join(ROOT, 'posted-items.json');
const BLOG_URL = 'https://www.antigravity-portal.com/blog';
const BLUESKY_API = 'bsky.social';

// 環境変数チェック
const IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
const NOTE_USERNAME = process.env.NOTE_USERNAME || 'hahu1124';

if (!IDENTIFIER || !APP_PASSWORD) {
    console.log('⚠️ Bluesky認証情報が設定されていません。スキップします。');
    process.exit(0);
}

// --- 投稿済みアイテム管理 ---
function loadPostedItems() {
    if (!existsSync(POSTED_ITEMS_PATH)) return [];
    try {
        return JSON.parse(readFileSync(POSTED_ITEMS_PATH, 'utf-8'));
    } catch {
        return [];
    }
}

function savePostedItems(items) {
    writeFileSync(POSTED_ITEMS_PATH, JSON.stringify(items, null, 2) + '\n', 'utf-8');
}

// --- HTTPリクエストユーティリティ ---
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

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// --- ソース1: ブログ記事の新着を取得 ---
function getNewBlogPosts(postedUrls) {
    if (!existsSync(BLOG_DATA_PATH)) {
        console.log('📝 blog-data.json が見つかりません。ブログチェックをスキップ。');
        return [];
    }
    const posts = JSON.parse(readFileSync(BLOG_DATA_PATH, 'utf-8'));
    return posts
        .map(p => ({
            title: p.title,
            url: `${BLOG_URL}/${p.slug}/`,
            tags: (p.tags || []).slice(0, 3),
            source: 'blog',
        }))
        .filter(p => !postedUrls.includes(p.url));
}

// --- ソース2: Note記事の新着をRSSから取得 ---
async function getNewNotePosts(postedUrls) {
    try {
        const rssUrl = `https://note.com/${NOTE_USERNAME}/rss`;
        const xml = await fetchUrl(rssUrl);

        // 簡易XMLパース（<item>を抽出）
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
                || itemXml.match(/<title>(.*?)<\/title>/)?.[1]
                || '';
            const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
            if (title && link && !postedUrls.includes(link)) {
                items.push({
                    title,
                    url: link,
                    tags: ['Note'],
                    source: 'note',
                });
            }
        }
        console.log(`📰 Note RSS: ${items.length} 件の未投稿記事を検出`);
        return items;
    } catch (err) {
        console.error(`⚠️ Note RSSの取得に失敗: ${err.message}`);
        return [];
    }
}

// --- Bluesky API: セッション作成 ---
async function createSession() {
    const body = JSON.stringify({ identifier: IDENTIFIER, password: APP_PASSWORD });
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
    return { accessJwt: res.data.accessJwt, did: res.data.did };
}

// --- OGPメタデータ取得（リンクカード用）---
async function fetchOgpMeta(url) {
    try {
        const html = await fetchUrl(url);
        const title = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"/i)?.[1]
            || html.match(/<title>([^<]*?)<\/title>/i)?.[1] || '';
        const description = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/i)?.[1]
            || html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i)?.[1] || '';
        return { title, description, uri: url };
    } catch {
        return { title: '', description: '', uri: url };
    }
}

// --- テキスト内のURL/ハッシュタグのfacets生成 ---
function detectFacets(text) {
    const facets = [];

    // URL
    const urlRegex = /https?:\/\/[^\s]+/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
        const byteStart = Buffer.byteLength(text.slice(0, match.index), 'utf-8');
        facets.push({
            index: { byteStart, byteEnd: byteStart + Buffer.byteLength(match[0], 'utf-8') },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
        });
    }

    // ハッシュタグ
    const tagRegex = /#([^\s#]+)/g;
    while ((match = tagRegex.exec(text)) !== null) {
        const byteStart = Buffer.byteLength(text.slice(0, match.index), 'utf-8');
        facets.push({
            index: { byteStart, byteEnd: byteStart + Buffer.byteLength(match[0], 'utf-8') },
            features: [{ $type: 'app.bsky.richtext.facet#tag', tag: match[1] }],
        });
    }

    return facets;
}

// --- Bluesky API: ポスト作成 ---
async function createPost(session, text, articleUrl) {
    const ogp = await fetchOgpMeta(articleUrl);
    const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        facets: detectFacets(text),
        embed: {
            $type: 'app.bsky.embed.external',
            external: { uri: ogp.uri, title: ogp.title, description: ogp.description },
        },
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

// --- 投稿テキスト生成（300文字制限対応）---
function buildPostText(item) {
    const prefix = item.source === 'note' ? '📝 Note更新' : '📝 新着記事';
    const tags = item.tags.map(t => `#${t.replace(/\s/g, '')}`).join(' ');
    const text = `${prefix}: ${item.title}\n\n${item.url}\n\n${tags}`;

    if (text.length <= 300) return text;

    // タイトルを短縮
    const maxLen = 300 - `${prefix}: \n\n${item.url}\n\n${tags}`.length - 3;
    return `${prefix}: ${item.title.slice(0, maxLen)}…\n\n${item.url}\n\n${tags}`;
}

// --- メイン処理 ---
async function main() {
    const postedItems = loadPostedItems();
    const postedUrls = postedItems.map(i => i.url);

    // 新着記事を両ソースから取得
    const newBlogPosts = getNewBlogPosts(postedUrls);
    const newNotePosts = await getNewNotePosts(postedUrls);
    const allNewPosts = [...newBlogPosts, ...newNotePosts];

    if (allNewPosts.length === 0) {
        console.log('📝 新しい記事はありません。スキップします。');
        return;
    }

    console.log(`🦋 ${allNewPosts.length} 件の新着を Bluesky に投稿します...`);
    console.log(`   ブログ: ${newBlogPosts.length} 件 / Note: ${newNotePosts.length} 件`);

    // Blueskyログイン
    const session = await createSession();
    console.log(`✅ Blueskyログイン成功 (${IDENTIFIER})`);

    // 最大5件まで投稿（安全制限）
    const toPost = allNewPosts.slice(0, 5);
    const newlyPosted = [];

    for (const item of toPost) {
        const postText = buildPostText(item);
        try {
            const result = await createPost(session, postText, item.url);
            console.log(`✅ [${item.source}] 投稿成功: ${item.title} (URI: ${result.uri})`);
            newlyPosted.push({
                url: item.url,
                title: item.title,
                source: item.source,
                postedAt: new Date().toISOString(),
            });
        } catch (err) {
            console.error(`❌ [${item.source}] 投稿失敗: ${item.title} — ${err.message}`);
        }

        // レート制限対策: 3秒間隔
        if (toPost.indexOf(item) < toPost.length - 1) {
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    // 投稿済みリストを更新・保存
    if (newlyPosted.length > 0) {
        const updated = [...postedItems, ...newlyPosted];
        savePostedItems(updated);
        console.log(`💾 posted-items.json を更新しました（${newlyPosted.length} 件追加、合計 ${updated.length} 件）`);
    }

    if (allNewPosts.length > 5) {
        console.log(`⚠️ ${allNewPosts.length - 5} 件は投稿上限(5件/回)により次回に持ち越し`);
    }
}

main().catch(err => {
    console.error('❌ エラー:', err.message);
    process.exit(0);
});
