// PDF結合・分割ツール — ブラウザ完結（pdf-lib）
(function () {
    'use strict';

    const { PDFDocument } = PDFLib;

    // UX保護制限
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_FILE_COUNT = 20;

    // ユーティリティ
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function stripExtension(name) {
        return name.replace(/\.[^.]+$/, '');
    }

    // ========== タブ切り替え ==========
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('panel-' + target).classList.add('active');
        });
    });

    // ========== 結合タブ ==========
    const mergeDropZone = document.getElementById('merge-drop-zone');
    const mergeFileInput = document.getElementById('merge-file-input');
    const mergeFileList = document.getElementById('merge-file-list');
    const mergeFileItems = document.getElementById('merge-file-items');
    const mergeFileCount = document.getElementById('merge-file-count');
    const mergeTotalSize = document.getElementById('merge-total-size');
    const mergeBtn = document.getElementById('merge-btn');
    const mergeClearBtn = document.getElementById('merge-clear-btn');
    const mergeResult = document.getElementById('merge-result');
    const mergeResultInfo = document.getElementById('merge-result-info');
    const mergeDownloadBtn = document.getElementById('merge-download-btn');

    let mergeFiles = [];
    let mergedBlobUrl = null;
    let mergedFileName = 'merged.pdf';

    // ドロップゾーン
    mergeDropZone.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        mergeFileInput.value = '';
        mergeFileInput.click();
    });

    mergeDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mergeDropZone.classList.add('drag-over');
    });

    mergeDropZone.addEventListener('dragleave', () => {
        mergeDropZone.classList.remove('drag-over');
    });

    mergeDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        mergeDropZone.classList.remove('drag-over');
        addMergeFiles(e.dataTransfer.files);
    });

    mergeFileInput.addEventListener('change', () => {
        if (mergeFileInput.files.length > 0) {
            addMergeFiles(mergeFileInput.files);
        }
    });

    function addMergeFiles(newFiles) {
        let skippedSize = 0;
        for (const file of newFiles) {
            if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) continue;
            if (mergeFiles.some(f => f.name === file.name && f.size === file.size)) continue;
            if (file.size > MAX_FILE_SIZE) {
                skippedSize++;
                continue;
            }
            if (mergeFiles.length >= MAX_FILE_COUNT) {
                alert('⚠️ 結合は最大' + MAX_FILE_COUNT + 'ファイルまでです。\nブラウザの安定動作のための制限です。');
                break;
            }
            mergeFiles.push(file);
        }
        if (skippedSize > 0) {
            alert('⚠️ ' + skippedSize + '件のファイルが50MBを超えているためスキップしました。');
        }
        updateMergeList();
    }

    function updateMergeList() {
        if (mergeFiles.length === 0) {
            mergeFileList.classList.add('hidden');
            mergeResult.classList.add('hidden');
            return;
        }

        mergeFileList.classList.remove('hidden');
        mergeFileCount.textContent = mergeFiles.length + ' ファイル';
        const total = mergeFiles.reduce((s, f) => s + f.size, 0);
        mergeTotalSize.textContent = '合計: ' + formatBytes(total);

        mergeFileItems.innerHTML = '';
        mergeFiles.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.draggable = true;
            item.dataset.index = idx;

            const order = document.createElement('span');
            order.className = 'file-order';
            order.textContent = (idx + 1);

            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = '📄';

            const info = document.createElement('div');
            info.className = 'file-info';

            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = file.name;

            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = formatBytes(file.size);

            // ページ数を非同期で取得
            loadPageCount(file, meta);

            info.appendChild(name);
            info.appendChild(meta);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mergeFiles.splice(idx, 1);
                updateMergeList();
            });

            item.appendChild(order);
            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(removeBtn);

            // ドラッグ並び替え
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                document.querySelectorAll('.drag-over-item').forEach(el => el.classList.remove('drag-over-item'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over-item');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-item');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over-item');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (fromIdx !== toIdx) {
                    const [moved] = mergeFiles.splice(fromIdx, 1);
                    mergeFiles.splice(toIdx, 0, moved);
                    updateMergeList();
                }
            });

            mergeFileItems.appendChild(item);
        });
    }

    async function loadPageCount(file, metaEl) {
        try {
            const buf = await file.arrayBuffer();
            const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
            const pages = pdf.getPageCount();
            metaEl.textContent = pages + 'ページ • ' + formatBytes(file.size);
        } catch (e) {
            // 読み取り失敗時はサイズのみ表示
        }
    }

    // クリア
    mergeClearBtn.addEventListener('click', () => {
        mergeFiles = [];
        if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
        mergedBlobUrl = null;
        updateMergeList();
    });

    // 結合実行
    mergeBtn.addEventListener('click', async () => {
        if (mergeFiles.length < 2) {
            alert('2つ以上のPDFファイルを追加してください。');
            return;
        }

        mergeBtn.disabled = true;
        mergeBtn.textContent = '⏳ 結合中...';
        mergeResult.classList.add('hidden');

        try {
            const mergedPdf = await PDFDocument.create();
            let totalPages = 0;

            for (const file of mergeFiles) {
                const buf = await file.arrayBuffer();
                const srcPdf = await PDFDocument.load(buf, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
                totalPages += pages.length;
            }

            const mergedBytes = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });

            if (mergedBlobUrl) URL.revokeObjectURL(mergedBlobUrl);
            mergedBlobUrl = URL.createObjectURL(blob);
            mergedFileName = 'merged_' + mergeFiles.length + 'files.pdf';

            mergeResultInfo.textContent = mergeFiles.length + 'ファイル → ' + totalPages + 'ページ（' + formatBytes(blob.size) + '）';
            mergeResult.classList.remove('hidden');
        } catch (e) {
            console.error('結合エラー:', e);
            alert('❌ PDFの結合に失敗しました。\nファイルが破損しているか、暗号化されている可能性があります。');
        }

        mergeBtn.disabled = false;
        mergeBtn.textContent = '📎 PDFを結合';
    });

    // 結合結果ダウンロード
    mergeDownloadBtn.addEventListener('click', () => {
        if (!mergedBlobUrl) return;
        const a = document.createElement('a');
        a.href = mergedBlobUrl;
        a.download = mergedFileName;
        a.click();
    });

    // ========== 分割タブ ==========
    const splitDropZone = document.getElementById('split-drop-zone');
    const splitFileInput = document.getElementById('split-file-input');
    const splitSettings = document.getElementById('split-settings');
    const splitFileInfo = document.getElementById('split-file-info');
    const splitMode = document.getElementById('split-mode');
    const pagesInputGroup = document.getElementById('pages-input-group');
    const pagesInput = document.getElementById('pages-input');
    const rangeInputGroup = document.getElementById('range-input-group');
    const rangeSize = document.getElementById('range-size');
    const splitBtn = document.getElementById('split-btn');
    const splitClearBtn = document.getElementById('split-clear-btn');
    const splitResult = document.getElementById('split-result');
    const splitResultItems = document.getElementById('split-result-items');
    const splitDownloadAllBtn = document.getElementById('split-download-all-btn');

    let splitFile = null;
    let splitPdfDoc = null;
    let splitPageCount = 0;
    let splitResults = [];

    // ドロップゾーン
    splitDropZone.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        splitFileInput.value = '';
        splitFileInput.click();
    });

    splitDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        splitDropZone.classList.add('drag-over');
    });

    splitDropZone.addEventListener('dragleave', () => {
        splitDropZone.classList.remove('drag-over');
    });

    splitDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        splitDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            loadSplitFile(e.dataTransfer.files[0]);
        }
    });

    splitFileInput.addEventListener('change', () => {
        if (splitFileInput.files.length > 0) {
            loadSplitFile(splitFileInput.files[0]);
        }
    });

    async function loadSplitFile(file) {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            alert('PDFファイルを選択してください。');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            alert('⚠️ ファイルサイズが50MBを超えています。\nブラウザのメモリ保護のため、50MB以下のファイルを使用してください。');
            return;
        }

        try {
            const buf = await file.arrayBuffer();
            splitPdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
            splitPageCount = splitPdfDoc.getPageCount();
            splitFile = file;

            splitFileInfo.innerHTML = '';
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = '📄';
            const info = document.createElement('div');
            info.className = 'file-info';
            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = file.name;
            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = splitPageCount + 'ページ • ' + formatBytes(file.size);
            info.appendChild(name);
            info.appendChild(meta);
            splitFileInfo.appendChild(icon);
            splitFileInfo.appendChild(info);

            splitSettings.classList.remove('hidden');
            splitResult.classList.add('hidden');

            // ページ指定のプレースホルダーを更新
            pagesInput.placeholder = '例: 1,3,5-8  （全' + splitPageCount + 'ページ）';
        } catch (e) {
            console.error('PDFロードエラー:', e);
            alert('❌ PDFの読み込みに失敗しました。\nファイルが破損しているか、暗号化されている可能性があります。');
        }
    }

    // モード切替
    splitMode.addEventListener('change', () => {
        const mode = splitMode.value;
        pagesInputGroup.classList.toggle('hidden', mode !== 'pages');
        rangeInputGroup.classList.toggle('hidden', mode !== 'range');
    });

    // クリア
    splitClearBtn.addEventListener('click', () => {
        splitFile = null;
        splitPdfDoc = null;
        splitPageCount = 0;
        splitResults.forEach(r => URL.revokeObjectURL(r.url));
        splitResults = [];
        splitSettings.classList.add('hidden');
        splitResult.classList.add('hidden');
    });

    // ページ番号パーサー（"1,3,5-8,12" → [0,2,4,5,6,7,11]）
    function parsePageSpec(spec, maxPage) {
        const pages = new Set();
        const parts = spec.split(',').map(s => s.trim()).filter(Boolean);

        for (const part of parts) {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-').map(s => s.trim());
                const start = parseInt(startStr);
                const end = parseInt(endStr);
                if (isNaN(start) || isNaN(end)) continue;
                for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) {
                    pages.add(i - 1); // 0-indexed
                }
            } else {
                const p = parseInt(part);
                if (!isNaN(p) && p >= 1 && p <= maxPage) {
                    pages.add(p - 1);
                }
            }
        }
        return Array.from(pages).sort((a, b) => a - b);
    }

    // 分割実行
    splitBtn.addEventListener('click', async () => {
        if (!splitPdfDoc) return;

        splitBtn.disabled = true;
        splitBtn.textContent = '⏳ 処理中...';
        splitResults.forEach(r => URL.revokeObjectURL(r.url));
        splitResults = [];
        splitResult.classList.add('hidden');

        const mode = splitMode.value;
        const baseName = stripExtension(splitFile.name);

        try {
            if (mode === 'pages') {
                // ページ指定抽出
                const spec = pagesInput.value.trim();
                if (!spec) {
                    alert('抽出するページ番号を指定してください。');
                    splitBtn.disabled = false;
                    splitBtn.textContent = '✂️ 分割・抽出';
                    return;
                }
                const pageIndices = parsePageSpec(spec, splitPageCount);
                if (pageIndices.length === 0) {
                    alert('有効なページ番号がありません。1〜' + splitPageCount + 'の範囲で指定してください。');
                    splitBtn.disabled = false;
                    splitBtn.textContent = '✂️ 分割・抽出';
                    return;
                }

                const newPdf = await PDFDocument.create();
                const pages = await newPdf.copyPages(splitPdfDoc, pageIndices);
                pages.forEach(p => newPdf.addPage(p));
                const bytes = await newPdf.save();
                const blob = new Blob([bytes], { type: 'application/pdf' });
                splitResults.push({
                    name: baseName + '_extracted.pdf',
                    pages: pageIndices.length,
                    size: blob.size,
                    url: URL.createObjectURL(blob)
                });
            } else if (mode === 'each') {
                // 1ページずつ分割
                for (let i = 0; i < splitPageCount; i++) {
                    const newPdf = await PDFDocument.create();
                    const [page] = await newPdf.copyPages(splitPdfDoc, [i]);
                    newPdf.addPage(page);
                    const bytes = await newPdf.save();
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    splitResults.push({
                        name: baseName + '_page' + (i + 1) + '.pdf',
                        pages: 1,
                        size: blob.size,
                        url: URL.createObjectURL(blob)
                    });
                }
            } else if (mode === 'range') {
                // 範囲分割
                const chunkSize = parseInt(rangeSize.value) || 5;
                for (let start = 0; start < splitPageCount; start += chunkSize) {
                    const end = Math.min(start + chunkSize, splitPageCount);
                    const indices = [];
                    for (let i = start; i < end; i++) indices.push(i);

                    const newPdf = await PDFDocument.create();
                    const pages = await newPdf.copyPages(splitPdfDoc, indices);
                    pages.forEach(p => newPdf.addPage(p));
                    const bytes = await newPdf.save();
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    splitResults.push({
                        name: baseName + '_p' + (start + 1) + '-' + end + '.pdf',
                        pages: end - start,
                        size: blob.size,
                        url: URL.createObjectURL(blob)
                    });
                }
            }

            showSplitResults();
        } catch (e) {
            console.error('分割エラー:', e);
            alert('❌ PDFの分割に失敗しました。');
        }

        splitBtn.disabled = false;
        splitBtn.textContent = '✂️ 分割・抽出';
    });

    function showSplitResults() {
        splitResult.classList.remove('hidden');
        splitResultItems.innerHTML = '';

        splitResults.forEach((result) => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.textContent = '📄';

            const info = document.createElement('div');
            info.className = 'file-info';
            const name = document.createElement('div');
            name.className = 'file-name';
            name.textContent = result.name;
            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = result.pages + 'ページ • ' + formatBytes(result.size);
            info.appendChild(name);
            info.appendChild(meta);

            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn-download';
            dlBtn.textContent = '⬇ DL';
            dlBtn.addEventListener('click', () => {
                const a = document.createElement('a');
                a.href = result.url;
                a.download = result.name;
                a.click();
            });

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(dlBtn);
            splitResultItems.appendChild(item);
        });
    }

    // 一括ダウンロード
    splitDownloadAllBtn.addEventListener('click', () => {
        splitResults.forEach((result, i) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = result.url;
                a.download = result.name;
                a.click();
            }, i * 300);
        });
    });

})();
