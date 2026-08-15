#!/usr/bin/env node
/**
 * Bluesky 自動投稿スクリプト（ブログ記事 + Note記事）
 * ブログの新着記事（src/blog-data.json）と Note.com RSSフィードの新着記事を検出し、
 * Blueskyに自動投稿する。
 *
 * ※ ブログ記事の自動投稿は2026-03-11に一度廃止されたが、2026-08にデプロイ完了検知
 *    方式（旧: 固定sleepによる推測）で再設計のうえ復活。日次レポート・週次トレンド等を含め、
 *    対象は BLOG_POST_SINCE 以降 かつ 直近3日以内の記事のみ。
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
 *   node scripts/post-to-bluesky.mjs --dry-run   # 投稿候補の確認のみ（ログイン・投稿なし）
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 設定
const POSTED_ITEMS_PATH = join(ROOT, 'posted-items.json');
const BLUESKY_API = 'bsky.social';
const SITE_URL = 'https://www.antigravity-portal.com';
// ブログ記事投稿の対象は導入日以降のみ（旧実装は日付ガードが無く既存全記事が
// 投稿候補になっていたため、機能復活にあたり二重ガードを追加する）
const BLOG_POST_SINCE = '2026-08-13';
// 除外タグ（現在は日次レポート・週次トレンド等を含め全新着記事を投稿対象とする）
const BLOG_EXCLUDE_TAGS = [];

// 環境変数チェック
const IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
const NOTE_USERNAME = process.env.NOTE_USERNAME || 'hahu1124';
const DRY_RUN = process.argv.includes('--dry-run');

if (!DRY_RUN && (!IDENTIFIER || !APP_PASSWORD)) {
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
        req.setTimeout(15000, () => {
            req.destroy(new Error('HTTPS request timeout (15s)'));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.setTimeout(15000, () => {
            req.destroy(new Error('fetchUrl timeout (15s)'));
        });
        req.on('error', reject);
    });
}

// fetchUrl のバイナリ版（サムネイル画像取得用。リダイレクト追従あり）
function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchBuffer(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                contentType: (res.headers['content-type'] || 'application/octet-stream').split(';')[0],
            }));
        });
        req.setTimeout(15000, () => {
            req.destroy(new Error('fetchBuffer timeout (15s)'));
        });
        req.on('error', reject);
    });
}

// 今日から N日前の日付文字列（YYYY-MM-DD）
function daysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

// --- ソース1: ブログ記事の新着を blog-data.json から取得 ---
// 日次レポート・週次トレンド等の新着記事を対象とする。
// 旧実装は日付ガードが無く既存全記事が投稿候補になる欠陥があったため、
// 導入日以降 かつ 直近3日以内 の二重ガードを設ける。
function getNewBlogPosts(postedUrls) {
    try {
        const blogDataPath = join(ROOT, 'src', 'blog-data.json');
        const blogData = JSON.parse(readFileSync(blogDataPath, 'utf-8'));
        const recentThreshold = daysAgo(3);

        const items = blogData
            .filter(post => post.date >= BLOG_POST_SINCE)
            .filter(post => post.date >= recentThreshold)
            .filter(post => !(post.tags || []).some(t => BLOG_EXCLUDE_TAGS.includes(t)))
            .map(post => ({
                title: post.title,
                url: `${SITE_URL}/blog/${post.slug}/`,
                tags: post.tags || [],
                source: 'blog',
                slug: post.slug,
                ogImage: post.ogImage || null,
            }))
            .filter(item => !postedUrls.includes(item.url));

        console.log(`📰 ブログ: ${items.length} 件の未投稿記事を検出`);
        return items;
    } catch (err) {
        console.error(`⚠️ blog-data.jsonの取得に失敗: ${err.message}`);
        return [];
    }
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
        const image = html.match(/<meta\s+property="og:image"\s+content="([^"]*?)"/i)?.[1] || '';
        return { title, description, uri: url, image };
    } catch {
        return { title: '', description: '', uri: url, image: '' };
    }
}

// --- Bluesky API: 画像blobアップロード ---
async function uploadBlob(session, buffer, mimeType) {
    const res = await httpsRequest({
        hostname: BLUESKY_API,
        path: '/xrpc/com.atproto.repo.uploadBlob',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.accessJwt}`,
            'Content-Type': mimeType,
            'Content-Length': buffer.length,
        },
    }, buffer);

    if (res.status !== 200) {
        throw new Error(`uploadBlob失敗 (${res.status}): ${JSON.stringify(res.data)}`);
    }
    return res.data.blob;
}

// --- リンクカード用サムネイル画像バッファ取得 ---
// blog記事: 記事本文のヒーロー画像（タイトル下画像）を最優先、なければ汎用ogImageをローカルファイルから読む
// note記事: og:image をHTTP取得する
async function getThumbBuffer(item) {
    if (item.source === 'blog') {
        let thumbPath = null;
        let sourceReason = '';

        // 記事HTMLからヒーロー画像（タイトル下画像）を優先抽出
        if (item.slug) {
            const articlePath = join(ROOT, 'src', 'articles', `${item.slug}.html`);
            if (existsSync(articlePath)) {
                const articleHtml = readFileSync(articlePath, 'utf-8');
                const heroMatch = articleHtml.match(/src="\/blog\/images\/([^"]+)"/);
                if (heroMatch) {
                    const heroFile = heroMatch[1]
                        .replace(/\.png$/i, '.webp')
                        .replace(/\.jpe?g$/i, '.webp');
                    const heroPath = join(ROOT, 'src', 'images', heroFile);
                    if (existsSync(heroPath)) {
                        thumbPath = heroPath;
                        sourceReason = `ヒーロー画像 (${heroFile})`;
                    }
                }
            }
        }

        // ヒーロー画像がなければ汎用ogImageを使用
        if (!thumbPath && item.ogImage) {
            const defaultOgPath = join(ROOT, 'src', 'images', item.ogImage);
            if (existsSync(defaultOgPath)) {
                thumbPath = defaultOgPath;
                sourceReason = `汎用OGP画像 (${item.ogImage})`;
            }
        }

        if (!thumbPath) return null;
        return {
            buffer: readFileSync(thumbPath),
            mimeType: 'image/webp',
            info: `ローカルファイル: ${sourceReason}`,
        };
    } else if (item.source === 'note') {
        const ogp = await fetchOgpMeta(item.url);
        if (!ogp.image) return null;
        const fetched = await fetchBuffer(ogp.image);
        return {
            buffer: fetched.buffer,
            mimeType: fetched.contentType || 'image/jpeg',
            info: `リモートURL: ${ogp.image}`,
        };
    }
    return null;
}

// --- リンクカード用サムネイル取得（失敗時は null を返し thumb 無しで投稿続行） ---
async function resolveThumb(session, item) {
    try {
        const thumbData = await getThumbBuffer(item);
        if (!thumbData) return null;

        const { buffer, mimeType } = thumbData;
        if (buffer.length > 1_000_000) {
            console.warn(`⚠️ サムネイルが1MBを超えるためスキップ: ${item.url}`);
            return null;
        }

        return await uploadBlob(session, buffer, mimeType);
    } catch (err) {
        console.warn(`⚠️ サムネイル取得に失敗（thumb無しで続行）: ${item.url} — ${err.message}`);
        return null;
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
async function createPost(session, text, articleUrl, thumb) {
    const ogp = await fetchOgpMeta(articleUrl);
    const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        facets: detectFacets(text),
        embed: {
            $type: 'app.bsky.embed.external',
            external: {
                uri: ogp.uri,
                title: ogp.title,
                description: ogp.description,
                ...(thumb ? { thumb } : {}),
            },
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

    // ブログ記事（週次トレンド等）とNote記事の新着を取得
    const [blogPosts, notePosts] = await Promise.all([
        Promise.resolve(getNewBlogPosts(postedUrls)),
        getNewNotePosts(postedUrls),
    ]);
    const allNewPosts = [...blogPosts, ...notePosts];

    if (allNewPosts.length === 0) {
        console.log('📝 新しい記事はありません。スキップします。');
        return;
    }

    if (DRY_RUN) {
        console.log(`🔍 [dry-run] ${allNewPosts.length} 件の投稿候補（実際の投稿・ログインは行いません）:`);
        for (const item of allNewPosts) {
            const postText = buildPostText(item);
            const thumbData = await getThumbBuffer(item);
            console.log(`  [${item.source}] ${item.title}`);
            console.log(`    URL: ${item.url}`);
            console.log(`    OGP画像: ${thumbData ? thumbData.info : 'なし'}`);
            console.log(`    本文(${postText.length}字): ${postText.replace(/\n/g, ' / ')}`);
        }
        return;
    }

    console.log(`🦋 ${allNewPosts.length} 件を Bluesky に投稿します...`);

    // Blueskyログイン
    const session = await createSession();
    console.log(`✅ Blueskyログイン成功 (${IDENTIFIER})`);

    // 最大3件まで投稿（安全制限）
    const toPost = allNewPosts.slice(0, 3);
    const newlyPosted = [];

    for (const item of toPost) {
        const postText = buildPostText(item);
        try {
            const thumb = await resolveThumb(session, item);
            const result = await createPost(session, postText, item.url, thumb);
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

    if (allNewPosts.length > 3) {
        console.log(`⚠️ ${allNewPosts.length - 3} 件は投稿上限(3件/回)により次回に持ち越し`);
    }
}

main().catch(err => {
    console.error('❌ エラー:', err.message);
    process.exit(0);
});
