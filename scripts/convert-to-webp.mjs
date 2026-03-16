/**
 * PNG → WebP 一括変換スクリプト
 * 使用: node scripts/convert-to-webp.mjs
 */
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync } from 'fs';
import { join, extname, basename } from 'path';

const IMAGES_DIR = join(import.meta.dirname, '..', 'src', 'images');
const QUALITY = 80;

const files = readdirSync(IMAGES_DIR)
    .filter(f => ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()));

console.log(`🔄 ${files.length} 件の画像を WebP (品質${QUALITY}) に変換中...\n`);

let totalOriginal = 0;
let totalConverted = 0;

for (const file of files) {
    const inputPath = join(IMAGES_DIR, file);
    const outputName = basename(file, extname(file)) + '.webp';
    const outputPath = join(IMAGES_DIR, outputName);

    const originalSize = statSync(inputPath).size;
    totalOriginal += originalSize;

    try {
        await sharp(inputPath)
            .webp({ quality: QUALITY })
            .toFile(outputPath);

        const newSize = statSync(outputPath).size;
        totalConverted += newSize;

        const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
        console.log(`  ✅ ${file} → ${outputName}  |  ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB  (${reduction}% 削減)`);
    } catch (err) {
        console.error(`  ❌ ${file}: ${err.message}`);
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 合計: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB → ${(totalConverted / 1024 / 1024).toFixed(1)}MB`);
console.log(`📉 削減率: ${((1 - totalConverted / totalOriginal) * 100).toFixed(1)}%`);
console.log(`💾 削減量: ${((totalOriginal - totalConverted) / 1024 / 1024).toFixed(1)}MB`);
