// QRコード生成・読み取りツール — ブラウザ完結
(function () {
    'use strict';

    // UX保護制限
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

    // ========== 生成タブ ==========
    const qrInput = document.getElementById('qr-input');
    const charCount = document.getElementById('char-count');
    const inputType = document.getElementById('input-type');
    const sizeSelect = document.getElementById('size-select');
    const ecSelect = document.getElementById('ec-select');
    const fgColor = document.getElementById('fg-color');
    const bgColor = document.getElementById('bg-color');
    const fgHex = document.getElementById('fg-hex');
    const bgHex = document.getElementById('bg-hex');
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('preview-placeholder');
    const previewActions = document.getElementById('preview-actions');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');
    const copyBtn = document.getElementById('copy-btn');

    // デバウンス付きQR生成
    let debounceTimer = null;

    function scheduleGenerate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(generateQR, 150);
    }

    qrInput.addEventListener('input', () => {
        updateMeta();
        scheduleGenerate();
    });

    sizeSelect.addEventListener('change', scheduleGenerate);
    ecSelect.addEventListener('change', scheduleGenerate);

    fgColor.addEventListener('input', () => {
        fgHex.textContent = fgColor.value.toUpperCase();
        scheduleGenerate();
    });

    bgColor.addEventListener('input', () => {
        bgHex.textContent = bgColor.value.toUpperCase();
        scheduleGenerate();
    });

    function updateMeta() {
        const text = qrInput.value;
        charCount.textContent = text.length + ' 文字';
        if (!text) {
            inputType.textContent = '—';
        } else if (/^https?:\/\//i.test(text)) {
            inputType.textContent = '🔗 URL';
        } else if (/^mailto:/i.test(text)) {
            inputType.textContent = '📧 メール';
        } else if (/^tel:/i.test(text)) {
            inputType.textContent = '📞 電話';
        } else if (/^WIFI:/i.test(text)) {
            inputType.textContent = '📶 Wi-Fi';
        } else {
            inputType.textContent = '📝 テキスト';
        }
    }

    function generateQR() {
        const text = qrInput.value.trim();
        if (!text) {
            canvas.style.display = 'none';
            placeholder.style.display = '';
            previewActions.classList.add('hidden');
            return;
        }

        try {
            const ecLevel = ecSelect.value;
            // qrcode-generator の型番を自動選択（typeNumber=0で自動）
            const typeNumber = 0;
            const errorCorrectionLevel = ecLevel;
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(text);
            qr.make();

            const moduleCount = qr.getModuleCount();
            const size = parseInt(sizeSelect.value);
            const cellSize = size / moduleCount;

            canvas.width = size;
            canvas.height = size;

            // 背景
            ctx.fillStyle = bgColor.value;
            ctx.fillRect(0, 0, size, size);

            // QRモジュール
            ctx.fillStyle = fgColor.value;
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        ctx.fillRect(
                            Math.round(col * cellSize),
                            Math.round(row * cellSize),
                            Math.ceil(cellSize),
                            Math.ceil(cellSize)
                        );
                    }
                }
            }

            canvas.style.display = 'block';
            // Canvasの表示サイズを制限（高解像度でも表示は256pxまで）
            const displaySize = Math.min(size, 320);
            canvas.style.width = displaySize + 'px';
            canvas.style.height = displaySize + 'px';
            placeholder.style.display = 'none';
            previewActions.classList.remove('hidden');

            // SVG生成用にQRデータを保存
            canvas._qrModuleCount = moduleCount;
            canvas._qrInstance = qr;
        } catch (e) {
            console.warn('QR生成エラー:', e);
            // テキストが長すぎる等の場合
            canvas.style.display = 'none';
            placeholder.style.display = '';
            placeholder.querySelector('p').textContent = '⚠️ テキストが長すぎます。短くするかエラー訂正レベルを下げてください。';
            previewActions.classList.add('hidden');
        }
    }

    // PNG ダウンロード
    downloadPngBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    // SVG ダウンロード
    downloadSvgBtn.addEventListener('click', () => {
        const qr = canvas._qrInstance;
        const moduleCount = canvas._qrModuleCount;
        if (!qr || !moduleCount) return;

        const size = parseInt(sizeSelect.value);
        const cellSize = size / moduleCount;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
        svg += `<rect width="${size}" height="${size}" fill="${bgColor.value}"/>`;

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    const x = Math.round(col * cellSize);
                    const y = Math.round(row * cellSize);
                    const w = Math.ceil(cellSize);
                    const h = Math.ceil(cellSize);
                    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fgColor.value}"/>`;
                }
            }
        }
        svg += '</svg>';

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'qrcode.svg';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    });

    // 画像をクリップボードにコピー
    copyBtn.addEventListener('click', async () => {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            copyBtn.textContent = '✅ コピー済み';
            setTimeout(() => { copyBtn.textContent = '📋 画像をコピー'; }, 2000);
        } catch (e) {
            // フォールバック: DataURL をテキストとしてコピー
            try {
                await navigator.clipboard.writeText(canvas.toDataURL('image/png'));
                copyBtn.textContent = '✅ Data URL コピー済み';
                setTimeout(() => { copyBtn.textContent = '📋 画像をコピー'; }, 2000);
            } catch (e2) {
                copyBtn.textContent = '❌ コピー失敗';
                setTimeout(() => { copyBtn.textContent = '📋 画像をコピー'; }, 2000);
            }
        }
    });

    // ========== 読み取りタブ ==========
    const readDropZone = document.getElementById('read-drop-zone');
    const readFileInput = document.getElementById('read-file-input');
    const readPreview = document.getElementById('read-preview');
    const readImage = document.getElementById('read-image');
    const readCanvas = document.getElementById('read-canvas');
    const readResult = document.getElementById('read-result');
    const resultContent = document.getElementById('result-content');
    const copyResultBtn = document.getElementById('copy-result-btn');
    const openLinkBtn = document.getElementById('open-link-btn');
    const readError = document.getElementById('read-error');

    // ドロップゾーンイベント
    readDropZone.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.closest('label')) return;
        readFileInput.value = '';
        readFileInput.click();
    });

    readDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        readDropZone.classList.add('drag-over');
    });

    readDropZone.addEventListener('dragleave', () => {
        readDropZone.classList.remove('drag-over');
    });

    readDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        readDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            readQRFromFile(e.dataTransfer.files[0]);
        }
    });

    readFileInput.addEventListener('change', () => {
        if (readFileInput.files.length > 0) {
            readQRFromFile(readFileInput.files[0]);
        }
    });

    function readQRFromFile(file) {
        if (!file.type.startsWith('image/')) return;
        if (file.size > MAX_FILE_SIZE) {
            alert('⚠️ ファイルサイズが50MBを超えています。\nブラウザのメモリ保護のため、50MB以下のファイルを使用してください。');
            return;
        }

        // リセット
        readResult.classList.add('hidden');
        readError.classList.add('hidden');

        const img = new Image();
        img.onload = () => {
            // プレビュー表示
            readImage.src = img.src;
            readPreview.classList.remove('hidden');

            // Canvasに描画してjsQRで解析
            const maxSize = 1024;
            let w = img.width;
            let h = img.height;
            if (w > maxSize || h > maxSize) {
                const scale = maxSize / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            readCanvas.width = w;
            readCanvas.height = h;
            const rctx = readCanvas.getContext('2d');
            rctx.drawImage(img, 0, 0, w, h);

            const imageData = rctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });

            if (code && code.data) {
                showReadResult(code.data);
            } else {
                // 反転モードでリトライ
                const code2 = jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
                if (code2 && code2.data) {
                    showReadResult(code2.data);
                } else {
                    readError.classList.remove('hidden');
                }
            }

            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            readError.classList.remove('hidden');
        };
        img.src = URL.createObjectURL(file);
    }

    function showReadResult(data) {
        readResult.classList.remove('hidden');
        readError.classList.add('hidden');
        resultContent.textContent = data;

        // URLかどうか判定
        if (/^https?:\/\//i.test(data)) {
            openLinkBtn.classList.remove('hidden');
            openLinkBtn.href = data;
        } else {
            openLinkBtn.classList.add('hidden');
        }
    }

    // 結果コピー
    copyResultBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(resultContent.textContent);
            copyResultBtn.textContent = '✅ コピー済み';
            setTimeout(() => { copyResultBtn.textContent = '📋 コピー'; }, 2000);
        } catch (e) {
            copyResultBtn.textContent = '❌ 失敗';
            setTimeout(() => { copyResultBtn.textContent = '📋 コピー'; }, 2000);
        }
    });

})();
