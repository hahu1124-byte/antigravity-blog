// 画像変換・圧縮ツール — ブラウザ完結（リサイズ強化版）
(function () {
    'use strict';

    // DOM要素
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const settingsPanel = document.getElementById('settings-panel');
    const fileList = document.getElementById('file-list');
    const fileItems = document.getElementById('file-items');
    const fileCount = document.getElementById('file-count');
    const totalSize = document.getElementById('total-size');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const qualitySection = document.getElementById('quality-section');
    const resizeSection = document.getElementById('resize-section');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    const results = document.getElementById('results');
    const resultItems = document.getElementById('result-items');
    const resultsSummary = document.getElementById('results-summary');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearResultsBtn = document.getElementById('clear-results-btn');
    const customSizePanel = document.getElementById('custom-size-panel');
    const customWidthPct = document.getElementById('custom-width-pct');
    const customHeightPct = document.getElementById('custom-height-pct');
    const aspectLockBtn = document.getElementById('aspect-lock-btn');
    const lockIcon = document.getElementById('lock-icon');
    const sizePreview = document.getElementById('size-preview');

    // ファイル管理
    let files = [];           // {file, img, width, height}
    let convertedFiles = [];

    // 設定状態
    let outputFormat = 'original';
    let resizePercent = 100;
    let isCustomResize = false;
    let aspectLocked = true;

    // UX保護制限
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const MAX_FILE_COUNT = 50;

    // === ユーティリティ ===
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getExtension(format) {
        if (format === 'jpeg') return 'jpg';
        if (format === 'base64') return 'txt';
        return format;
    }

    function getMimeType(format) {
        if (format === 'ico') return 'image/x-icon';
        if (format === 'base64') return 'text/plain';
        return 'image/' + format;
    }

    function stripExtension(name) {
        return name.replace(/\.[^.]+$/, '');
    }

    function detectSourceFormat(file) {
        const t = file.type;
        if (t === 'image/jpeg') return 'jpeg';
        if (t === 'image/png') return 'png';
        if (t === 'image/webp') return 'webp';
        if (t === 'image/avif') return 'avif';
        if (t === 'image/gif') return 'gif';
        if (t === 'image/bmp') return 'bmp';
        if (t === 'image/svg+xml') return 'svg';
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'jpg') return 'jpeg';
        return ext || 'png';
    }

    function getEffectiveFormat(sourceFormat) {
        if (outputFormat === 'original') {
            // Canvas非対応の形式はPNGにフォールバック
            const supported = ['jpeg', 'png', 'webp', 'avif'];
            return supported.includes(sourceFormat) ? sourceFormat : 'png';
        }
        return outputFormat;
    }

    function getSourceExtension(file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        return ext;
    }

    // === ドラッグ＆ドロップ ===
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        fileInput.value = '';
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFiles(fileInput.files);
        }
    });

    // === ファイル処理 ===
    function handleFiles(newFiles) {
        let skippedSize = 0;
        let skippedCount = 0;

        const promises = [];

        for (const file of newFiles) {
            if (!file.type.startsWith('image/')) continue;
            if (files.some(f => f.file.name === file.name && f.file.size === file.size)) continue;
            if (file.size > MAX_FILE_SIZE) { skippedSize++; continue; }
            if (files.length >= MAX_FILE_COUNT) {
                skippedCount += (newFiles.length - Array.from(newFiles).indexOf(file));
                break;
            }

            // 画像のサイズを取得
            const p = new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    files.push({ file, img, width: img.naturalWidth, height: img.naturalHeight });
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = URL.createObjectURL(file);
            });
            promises.push(p);
        }

        Promise.all(promises).then(() => {
            if (skippedSize > 0) {
                alert('⚠️ ' + skippedSize + '件のファイルが50MBを超えているためスキップしました。');
            }
            if (skippedCount > 0) {
                alert('⚠️ 同時処理は最大50枚までです。');
            }
            updateFileList();
            updateSizePreview();
        });
    }

    function updateFileList() {
        if (files.length === 0) {
            settingsPanel.classList.add('hidden');
            fileList.classList.add('hidden');
            results.classList.add('hidden');
            return;
        }

        settingsPanel.classList.remove('hidden');
        fileList.classList.remove('hidden');

        fileCount.textContent = files.length + ' ファイル';
        const total = files.reduce((s, f) => s + f.file.size, 0);
        totalSize.textContent = '合計: ' + formatBytes(total);

        fileItems.innerHTML = '';
        files.forEach((entry, idx) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.id = 'file-item-' + idx;

            const thumb = document.createElement('img');
            thumb.className = 'file-thumb';
            thumb.src = URL.createObjectURL(entry.file);
            thumb.onload = () => URL.revokeObjectURL(thumb.src);

            const info = document.createElement('div');
            info.className = 'file-info';

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = entry.file.name;

            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = entry.width + '×' + entry.height + ' • ' + formatBytes(entry.file.size) + ' • ' + entry.file.type.split('/')[1].toUpperCase();

            // リサイズ後のサイズ表示
            const afterSize = document.createElement('div');
            afterSize.className = 'file-after-size';
            afterSize.id = 'after-size-' + idx;
            updateFileAfterSize(afterSize, entry);

            info.appendChild(name);
            info.appendChild(meta);
            info.appendChild(afterSize);

            // プログレスバー
            const progress = document.createElement('div');
            progress.className = 'file-progress hidden';
            progress.id = 'progress-' + idx;
            const progressBar = document.createElement('div');
            progressBar.className = 'file-progress-bar';
            progress.appendChild(progressBar);
            info.appendChild(progress);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                files.splice(idx, 1);
                updateFileList();
                updateSizePreview();
            });

            item.appendChild(thumb);
            item.appendChild(info);
            item.appendChild(removeBtn);
            fileItems.appendChild(item);
        });
    }

    function updateFileAfterSize(el, entry) {
        const { w, h } = calcNewSize(entry.width, entry.height);
        const fmt = getEffectiveFormat(detectSourceFormat(entry.file)).toUpperCase();
        if (w !== entry.width || h !== entry.height || outputFormat !== 'original') {
            el.textContent = '→ ' + w + '×' + h + ' • ' + fmt;
        } else {
            el.textContent = '';
        }
    }

    function updateAllAfterSizes() {
        files.forEach((entry, idx) => {
            const el = document.getElementById('after-size-' + idx);
            if (el) updateFileAfterSize(el, entry);
        });
    }

    // === リサイズ計算 ===
    function calcNewSize(origW, origH) {
        if (isCustomResize) {
            const wp = parseInt(customWidthPct.value) || 100;
            const hp = parseInt(customHeightPct.value) || 100;
            return {
                w: Math.max(1, Math.round(origW * wp / 100)),
                h: Math.max(1, Math.round(origH * hp / 100))
            };
        }
        return {
            w: Math.max(1, Math.round(origW * resizePercent / 100)),
            h: Math.max(1, Math.round(origH * resizePercent / 100))
        };
    }

    // === 出力フォーマット ===
    document.getElementById('format-chips').addEventListener('click', (e) => {
        const chip = e.target.closest('.format-chip');
        if (!chip) return;
        document.querySelectorAll('.format-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        outputFormat = chip.dataset.fmt;

        // PNG/Base64/ICOでは品質無効化
        const noQuality = ['png', 'base64', 'ico'].includes(outputFormat === 'original' ? '' : outputFormat);
        qualitySlider.disabled = noQuality;
        qualitySection.style.opacity = noQuality ? '0.4' : '1';

        // ICOではリサイズセクション非表示
        resizeSection.style.display = outputFormat === 'ico' ? 'none' : '';

        updateAllAfterSizes();
    });

    // === 品質スライダー ===
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value + '%';
    });

    // === リサイズプリセット ===
    document.getElementById('resize-presets').addEventListener('click', (e) => {
        const btn = e.target.closest('.resize-preset');
        if (!btn) return;

        document.querySelectorAll('.resize-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (btn.dataset.pct === 'custom') {
            isCustomResize = true;
            customSizePanel.classList.remove('hidden');
        } else {
            isCustomResize = false;
            resizePercent = parseInt(btn.dataset.pct);
            customSizePanel.classList.add('hidden');
        }

        updateAllAfterSizes();
        updateSizePreview();
    });

    // === カスタムサイズ入力 ===
    customWidthPct.addEventListener('input', () => {
        if (aspectLocked) {
            customHeightPct.value = customWidthPct.value;
        }
        updateAllAfterSizes();
        updateSizePreview();
    });

    customHeightPct.addEventListener('input', () => {
        if (aspectLocked) {
            customWidthPct.value = customHeightPct.value;
        }
        updateAllAfterSizes();
        updateSizePreview();
    });

    // === アスペクト比ロック ===
    aspectLockBtn.addEventListener('click', () => {
        aspectLocked = !aspectLocked;
        aspectLockBtn.classList.toggle('active', aspectLocked);
        lockIcon.textContent = aspectLocked ? '🔗' : '🔓';

        if (aspectLocked) {
            // ロック時は幅に合わせる
            customHeightPct.value = customWidthPct.value;
            updateAllAfterSizes();
            updateSizePreview();
        }
    });

    // === サイズプレビュー ===
    function updateSizePreview() {
        if (files.length === 0 || (!isCustomResize && resizePercent === 100)) {
            sizePreview.textContent = '';
            return;
        }
        const first = files[0];
        const { w, h } = calcNewSize(first.width, first.height);
        if (files.length === 1) {
            sizePreview.textContent = first.width + '×' + first.height + ' → ' + w + '×' + h + ' px';
        } else {
            sizePreview.textContent = '例: ' + first.width + '×' + first.height + ' → ' + w + '×' + h + ' px（各ファイルごとに計算）';
        }
    }

    // === クリア ===
    clearBtn.addEventListener('click', () => {
        files = [];
        convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
        convertedFiles = [];
        updateFileList();
    });

    clearResultsBtn.addEventListener('click', () => {
        convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
        convertedFiles = [];
        results.classList.add('hidden');
    });

    // === 変換処理 ===
    convertBtn.addEventListener('click', async () => {
        if (files.length === 0) return;

        convertBtn.disabled = true;
        convertBtn.textContent = '⏳ 変換中...';
        convertedFiles = [];
        results.classList.add('hidden');

        const quality = parseInt(qualitySlider.value) / 100;

        let totalOriginal = 0;
        let totalConverted = 0;

        for (let i = 0; i < files.length; i++) {
            const entry = files[i];
            const file = entry.file;
            const progressEl = document.getElementById('progress-' + i);
            const progressBar = progressEl?.querySelector('.file-progress-bar');

            if (progressEl) {
                progressEl.classList.remove('hidden');
                progressBar.style.width = '30%';
                progressBar.style.background = '';
            }

            const sourceFormat = detectSourceFormat(file);
            const format = getEffectiveFormat(sourceFormat);
            const { w, h } = calcNewSize(entry.width, entry.height);

            try {
                let result;
                if (format === 'ico' || outputFormat === 'ico') {
                    result = await convertToIco(file);
                } else if (format === 'base64' || outputFormat === 'base64') {
                    result = await convertToBase64(file, quality, w, h);
                } else {
                    result = await convertImage(file, format, quality, w, h);
                }
                totalOriginal += file.size;
                totalConverted += result.blob.size;

                // ファイル名を決定
                let outName;
                if (outputFormat === 'original') {
                    outName = file.name; // 元ファイル名そのまま
                } else {
                    outName = stripExtension(file.name) + '.' + getExtension(format);
                }

                const resultEntry = {
                    name: outName,
                    blob: result.blob,
                    originalSize: file.size,
                    newSize: result.blob.size,
                    width: result.width,
                    height: result.height,
                    url: URL.createObjectURL(result.blob),
                };
                if (result.base64Text) resultEntry.base64Text = result.base64Text;
                convertedFiles.push(resultEntry);

                if (progressBar) progressBar.style.width = '100%';
            } catch (err) {
                console.warn('変換失敗:', file.name, err);
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.style.background = '#ef4444';
                }
            }
        }

        showResults(totalOriginal, totalConverted);
        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 一括変換';
    });

    // === Canvas変換 ===
    function convertImage(file, format, quality, targetW, targetH) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;

                const ctx = canvas.getContext('2d');

                // JPEGは透過非対応 → 白背景
                if (format === 'jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, targetW, targetH);
                }

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, targetW, targetH);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({ blob, width: targetW, height: targetH });
                        } else {
                            // AVIF等未対応ブラウザ → WebPフォールバック
                            canvas.toBlob(
                                (fbBlob) => {
                                    if (fbBlob) resolve({ blob: fbBlob, width: targetW, height: targetH });
                                    else reject(new Error('変換に失敗しました'));
                                },
                                'image/webp',
                                quality
                            );
                        }
                        URL.revokeObjectURL(img.src);
                    },
                    getMimeType(format),
                    (format === 'png') ? undefined : quality
                );
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('画像の読み込みに失敗'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    // === ICO変換 ===
    function convertToIco(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const sizes = [16, 32, 48];
                const images = [];

                for (const size of sizes) {
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);
                    const imageData = ctx.getImageData(0, 0, size, size);
                    images.push({ size, data: imageData });
                }

                let processed = 0;
                const pngBlobs = [];
                images.forEach((img2, idx) => {
                    const c = document.createElement('canvas');
                    c.width = img2.size;
                    c.height = img2.size;
                    c.getContext('2d').putImageData(img2.data, 0, 0);
                    c.toBlob((blob) => {
                        pngBlobs[idx] = blob;
                        processed++;
                        if (processed === images.length) {
                            buildIco(pngBlobs, sizes, resolve, reject);
                        }
                    }, 'image/png');
                });

                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('画像の読み込みに失敗'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    async function buildIco(pngBlobs, sizes, resolve, reject) {
        try {
            const buffers = [];
            for (const blob of pngBlobs) {
                buffers.push(await blob.arrayBuffer());
            }

            const headerSize = 6;
            const entrySize = 16;
            let totalIcoSize = headerSize + entrySize * buffers.length;
            for (const buf of buffers) totalIcoSize += buf.byteLength;

            const ico = new ArrayBuffer(totalIcoSize);
            const view = new DataView(ico);

            view.setUint16(0, 0, true);
            view.setUint16(2, 1, true);
            view.setUint16(4, buffers.length, true);

            let dataPos = headerSize + entrySize * buffers.length;
            buffers.forEach((buf, i) => {
                const offset = headerSize + entrySize * i;
                const s = sizes[i];
                view.setUint8(offset, s < 256 ? s : 0);
                view.setUint8(offset + 1, s < 256 ? s : 0);
                view.setUint8(offset + 2, 0);
                view.setUint8(offset + 3, 0);
                view.setUint16(offset + 4, 1, true);
                view.setUint16(offset + 6, 32, true);
                view.setUint32(offset + 8, buf.byteLength, true);
                view.setUint32(offset + 12, dataPos, true);

                new Uint8Array(ico, dataPos, buf.byteLength).set(new Uint8Array(buf));
                dataPos += buf.byteLength;
            });

            const blob = new Blob([ico], { type: 'image/x-icon' });
            resolve({ blob, width: 48, height: 48 });
        } catch (e) {
            reject(e);
        }
    }

    // === Base64変換 ===
    function convertToBase64(file, quality, targetW, targetH) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, targetW, targetH);

                const dataUrl = canvas.toDataURL('image/png');
                const blob = new Blob([dataUrl], { type: 'text/plain' });
                resolve({ blob, width: targetW, height: targetH, base64Text: dataUrl });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('画像の読み込みに失敗'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    // === 結果表示 ===
    function showResults(totalOriginal, totalConverted) {
        results.classList.remove('hidden');

        const savedBytes = totalOriginal - totalConverted;
        const savedPct = totalOriginal > 0 ? Math.round((savedBytes / totalOriginal) * 100) : 0;

        if (savedBytes > 0) {
            resultsSummary.textContent = formatBytes(totalOriginal) + ' → ' + formatBytes(totalConverted) + ' (' + savedPct + '% 削減)';
        } else {
            resultsSummary.textContent = formatBytes(totalOriginal) + ' → ' + formatBytes(totalConverted);
        }

        resultItems.innerHTML = '';
        convertedFiles.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const thumb = document.createElement('img');
            thumb.className = 'result-thumb';
            thumb.src = file.url;

            const info = document.createElement('div');
            info.className = 'result-info';

            const name = document.createElement('div');
            name.className = 'result-name';
            name.textContent = file.name;

            const meta = document.createElement('div');
            meta.className = 'result-meta';

            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'result-size';
            sizeSpan.textContent = file.width + '×' + file.height + ' • ' + formatBytes(file.newSize);

            const savings = document.createElement('span');
            savings.className = 'result-savings';
            const diff = file.originalSize - file.newSize;
            if (diff > 0) {
                savings.textContent = '▼ ' + Math.round((diff / file.originalSize) * 100) + '% 削減';
            } else if (diff < 0) {
                savings.textContent = '▲ ' + Math.round((Math.abs(diff) / file.originalSize) * 100) + '% 増加';
                savings.style.color = '#f87171';
            }

            meta.appendChild(sizeSpan);
            if (diff !== 0) meta.appendChild(savings);

            info.appendChild(name);
            info.appendChild(meta);

            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn-download';
            dlBtn.textContent = '⬇ DL';
            dlBtn.addEventListener('click', () => downloadFile(file));

            item.appendChild(thumb);
            item.appendChild(info);
            item.appendChild(dlBtn);

            // Base64コピーボタン
            if (file.base64Text) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn-download';
                copyBtn.textContent = '📋 コピー';
                copyBtn.style.marginLeft = '0.3rem';
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(file.base64Text).then(() => {
                        copyBtn.textContent = '✅ コピー済';
                        setTimeout(() => { copyBtn.textContent = '📋 コピー'; }, 2000);
                    });
                });
                item.appendChild(copyBtn);
            }

            resultItems.appendChild(item);
        });
    }

    // === ダウンロード ===
    function downloadFile(file) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.name;
        a.click();
    }

    downloadAllBtn.addEventListener('click', async () => {
        if (convertedFiles.length === 0) return;

        // 1ファイルなら単体ダウンロード
        if (convertedFiles.length === 1) {
            downloadFile(convertedFiles[0]);
            return;
        }

        // 複数ファイル → ZIPにまとめる
        downloadAllBtn.disabled = true;
        downloadAllBtn.textContent = '⏳ ZIP作成中...';

        try {
            const zip = new JSZip();
            for (const file of convertedFiles) {
                zip.file(file.name, file.blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'converted-images.zip';
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('ZIP作成失敗:', err);
            alert('⚠️ ZIPの作成に失敗しました。個別にダウンロードしてください。');
        }

        downloadAllBtn.disabled = false;
        downloadAllBtn.textContent = '📦 すべてダウンロード (ZIP)';
    });

})();
