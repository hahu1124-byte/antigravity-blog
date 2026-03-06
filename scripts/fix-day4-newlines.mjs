// Day4記事のリテラル \n を実際の改行に修正するスクリプト
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/blog-data.json';
const raw = readFileSync(filePath, 'utf-8');
const data = JSON.parse(raw);

const day4 = data[0];
if (!day4.title.includes('Day 4')) {
    console.error('先頭がDay4ではありません:', day4.title);
    process.exit(1);
}

// パース後のcontent文字列内にリテラルの \n （バックスラッシュ+n）が残っている場合
// 実際の改行文字に置換
const before = day4.content;
day4.content = day4.content.replace(/\\n/g, '\n');

const changed = before !== day4.content;
console.log(changed ? '✅ リテラル \\n を改行に修正しました' : '⚠️ 変更なし');

writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
