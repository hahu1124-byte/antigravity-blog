// 画像変換・圧縮ツール — ブラウザ完結
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
    const formatSelect = document.getElementById('format-select');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const resizeSelect = document.getElementById('resize-select');
    const customSizeGroup = document.getElementById('custom-size-group');
    const customWidth = document.getElementById('custom-width');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    const results = document.getElementById('results');
    const resultItems = document.getElementById('result-items');
    const resultsSummary = document.getElementById('results-summary');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearResultsBtn = document.getElementById('clear-results-btn');

    // ファイル管理
    let files = [];
    let convertedFiles = [];

    // ユーティリティ
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

    // ドラッグ＆ドロップ
    dropZone.addEventListener('click', (e) => {
        // label要素のクリックはネイティブでfile inputを開くので二重発火防止
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        // リセットしてから開く（同じファイルの再選択を可能に）
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

    // ファイル処理
    function handleFiles(newFiles) {
        for (const file of newFiles) {
            if (!file.type.startsWith('image/')) continue;
            // 重複チェック
            if (files.some(f => f.name === file.name && f.size === file.size)) continue;
            files.push(file);
        }
        updateFileList();
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
        const total = files.reduce((s, f) => s + f.size, 0);
        totalSize.textContent = '合計: ' + formatBytes(total);

        fileItems.innerHTML = '';
        files.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.id = 'file-item-' + idx;

            const thumb = document.createElement('img');
            thumb.className = 'file-thumb';
            thumb.src = URL.createObjectURL(file);
            thumb.onload = () => URL.revokeObjectURL(thumb.src);

            const info = document.createElement('div');
            info.className = 'file-info';

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = file.name;

            // 画像の実際のサイズを取得して表示
            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = formatBytes(file.size) + ' • ' + file.type.split('/')[1].toUpperCase();

            const img = new Image();
            img.onload = () => {
                meta.textContent = img.width + '×' + img.height + ' • ' + formatBytes(file.size) + ' • ' + file.type.split('/')[1].toUpperCase();
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(file);

            info.appendChild(name);
            info.appendChild(meta);

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
            });

            item.appendChild(thumb);
            item.appendChild(info);
            item.appendChild(removeBtn);
            fileItems.appendChild(item);
        });
    }

    // 設定イベント
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });

    resizeSelect.addEventListener('change', () => {
        customSizeGroup.classList.toggle('hidden', resizeSelect.value !== 'custom');
    });

    // PNG/Base64選択時は品質スライダーを無効化
    formatSelect.addEventListener('change', () => {
        const fmt = formatSelect.value;
        const noQuality = fmt === 'png' || fmt === 'base64' || fmt === 'ico';
        qualitySlider.disabled = noQuality;
        qualitySlider.style.opacity = noQuality ? '0.3' : '1';
        // ICO/Base64ではリサイズ設定を非表示（ICOは固定サイズ）
        const hideResize = fmt === 'ico';
        resizeSelect.closest('.setting-group').style.display = hideResize ? 'none' : '';
    });

    // クリア
    clearBtn.addEventListener('click', () => {
        files = [];
        convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
        convertedFiles = [];
        updateFileList();
    });

    // 結果のみクリア
    clearResultsBtn.addEventListener('click', () => {
        convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
        convertedFiles = [];
        results.classList.add('hidden');
    });

    // 変換処理
    convertBtn.addEventListener('click', async () => {
        if (files.length === 0) return;

        convertBtn.disabled = true;
        convertBtn.textContent = '⏳ 変換中...';
        convertedFiles = [];
        results.classList.add('hidden');

        const format = formatSelect.value;
        const quality = parseInt(qualitySlider.value) / 100;
        const resizeOption = resizeSelect.value;
        const maxWidth = resizeOption === 'custom' ? parseInt(customWidth.value) : (resizeOption !== 'none' ? parseInt(resizeOption) : null);

        let totalOriginal = 0;
        let totalConverted = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progressEl = document.getElementById('progress-' + i);
            const progressBar = progressEl?.querySelector('.file-progress-bar');

            if (progressEl) {
                progressEl.classList.remove('hidden');
                progressBar.style.width = '30%';
            }

            try {
                let result;
                if (format === 'ico') {
                    result = await convertToIco(file);
                } else if (format === 'base64') {
                    result = await convertToBase64(file, quality, maxWidth);
                } else {
                    result = await convertImage(file, format, quality, maxWidth);
                }
                totalOriginal += file.size;
                totalConverted += result.blob.size;

                const entry = {
                    name: stripExtension(file.name) + '.' + getExtension(format),
                    blob: result.blob,
                    originalSize: file.size,
                    newSize: result.blob.size,
                    width: result.width,
                    height: result.height,
                    url: URL.createObjectURL(result.blob),
                };
                if (result.base64Text) entry.base64Text = result.base64Text;
                convertedFiles.push(entry);

                if (progressBar) progressBar.style.width = '100%';
            } catch (err) {
                console.warn('変換失敗:', file.name, err);
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.style.background = '#ef4444';
                }
            }
        }

        // 結果表示
        showResults(totalOriginal, totalConverted);

        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 一括変換';
    });

    // Canvas変換（PNG/JPEG/WebP/AVIF）
    function convertImage(file, format, quality, maxWidth) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;

                // リサイズ
                if (maxWidth && w > maxWidth) {
                    h = Math.round(h * (maxWidth / w));
                    w = maxWidth;
                }

                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');

                // JPEGは透過非対応 → 白背景で塗りつぶし
                if (format === 'jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                }

                ctx.drawImage(img, 0, 0, w, h);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({ blob, width: w, height: h });
                        } else {
                            // AVIFなど未対応ブラウザの場合WebPにフォールバック
                            canvas.toBlob(
                                (fbBlob) => {
                                    if (fbBlob) resolve({ blob: fbBlob, width: w, height: h });
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

    // ICO (favicon) 変換 — 16/32/48px の3サイズを1ファイルに
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

                // ICOバイナリ構築
                const headerSize = 6;
                const entrySize = 16;
                const dataOffset = headerSize + entrySize * images.length;

                let totalDataSize = 0;
                const pngBlobs = [];

                // 各サイズをPNG形式でエンコード
                let processed = 0;
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
            let totalSize = headerSize + entrySize * buffers.length;
            for (const buf of buffers) totalSize += buf.byteLength;

            const ico = new ArrayBuffer(totalSize);
            const view = new DataView(ico);

            // ICOヘッダー
            view.setUint16(0, 0, true);     // 予約
            view.setUint16(2, 1, true);     // タイプ: ICO
            view.setUint16(4, buffers.length, true); // 画像数

            let dataPos = headerSize + entrySize * buffers.length;
            buffers.forEach((buf, i) => {
                const offset = headerSize + entrySize * i;
                const s = sizes[i];
                view.setUint8(offset, s < 256 ? s : 0);      // 幅
                view.setUint8(offset + 1, s < 256 ? s : 0);  // 高さ
                view.setUint8(offset + 2, 0);   // パレット
                view.setUint8(offset + 3, 0);   // 予約
                view.setUint16(offset + 4, 1, true);   // カラープレーン
                view.setUint16(offset + 6, 32, true);  // ビット深度
                view.setUint32(offset + 8, buf.byteLength, true);  // データサイズ
                view.setUint32(offset + 12, dataPos, true);        // データオフセット

                new Uint8Array(ico, dataPos, buf.byteLength).set(new Uint8Array(buf));
                dataPos += buf.byteLength;
            });

            const blob = new Blob([ico], { type: 'image/x-icon' });
            resolve({ blob, width: 48, height: 48 });
        } catch (e) {
            reject(e);
        }
    }

    // Base64テキスト出力
    function convertToBase64(file, quality, maxWidth) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (maxWidth && w > maxWidth) {
                    h = Math.round(h * (maxWidth / w));
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const dataUrl = canvas.toDataURL('image/png');
                const text = dataUrl;
                const blob = new Blob([text], { type: 'text/plain' });
                resolve({ blob, width: w, height: h, base64Text: text });
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('画像の読み込みに失敗'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    // 結果表示
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

            // Base64の場合はコピーボタンを追加
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

    // ダウンロード
    function downloadFile(file) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.name;
        a.click();
    }

    // 一括ダウンロード
    downloadAllBtn.addEventListener('click', () => {
        convertedFiles.forEach((file, i) => {
            setTimeout(() => downloadFile(file), i * 200);
        });
    });

})();
