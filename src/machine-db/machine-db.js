/* 機種データベース - ロジック */
(() => {
    'use strict';

    const DATA_URL = '/data/machines.json';

    let allMachines = [];
    let filteredMachines = [];
    let currentPage = 1;
    let perPage = 20;
    let sortKey = 'release';
    let sortDir = 'desc';

    // お気に入り管理
    let favoriteNames = new Set();

    function isFavorite(name) {
        return favoriteNames.has(name);
    }

    function toggleFavorite(machine) {
        parent.postMessage({
            type: 'favorite-toggle',
            machine: {
                name: machine.name,
                type: machine.type,
                prob: machine.prob,
                baseProbability: machine.baseProbability,
                borderEquiv: machine.borderEquiv,
                rb: machine.rb,
                avgChain: machine.avgChain,
                avgAcquired: machine.avgAcquired,
                entryRate: machine.entryRate,
                realContRate: machine.realContRate,
                rushRate: machine.rushRate,
                yutimeTrigger: machine.yutimeTrigger,
                yutimeSpins: machine.yutimeSpins,
                releaseDate: machine.releaseDate,
            }
        }, '*');
    }

    // 親フレームからのお気に入り一覧を受信
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'favorite-list') {
            favoriteNames = new Set(e.data.names || []);
            updateFavoriteStars();
        }
        if (e.data?.type === 'favorite-updated') {
            favoriteNames = new Set(e.data.names || []);
            updateFavoriteStars();
        }
        if (e.data?.type === 'favorite-limit') {
            alert(e.data.message || 'お気に入りの上限に達しました');
        }
    });

    function updateFavoriteStars() {
        document.querySelectorAll('.fav-btn').forEach(btn => {
            const name = btn.dataset.name;
            const active = favoriteNames.has(name);
            btn.textContent = active ? '★' : '☆';
            btn.classList.toggle('fav-active', active);
        });
    }

    // 列定義（デフォルト順序）
    const COLUMN_DEFS = {
        type: { label: 'タイプ', sortKey: 'type' },
        baseProb: { label: '大当り確率', sortKey: 'baseProb' },
        prob: { label: 'トータル確率', sortKey: 'prob' },
        border: { label: 'ボーダー(等価)', sortKey: 'border' },
        rb: { label: '想定1R出玉', sortKey: 'rb' },
        chain: { label: '平均連荘', sortKey: 'chain' },
        avg: { label: '平均獲得', sortKey: 'avg' },
        entry: { label: '突入率', sortKey: 'entry' },
        cont: { label: '継続率(継続)', sortKey: 'cont' },
        yutime: { label: '遊タイム', sortKey: 'yutime' },
        release: { label: '導入日', sortKey: 'release' },
    };

    // デフォルト列順序
    const defaultColumnOrder = ['type', 'baseProb', 'prob', 'border', 'rb', 'chain', 'avg', 'entry', 'cont', 'yutime', 'release'];

    // 列表示のデフォルト設定
    const defaultColumnVisibility = {
        type: true, baseProb: true, prob: true, border: true,
        rb: false, chain: false, avg: false, entry: true, cont: true,
        yutime: false, release: true,
    };

    // localStorage から列設定を読み込み
    const STORAGE_KEY = 'machinedb_col_visibility';
    const ORDER_STORAGE_KEY = 'machinedb_col_order';
    let columnVisibility = { ...defaultColumnVisibility };
    let columnOrder = [...defaultColumnOrder];
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            columnVisibility = { ...defaultColumnVisibility, ...parsed };
        }
        const savedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
        if (savedOrder) {
            const parsedOrder = JSON.parse(savedOrder);
            // 新しい列が追加された場合に対応
            const known = new Set(parsedOrder);
            columnOrder = [...parsedOrder];
            for (const col of defaultColumnOrder) {
                if (!known.has(col)) columnOrder.push(col);
            }
        }
    } catch { /* localStorage 不可 */ }

    const $ = id => document.getElementById(id);
    const searchInput = $('search-input');
    const typeFilter = $('type-filter');
    const yutimeFilter = $('yutime-filter');
    const yearFilter = $('year-filter');
    const makerFilter = $('maker-filter');
    const tbody = $('machine-tbody');
    const machineCount = $('machine-count');
    const filteredInfo = $('filtered-info');
    const lastUpdated = $('last-updated');
    const noResults = $('no-results');
    const loading = $('loading');
    const prevBtn = $('prev-btn');
    const nextBtn = $('next-btn');
    const pageInfo = $('page-info');
    const perPageSelect = $('per-page');
    const activeFilters = $('active-filters');
    const modal = $('detail-modal');
    const modalBody = $('modal-body');
    const modalClose = $('modal-close');
    const colToggleBtn = $('col-toggle-btn');
    const colSettings = $('col-settings');
    const colSettingsList = $('col-settings-list');
    const headerRow = $('header-row');

    async function loadData() {
        try {
            const res = await fetch(DATA_URL, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allMachines = data.machines || [];
            if (data.lastUpdated) {
                const d = new Date(data.lastUpdated);
                lastUpdated.textContent = `更新: ${d.toLocaleDateString('ja-JP')} ${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
            }
            buildMakerOptions();
            loading.classList.add('hidden');
            applyFilters();
        } catch (e) {
            loading.textContent = `❌ データ読込エラー: ${e.message}`;
        }
    }

    function buildMakerOptions() {
        const makers = new Map();
        for (const m of allMachines) {
            if (m.maker) makers.set(m.maker, (makers.get(m.maker) || 0) + 1);
        }
        const sorted = [...makers.entries()].sort((a, b) => b[1] - a[1]);
        makerFilter.innerHTML = '<option value="all">すべて</option>';
        for (const [name, count] of sorted) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `${name} (${count})`;
            makerFilter.appendChild(opt);
        }
    }

    function applyFilters() {
        const search = searchInput.value.trim().toLowerCase();
        const type = typeFilter.value;
        const yutime = yutimeFilter.value;
        filteredMachines = allMachines.filter(m => {
            if (search) {
                const nameMatch = m.name.toLowerCase().includes(search);
                const aliasMatch = Array.isArray(m.aliases) && m.aliases.some(a => a.toLowerCase().includes(search));
                if (!nameMatch && !aliasMatch) return false;
            }
            if (type !== 'all') {
                if (type === 'その他') {
                    if (['ハイミドル', 'ミドル', 'ライトミドル', 'ライト(甘デジ)'].includes(m.type)) return false;
                } else if (m.type !== type) return false;
            }
            if (yutime === 'yes' && (!m.yutimeTrigger || m.yutimeTrigger <= 0)) return false;
            if (yutime === 'no' && (m.yutimeTrigger > 0)) return false;
            const year = yearFilter.value;
            if (year !== 'all' && m.releaseDate && m.releaseDate < year + '-01-01') return false;
            const maker = makerFilter.value;
            if (maker !== 'all' && m.maker !== maker) return false;
            return true;
        });
        applySorting();
        currentPage = 1;
        renderTable();
        updateStats();
        updateActiveFilterTags();
    }

    function applySorting() {
        filteredMachines.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'fav': {
                    const aFav = favoriteNames.has(a.name) ? 1 : 0;
                    const bFav = favoriteNames.has(b.name) ? 1 : 0;
                    cmp = bFav - aFav;
                    break;
                }
                case 'name': cmp = a.name.localeCompare(b.name, 'ja'); break;
                case 'type': cmp = getTypeOrder(a.type) - getTypeOrder(b.type); break;
                case 'baseProb': cmp = (a.baseProbability || 9999) - (b.baseProbability || 9999); break;
                case 'prob': cmp = a.prob - b.prob; break;
                case 'border': cmp = a.borderEquiv - b.borderEquiv; break;
                case 'rb': cmp = a.rb - b.rb; break;
                case 'chain': cmp = (a.avgChain || 0) - (b.avgChain || 0); break;
                case 'avg': cmp = (a.avgAcquired || 0) - (b.avgAcquired || 0); break;
                case 'entry': cmp = (a.entryRate || 0) - (b.entryRate || 0); break;
                case 'cont': cmp = (a.realContRate || 0) - (b.realContRate || 0); break;
                case 'yutime': cmp = (a.yutimeTrigger || 0) - (b.yutimeTrigger || 0); break;
                case 'release': cmp = (a.releaseDate || '').localeCompare(b.releaseDate || ''); break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }

    function getTypeOrder(type) {
        const order = { 'ハイミドル': 0, 'ミドル': 1, 'ライトミドル': 2, 'ライト(甘デジ)': 3 };
        return order[type] ?? 4;
    }

    // 機種名カラム幅の永続化
    const NAME_COL_WIDTH_KEY = 'machineDB_nameColWidth';
    let nameColWidth = parseInt(localStorage.getItem(NAME_COL_WIDTH_KEY)) || 0;
    let isResizing = false; // リサイズ中フラグ（ソート発火防止用）

    function applyNameColWidth(w) {
        if (!w) return;
        document.querySelectorAll('thead th:nth-child(2), .machine-name').forEach(el => {
            el.style.width = w + 'px';
            el.style.minWidth = w + 'px';
            el.style.maxWidth = w + 'px';
        });
    }

    // ヘッダーを動的生成（列順序対応）
    function renderHeader() {
        const v = columnVisibility;
        const widthStyle = nameColWidth ? `style="width:${nameColWidth}px;min-width:${nameColWidth}px;max-width:${nameColWidth}px"` : '';
        let html = `<th class="fav-header sortable" data-sort="fav" title="お気に入りで並び替え">★ <span class="sort-icon">${sortKey === 'fav' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>`;
        html += `<th class="sortable" data-sort="name" ${widthStyle}>機種名 <span class="sort-icon">${sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span><div class="resize-handle" id="name-resize-handle"></div></th>`;
        for (const col of columnOrder) {
            if (!v[col]) continue;
            const def = COLUMN_DEFS[col];
            if (!def) continue;
            const isActive = sortKey === def.sortKey;
            const icon = isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
            html += `<th class="sortable col-${col}${isActive ? ' active-sort' : ''}" data-sort="${def.sortKey}">${def.label} <span class="sort-icon">${icon}</span></th>`;
        }
        headerRow.innerHTML = html;
        // ソートイベント再バインド
        headerRow.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                if (isResizing) return; // リサイズ操作直後はソートしない
                const key = th.dataset.sort;
                if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                else { sortKey = key; sortDir = 'asc'; }
                applySorting();
                renderHeader();
                renderTable();
            });
        });

        // リサイズハンドルのドラッグ処理
        const handle = $('name-resize-handle');
        if (handle) {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const th = handle.closest('th');
                const startX = e.clientX;
                const startW = th.offsetWidth;
                handle.classList.add('active');
                isResizing = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                function onMove(ev) {
                    const diff = ev.clientX - startX;
                    const newW = Math.max(80, Math.min(500, startW + diff));
                    nameColWidth = newW;
                    applyNameColWidth(newW);
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    handle.classList.remove('active');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (nameColWidth) localStorage.setItem(NAME_COL_WIDTH_KEY, nameColWidth);
                    // clickイベントが発火するのを防ぐため遅延リセット
                    requestAnimationFrame(() => { isResizing = false; });
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            // タッチデバイス対応
            handle.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const th = handle.closest('th');
                const startX = e.touches[0].clientX;
                const startW = th.offsetWidth;
                handle.classList.add('active');
                isResizing = true;

                function onTouchMove(ev) {
                    const diff = ev.touches[0].clientX - startX;
                    const newW = Math.max(80, Math.min(500, startW + diff));
                    nameColWidth = newW;
                    applyNameColWidth(newW);
                }
                function onTouchEnd() {
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                    handle.classList.remove('active');
                    if (nameColWidth) localStorage.setItem(NAME_COL_WIDTH_KEY, nameColWidth);
                    requestAnimationFrame(() => { isResizing = false; });
                }
                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('touchend', onTouchEnd);
            });
        }

        // 保存済み幅を適用
        if (nameColWidth) applyNameColWidth(nameColWidth);
    }

    function renderTable() {
        const start = (currentPage - 1) * perPage;
        const end = Math.min(start + perPage, filteredMachines.length);
        const pageData = filteredMachines.slice(start, end);
        if (pageData.length === 0) { tbody.innerHTML = ''; noResults.classList.remove('hidden'); return; }
        noResults.classList.add('hidden');

        const v = columnVisibility;
        const html = pageData.map((m, i) => {
            const globalIdx = start + i;
            const favClass = isFavorite(m.name) ? 'fav-active' : '';
            const favStar = isFavorite(m.name) ? '★' : '☆';
            let cells = `<td class="fav-cell"><button class="fav-btn ${favClass}" data-name="${esc(m.name)}" title="お気に入り">${favStar}</button></td>`;
            cells += `<td class="machine-name" title="${esc(m.name)}">${esc(m.name)}</td>`;
            for (const col of columnOrder) {
                if (!v[col]) continue;
                cells += renderCell(col, m);
            }
            return `<tr data-index="${globalIdx}">${cells}</tr>`;
        }).join('');
        tbody.innerHTML = html;
        updatePaging();
    }

    function renderCell(col, m) {
        switch (col) {
            case 'type': return `<td><span class="type-badge ${getTypeClass(m.type)}">${esc(m.type || '—')}</span></td>`;
            case 'baseProb': return `<td class="prob-value">${m.baseProbability > 0 ? '1/' + m.baseProbability : '—'}</td>`;
            case 'prob': return `<td class="prob-value">1/${m.prob}${m.calcProb > 0 ? ` <span class="calc-prob">(${m.calcProb})</span>` : ''}</td>`;
            case 'border': return `<td class="border-value ${getBorderClass(m.borderEquiv)}">${m.borderEquiv > 0 ? m.borderEquiv.toFixed(2) : '—'}</td>`;
            case 'rb': return `<td class="rb-value">${m.rb > 0 ? m.rb.toFixed(0) + '玉' : '—'}</td>`;
            case 'chain': return `<td class="chain-value">${m.avgChain > 0 ? m.avgChain.toFixed(2) + '連' : '—'}</td>`;
            case 'avg': return `<td class="avg-value">${m.avgAcquired > 0 ? m.avgAcquired.toFixed(0) + '玉' : '—'}</td>`;
            case 'entry': return `<td class="entry-value">${formatEntryRate(m)}</td>`;
            case 'cont': return `<td class="cont-value">${formatContRate(m)}</td>`;
            case 'yutime': return `<td class="yutime-cell">${formatYutime(m)}</td>`;
            case 'release': return `<td class="release-value">${m.releaseDate || '—'}</td>`;
            default: return '';
        }
    }

    function formatYutime(m) {
        const trigger = m.yutimeTrigger || 0;
        const spins = m.yutimeSpins || 0;
        const desc = m.yutimeDesc || '';
        if (trigger > 0 && desc) return `<span class="yutime-badge yutime-yes">${trigger}/${desc}</span>`;
        if (trigger > 0 && spins > 0 && spins < 9999) return `<span class="yutime-badge yutime-yes">${trigger}/${spins}</span>`;
        if (trigger > 0 && spins >= 9999) return `<span class="yutime-badge yutime-yes">${trigger}/次回</span>`;
        if (trigger > 0) return `<span class="yutime-badge yutime-yes">${trigger}</span>`;
        return `<span class="yutime-badge yutime-no">—</span>`;
    }

    function formatEntryRate(m) {
        const entry = m.entryRate || 0;
        const cont = m.realContRate || 0;
        if (entry <= 0 && cont <= 0) return '—';
        if (entry <= 0 || entry >= 100) {
            // 100%突入の場合は継続率も併記
            if (cont > 0) return `<span class="entry-badge entry-full">100% / ${cont}%</span>`;
            return `<span class="entry-badge entry-full">100%</span>`;
        }
        return `<span class="entry-badge">${entry}%</span>`;
    }

    function formatContRate(m) {
        const rate = m.realContRate || 0;
        if (rate <= 0) return '—';
        return `<span class="cont-badge">${rate}%</span>`;
    }

    function getTypeClass(type) {
        if (type === 'ハイミドル') return 'type-highmid';
        if (type === 'ミドル') return 'type-mid';
        if (type === 'ライトミドル') return 'type-lightmid';
        if (type?.includes('甘') || type?.includes('ライト(')) return 'type-ama';
        return 'type-other';
    }

    function getBorderClass(border) {
        if (border <= 0) return '';
        return border <= 17.5 ? 'border-easy' : border <= 20 ? 'border-normal' : 'border-hard';
    }

    function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }

    function updateStats() {
        machineCount.textContent = `${filteredMachines.length} 機種`;
        filteredInfo.textContent = filteredMachines.length < allMachines.length ? `(全${allMachines.length}件中)` : '';
    }

    function updatePaging() {
        const totalPages = Math.max(1, Math.ceil(filteredMachines.length / perPage));
        pageInfo.textContent = `${currentPage} / ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
    }

    function updateActiveFilterTags() {
        const tags = [];
        const search = searchInput.value.trim();
        if (search) tags.push({ label: `検索: "${search}"`, action: () => { searchInput.value = ''; applyFilters(); } });
        if (typeFilter.value !== 'all') tags.push({ label: `タイプ: ${typeFilter.options[typeFilter.selectedIndex].text}`, action: () => { typeFilter.value = 'all'; applyFilters(); } });
        if (yutimeFilter.value !== 'all') tags.push({ label: yutimeFilter.value === 'yes' ? '遊タイム搭載' : '遊タイム非搭載', action: () => { yutimeFilter.value = 'all'; applyFilters(); } });
        if (yearFilter.value !== 'all') tags.push({ label: yearFilter.value + '年以降', action: () => { yearFilter.value = 'all'; applyFilters(); } });
        if (makerFilter.value !== 'all') tags.push({ label: 'メーカー: ' + makerFilter.value, action: () => { makerFilter.value = 'all'; applyFilters(); } });
        if (tags.length === 0) { activeFilters.classList.add('hidden'); return; }
        activeFilters.classList.remove('hidden');
        activeFilters.innerHTML = tags.map((t, i) => `<span class="filter-tag" data-idx="${i}">${t.label} <span class="tag-close">✕</span></span>`).join('');
        activeFilters.querySelectorAll('.filter-tag').forEach(el => el.addEventListener('click', () => tags[parseInt(el.dataset.idx)]?.action()));
    }

    function applyColumnVisibility() {
        colSettingsList.querySelectorAll('input[data-col]').forEach(cb => {
            cb.checked = columnVisibility[cb.dataset.col] ?? true;
        });
        renderHeader();
        renderTable();
    }

    // 列設定を localStorage に保存
    function saveColumnSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
            localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
        } catch { /* 無視 */ }
    }

    // 列設定パネルの順序を反映
    function syncOrderFromPanel() {
        const labels = colSettingsList.querySelectorAll('label[data-col-order]');
        columnOrder = Array.from(labels).map(l => l.dataset.colOrder);
        saveColumnSettings();
        renderHeader();
        renderTable();
    }

    colToggleBtn.addEventListener('click', () => colSettings.classList.toggle('hidden'));
    colSettingsList.querySelectorAll('input[data-col]').forEach(cb => {
        cb.addEventListener('change', () => {
            columnVisibility[cb.dataset.col] = cb.checked;
            saveColumnSettings();
            applyColumnVisibility();
        });
    });

    // ドラッグ&ドロップで列順序変更
    let dragEl = null;
    colSettingsList.addEventListener('dragstart', (e) => {
        const label = e.target.closest('label[data-col-order]');
        if (!label) return;
        dragEl = label;
        label.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    colSettingsList.addEventListener('dragend', () => {
        if (dragEl) dragEl.classList.remove('dragging');
        dragEl = null;
        colSettingsList.querySelectorAll('label').forEach(l => l.classList.remove('drag-over'));
    });
    colSettingsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('label[data-col-order]');
        if (!target || target === dragEl) return;
        colSettingsList.querySelectorAll('label').forEach(l => l.classList.remove('drag-over'));
        target.classList.add('drag-over');
    });
    colSettingsList.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('label[data-col-order]');
        if (!target || !dragEl || target === dragEl) return;
        // ドロップ位置に挿入
        const allLabels = Array.from(colSettingsList.querySelectorAll('label[data-col-order]'));
        const fromIdx = allLabels.indexOf(dragEl);
        const toIdx = allLabels.indexOf(target);
        if (fromIdx < toIdx) {
            target.after(dragEl);
        } else {
            target.before(dragEl);
        }
        colSettingsList.querySelectorAll('label').forEach(l => l.classList.remove('drag-over'));
        syncOrderFromPanel();
    });

    // モバイル: タッチドラッグで列順序変更
    let touchDragEl = null;
    colSettingsList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const label = handle.closest('label[data-col-order]');
        if (!label) return;
        e.preventDefault();
        touchDragEl = label;
        touchStartY = e.touches[0].clientY;
        label.classList.add('touch-dragging');
    }, { passive: false });

    colSettingsList.addEventListener('touchmove', (e) => {
        if (!touchDragEl) return;
        e.preventDefault();
        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!target) return;
        const overLabel = target.closest('label[data-col-order]');
        colSettingsList.querySelectorAll('label').forEach(l => l.classList.remove('touch-drag-over'));
        if (overLabel && overLabel !== touchDragEl) {
            overLabel.classList.add('touch-drag-over');
        }
    }, { passive: false });

    colSettingsList.addEventListener('touchend', (e) => {
        if (!touchDragEl) return;
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const overLabel = target ? target.closest('label[data-col-order]') : null;
        if (overLabel && overLabel !== touchDragEl) {
            const allLabels = Array.from(colSettingsList.querySelectorAll('label[data-col-order]'));
            const fromIdx = allLabels.indexOf(touchDragEl);
            const toIdx = allLabels.indexOf(overLabel);
            if (fromIdx < toIdx) {
                overLabel.after(touchDragEl);
            } else {
                overLabel.before(touchDragEl);
            }
            syncOrderFromPanel();
        }
        touchDragEl.classList.remove('touch-dragging');
        colSettingsList.querySelectorAll('label').forEach(l => l.classList.remove('touch-drag-over'));
        touchDragEl = null;
    });

    // リセットボタン
    const colResetBtn = $('col-reset-btn');
    if (colResetBtn) {
        colResetBtn.addEventListener('click', () => {
            // 列設定リセット
            Object.assign(columnVisibility, defaultColumnVisibility);
            columnOrder = [...defaultColumnOrder];
            saveColumnSettings();
            // パネルの順序もリセット
            const container = colSettingsList;
            for (const col of defaultColumnOrder) {
                const label = container.querySelector(`label[data-col-order="${col}"]`);
                if (label) container.appendChild(label);
            }
            applyColumnVisibility();
            // フィルター・検索・ソート・ページもリセット
            searchInput.value = '';
            typeFilter.value = 'all';
            yutimeFilter.value = 'all';
            yearFilter.value = '2022';
            makerFilter.value = 'all';
            sortKey = 'release';
            sortDir = 'desc';
            currentPage = 1;
            // 機種名カラム幅もリセット
            nameColWidth = 0;
            localStorage.removeItem(NAME_COL_WIDTH_KEY);
            document.querySelectorAll('thead th:nth-child(2), .machine-name').forEach(el => {
                el.style.width = '';
                el.style.minWidth = '';
                el.style.maxWidth = '';
            });
            applyFilters();
        });
    }    // 全スラッグ一覧（build.mjs がビルド時にインライン埋め込み）
    const allSlugs = []; /* __ALL_SLUGS_PLACEHOLDER__ */

    // 機種名のキーパーツでスラッグを部分一致検索
    function findSlug(name) {
        if (!allSlugs.length) return '';
        // e/P接頭辞を除去（toSlugと同じ処理）してからパーツ抽出
        const cleaned = name
            .replace(/^[PＰeｅ]\s*/i, '')
            .replace(/[&＆！!？?・：:＋+／/＊*＃#|"【】「」『』（）()〈〉《》<>～〜\s　]+/g, ' ')
            .trim();
        const parts = cleaned.split(/\s+/)
            .filter(p => p.length >= 2)
            .map(p => p.toLowerCase());
        if (!parts.length) return '';

        let bestSlug = '';
        let bestScore = 0;
        for (const slug of allSlugs) {
            let score = 0;
            for (const part of parts) {
                if (slug.includes(part)) score++;
            }
            // 同スコアならスラッグが長い(より具体的な)方を優先
            if (score > bestScore || (score === bestScore && slug.length > bestSlug.length)) {
                bestScore = score;
                bestSlug = slug;
            }
        }
        return bestScore >= 2 ? bestSlug : '';
    }

    function showDetail(machine) {
        const m = machine;
        const slug = findSlug(m.name);
        const seoLink = slug ? `<a href="https://www.antigravity-portal.com/machine-db/${slug}/" class="modal-link modal-link-seo" target="_blank" rel="noopener">📊 詳細スペックと自前ボーダーを見る →</a>` : '';
        modalBody.innerHTML = `
            <h2 class="modal-title">${esc(m.name)}</h2>
            <div class="modal-type"><span class="type-badge ${getTypeClass(m.type)}">${esc(m.type || '不明')}</span>${m.maker ? ' <span class="modal-maker">' + esc(m.maker) + '</span>' : ''}</div>
            <div class="modal-specs">
                <div class="spec-card"><div class="spec-label">大当り確率</div><div class="spec-value">${m.baseProbability > 0 ? '1/' + m.baseProbability : '—'}</div></div>
                <div class="spec-card"><div class="spec-label">トータル確率</div><div class="spec-value">1/${m.prob}${m.calcProb > 0 ? ` <span class="calc-prob">(${m.calcProb})</span>` : ''}</div></div>
                <div class="spec-card"><div class="spec-label">等価ボーダー</div><div class="spec-value ${getBorderClass(m.borderEquiv)}">${m.borderEquiv > 0 ? m.borderEquiv.toFixed(2) + ' 回転/k' : '—'}</div></div>
                <div class="spec-card"><div class="spec-label">想定1R出玉</div><div class="spec-value">${m.rb > 0 ? m.rb.toFixed(0) + ' 玉' : '—'}</div></div>
                <div class="spec-card"><div class="spec-label">平均連荘</div><div class="spec-value">${m.avgChain > 0 ? m.avgChain.toFixed(2) + ' 連' : '—'}</div></div>
                <div class="spec-card"><div class="spec-label">平均獲得</div><div class="spec-value">${m.avgAcquired > 0 ? m.avgAcquired.toFixed(0) + ' 玉' : '—'}</div></div>
                <div class="spec-card"><div class="spec-label">突入率</div><div class="spec-value">${formatEntryRate(m) || '—'}</div></div>
                <div class="spec-card"><div class="spec-label">継続率(継続)</div><div class="spec-value">${formatContRate(m) || '—'}</div></div>
                <div class="spec-card"><div class="spec-label">遊タイム</div><div class="spec-value">${m.yutimeTrigger > 0 ? m.yutimeTrigger + (m.yutimeSpins > 0 && m.yutimeSpins < 9999 ? ' / ' + m.yutimeSpins : m.yutimeSpins >= 9999 ? ' / 実質次回' : '') : '非搭載'}</div></div>
                <div class="spec-card"><div class="spec-label">導入日</div><div class="spec-value">${m.releaseDate || '未定'}</div></div>
            </div>
            ${seoLink}
            ${m.sourceUrl ? `<a href="${m.sourceUrl}" target="_blank" rel="noopener" class="modal-link">🔗 データ元を見る →</a>` : ''}
        `;
        modal.classList.remove('hidden');
    }

    function hideDetail() { modal.classList.add('hidden'); }

    searchInput.addEventListener('input', debounce(applyFilters, 200));
    typeFilter.addEventListener('change', applyFilters);
    yutimeFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    makerFilter.addEventListener('change', applyFilters);

    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    nextBtn.addEventListener('click', () => { if (currentPage < Math.ceil(filteredMachines.length / perPage)) { currentPage++; renderTable(); } });
    perPageSelect.addEventListener('change', () => { perPage = parseInt(perPageSelect.value); currentPage = 1; renderTable(); });
    tbody.addEventListener('click', (e) => { if (e.target.closest('.fav-btn, .fav-cell')) return; const row = e.target.closest('tr'); if (row?.dataset.index !== undefined) showDetail(filteredMachines[parseInt(row.dataset.index)]); });
    modalClose.addEventListener('click', hideDetail);
    modal.querySelector('.modal-backdrop').addEventListener('click', hideDetail);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideDetail(); });

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

    applyColumnVisibility();
    loadData();

    // ★ボタンクリックイベント（イベント委譲）
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.fav-btn');
        if (btn) {
            e.stopPropagation();
            const name = btn.dataset.name;
            const machine = allMachines.find(m => m.name === name);
            if (machine) toggleFavorite(machine);
            return;
        }
    });

    // 親フレームにお気に入り一覧を要求
    parent.postMessage({ type: 'get-favorites' }, '*');

    // お気に入り一括削除ボタン
    const favClearBtn = $('fav-clear-btn');
    if (favClearBtn) {
        favClearBtn.addEventListener('click', () => {
            if (favoriteNames.size === 0) {
                alert('お気に入りが登録されていません');
                return;
            }
            if (confirm('お気に入りを全て削除しますか？')) {
                parent.postMessage({ type: 'clear-favorites' }, '*');
            }
        });
    }

    // スクロールインジケーター制御
    const tableScroll = $('table-scroll');
    const scrollIndicator = $('scroll-indicator');
    if (tableScroll && scrollIndicator) {
        function updateScrollIndicator() {
            const { scrollLeft, scrollWidth, clientWidth } = tableScroll;
            const atEnd = scrollLeft + clientWidth >= scrollWidth - 10;
            const canScroll = scrollWidth > clientWidth + 20;
            scrollIndicator.classList.toggle('hidden-fade', atEnd || !canScroll);
        }
        tableScroll.addEventListener('scroll', updateScrollIndicator);
        window.addEventListener('resize', updateScrollIndicator);
        // 初期表示・テーブル更新後にも呼ぶ
        const origRenderTable = renderTable;
        renderTable = function () { origRenderTable(); requestAnimationFrame(updateScrollIndicator); };
    }
})();
