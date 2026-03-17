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
            case 'prob': return `<td class="prob-value">1/${m.prob}</td>`;
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
    const allSlugs = ["e-cyborg-009-rule-of-sacrifice","e-godzilla","e-reゼロから始める異世界生活-season2","e86-エイティシックス","ea夏色日記go","erave-覚聖ループ-jmc","essss.gridman","eultraman","eultraman-4500超ライトver.","eアクダマドライブ","eアズールレーンⅱ-超次元","eうしおととら-神のせspec-150ver.","eうしおととら-神のせspec-399ver.","eガールズパンツァー-最終章","eガールズパンツァー-最終章-159ver.","eカケグルイ-生か死か-219ver.","eカケグルイ-生か死か-7500ver.","eガンゲイルオンライン","eキャッツアイ3-h4yz3","eキョンシー-ライトミドル-新cタイムver.","eギンギラパラダイス-viva-festa","eグリッドマン-メガstart159ver.","eゲゲゲの鬼太郎-獅子奮迅-sp","eゴジラ対エヴァンゲリオン-セカンドインパクトg-破壊神覚醒","eゴジラ対エヴァンゲリオン2-超デカgold299","eゴッドイーター-triple-burst","eシャーマンキング","eシャーマンキング-でっけぇなあver.","eシンウルトラマン","eシン･エヴァンゲリオン-type-カヲル","eシン･エヴァンゲリオン-type-ゲンドウ","eソードアートオンライン-閃光の軌跡-99ver.","eソードアートオンライン2-閃光の軌跡-k1","eとある科学の超電磁砲-phase-next","eノーゲームノーライフ-199ver.","eノーゲームノーライフ-319ver","eバイオハザード6","eぱちんこソードアートオンラインk12","eぱちんこ押忍番長-男の頂","eパリピ孔明","eひきこまり吸血姫の悶々","eフィーバーうたわれるものz","eフィーバーからくりサーカス2-魔王ver.","eフィーバーキン肉マン","eフィーバーダンジョンに出会いを求めるのは間違っているだろうか2","eフィーバーダンベル何キロ持てる2","eフィーバーバスタード-暗黒の破壊神","eフィーバーブルーロック","eフィーバーマクロスフロンティア5v","eフィーバーもののがたり","eフィーバー炎炎ノ消防隊2-シンラver.","eフィーバー炎炎ノ消防隊2-紅丸ver.","eフィーバー機動戦士ガンダムユニコーン-白き一角獣と黒き獅子-再来","eフィーバー戦姫絶唱シンフォギア4-final-commander-carolver.","eフィーバー彼女､お借りしますh","eベルセルク無双-第2章","eマギアレコード魔法少女まどか☆マギカ外伝","eようこそ実力至上主義の教室へ","eライザのアトリエ-常闇の女王と秘密の隠れ家","eラグナドール-妖しき皇帝と終焉の夜叉姫","eリコリスリコイル","eリング-最恐領域","eルパン三世-one-collection-超ブチヌキltver.","eルパン三世-the-first","eルパン三世-銭形からの招待状","eルパン三世vscat’s-eye","eルパン三世vsキャッツアイ-157ver.-極限突破ぶった切り7,500","eワンパンマン2-正義執行lm10","e異世界でチート能力を手にした俺は､現実世界をも無双する-レベルアップは人生を変えた","e一方通行","e黄門ちゃま-寿限無","e化物語-鬼99ver.","e仮面ライダーblack","e仮面ライダー電王","e仮面ライダー電王-デカヘソ239","e花の慶次-裂-一刀両断","e花の慶次-黄金の一撃","e花の慶次-傾奇一転","e牙狼11-冴島大河-魔戒burst-ver.","e牙狼12黄金騎士極限","e牙狼goldimpact-348ver.テスト導入","e牙狼神速神撃3000lt","e学園黙示録high-school-of-the-dead3","e義風堂々-兼続と慶次-3-dm5-s","e吉宗-極乗3000ver.","e犬夜叉3.0","e源外伝-episode-of-dairyu","e甲鉄城のカバネリ2-咲かせや燐然","e冴えない彼女の育てかた","e終末のワルキューレ","e盾の勇者の成り上がり-アルティメット-199ver.","e女神のカフェテラス","e新必殺仕置人-超斬撃99ver.","e新･必殺仕置人-超斬撃199ver.","e新･必殺仕置人s","e新海物語349","e新世紀エヴァンゲリオン-はじまりの記憶","e真･一騎当千-軍神覚醒-319大入りver.","e真･一騎当千-軍神覚醒-396ver.","e真北斗無双-第5章-ドデカstart","e真北斗無双-第5章-夢幻闘双","e聖戦士ダンバイン3-zero-sonic","e聖闘士星矢-超流星-climax-349","e閃乱カグラ","e蒼天の拳-羅龍sren","e大海物語5スペシャル","e大工の源さん超韋駄天2-フルスイングlt","e地獄少女7500ver.","e転生したらスライムだった件2","e東京リベンジャーズ","e東京喰種","e東京喰種-超デカ超一撃ver.","e乃木坂46ⅱ","e乃木坂46ⅱ-sweet-version","e範馬刃牙","e範馬刃牙-199ver.","e冒険島","e北斗の拳10","e北斗の拳11-暴凶星","e魔法少女まどか☆マギカ3-時間遡行-始まりの願い","p-another-wild-rodeo-スギちゃんっス","p-ayumi-hamasaki-live-in-casino","p-ayumi-hamasaki-live-in-casino-1","p-bang-dream","p-bang-dream-light-ver.","p-cyborg-009-rule-of-sacrifice","p-cyborg009-call-of-justice-hi-speed-edition","p-cyborg009-rule-of-sacrifice-lt99ver","p-cyborg009-rule-of-sacrifice-vs-scarl-body-edition-199","p-cyborg009-ごらく","p-d-clock","p-dd北斗の拳-主役はジャギ","p-dd北斗の拳-主役はジャギ-ユリア","p-dd北斗の拳2-ついでに愛をとりもどせ-ケンシロウ","p-dd北斗の拳2-ついでに愛をとりもどせ-ラオウ","p-dd北斗の拳2-ついでに愛をとりもどせ-ケンシロウ99-トキver.","p-dd北斗の拳2-ついでに愛をとりもどせ-ラオウ99-アミver.","p-dd北斗の拳3","p-dd北斗の拳3-百突99ver.","p-exゼウス","p-fairy-tail-89ver.","p-fairy-tail-これが七炎竜の力だfsa","p-fairy-tail-超一夜ver.","p-fairy-tail2","p-fairy-tail2-2","p-gⅰドリームロード","p-gogoマリン-超連撃battle","p-gogoマリン3000","p-gogo郷-革命の5","p-gogo郷-comeback-stage","p-gogo郷-comeback-stage-77ver.","p-god-eater-ブラッドの覚醒","p-god-eater-ブラッドの覚醒-3","p-god-eater-ブラッドの覚醒-アマデジ神撃90ver.","p-god-eater-ブラッドの覚醒-神撃90ver.","p-j-rush5","p-j-rush5-4","p-jaws3-light","p-jaws3-shark-panic-深淵","p-jaws再臨-shark-panic-again","p-reゼロから始める異世界生活","p-reゼロから始める異世界生活-season2-129ver.","p-reゼロから始める異世界生活-season2-249ver.","p-reゼロから始める異世界生活-鬼がかり-199ver.","p-reゼロから始める異世界生活-鬼がかり-99ver.","p-reゼロから始める異世界生活-鬼がかりver.","p-rewrite-fa","p-rewrite-fb","p-rewrite-gla","p-road-to-eden","p-rokuroku-2400-ちょい恐","p-rokuroku-6000","p-show-by-rock","p-steins;gate0","p-to-loveる-ダークネス","p-toloveる-ダークネス-199ver.","p-toloveる-ダークネス-らぶらぶ100ver.","p-v王-glc","p-v王-legend-mc","p-v王-legend-xa","p-yes高須クリニック-超整形pink","p-yes高須クリニック-超整形-black","p-yes高須クリニック晴天-はじまりは4500","p-リング呪縛rush-fex-設定付","p超甘ltこの素晴らしい世界に祝福を-最終クエスト149","p超甘lt華牌rr-149✕99de遊タイム","p超甘lt江頭250inナナシー-奇跡の99%","p超甘lt豊丸のとあるパチンコにしみけん参戦-感度up139","p物語セカンドシーズンgee","p009-recyborg-accelerator-edition","p009-recyborg-accelerator-edition-99ver.","p10カウントチャージ絶狼135ver.","p10カウントチャージ絶狼mc","p13日の金曜日gla","p13日の金曜日ma","p13日の金曜日zb","pa-cyborg009-call-of-justice-n-x1","pa-fairy-tail2-jwa","pa-gi-dream駿","pagogo富士山t","paアニマルマンションgo","paウイニングボール","paうる星やつら-ラムのlovesong","paガールフレンド仮","paガオガオキング3","paガンスリンガー-ストラトス-遊撃ver.","paキャプテン翼-雷獣バージョン","paギンギラパラダイス-夢幻カーニバル","paゴールデン鳳凰∞-jr.99","paこの素晴らしい世界に祝福を｢このゆる甘99に祝福を｣","paコマコマ倶楽部-with-坂本冬美-89stver.","paコマコマ倶楽部-with-坂本冬美-89確変ループ10ラウンド極","paコマコマ倶楽部-with-坂本冬美-99ver.","paコマコマ倶楽部-with-坂本冬美-ごらくバージョン","paコマコマ倶楽部@エイジセレクトy2f","paコマコマ倶楽部with坂本冬美loop1","paさくらももこ劇場コジコジ2-n2-k","paさくらももこ劇場コジコジ2-n2-k4","paシンエヴァンゲリオン-99-遊タイム付-ごらくver.","paスーパー海物語-in-japan-2-金富士","paスーパー海物語-in-japan2-with-太鼓の達人","paスーパー海物語-in-沖縄5-with-アイマリン","paスーパー海物語-in-沖縄5-夜桜超旋風-99ver","paスーパー海物語-in-地中海2","paスーパー海物語in沖縄6-withえなこ","paスーパー海物語in地中海","paスーパー海物語in地中海go","paストライクウィッチーズ","paでかちりラッシュ","paデジハネ火曜サスペンス劇場-最後の推理","paデジハネ北斗の拳7-天破","paドラム海物語-in-japan","paドラム海物語-in-沖縄","paドラム海物語-in-沖縄-go","paナナシー-お江戸77ver.","paナムココレクション","paナムココレクション2-スイートゲームver.","paハイスクール･フリート-オールスター-すい-とでハッピー2400","paハイスクールフリート-スイートでハッピー","paぱちんこ-仮面ライダー-go-on-light","paぱちんこ乗物娘-with-cyber-japan-dancers","paぱちんこ乗物娘-with-cyber-japan-dancers-ごらく","paぱちんこ新必殺仕置人turbo","paぱちんこ新必殺仕置人turbo-goraku","paぱちんこ戦国コレクション小悪魔","paひぐらしのなく頃に-輪廻転生99ver.","paビビッドレッドオペレーション-sweetもも99ver.","paフィーバーアイドルマスター-ミリオンライブ-light","paフィーバーアクエリオン-all-stars-light","paフィーバーかぐや様は告らせたい-light-ver.","paフィーバーからくりサーカス2yf","paフィーバークィーンⅱys","paフィーバースーパー戦隊-light","paフィーバーダンベル何キロ持てる-light-ver.","paフィーバートータルイクリプスlight","paフィーバーバイオハザード-リベレーションズ2-light","paフィーバーマクロスフロンティア3-light","paフィーバーマクロスフロンティア4-88ver.","paフィーバー機動戦士ガンダム-逆襲のシャア-light","paフィーバー機動戦士ガンダムユニコーン-白き一角獣と黒き獅子-再来-99ver.","paフィーバー機動戦士ガンダムユニコーン-light-ver.","paフィーバー真花月2-light","paフィーバー戦姫絶唱シンフォギア4-final-commander-lt-light-ver.1個賞球","paフィーバー戦姫絶唱シンフォギア4-final-commander-lt-light-ver.3個賞球","paぶいぶいゴジラ-かいじゅう大集合-n-k1","paぶいぶいゴジラ-かいじゅう大集合-n4-k6","paヤッターマンvvv","paリング-バースデイ-呪いの始まりfwc","paルパン三世-the-first-不二子89ver.","paロードファラオ-神の一撃-連撃","paワンパンマン-99ver.","paわんわんパラダイス-セレブレーション","paわんわんパラダイスv","pa異世界魔王と召喚少女の奴隷魔術-敏感99ver.","pa押忍番長2","pa花の慶次-傾奇一転-87ver.","pa花の慶次-裂-99ver.","pa花の慶次-蓮","pa怪盗おそ松さん","pa海物語-極japan","pa海物語3r2","pa海物語3r2スペシャル","pa海物語3r3クリスタルシェル","pa海物語3r3マリンシェル","pa義風堂々3-兼続と慶次-99ver.","pa究極神判-sweet-judgement","pa巨人の星-明子2000","pa巨人の星-栄光の軌跡-lightversion","pa激デジ-牙狼-月虹ノ旅人","pa激デジ-笑ゥせぇるすまん-最後の忠告","pa激デジジューシーハニー3ncy","pa激デジジューシーハニーハーレムray","pa元祖ギンギラパラダイス-強99ver.","pa元祖大工の源さん","pa元祖大工の源さん2","pa咲-saki-阿知賀編","pa獅子王jr.99","pa春一番-花札昇舞-go-ごらく","pa女子ザジャイアントyf","pa乗物娘-with-cyberjapan-dancers-2nd-season-77ver.","pa新海物語arbb","pa新鬼武者-狂鬼乱舞-light-version","pa新世紀エヴァンゲリオン決戦プレミアムモデル","pa真･花の慶次2-漆黒の衝撃-99ver.","pa真怪獣王ゴジラ-n2-k6","pa真･怪獣王ゴジラ2","pa真怪獣王ゴジラnl-k1","pa真暴れん坊将軍-99ver.","pa清流物語3","pa清流物語3-go","pa清流物語4-ウキウキ79ver.","pa聖闘士星矢4-the-battle-of-”限界突破”","pa設定付牙狼goldstorm翔rh","pa戦国basara","pa戦国乙女-legend-battle-ときめき♥89ver.","pa大海物語4スペシャル-with-アグネスラム","pa大海物語5-withアグネス･ラム","pa大海物語5ブラックlt99ver.","pa貞子vs伽椰子-頂上決戦","pa鉄拳-極-sweet-combo-ver.","pa緋弾のアリア-緋弾覚醒編","pa緋弾のアリアaa-jd設定付","pa豊丸ととある企業の最新作2-sod-99ver.","pa魔王学院の不適合者-魔王再臨99ver","pa満開花火go-ごらく","pa満開爛漫go","pa野生の王国-go","pa野生の王国ⅵ","pa野生の王国どらむサファリn-k1","pgogo郷-豪遊の5-n-vylt","plt-overlord-魔導王光臨","plt-overlord-魔導王光臨-129ver.","plt-激デジ-ジューシーハニー極嬢","pltジューシーハニー極嬢","psin-七つの大罪-x-treme","psin-七つの大罪-x-treme-強甘2400ver.","pアイドルマスターミリオンライブ-39フェス","pアズールレーン-the-animation-異次元トリガー","pアズールレーン-the-animation-異次元トリガー-79ver.","pあっぱれ夏物語-ドカンと一発7000ver.","pアナザーゴッドハーデス-ザワールド","pアナザーゴッドハーデス-ジャッジメント","pアナザーゴッドハーデス-獄炎","pアナザーゴッドハーデス3-狂乱","pアナザーゴッドポセイドン-怒涛の神撃","pあの日見た花の名前を僕達はまだ知らない。","pあぶない刑事","pあぶない刑事n-z-yt350","pアレジン-プレミアム","pいくさの子-織田三郎信長伝","pいくさの子-戦極最強ドデカ199ver.","pうしおととら-超獣spec","pうまい棒","pうまい棒2-おかわりちょちょちょうだ-いv3","pウルトラマンティガ-ウルトラ超光ライトver.","pウルトラマンメビウス","pうる星やつら-ラムのlovesong","pうる星やつら2","pうる星やつら2-eternal-love-song-129ver.","pえとたま2-神祭","pえとたま2-神祭-干支甘","pおそ松さんのゴールデンロード","pおばけらんど2022gcc","pおばけらんど怪gls","pおばけらんど怪xa","pおばけらんど怪za","pおばけらんど怪zbs","pガールズパンツァー-劇場版","pガールズパンツァー-劇場版-5","pガールフレンド仮m2-k-yt500","pカイジ鉄骨渡り勝負編","pガオガオキング3","pカナカナ2-桃汁100％","pガンスリンガーストラトス","pキャッツアイ-最高のお宝、頂きに上がります-sweet-treasures","pキャプテン翼-2020","pキャプテン翼-若林ver.","pキャプテン翼-若林甘えんなよ-99ver","pキャプテン翼-石崎バージョン","pキュインぱちんこ-ピンク★レディー","pキュインぱちんこ-ピンク★レディー-しんぷる","pキュインぱちんこ-南国育ち-デカパト","pキュインぱちんこ-南国育ち-デカパトver.","pギルティクラウン2","pギルティクラウン2-premium-live-ticket","pギンギラパラダイス-夢幻カーニバル","pギンギラパラダイス-夢幻カーニバル-6","pキングモンスターrush","pクイーンズブレイド-アンリミテッド-奈落","pクイーンズブレイド3-ナナエル","pクイーンズブレイド3-レイナ","pクイーンズブレイド4-アンリミテッド","pクイーンズブレイド4-ナナエルver.","pクイーンズブレイド奈落-ナナエル79ver.","pクイーンズブレイド美闘士カーニバル-ナナエルver.","pゲゲゲの鬼太郎-獅子奮迅","pゲゲゲの鬼太郎-獅子奮迅-99ver.-rwc","pケロロ軍曹gla","pコードギアス-反逆のルルーシュ-rebellion-to-re;surrection","pコードギアス-反逆のルルーシュ-強ライトミドル","pコードギアス-反逆のルルーシュ3-light-ver.","pコードギアス-反逆のルルーシュbr","pコードギアス反逆のルルーシュ-light","pゴールデン鳳凰∞-全突アクセルスペック","pゴールドマックス-限界突破","pゴジラ対エヴァンゲリオン-g細胞覚醒-premium-model-ロングstver.","pゴジラ対エヴァンゲリオン-セカンドインパクトg","pゴジラ対エヴァンゲリオン-g細胞覚醒","pゴジラ対エヴァンゲリオン2-超デカsilver-174","pゴッドイーター-究極の一閃","pゴッドイーター199-ゴッドトリガーver.","pゴッドイーター神がかりver.","pこの素晴らしい世界に祝福を199lt-｢このラッキートリガーに祝福を｣","pこの素晴らしい世界に祝福をラッキートリガー129緊急クエスト","pゴブリンスレイヤー-ラッキートリガーver.","pゴブリンスレイヤーjgz","pコマコマ倶楽部-with-坂本冬美-199ver.","pサラリーマン金太郎-159をなめんじゃねぇ-ver.","pサラリーマン金太郎-fmy","pシティーハンター-俺の心を震わせた日","pシティーハンター-俺の心を震わせた日-凄ライトミドル","pシャカラッシュz","pジューシーハニー-ハーレム","pジューシーハニー2-rey2","pジューシーハニー3-てんこ盛り連写rush","pジューシーハニー3mgy2","pシュタインズゲートゼロ-まゆしぃば-じょん","pシンエヴァンゲリオン-premium-model","pシン･エヴァンゲリオン-type-レイ","pシンデレラブレイド-jqx","pスーパーコンビα7500","pスーパー海物語-in-japan-2","pスーパー海物語-in-japan-2-金富士-199","pスーパー海物語-in-japan-2-金富士-319","pスーパー海物語-in-沖縄5-夜桜超旋風","pスーパー海物語in沖縄5-桜早咲き","pスーパー海物語in沖縄5-桜満開","pスーパー海物語in沖縄5ltv","pスーパー海物語in沖縄6","pスカイレーサーdx","pすしざんまい極上4200","pすしざんまい極上5700","pスターオーシャン4-sweet-premium-ver.","pストライクウィッチーズ2","pストライクウィッチーズ2-129ver.","pストリートファイターv","pストリートファイターv-k.o.rush","pストリートファイターv-k.o.rush-light-edition","pストレートセブンdx-h","pストレートセブンlsj-h","pゾンビランドサガ","pゾンビリーバボー-絶叫-s3-t1","pゾンビリーバボー-絶叫-s4-t6","pゾンビリーバボー-絶叫-s5-t1","pターミネーター2-type7500","pターミネーター2-連撃full-auto","pタイガーバニー-完全無欠wildスペック","pダイナマイトキング-無敵spec","pだるまっしゅ2-だるま湯繁盛記","pだるまっしゅ2-n-kc","pダンガンロンパ","pちょいパチ海物語3r2","pちょいパチ清流物語3","pツインループ花満開","pツインループ花満開gla","pデカスタ-デビルマン-the-final-179ver.","pデカスタ戦国無双-100ver.","pデカビスカス","pデジハネ物語セカンドシーズン","pデジハネブラックラグーン3","pデジハネモンスターハンターライズ","pデジハネ交響詩篇エウレカセブン-anemone-99ver.","pデジハネ蒼天の拳-双龍","pデジハネ頭文字dせかんど","pデビルマン-疾風迅雷-129ver.","pデビルマン-the-final","pデビルマン-疾風迅雷","pデビルマン黄金黙示録-n-k1-yt250","pデビルメイクライ-4-アウトオブリミット","pデビルメイクライ4-クレイジーバトル","pとある科学の超電磁砲","pとある科学の超電磁砲-最強御坂ver.","pとある科学の超電磁砲2-jmb","pとある魔術の禁書目録","pとある魔術の禁書目録-light-premium","pとある魔術の禁書目録2","pとある魔術の禁書目録2-light-premium-2000-ver.","pトキオブラック4500","pどないやねんfyc","pドラムだ金ドン-花火外伝","pドラムだ金ドン-花火外伝99ver.","pドラム花火の源さん-ドォオオンと2400ex","pドラム海物語-in-沖縄-桜バージョン","pドリームクルーンultimate","pナムココレクション","pナムココレクション2","pにゃんこ大戦争-多様性のネコ-神様におまかせ88ver","pニュートキオgreen-v1","pニュートキオh1-ヘソ","pニュートキオv1-ハカマ","pネオモンスターハウス-199ver.","pネオモンスターハウス-99ver.","pネオモンスターハウスlml","pネオモンスターハウスmxl","pバーストエンジェル3","pバーストエンジェルex-99ver.","pバイオハザードre2-lucky-trigger-タイプ","pバイオハザードre2-ごらくバージョン","pバイオハザードre2-h1yz3","pハイスクールフリート","pハイスクール･フリート-all-star","pハイスクールd×d-gla","pハイスクールd×d-ma","pハイスクールd×d-mx","pハイスクールd×d-zd","pハイスクールd×d-真紅gca","pハイスクールd×d-真紅mc","pパイレーツオブダイナマイトキング","pバキ-199","pバキ-319","pはぐれ刑事純情派","pバジリスク-甲賀忍法帖-2","pバジリスク-甲賀忍法帖-2-朧の章","pバジリスク桜花忍法帖","pバジリスク桜花忍法帖-早咲き桜99ver.","pぱちんこ-gantz2","pぱちんこ-gantz極","pぱちんこ-ウルトラ6兄弟","pぱちんこ-ウルトラセブン2-light","pぱちんこ-ガラスの仮面m-k1","pぱちんこ-ガラスの仮面ml-k1","pぱちんこ-にゃんこ大戦争-多様性のネコ","pぱちんこ-劇場版-魔法少女まどか☆マギカ","pぱちんこ-劇場霊","pぱちんこ-新必殺仕置人","pぱちんこ-新鬼武者-狂鬼乱舞","pぱちんこ-必殺仕事人-総出陣","pぱちんこakb48-ワンツースリー-フェスティバル","pぱちんこakb48-桜-light","pぱちんこakb48-3-誇りの丘-light","pぱちんこgantz-覚醒-sweet-2000","pぱちんこgantz2-sweetバージョン","pぱちんこgantz3-last-battle","pぱちんこgantz覚醒-light-middle","pぱちんこgi優駿倶楽部","pぱちんこgi優駿倶楽部-7","pぱちんこgi優駿倶楽部2-ラッキートリガーver","pぱちんこgi優駿倶楽部2-超限界突破","pぱちんこアズールレーン-the-animation","pぱちんこウルトラ6兄弟-light","pぱちんこウルトラセブン超乱舞","pぱちんこウルトラマンタロウ2","pぱちんこウルトラマンタロウ2超決戦light","pぱちんこウルトラマンティガ-1500×84","pぱちんこキン肉マン3-キン肉星王位争奪編-火事場ゴールド","pぱちんこキン肉マン3-キン肉星王位争奪編-特盛ミートくんバージョン","pぱちんこキン肉マン3-キン肉星王位争奪編-友情シルバー","pぱちんこシン･エヴァンゲリオン-129-lt-ver.","pぱちんこセブンインパクト","pぱちんこ仮面ライダー-闇のライダーver.","pぱちんこ劇場版魔法少女まどか☆マギカ-キュゥべえ","pぱちんこ乗物娘-2nd-season-with-cyberjapan-dancers","pぱちんこ乗物娘-with-cyber-japan-dancers-1個賞球","pぱちんこ乗物娘-with-cyber-japan-dancers-3個賞球","pぱちんこ水戸黄門-超極楽","pぱちんこ水戸黄門-超極上-らいとばーじょん","pぱちんこ戦国コレクション","pぱちんこ冬のソナタ-my-memory-sweet-goraku-version","pぱちんこ冬のソナタ-my-memory-sweet-version","pぱちんこ冬のソナタ-sweet-w-happy","pぱちんこ冬のソナタforever","pぱちんこ乃木坂46","pぱちんこ乃木坂46-トレジャースペック","pぱちんこ美夏美華パラダイスm-v","pパトラッシュv-green","pパトラッシュv-red","pはねものファインプレー","pハネモノファミリースタジアム","pバベル5000","pひぐらしのなく頃に-輪廻転生","pひぐらしのなく頃に-廻","pひぐらしのなく頃に-廻-8","pひぐらしのなく頃に-憩","pひぐらしのなく頃に-彩","pひぐらしのなく頃に-瞬","pひぐらしのなく頃に-囁","pひぐらしのなく頃に-蕾","pビッグドリーム2激神","pビッグドリーム2激神-9","pビッグドリーム3","pビッグドリーム3-77ver.","pビッグポップコーンa","pビビッドレッドオペレーション","pファンキーdr.-回るヘソワイド-11000ver.","pファンキードクター-7200ループver.","pファンキードクター-悪魔-12000ver.","pファンキードクター天使ver.","pフィーバー-ダンジョンに出会いを求めるのは間違っているだろうか","pフィーバー-バイオハザード-リベレーションズ-light","pフィーバーアイドルマスター-ミリオンライブ","pフィーバーアクエリオン-all-stars","pフィーバーアクエリオン-極合体","pフィーバーアクエリオンw-気持ちいい","pフィーバーアクエリオンw-最終決戦","pフィーバーありふれた職業で世界最強-ligjht-ver.","pフィーバーありふれた職業で世界最強r","pフィーバーうたわれるもの-lt-light-ver.","pフィーバーうたわれるものz","pフィーバーかぐや様は告らせたい","pフィーバーからくりサーカス2-運命ver.","pフィーバーからくりサーカスv","pフィーバーからくりサーカスy","pフィーバークィーンⅱ","pフィーバークィーンⅱ-30th-anniversary-edition","pフィーバークィーンⅱ-ごらく","pフィーバークィーンruhs-y","pフィーバーゴルゴ13-疾風マシンガン","pフィーバーゴルゴ13-light","pフィーバーゴルゴ13-light-2019年","pフィーバーゴルゴ13-疾風","pフィーバースーパー戦隊","pフィーバースプラッシュxスプラッシュ","pフィーバータイガーマスクw","pフィーバータイガーマスクw-light","pフィーバーダンジョンに出会いを求めるのは間違っているだろうか2","pフィーバーダンジョンに出会いを求めるのは間違っているだろうか2-lt-light-ver.","pフィーバーダンベル何キロ持てる","pフィーバートータルイクリプス","pフィーバードラムゴルゴ13-light","pフィーバーバイオハザード-リベレーションズ2","pフィーバーバイオハザードリベレーションズ2","pフィーバーパワフル","pフィーバーパワフル-10","pフィーバーパワフル-ごらく","pフィーバーマクロスデルタ-v-ラッシュ","pフィーバーマクロスフロンティア4-a","pフィーバーマクロスフロンティア5-lt-light-ver.","pフィーバーマクロスフロンティア5w","pフィーバーマクロスδ","pフィーバーマクロスδ-設定付き","pフィーバー炎炎ﾉ消防隊","pフィーバー炎炎ノ消防隊-light-ver.","pフィーバー革命機ヴァルヴレイヴ-light","pフィーバー革命機ヴァルヴレイヴ2-light","pフィーバー革命機ヴァルヴレイヴ2-カミツキ","pフィーバー革命機ヴァルヴレイヴ2s","pフィーバー革命機ヴァルヴレイヴ3","pフィーバー革命機ヴァルヴレイヴ3-light-ver.","pフィーバー機動戦士ガンダム-逆襲のシャア","pフィーバー機動戦士ガンダムseed","pフィーバー機動戦士ガンダムseed-lt-light-ver.","pフィーバー機動戦士ガンダムユニコーン","pフィーバー機動戦士ガンダムユニコーン-白き一角獣と黒き獅子-再来","pフィーバー機動戦士ガンダムユニコーン-白き一角獣と黒き獅子-再来-129ver.","pフィーバー三国戦騎7500","pフィーバー真花月2-夜桜バージョン","pフィーバー戦姫絶唱シンフォギア2","pフィーバー戦姫絶唱シンフォギア2s","pフィーバー戦姫絶唱シンフォギア2yr","pフィーバー戦姫絶唱シンフォギア3-黄金絶唱","pフィーバー戦姫絶唱シンフォギア3-黄金絶唱-light-ver.","pフィーバー戦姫絶唱シンフォギア4-final-commander-199ver.","pフィーバー戦姫絶唱シンフォギアyr","pフィーバー蒼穹のファフナー2","pフィーバー蒼穹のファフナー2-light-ver.","pフィーバー蒼穹のファフナー3-exodus-織姫light-ver.","pフィーバー超デカ彼女､お借りします-lt-light-ver.","pぶいぶいゴジラ-かいじゅう大集合","pブラックラグーン4-extra-bullet-129ver.","pブラックラグーン4-gfpj","pプロゴルファー猿-emperor-model","pプロゴルファー猿-強甘119ver.","pベルサイユのばら-革命への序曲-fa","pベルサイユのばら-革命への序曲-glb","pベルサイユのばら-革命への序曲-ma","pベルセルク無双","pベルセルク無双-119ver","pベルセルク無双-冥府魔道ver.","pホームランキング","pホー助くん","pポチッと一発おだてブタ2","pほのかとクールポコと、ときどき武藤敬司","pホワイトシャカrush-廻るヘソワイド","pまわるん大海4sp-アグネス","pミニミニモンスター4a","pミニミニモンスター4lm","pミニミニモンスタードラムakz","pミリオンヴィーナス","pミリオンゴッド一撃mh","pメイドインアビス-奈落の連環蝕","pメイドインアビス-虹の黄金域","pめぞん一刻-wedding-story","pめぞん一刻-wedding-story-11","pモードぱちんこ-どらむ★ヱヴァンゲリヲンgold","pモードぱちんこ-ヱヴァンゲリヲン-超覚醒","pモードぱちんこ-ヱヴァンゲリヲン-超暴走-g","pもっとあぶない刑事","pモモキュンソード-速撃99ver.","pモモキュンソードgc250a","pモモキュンソードmc","pモモキュンソード閃撃","pモモキュンソード閃撃-極","pモモキュンソード閃撃gca","pモモキュンソード速撃3000","pモンキーターンv","pモンキーターンv-gc250a","pモンキーターンvi-超抜","pモンスターハンターrise","pモンスターハンターダブルクロス","pモンスターハンターダブルクロス-連続狩猟-gea","pやじきた道中記-甘味ver.","pやじきた道中記mm","pヤッターマンvvv","pラブ嬢-極嬢のハーレム体験","pラブ嬢-極嬢のハーレム体験-12","pらんま12-熱血格闘遊戯","pらんま12-熱血格闘遊戯-99ver.","pリアル鬼ごっこ2-全力疾走チャージ-王様ver.","pリアル鬼ごっこ2-全力疾走チャージ-翼","pリアル鬼ごっこ2-全力疾走チャージ鬼","pリング-バースデイ-呪いの始まりfrx設定付","pリング-呪いの7日間2","pリング-呪いの7日間2-13","pリング-呪いの7日間2-fwa","pリングにかけろ1","pリングにかけろ1-129ver.","pリング呪いの7日間3","pリング呪いの7日間3-ラッキートリガーver.","pリング呪いの7日間3-甘デジver.","pルパン三世-銭形からの招待状-77ver.","pルパン三世-復活のマモー","pルパン三世-復活のマモー-14","pルパン三世-復活のマモー-15","pルパン三世-2000カラットの涙","pルパン三世-2000カラットの涙-129ver","pルパン三世-one-collection","pルパン三世-one-collection-100ver.","pルパン三世-the-first","pルパン三世-the-first-99ver.","pルパン三世-消されたルパン2022","pルパン三世-消されたルパン2022-99ver.","pルパン三世-神々への予告状","pルパン三世-神々への予告状-16","pロードファラオ-神の一撃","pワイの佐野ラーメン","pワイルドロデオ6750だぜぇ","pわんニャンアドベンチャー","pわんニャンアドベンチャー-119ver.","pワンパンマン-199ver.","pワンパンマンl3-mx","pヱヴァンゲリヲン-超暴走","pヱヴァンゲリヲン13-エクストラモデル","pヱヴァンゲリヲン13-プレミアムモデル","pヱヴァンゲリヲン13ごらくモデル","p亜人-衝戟に備えろ","p亜人-衝戟の全突フルスペック","p愛の不時着","p安心ぱちんこキレパンダ-in-リゾート","p安心ぱちんこキレパンダinリゾート","p異世界魔王と召喚少女の奴隷魔術","p一騎当千-サバイバルソルジャー","p一騎当千ss斬-孫策","p一騎当千ss斬-呂蒙","p一球魂goldピラミッ伝","p宇宙戦艦ヤマト2202-only-one","p宇宙戦艦ヤマト2202-only-one-light","p宇宙戦艦ヤマト2202-愛の戦士たち","p宇宙戦艦ヤマト2202-愛の戦士たち-light-ver.","p宇宙戦艦ヤマト2202-愛の戦士たち-超波動","p宇宙戦艦ヤマト2202-愛の戦士たち-超波動-森雪199ltver.","p羽根モノ獣王go2-ごらく","p炎のドラム魂ga","p遠山の金さん2-遠山桜と華の密偵-jwd","p遠山の金さん2-遠山桜と華の密偵jqa","p遠山の金さん2-遠山桜と華の密偵jud","p黄門ちゃま-寿限無-99ver.","p黄門ちゃま-寿限無-llサイズstart-259ver.","p黄門ちゃま神盛2","p沖7-black","p沖7-し-さ-ば-じょん","p沖ドキ-ドキドキ弾丸ツアー","p俺の妹がこんなに可愛いわけがない｡","p俺の妹がこんなに可愛いわけがない｡-攻略スキップ159ver.","p化物語-199ver.","p化物語-319ver.","p火曜サスペンス劇場-最後の推理","p花の慶次-蓮","p花の慶次-傾奇一転","p花の慶次-裂-蓮極129ver.","p花の慶次-蓮-17","p花満開-月光-the-final","p花満開-月光-the-final-gca","p華牌r-猿渡翔がローズテイルにやってきた","p華牌r-猿渡翔がローズテイルにやってきた-ごらく","p華牌rr-with-清水あいり-ごらく","p華牌rr-with-清水あいり150de遊タイム","p牙狼-gold-impact","p牙狼-月虹ノ旅人","p牙狼-月虹ノ旅人-58%の衝撃ver.","p牙狼-月虹ノ旅人絆-giga-ghost","p牙狼11-冴島大河-xx","p牙狼museum","p牙狼コレクション","p牙狼コレクション-遊タイム","p牙狼冴島鋼牙xx","p海物語極ジャパンhth","p学園黙示録ハイスクールオブザデッド2-弾丸","p学園黙示録ハイスクール･オブ･ザ･デッド2-弾丸","p寄生獣","p義風堂々-兼続と慶次-2-m6-x-1個賞球","p義風堂々-兼続と慶次-2-m3-x-3個賞球","p義風堂々3-兼続と慶次-199ver.","p巨人の星-一球入魂3000","p巨人の星-栄光の軌跡-連戦連勝version","p競女-keijo","p競女-keijo-18","p競女-keijo-19","p銀河英雄伝説-die-neue-these-319ver.","p銀河英雄伝説-die-neue-these-89ver.","p銀河鉄道999-golden","p銀河鉄道999-next-journey","p銀河鉄道999-next-journey-1100ver.","p銀河鉄道999-premium","p激デジ-真･牙狼","p結城友奈は勇者である","p結城友奈は勇者である-all-rush-rfa","p結城友奈は勇者である-gc250ba","p結城友奈は勇者である-sweet-77ver.","p犬夜叉-ジャッジメントインフィニティ-プレミアム","p犬夜叉2","p犬夜叉3.0-甘spec-大入りスタート","p元祖ギンギラパラダイス-hcb","p元祖大工の源さん","p交響詩篇エウレカセブン-anemone","p交響詩篇エウレカセブン-hiｰevolution-zero","p攻殻機動隊-ghost-in-the-shellsac_2045","p攻殻機動隊-ghost-in-the-shellsac_2045-20","p攻殻機動隊sac-2045-99ver.","p江頭250-in-ナナシー-lt","p甲鉄城のカバネリ-4000連激ver.","p甲鉄城のカバネリgee","p甲鉄城のカバネリgfb","p冴えない彼女の育てかた-99ver.","p咲-saki-阿知賀編-episode-of-side-a","p咲-saki-阿知賀編-役満gold","p咲-saki-全国編","p咲-saki-全国編-テンパイ即リーver.","p獅子王","p七つの大罪-エリザベスver.","p七つの大罪-強欲ver.","p七つの大罪2","p七つの大罪2-神千斬りver.","p七つの美徳-ゴールデンエンジェルタイム","p七つの美徳-ゴールデンエンジェルタイム-スイート-99ver.","p春一番-花札昇舞","p春一番-花札昇舞-glb","p春一番-恋絵巻-gc250a","p春一番-恋絵巻-gc250xa","p春一番-恋絵巻-mb","p春一番-恋絵巻-ze","p春夏秋冬glb","p春夏秋冬ma","p春夏秋冬zb","p盾の勇者の成り上がり","p女神ドリーム","p少女☆歌劇レヴュースタァライト-ラッキートリガー4500","p少女☆劇場-レヴュースタァライト99-lt300","p笑ゥせぇるすまん-ドーンといきまshow-199ver.","p笑点","p織田信奈の野望-下剋上","p織田信奈の野望-全国版gc250aa","p織田信奈の野望-全国版mga","p信長の野望-創造-n-k","p信長の野望-創造-go","p新･遠山の金さん","p新･遠山の金さん-77ver.-jwz","p新鬼武者-dwan-of-dreams","p新鬼武者-dwan-of-dreams-21","p新世紀エヴァンゲリオン-シト、新生","p新世紀エヴァンゲリオン-シト、新生-premium-model","p新世紀エヴァンゲリオン-未来への咆哮","p新世紀エヴァンゲリオン-決戦-真紅","p新世紀エヴァンゲリオン15-未来への咆哮-premium-model","p新世紀エヴァンゲリオン15-未来への咆哮-special-edition","p新日本プロレスリング","p真･一騎当千-桃園の誓い-199ltver","p真･一騎当千-angelic-heroine","p真･一騎当千-angelic-heroine-light-ver.","p真･一騎当千~桃園の誓い~","p真･一騎当千-桃園の誓い-129ver","p真黄門ちゃま","p真･黄門ちゃま","p真･黄門ちゃま-22","p真･花の慶次-黄金一閃","p真花の慶次2-漆黒の衝撃-extra-rush","p真･花の慶次3","p真花の慶次3-天速ver.","p真･花の慶次3n-k","p真･牙狼2","p真牙狼rs","p真怪獣王ゴジラ2","p真･座頭市物語","p真座頭市物語-lt99ver.","p真暴れん坊将軍-双撃","p真･北斗無双-re","p真北斗無双-第2章-頂上決戦","p真北斗無双-第3章","p真･北斗無双-第3章-覚醒闘舞","p真･北斗無双-第4章-下剋上闘","p真･北斗無双4","p真シャカrush-jr.117-遊タイムあり","p真シャカrush-jr.117-遊タイムなし","p真シャカラッシュ","p真バジリスク-甲賀忍法帖","p真バジリスク-甲賀忍法帖-豪塊319ver.","p真速のガッチャマン-インフィニティフォース","p真北斗無双3-ジャギの逆襲","p神天才バカボン-神超spec","p神･天才バカボン-甘神spec","p翠星のガルガンティアks","p世界でいちばん強くなりたい-w悶starver","p世界でいちばん強くなりたいmu","p世界最高の暗殺者、異世界貴族に転生する","p世紀末-天才バカボン-神spec-凱旋","p世紀末天才バカボン-神spec-凱旋-99ver.","p世紀末･天才バカボン-福神spec","p清流物語4-ヌシを求めて4000匹","p聖戦士ダンバイン2-zero-limit-hyper","p聖戦士ダンバイン2-zero-sonic-99ver.","p聖闘士星矢-超流星-女神ゴールドver.","p聖闘士星矢-超流星-星矢ゴールドver.","p聖闘士星矢-超流星light-ver.","p戦国†恋姫2-vチャージ","p戦国basara","p戦国コレクション-black","p戦国コレクション-天魔99","p戦国乙女5","p戦国乙女5-甘デジ","p戦国乙女6-暁の関ヶ原","p戦国乙女6-暁の関ヶ原-23","p戦国乙女7-終焉の関ヶ原-299ver.","p戦国乙女7-終焉の関ヶ原","p戦国乙女7-終焉の関ヶ原-強カワ99ver.","p戦国乙女レジェンドバトル","p戦国乙女レジェンドバトル-99ver","p戦国無双","p銭形平次2","p銭形平次2-疾風st","p銭形平次3-denkousekka","p銭形平次3-お静99","p閃乱カグラ-大入りスタート189ver.","p閃乱カグラ2-パイまみれ","p閃乱カグラ2-胸躍る","p蒼天の拳-双龍","p蒼天の拳-天刻","p蒼穹のファフナー3-exodus-超蒼穹3800ver.","p大海物語4スペシャル","p大海物語4スペシャル-black","p大海物語5","p大海物語5-ブラック","p大海物語5スペシャル","p大開王x","p大工の源さん-超韋駄天-light","p大工の源さん超韋駄天2-極源light","p大工の源さん超韋駄天black","p大工の源さん超韋駄天yta","p弾球黙示録カイジ5-ざわっ･･･ver.","p弾球黙示録カイジ5-プラズマ","p弾球黙示録カイジ5-電撃","p弾球黙示録カイジ5-電撃チャージ-和也ver.","p弾球黙示録カイジ沼4-カイジver.","p弾球黙示録カイジ沼4-ざわっ…","p弾球黙示録カイジ沼5-運否天賦","p弾球黙示録カイジ沼5-運否天賦-ざわっ･･･79ver.","p弾球黙示録カイジ沼5-超欲望129×87%ver.","p地獄少女-light-ver.","p地獄少女-きくりのお祭りlive-fwa","p地獄少女5-華","p地獄少女覚醒3000ver.","p地獄少女四","p中森明菜-歌姫伝説-the-best-legend","p中森明菜-歌姫伝説-the-best-legend-24","p中森明菜-歌姫伝説-the-best-legend-25","p中森明菜-歌姫伝説-black-diva","p中森明菜歌姫伝説-black-diva楽-80-89ver.","p中森明菜歌-姫伝説-black-diva-愛","p超ハネ獣王","p痛いのは嫌なので防御力に極振りしたいと思います｡","p痛いのは嫌なので防御力に極振りしたいと思います｡-極振り129ver.","p貞子3d-rebirth","p貞子3d2-light-呪われた12時間","p貞子3d2-呪われた12時間","p貞子fmd","p貞子vs伽椰子-頂上決戦","p哲也4","p鉄拳-極","p天昇姫相撲-大横綱ver","p天龍∞-2400","p天龍∞2","p天龍7","p天龍7-blue-ver.","p天龍7-light-ver.","p転生したらスライムだった件","p転生したらスライムだった件-129ver.","p冬のソナタ-my-memory","p冬のソナタ-remember-sweet-version","p冬のソナタremember-sweet-goraku","p刀使ノ巫女gcaa","p刀使ノ巫女mha","p刀使ノ巫女zca","p藤丸くん-6000-fhx","p藤丸くん30min-4000fgz設定付","p藤丸くん30min-ff設定付","p頭文字d","p頭文字d-2nd","p頭文字d-non-stop-3000edition","p闘将覇伝","p忍者ハットリくん-決戦サイバーからくり城の巻-上忍","p忍者ハットリくん-決戦サイバーからくり城の巻-中忍","p乃木坂46-キュンキュンlight-ver.","p覇穹-封神演義dl3-mx","p白魔女学園-オワリトハジマリ-赤き騎士団ver.","p白魔女学園-オワリトハジマリ-白魔女ver.","p彼岸島rpy","p緋弾のアリア-緋緋神降臨-ラッキートリガーver.","p緋弾のアリア-緋弾覚醒編","p緋弾のアリア-緋弾覚醒編-319ver.","p緋弾のアリア-緋緋神降臨-199ver.","p緋弾のアリア-緋緋神降臨-88ver.","p緋弾のアリアaa-fe-設定付","p百花繚乱","p百花繚乱-ご奉仕129ver.","p平家物語reloaded-y2c","p保4のガチャバスター","p鳳凰∞","p鳳凰∞-ライトミドル","p暴れん坊将軍-炎獄鬼神の怪-fhx","p暴れん坊将軍-炎獄鬼神の怪-設定付-ごらく","p暴れん坊将軍-炎獄鬼神の怪fsz設定付","p暴れん坊将軍-炎獄鬼神の怪fw設定付","p北斗の拳-強敵-lt","p北斗の拳-慈母","p北斗の拳-暴凶星sfpa","p北斗の拳8-救世主","p北斗の拳8-究極乱世","p北斗の拳8覇王","p北斗の拳9-闘神","p魔王学院の不適合者fmy","p魔法少女まどか☆マギカ3","p魔法少女まどか☆マギカ3-キュウべえver.","p魔法少女リリカルなのは-2人の絆","p麻雀物語4","p麻雀物語4-77ver","p満開まつり-go1","p野生の王国-go-199ver.","p野生の王国5-go","p野生の王国5-go-遊タイム付","p野生の王国どらむサファリs-k1","p烈火の炎3","p烈火の炎3-26","p烈火の炎3-type-r","アマデジpa笑ゥせぇるすまん-ドーンといきまshow","デカスタe花の慶次-傾奇一転","デジハネpa交響詩篇エウレカセブン-hiｰevolution-zero","デジハネpa真北斗無双-第2章-連撃edition","デジハネpあの日見た花の名前を僕達はまだ知らない。","ぱちんこ仮面ライダー轟音","笑ゥせぇるすまん最後の忠告-今日のお客様はあなたです","戦国パチンコp義風堂々-兼続と慶次-2-n-x"]

    // 機種名のキーパーツでスラッグを部分一致検索
    // e/P接頭辞は削除しない（スラッグ側にもe/pが残っているため、区別に必要）
    function findSlug(name) {
        if (!allSlugs.length) return '';
        const parts = name
            .replace(/[&＆！!？?・：:＋+／/＊*＃#|"【】「」『』（）()〈〉《》<>～〜\s　]+/g, ' ')
            .trim()
            .split(/\s+/)
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
            // 同スコアならスラッグが短い(余計な部分が少ない=より正確)方を優先
            if (score > bestScore || (score === bestScore && score > 0 && slug.length < bestSlug.length)) {
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
                <div class="spec-card"><div class="spec-label">トータル確率</div><div class="spec-value">1/${m.prob}</div></div>
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
