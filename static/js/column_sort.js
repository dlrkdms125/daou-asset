// 컬럼 표시/숨기기, 정렬, 순서 변경, 필터링 기능

// localStorage 키
const COLUMN_VISIBILITY_KEY = 'assetColumnVisibility';
const SORT_STATE_KEY = 'assetSortState';
const COLUMN_ORDER_KEY = 'assetColumnOrder';
const ROW_ORDER_KEY = 'assetRowOrder';
const FILTER_STATE_KEY = 'assetFilterState';

// 현재 정렬 상태
let currentSort = {
    field: null,
    direction: null // 'asc' or 'desc'
};

// 드래그 중인 요소
let draggedHeader = null;
let draggedRow = null;

// 현재 필터 상태
let currentFilters = [];

// 컬럼 순서 로드
function loadColumnOrder() {
    const saved = localStorage.getItem(COLUMN_ORDER_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    // 기본 순서: columns 배열 순서대로
    return columns.map(col => col.field);
}

// 컬럼 순서 저장
function saveColumnOrder(order) {
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
}

// 컬럼 가시성 상태 로드
function loadColumnVisibility() {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    // 기본값: 모든 컬럼 표시
    const defaultVisibility = {};
    columns.forEach(col => {
        defaultVisibility[col.field] = true;
    });
    return defaultVisibility;
}

// 컬럼 가시성 상태 저장
function saveColumnVisibility(visibility) {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(visibility));
}

// 정렬 상태 로드
function loadSortState() {
    const saved = localStorage.getItem(SORT_STATE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    return { field: null, direction: null };
}

// 정렬 상태 저장
function saveSortState(state) {
    localStorage.setItem(SORT_STATE_KEY, JSON.stringify(state));
}

// 필터 상태 로드
function loadFilterState() {
    const saved = localStorage.getItem(FILTER_STATE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

// 필터 상태 저장
function saveFilterState(filters) {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filters));
}

// 컬럼 순서 적용 (최적화: tbody를 DOM에서 분리 후 작업하여 리플로우 최소화)
function applyColumnOrder() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const order = loadColumnOrder();
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    if (!thead || !tbody) return;

    // 현재 헤더 셀들 가져오기
    const headerCells = Array.from(thead.querySelectorAll('th'));
    const headerMap = {};
    headerCells.forEach(cell => {
        const field = cell.dataset.column || cell.dataset.field;
        if (field) {
            headerMap[field] = cell;
        }
    });

    // 헤더 재정렬
    order.forEach(field => {
        if (headerMap[field]) {
            thead.appendChild(headerMap[field]);
        }
    });

    // tbody를 DOM에서 분리 (리플로우 방지)
    const tbodyParent = tbody.parentNode;
    const tbodyNext = tbody.nextSibling;
    tbodyParent.removeChild(tbody);

    // 각 행의 셀들 재정렬 (DOM 분리 상태에서 수행 → 리플로우 없음)
    const rows = tbody.querySelectorAll('tr[data-asset-id]');
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const cellMap = {};
        cells.forEach(cell => {
            const field = cell.dataset.field;
            if (field) {
                cellMap[field] = cell;
            }
        });

        order.forEach(field => {
            if (cellMap[field]) {
                row.appendChild(cellMap[field]);
            }
        });
    });

    // tbody를 DOM에 재부착 (단 1번의 리플로우)
    if (tbodyNext) {
        tbodyParent.insertBefore(tbody, tbodyNext);
    } else {
        tbodyParent.appendChild(tbody);
    }
}

// 컬럼 드롭다운 생성
function createColumnDropdown() {
    const columnList = document.getElementById('columnList');
    if (!columnList) return;

    const visibility = loadColumnVisibility();
    const order = loadColumnOrder();

    // 순서대로 드롭다운 아이템 생성
    order.forEach(field => {
        const col = columns.find(c => c.field === field);
        if (!col) return;

        const item = document.createElement('div');
        item.className = 'column-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col_${col.field}`;
        checkbox.checked = visibility[col.field] !== false;
        checkbox.addEventListener('change', () => toggleColumn(col.field, checkbox.checked));

        const label = document.createElement('label');
        label.htmlFor = `col_${col.field}`;
        label.textContent = col.name;

        item.appendChild(checkbox);
        item.appendChild(label);
        columnList.appendChild(item);
    });
}

// 컬럼 토글
function toggleColumn(field, visible) {
    const visibility = loadColumnVisibility();
    visibility[field] = visible;
    saveColumnVisibility(visibility);
    applyColumnVisibility();
}

// 컬럼 가시성 적용 (최적화: CSS 스타일 주입으로 DOM 조작 제거)
function applyColumnVisibility() {
    const visibility = loadColumnVisibility();

    // 동적 스타일 태그 생성 또는 재사용
    let styleEl = document.getElementById('columnVisibilityStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'columnVisibilityStyle';
        document.head.appendChild(styleEl);
    }

    // 숨길 컬럼에 대한 CSS 규칙 생성 (DOM 조작 없이 CSS로 처리)
    let css = '';
    columns.forEach(col => {
        if (visibility[col.field] === false) {
            css += `th[data-column="${col.field}"], td[data-field="${col.field}"] { display: none !important; }\n`;
        }
    });

    styleEl.textContent = css;
}

// 전체 선택
function selectAllColumns() {
    const visibility = {};
    columns.forEach(col => {
        visibility[col.field] = true;
        const checkbox = document.getElementById(`col_${col.field}`);
        if (checkbox) checkbox.checked = true;
    });
    saveColumnVisibility(visibility);
    applyColumnVisibility();
}

// 전체 해제
function deselectAllColumns() {
    const visibility = {};
    columns.forEach(col => {
        visibility[col.field] = false;
        const checkbox = document.getElementById(`col_${col.field}`);
        if (checkbox) checkbox.checked = false;
    });
    saveColumnVisibility(visibility);
    applyColumnVisibility();
}

// 컬럼 순서 초기화
function resetColumnOrder() {
    const defaultOrder = columns.map(col => col.field);
    saveColumnOrder(defaultOrder);
    location.reload();
}

// 테이블 정렬
function sortTable(field) {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr[data-asset-id]'));

    // 정렬 방향 결정
    if (currentSort.field === field) {
        if (currentSort.direction === 'asc') {
            currentSort.direction = 'desc';
        } else if (currentSort.direction === 'desc') {
            currentSort.direction = null;
            currentSort.field = null;
        } else {
            currentSort.direction = 'asc';
        }
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    // 정렬 상태 저장
    saveSortState(currentSort);

    // 헤더 스타일 업데이트
    updateSortHeaders();

    // 정렬이 해제된 경우 원래 순서로 복원 (페이지 새로고침)
    if (!currentSort.direction) {
        location.reload();
        return;
    }

    // 정렬 수행
    rows.sort((a, b) => {
        let aVal, bVal;

        const aCell = a.querySelector(`td[data-field="${field}"]`);
        const bCell = b.querySelector(`td[data-field="${field}"]`);
        aVal = aCell ? aCell.textContent.trim() : '';
        bVal = bCell ? bCell.textContent.trim() : '';

        // 숫자 비교 (중요도점수 등)
        if (field === 'importance_score') {
            aVal = aVal === '' ? -Infinity : parseFloat(aVal);
            bVal = bVal === '' ? -Infinity : parseFloat(bVal);
        }

        // 비교
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else {
            comparison = String(aVal).localeCompare(String(bVal), 'ko');
        }

        return currentSort.direction === 'desc' ? -comparison : comparison;
    });

    // 정렬된 행 다시 추가
    rows.forEach(row => tbody.appendChild(row));
}

// 헤더 정렬 표시 업데이트
function updateSortHeaders() {
    const headers = document.querySelectorAll('th.sortable');
    headers.forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.column === currentSort.field) {
            if (currentSort.direction === 'asc') {
                header.classList.add('sort-asc');
            } else if (currentSort.direction === 'desc') {
                header.classList.add('sort-desc');
            }
        }
    });
}

// 컬럼 이름 가져오기
function getColumnName(field) {
    const col = columns.find(c => c.field === field);
    return col ? col.name : field;
}

// 헤더 드래그 앤 드롭 설정
function setupHeaderDragAndDrop() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const headers = table.querySelectorAll('th.sortable');

    headers.forEach(header => {
        header.setAttribute('draggable', true);

        header.addEventListener('dragstart', function(e) {
            draggedHeader = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.column);
        });

        header.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            draggedHeader = null;

            // 모든 헤더에서 드롭 영역 스타일 제거
            headers.forEach(h => {
                h.classList.remove('drag-over-left', 'drag-over-right');
            });
        });

        header.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (draggedHeader === this) return;

            e.dataTransfer.dropEffect = 'move';

            // 마우스 위치에 따라 왼쪽/오른쪽 표시
            const rect = this.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;

            headers.forEach(h => {
                h.classList.remove('drag-over-left', 'drag-over-right');
            });

            if (e.clientX < midpoint) {
                this.classList.add('drag-over-left');
            } else {
                this.classList.add('drag-over-right');
            }
        });

        header.addEventListener('dragleave', function() {
            this.classList.remove('drag-over-left', 'drag-over-right');
        });

        header.addEventListener('drop', function(e) {
            e.preventDefault();
            if (draggedHeader === this) return;

            this.classList.remove('drag-over-left', 'drag-over-right');

            const draggedField = draggedHeader.dataset.column;
            const targetField = this.dataset.column;
            const draggedName = getColumnName(draggedField);

            // 현재 순서 가져오기
            const order = loadColumnOrder();
            const oldIndex = order.indexOf(draggedField);

            // 드래그된 항목 제거
            const draggedIndex = order.indexOf(draggedField);
            if (draggedIndex > -1) {
                order.splice(draggedIndex, 1);
            }

            // 마우스 위치에 따라 삽입 위치 결정
            const rect = this.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            let targetIndex = order.indexOf(targetField);

            if (e.clientX >= midpoint) {
                targetIndex += 1;
            }

            // 새 위치에 삽입
            order.splice(targetIndex, 0, draggedField);

            // 순서 저장 및 적용
            saveColumnOrder(order);
            applyColumnOrder();

            // 변경 이력 기록
            recordColumnOrderChange(draggedName, oldIndex, targetIndex);

            console.log(`컬럼 순서 변경: ${draggedField} → ${targetIndex + 1}번째로 이동`);
        });
    });
}

// 컬럼 순서 변경 이력 기록
function recordColumnOrderChange(columnName, oldPosition, newPosition) {
    fetch('/assets/record-column-order/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            column_name: columnName,
            old_position: oldPosition,
            new_position: newPosition
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('[컬럼 순서 변경 이력 기록 완료]');
        }
    })
    .catch(error => {
        console.error('컬럼 순서 변경 이력 기록 오류:', error);
    });
}

// 행 드래그 앤 드롭 설정 (최적화: 이벤트 위임 - 2,345개 리스너 → 5개 리스너)
function setupRowDragAndDrop() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // 모든 기존 행에 draggable 속성 설정
    tbody.querySelectorAll('tr[data-asset-id]').forEach(row => {
        row.setAttribute('draggable', true);
    });

    // 이벤트 위임: tbody에 한 번만 리스너 등록
    tbody.addEventListener('dragstart', function(e) {
        const row = e.target.closest('tr[data-asset-id]');
        if (!row) return;

        if (e.target.tagName === 'TD' && e.target.isContentEditable) {
            e.preventDefault();
            return;
        }

        draggedRow = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.assetId);

        const allRows = Array.from(tbody.querySelectorAll('tr[data-asset-id]'));
        row.dataset.startIndex = allRows.indexOf(row);
    });

    tbody.addEventListener('dragend', function(e) {
        const row = e.target.closest('tr[data-asset-id]');
        if (!row) return;

        row.classList.remove('dragging');
        draggedRow = null;

        tbody.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(r => {
            r.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    });

    tbody.addEventListener('dragover', function(e) {
        e.preventDefault();
        const row = e.target.closest('tr[data-asset-id]');
        if (!row || draggedRow === row || !draggedRow) return;

        e.dataTransfer.dropEffect = 'move';

        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        tbody.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(r => {
            r.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        if (e.clientY < midpoint) {
            row.classList.add('drag-over-top');
        } else {
            row.classList.add('drag-over-bottom');
        }
    });

    tbody.addEventListener('dragleave', function(e) {
        const row = e.target.closest('tr[data-asset-id]');
        if (row) {
            row.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    });

    tbody.addEventListener('drop', function(e) {
        e.preventDefault();
        const row = e.target.closest('tr[data-asset-id]');
        if (!row || draggedRow === row || !draggedRow) return;

        row.classList.remove('drag-over-top', 'drag-over-bottom');

        const startIndex = parseInt(draggedRow.dataset.startIndex);

        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
            tbody.insertBefore(draggedRow, row);
        } else {
            tbody.insertBefore(draggedRow, row.nextSibling);
        }

        const newRows = Array.from(tbody.querySelectorAll('tr[data-asset-id]'));
        const newIndex = newRows.indexOf(draggedRow);
        const order = newRows.map(r => parseInt(r.dataset.assetId));

        saveRowOrder(order, draggedRow.dataset.assetId, draggedRow.querySelector('td[data-field="asset_name"]')?.textContent || '', startIndex, newIndex);
    });
}

// 행 순서 저장
function saveRowOrder(order, movedAssetId, movedAssetName, oldPosition, newPosition) {
    fetch('/assets/reorder-assets/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            order: order,
            moved_asset_id: movedAssetId,
            moved_asset_name: movedAssetName,
            old_position: oldPosition,
            new_position: newPosition
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('[행 순서 저장 완료]');
        } else {
            console.error('행 순서 저장 실패:', data.error);
        }
    })
    .catch(error => {
        console.error('행 순서 저장 오류:', error);
    });
}

// ============ 필터링 기능 ============

// 필터 UI 생성
function createFilterUI() {
    // 필터 컨테이너가 이미 존재하면 스킵
    if (document.getElementById('filterContainer')) return;

    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    // 필터 버튼 추가
    const toolbarLeft = toolbar.querySelector('.toolbar-left');
    if (toolbarLeft) {
        const filterBtn = document.createElement('button');
        filterBtn.type = 'button';
        filterBtn.className = 'btn';
        filterBtn.id = 'filterToggleBtn';
        filterBtn.textContent = '필터 ▼';
        filterBtn.addEventListener('click', toggleFilterPanel);
        toolbarLeft.appendChild(filterBtn);
    }

    // 필터 패널 생성
    const filterContainer = document.createElement('div');
    filterContainer.id = 'filterContainer';
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
        <div class="filter-header">
            <h3>다중 필터</h3>
            <button type="button" class="btn btn-filter btn-clear-filter" onclick="clearAllFilters()">모두 초기화</button>
        </div>
        <div class="filter-rows" id="filterRows">
        </div>
        <div class="filter-actions">
            <button type="button" class="btn btn-filter btn-add-filter" onclick="addFilterRow()">+ 필터 추가</button>
            <button type="button" class="btn btn-primary btn-filter" onclick="applyFilters()">필터 적용</button>
        </div>
    `;

    // 툴바 다음에 삽입
    toolbar.parentNode.insertBefore(filterContainer, toolbar.nextSibling);

    // 활성 필터 태그 영역 생성
    const activeFilters = document.createElement('div');
    activeFilters.id = 'activeFilters';
    activeFilters.className = 'active-filters';
    filterContainer.parentNode.insertBefore(activeFilters, filterContainer.nextSibling);

    // 저장된 필터 복원
    currentFilters = loadFilterState();
    if (currentFilters.length > 0) {
        currentFilters.forEach((filter, index) => {
            addFilterRow(filter);
        });
        applyFilters();
    }
}

// 필터 패널 토글
function toggleFilterPanel() {
    const container = document.getElementById('filterContainer');
    if (container) {
        container.classList.toggle('show');
        const btn = document.getElementById('filterToggleBtn');
        if (btn) {
            btn.textContent = container.classList.contains('show') ? '필터 ▲' : '필터 ▼';
        }
    }
}

// 필터 행 추가
function addFilterRow(existingFilter = null) {
    const filterRows = document.getElementById('filterRows');
    if (!filterRows) return;

    const rowIndex = filterRows.children.length;
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.dataset.index = rowIndex;

    // AND/OR 선택 (첫 번째 행이 아닌 경우)
    let logicSelect = '';
    if (rowIndex > 0) {
        logicSelect = `
            <select class="filter-logic" name="logic_${rowIndex}">
                <option value="AND" ${existingFilter?.logic === 'AND' ? 'selected' : ''}>AND</option>
                <option value="OR" ${existingFilter?.logic === 'OR' ? 'selected' : ''}>OR</option>
            </select>
        `;
    }

    // 컬럼 선택 옵션 생성
    const columnOptions = columns.map(col =>
        `<option value="${col.field}" ${existingFilter?.field === col.field ? 'selected' : ''}>${col.name}</option>`
    ).join('');

    // 연산자 선택
    const operatorOptions = `
        <option value="contains" ${existingFilter?.operator === 'contains' ? 'selected' : ''}>포함</option>
        <option value="not_contains" ${existingFilter?.operator === 'not_contains' ? 'selected' : ''}>포함하지 않음</option>
        <option value="equals" ${existingFilter?.operator === 'equals' ? 'selected' : ''}>같음</option>
        <option value="not_equals" ${existingFilter?.operator === 'not_equals' ? 'selected' : ''}>같지 않음</option>
        <option value="starts_with" ${existingFilter?.operator === 'starts_with' ? 'selected' : ''}>시작함</option>
        <option value="ends_with" ${existingFilter?.operator === 'ends_with' ? 'selected' : ''}>끝남</option>
        <option value="empty" ${existingFilter?.operator === 'empty' ? 'selected' : ''}>비어있음</option>
        <option value="not_empty" ${existingFilter?.operator === 'not_empty' ? 'selected' : ''}>비어있지 않음</option>
    `;

    row.innerHTML = `
        ${logicSelect}
        <select class="filter-column" name="column_${rowIndex}">
            ${columnOptions}
        </select>
        <select class="filter-operator" name="operator_${rowIndex}">
            ${operatorOptions}
        </select>
        <input type="text" class="filter-value" name="value_${rowIndex}" placeholder="검색값" value="${existingFilter?.value || ''}">
        <button type="button" class="btn-remove-filter" onclick="removeFilterRow(this)">✕</button>
    `;

    filterRows.appendChild(row);

    // 연산자 변경 시 입력란 표시/숨김
    const operatorSelect = row.querySelector('.filter-operator');
    const valueInput = row.querySelector('.filter-value');

    operatorSelect.addEventListener('change', function() {
        if (this.value === 'empty' || this.value === 'not_empty') {
            valueInput.style.display = 'none';
            valueInput.value = '';
        } else {
            valueInput.style.display = '';
        }
    });

    // 기존 필터의 연산자에 따라 초기 상태 설정
    if (existingFilter && (existingFilter.operator === 'empty' || existingFilter.operator === 'not_empty')) {
        valueInput.style.display = 'none';
    }
}

// 필터 행 제거
function removeFilterRow(button) {
    const row = button.closest('.filter-row');
    if (row) {
        row.remove();
        // 인덱스 재정렬
        const rows = document.querySelectorAll('.filter-row');
        rows.forEach((r, index) => {
            r.dataset.index = index;
            // 첫 번째 행의 AND/OR 제거
            if (index === 0) {
                const logic = r.querySelector('.filter-logic');
                if (logic) logic.remove();
            }
        });
    }
}

// 필터 적용
function applyFilters() {
    const filterRows = document.querySelectorAll('.filter-row');
    currentFilters = [];

    filterRows.forEach((row, index) => {
        const logic = index > 0 ? row.querySelector('.filter-logic')?.value || 'AND' : null;
        const field = row.querySelector('.filter-column')?.value;
        const operator = row.querySelector('.filter-operator')?.value;
        const value = row.querySelector('.filter-value')?.value || '';

        if (field && operator) {
            currentFilters.push({ logic, field, operator, value });
        }
    });

    // 필터 상태 저장
    saveFilterState(currentFilters);

    // 테이블 필터링 적용
    filterTable();

    // 활성 필터 태그 업데이트
    updateActiveFilterTags();
}

// 테이블 필터링
function filterTable() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr[data-asset-id]');

    if (currentFilters.length === 0) {
        // 필터가 없으면 모든 행 표시
        rows.forEach(row => {
            row.style.display = '';
        });
        return;
    }

    rows.forEach(row => {
        let showRow = evaluateFilters(row);
        row.style.display = showRow ? '' : 'none';
    });

    // 표시된 행 수 업데이트
    updateRowCount();
}

// 필터 조건 평가
function evaluateFilters(row) {
    if (currentFilters.length === 0) return true;

    let result = null;

    currentFilters.forEach((filter, index) => {
        const cell = row.querySelector(`td[data-field="${filter.field}"]`);
        const cellValue = cell ? cell.textContent.trim().toLowerCase() : '';
        const filterValue = filter.value.toLowerCase();

        let matches = false;

        switch (filter.operator) {
            case 'contains':
                matches = cellValue.includes(filterValue);
                break;
            case 'not_contains':
                matches = !cellValue.includes(filterValue);
                break;
            case 'equals':
                matches = cellValue === filterValue;
                break;
            case 'not_equals':
                matches = cellValue !== filterValue;
                break;
            case 'starts_with':
                matches = cellValue.startsWith(filterValue);
                break;
            case 'ends_with':
                matches = cellValue.endsWith(filterValue);
                break;
            case 'empty':
                matches = cellValue === '';
                break;
            case 'not_empty':
                matches = cellValue !== '';
                break;
        }

        if (index === 0) {
            result = matches;
        } else {
            if (filter.logic === 'AND') {
                result = result && matches;
            } else {
                result = result || matches;
            }
        }
    });

    return result;
}

// 활성 필터 태그 업데이트
function updateActiveFilterTags() {
    const container = document.getElementById('activeFilters');
    if (!container) return;

    container.innerHTML = '';

    if (currentFilters.length === 0) return;

    currentFilters.forEach((filter, index) => {
        const col = columns.find(c => c.field === filter.field);
        const columnName = col ? col.name : filter.field;

        const operatorNames = {
            'contains': '포함',
            'not_contains': '미포함',
            'equals': '=',
            'not_equals': '≠',
            'starts_with': '시작',
            'ends_with': '끝',
            'empty': '비어있음',
            'not_empty': '값있음'
        };

        const tag = document.createElement('span');
        tag.className = 'filter-tag';

        let text = '';
        if (index > 0 && filter.logic) {
            text += `${filter.logic} `;
        }
        text += `${columnName} ${operatorNames[filter.operator] || filter.operator}`;
        if (filter.value) {
            text += ` "${filter.value}"`;
        }

        tag.innerHTML = `${text} <span class="remove-tag" onclick="removeFilter(${index})">✕</span>`;
        container.appendChild(tag);
    });
}

// 특정 필터 제거
function removeFilter(index) {
    currentFilters.splice(index, 1);
    saveFilterState(currentFilters);

    // UI 업데이트
    const filterRows = document.getElementById('filterRows');
    if (filterRows) {
        filterRows.innerHTML = '';
        currentFilters.forEach(filter => addFilterRow(filter));
    }

    filterTable();
    updateActiveFilterTags();
}

// 모든 필터 초기화
function clearAllFilters() {
    currentFilters = [];
    saveFilterState(currentFilters);

    const filterRows = document.getElementById('filterRows');
    if (filterRows) {
        filterRows.innerHTML = '';
    }

    filterTable();
    updateActiveFilterTags();
}

// 행 수 업데이트
function updateRowCount() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const visibleRows = table.querySelectorAll('tbody tr[data-asset-id]:not([style*="display: none"])');
    const totalRows = table.querySelectorAll('tbody tr[data-asset-id]');

    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
        const countSpan = statusBar.querySelector('span:last-child');
        if (countSpan) {
            if (currentFilters.length > 0) {
                countSpan.textContent = `${visibleRows.length}개 표시 (총 ${totalRows.length}개 중)`;
            } else {
                countSpan.textContent = `총 ${totalRows.length}개 자산`;
            }
        }
    }
}

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    const _t0 = performance.now();

    console.time('[성능] 전체 초기화');

    console.time('[성능] applyColumnOrder');
    applyColumnOrder();
    console.timeEnd('[성능] applyColumnOrder');

    console.time('[성능] createColumnDropdown');
    createColumnDropdown();
    console.timeEnd('[성능] createColumnDropdown');

    console.time('[성능] applyColumnVisibility');
    applyColumnVisibility();
    console.timeEnd('[성능] applyColumnVisibility');

    console.time('[성능] setupHeaderDragAndDrop');
    setupHeaderDragAndDrop();
    console.timeEnd('[성능] setupHeaderDragAndDrop');

    console.time('[성능] setupRowDragAndDrop');
    setupRowDragAndDrop();
    console.timeEnd('[성능] setupRowDragAndDrop');

    console.time('[성능] createFilterUI');
    createFilterUI();
    console.timeEnd('[성능] createFilterUI');

    // 저장된 정렬 상태 로드 및 적용
    currentSort = loadSortState();
    if (currentSort.field && currentSort.direction) {
        console.time('[성능] sortTable (복원)');
        updateSortHeaders();
        const tempDirection = currentSort.direction;
        currentSort.direction = tempDirection === 'asc' ? null : 'asc';
        sortTable(currentSort.field);
        console.timeEnd('[성능] sortTable (복원)');
    }

    // 드롭다운 토글
    const toggleBtn = document.getElementById('columnToggleBtn');
    const dropdown = document.getElementById('columnDropdown');

    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== toggleBtn) {
                dropdown.classList.remove('show');
            }
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    const selectAllBtn = document.getElementById('selectAllColumns');
    const deselectAllBtn = document.getElementById('deselectAllColumns');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllColumns);
    }
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', deselectAllColumns);
    }

    // 정렬 헤더 클릭 이벤트 (드래그가 아닌 클릭만)
    const sortableHeaders = document.querySelectorAll('th.sortable');
    sortableHeaders.forEach(header => {
        let mouseDownTime = 0;

        header.addEventListener('mousedown', () => {
            mouseDownTime = Date.now();
        });

        header.addEventListener('click', (e) => {
            if (Date.now() - mouseDownTime < 200) {
                sortTable(header.dataset.column);
            }
        });
    });

    console.time('[성능] updateRowNumbers');
    updateRowNumbers();
    console.timeEnd('[성능] updateRowNumbers');

    console.time('[성능] setupColumnSelection');
    setupColumnSelection();
    console.timeEnd('[성능] setupColumnSelection');

    console.time('[성능] createContextMenu');
    createContextMenu();
    console.timeEnd('[성능] createContextMenu');

    console.timeEnd('[성능] 전체 초기화');
    console.log(`[성능] 전체 초기화 완료: ${(performance.now() - _t0).toFixed(1)}ms`);

    // 페이지 이탈 시 현재 행 순서를 서버에 저장
    let orderDirty = false;
    window._markOrderDirty = function() { orderDirty = true; };

    window.addEventListener('beforeunload', function() {
        if (!orderDirty) return;
        const rows = document.querySelectorAll('#assetTable tbody tr[data-asset-id]');
        const order = Array.from(rows).map(r => parseInt(r.dataset.assetId)).filter(id => !isNaN(id));
        if (order.length === 0) return;
        navigator.sendBeacon('/assets/reorder-assets/',
            new Blob([JSON.stringify({ order: order })], { type: 'application/json' })
        );
    });
});

// ============ 행 번호 기능 ============

// 행 번호 업데이트
function updateRowNumbers() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr[data-asset-id]');
    rows.forEach((row, index) => {
        const numberCell = row.querySelector('.row-number-cell');
        if (numberCell) {
            numberCell.textContent = index + 1;
        }
    });
}

// ============ 열/행 선택 및 복사/붙여넣기 기능 ============

// 선택된 열 정보
let selectedColumn = null;
let copiedColumnData = null;
let menuSelectedColumn = null; // 컨텍스트 메뉴용 선택 정보

// 선택된 행 정보
let selectedRow = null;
let copiedRowData = null;
let menuSelectedRow = null; // 컨텍스트 메뉴용 선택 정보

// 열 선택 설정 (최적화: 이벤트 위임 - 938개 리스너 → 테이블 레벨 위임)
function setupColumnSelection() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    // 헤더 이벤트 위임: thead에 한 번만 등록
    const thead = table.querySelector('thead');
    if (thead) {
        thead.addEventListener('click', function(e) {
            const header = e.target.closest('th');
            if (!header) return;

            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                selectColumn(header.dataset.column || header.dataset.field);
            }
        });

        thead.addEventListener('contextmenu', function(e) {
            const header = e.target.closest('th');
            if (!header) return;

            e.preventDefault();
            const field = header.dataset.column || header.dataset.field;
            if (field && field !== 'row_number') {
                selectColumn(field);
                showContextMenu(e.clientX, e.clientY, 'column');
            }
        });
    }

    // 행 번호 셀 이벤트 위임: tbody에 한 번만 등록
    const tbody = table.querySelector('tbody');
    if (tbody) {
        tbody.addEventListener('click', function(e) {
            const cell = e.target.closest('.row-number-cell');
            if (!cell) return;

            const row = cell.closest('tr');
            selectRow(row);
        });

        tbody.addEventListener('contextmenu', function(e) {
            const cell = e.target.closest('.row-number-cell');
            if (!cell) return;

            e.preventDefault();
            const row = cell.closest('tr');
            selectRow(row);
            showContextMenu(e.clientX, e.clientY, 'row');
        });
    }

    // 문서 클릭 시 선택 해제
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.asset-table') && !e.target.closest('.context-menu')) {
            clearSelection();
            hideContextMenu();
        }
    });

    // 키보드 단축키
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (document.activeElement.isContentEditable) return;
            if (selectedRow) {
                e.preventDefault();
                copyRow();
            } else if (selectedColumn) {
                e.preventDefault();
                copyColumn();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (document.activeElement.isContentEditable) return;
            if (copiedRowData) {
                e.preventDefault();
                pasteRow();
            } else if (selectedColumn) {
                e.preventDefault();
                pasteColumn();
            }
        }
        if (e.key === 'Escape') {
            clearSelection();
            hideContextMenu();
        }
    });
}

// 열 선택
function selectColumn(field) {
    if (!field || field === 'row_number') return;

    clearSelection();
    selectedColumn = field;

    const table = document.getElementById('assetTable');
    if (!table) return;

    // 헤더 강조
    const header = table.querySelector(`th[data-column="${field}"]`);
    if (header) {
        header.classList.add('col-selected');
    }

    // 해당 열의 모든 셀 강조
    const cells = table.querySelectorAll(`td[data-field="${field}"]`);
    cells.forEach(cell => {
        cell.classList.add('col-selected');
    });
}

// 행 선택
function selectRow(row) {
    if (!row) return;

    // 열 선택 해제
    selectedColumn = null;
    const selectedCols = document.querySelectorAll('.col-selected');
    selectedCols.forEach(el => {
        el.classList.remove('col-selected');
    });

    // 이전 행 선택 해제
    const prevSelected = document.querySelectorAll('.row-selected, .row-number-cell.selected');
    prevSelected.forEach(el => {
        el.classList.remove('row-selected', 'selected');
    });

    // 새 행 선택
    selectedRow = row;
    row.classList.add('row-selected');
    const numberCell = row.querySelector('.row-number-cell');
    if (numberCell) {
        numberCell.classList.add('selected');
    }
}

// 선택 해제
function clearSelection() {
    selectedColumn = null;
    selectedRow = null;

    const table = document.getElementById('assetTable');
    if (!table) return;

    // 열 선택 해제
    const selectedCols = table.querySelectorAll('.col-selected');
    selectedCols.forEach(el => {
        el.classList.remove('col-selected');
    });

    // 행 선택 해제
    const selectedRows = table.querySelectorAll('.row-selected, .row-number-cell.selected');
    selectedRows.forEach(el => {
        el.classList.remove('row-selected', 'selected');
    });
}

// 열 복사
function copyColumn() {
    if (!selectedColumn) return;

    const table = document.getElementById('assetTable');
    if (!table) return;

    const cells = table.querySelectorAll(`tbody td[data-field="${selectedColumn}"]`);
    copiedColumnData = {
        field: selectedColumn,
        values: Array.from(cells).map(cell => cell.textContent.trim())
    };

    // 클립보드에도 복사 (탭으로 구분된 텍스트)
    const textData = copiedColumnData.values.join('\n');
    navigator.clipboard.writeText(textData).then(() => {
        showNotification(`${getColumnName(selectedColumn)} 열이 복사되었습니다. (${copiedColumnData.values.length}개 값)`);
    }).catch(err => {
        console.log('클립보드 복사 실패:', err);
        showNotification(`${getColumnName(selectedColumn)} 열이 복사되었습니다.`);
    });
}

// 행 붙여넣기 (내부 복사 데이터 사용)
function pasteColumn() {
    // menuSelectedColumn 또는 selectedColumn 사용 (컨텍스트 메뉴 클릭 시 selectedColumn이 초기화될 수 있음)
    const targetColumn = menuSelectedColumn || selectedColumn;

    if (!targetColumn) {
        showNotification('먼저 열을 선택하세요. (헤더 우클릭 또는 Ctrl+클릭)');
        return;
    }

    // 읽기 전용 필드 체크
    if (targetColumn === 'last_modified_date' || targetColumn === 'row_number') {
        showNotification('이 열은 수정할 수 없습니다.');
        return;
    }

    // 클립보드에서 먼저 읽어보기
    navigator.clipboard.readText().then(clipboardText => {
        if (clipboardText) {
            // 클립보드 데이터를 줄 단위로 분리
            const values = clipboardText.split('\n').map(v => v.trim()).filter(v => v !== '');
            if (values.length > 0) {
                pasteValues(values, targetColumn);
                return;
            }
        }
        // 클립보드가 비어있으면 내부 복사 데이터 사용
        if (copiedColumnData && copiedColumnData.values.length > 0) {
            pasteValues(copiedColumnData.values, targetColumn);
        } else {
            showNotification('붙여넣을 데이터가 없습니다. 먼저 복사하세요.');
        }
    }).catch(err => {
        console.log('클립보드 읽기 실패, 내부 데이터 사용:', err);
        // 클립보드 접근 실패 시 내부 복사 데이터 사용
        if (copiedColumnData && copiedColumnData.values.length > 0) {
            pasteValues(copiedColumnData.values, targetColumn);
        } else {
            showNotification('붙여넣을 데이터가 없습니다. 먼저 복사하세요.');
        }
    });
}

// 실제 값 붙여넣기 실행
function pasteValues(values, targetColumn) {
    const table = document.getElementById('assetTable');
    if (!table) return;

    const targetCells = table.querySelectorAll(`tbody td[data-field="${targetColumn}"]`);
    const isCustomField = targetCells[0]?.dataset.custom === 'true';

    let pastedCount = 0;

    // 값 붙여넣기
    targetCells.forEach((cell, index) => {
        if (index < values.length) {
            const oldValue = cell.textContent.trim();
            const newValue = values[index];

            if (oldValue !== newValue) {
                cell.textContent = newValue;
                cell.classList.add('changed');

                // 서버에 저장
                const row = cell.closest('tr');
                const assetId = row.dataset.assetId;

                if (isCustomField) {
                    saveCustomFieldValue(assetId, targetColumn, newValue);
                } else {
                    sendUpdate(assetId, targetColumn, newValue);
                }

                setTimeout(() => {
                    cell.classList.remove('changed');
                }, 3000);

                pastedCount++;
            }
        }
    });

    showNotification(`${getColumnName(targetColumn)} 열에 ${pastedCount}개 값 붙여넣기 완료`);
}

// ============ 행 복사/붙여넣기 기능 ============

// 행 복사
function copyRow() {
    const targetRow = menuSelectedRow || selectedRow;
    if (!targetRow) {
        showNotification('먼저 행을 선택하세요. (행 번호 클릭)');
        return;
    }

    const assetId = targetRow.dataset.assetId;
    if (!assetId) return;

    // 모든 셀 데이터 수집
    const cells = targetRow.querySelectorAll('td[data-field]');
    const rowData = {};

    cells.forEach(cell => {
        const field = cell.dataset.field;
        if (field && field !== 'row_number' && field !== 'last_modified_date') {
            rowData[field] = {
                value: cell.textContent.trim(),
                isCustom: cell.dataset.custom === 'true'
            };
        }
    });

    copiedRowData = {
        assetId: assetId,
        data: rowData
    };

    // 행 번호 찾기
    const rowNumber = targetRow.querySelector('.row-number-cell')?.textContent || '';
    showNotification(`${rowNumber}번 행이 복사되었습니다.`);
}

// 행 삭제 (우클릭 메뉴 -> 열 삭제)
function deleteSelectedRow() {
    const targetRow = menuSelectedRow || selectedRow;
    if (!targetRow) {
        showNotification('삭제할 열을 선택하세요.');
        return;
    }

    const assetId = targetRow.dataset.assetId;
    if (!confirm('이 열을 삭제하시겠습니까?')) return;

    const _opStart = performance.now();
    // 즉시 DOM에서 제거 (낙관적 UI)
    const parentNode = targetRow.parentNode;
    const nextSibling = targetRow.nextSibling;
    targetRow.remove();
    updateRowNumbers();
    clearSelection();
    console.log(`[성능] 열 삭제 DOM 작업: ${(performance.now() - _opStart).toFixed(1)}ms`);
    showNotification('열이 삭제되었습니다.');
    if (window._markOrderDirty) window._markOrderDirty();

    // 서버에 백그라운드로 요청
    const _fetchStart = performance.now();
    fetch('/assets/delete-asset/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ asset_id: assetId })
    })
    .then(response => response.json())
    .then(data => {
        console.log(`[성능] 열 삭제 서버 응답: ${(performance.now() - _fetchStart).toFixed(1)}ms`);
        if (!data.success) {
            parentNode.insertBefore(targetRow, nextSibling);
            updateRowNumbers();
            showNotification('삭제 실패: ' + (data.error || '알 수 없는 오류'));
        }
    })
    .catch(error => {
        // 오류 시 행 복원
        parentNode.insertBefore(targetRow, nextSibling);
        updateRowNumbers();
        showNotification('삭제 중 오류가 발생했습니다.');
    });
}

// 빈 행 생성 (우클릭 메뉴 -> 새 열 추가)
function createNewEmptyRow() {
    const _opStart = performance.now();
    const targetRow = menuSelectedRow || selectedRow;
    let insertAfterAssetId = null;
    let insertAfterRow = null;

    if (targetRow) {
        insertAfterAssetId = targetRow.dataset.assetId;
        insertAfterRow = targetRow;
    } else {
        const tbody = document.querySelector('#assetTable tbody');
        const lastRow = tbody ? tbody.querySelector('tr:last-child') : null;
        if (lastRow && lastRow.dataset.assetId) {
            insertAfterAssetId = lastRow.dataset.assetId;
            insertAfterRow = lastRow;
        }
    }

    // 즉시 DOM에 빈 행 삽입 (낙관적 UI)
    const tempId = 'temp_' + Date.now();
    const newRow = insertEmptyRow(insertAfterRow, { new_asset_id: tempId });
    console.log(`[성능] 새 열 추가 DOM 작업: ${(performance.now() - _opStart).toFixed(1)}ms`);
    showNotification('새 열이 추가되었습니다.');
    if (window._markOrderDirty) window._markOrderDirty();

    // 서버에 백그라운드로 요청
    const _fetchStart = performance.now();
    fetch('/assets/create-empty-asset/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            insert_after_asset_id: insertAfterAssetId
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(`[성능] 새 열 추가 서버 응답: ${(performance.now() - _fetchStart).toFixed(1)}ms`);
        if (data.success) {
            newRow.dataset.assetId = data.new_asset_id;
        } else {
            newRow.remove();
            updateRowNumbers();
            showNotification('열 추가 실패: ' + (data.error || '알 수 없는 오류'));
        }
    })
    .catch(() => {
        newRow.remove();
        updateRowNumbers();
        showNotification('열 추가 중 오류가 발생했습니다.');
    });
}

// 빈 행을 테이블에 동적으로 추가 (행 요소 반환)
function insertEmptyRow(afterRow, data) {
    const tbody = document.querySelector('#assetTable tbody');
    if (!tbody) return null;

    const newRow = document.createElement('tr');
    newRow.dataset.assetId = data.new_asset_id;

    // 테이블 헤더에서 컬럼 목록 가져오기
    const headers = document.querySelectorAll('#assetTable thead th');
    headers.forEach(th => {
        const field = th.dataset.field || th.dataset.column;
        const td = document.createElement('td');

        if (th.classList.contains('row-number-header')) {
            td.className = 'row-number-cell';
            td.dataset.field = 'row_number';
            td.textContent = '0'; // updateRowNumbers에서 갱신됨
        } else if (field === 'last_modified_date') {
            td.dataset.field = field;
            td.textContent = '';
        } else if (th.dataset.custom === 'true') {
            td.contentEditable = 'true';
            td.dataset.field = field;
            td.dataset.custom = 'true';
            td.dataset.fieldType = th.dataset.fieldType || '';
            td.textContent = '';
        } else if (field) {
            td.contentEditable = 'true';
            td.dataset.field = field;
            td.textContent = '';
        }

        newRow.appendChild(td);
    });

    // 새 행에 하이라이트 효과
    newRow.classList.add('new-row-highlight');

    // 행 삽입
    if (afterRow) {
        afterRow.parentNode.insertBefore(newRow, afterRow.nextSibling);
    } else {
        tbody.appendChild(newRow);
    }

    // 행 번호 업데이트
    updateRowNumbers();

    // 새 행에 이벤트 리스너 추가
    setupNewRowEvents(newRow);

    // 하이라이트 효과 제거
    setTimeout(() => {
        newRow.classList.remove('new-row-highlight');
    }, 2000);

    return newRow;
}

// 행 붙여넣기 (새 행 생성)
function pasteRow() {
    if (!copiedRowData) {
        showNotification('먼저 행을 복사하세요. (행 번호 클릭 후 Ctrl+C)');
        return;
    }

    // 삽입 위치 결정 (선택된 행 아래 또는 복사한 행 아래)
    const targetRow = menuSelectedRow || selectedRow;
    let insertAfterAssetId = null;
    let insertAfterRow = null;

    if (targetRow) {
        insertAfterAssetId = targetRow.dataset.assetId;
        insertAfterRow = targetRow;
    } else {
        insertAfterAssetId = copiedRowData.assetId;
        insertAfterRow = document.querySelector(`tr[data-asset-id="${copiedRowData.assetId}"]`);
    }

    // 즉시 DOM에 복사 행 삽입 (낙관적 UI)
    const _opStart = performance.now();
    const tempId = 'temp_' + Date.now();
    const newRow = insertNewRow(insertAfterRow, { new_asset_id: tempId, server_code: '' });
    console.log(`[성능] 붙여넣기 DOM 작업: ${(performance.now() - _opStart).toFixed(1)}ms`);
    showNotification('붙여넣기 완료');
    if (window._markOrderDirty) window._markOrderDirty();

    // 서버에 백그라운드로 요청
    const _fetchStart = performance.now();
    fetch('/assets/copy-asset/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            source_asset_id: copiedRowData.assetId,
            insert_after_asset_id: insertAfterAssetId,
            row_data: copiedRowData.data
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(`[성능] 붙여넣기 서버 응답: ${(performance.now() - _fetchStart).toFixed(1)}ms`);
        if (data.success) {
            if (newRow) newRow.dataset.assetId = data.new_asset_id;
        } else {
            if (newRow) { newRow.remove(); updateRowNumbers(); }
            showNotification('붙여넣기 실패: ' + (data.error || '알 수 없는 오류'));
        }
    })
    .catch(() => {
        if (newRow) { newRow.remove(); updateRowNumbers(); }
        showNotification('붙여넣기 중 오류가 발생했습니다.');
    });
}

// 새 행을 테이블에 동적으로 추가 (행 요소 반환) - 원본 그대로 복제
function insertNewRow(afterRow, data) {
    if (!afterRow) return null;

    const newRow = afterRow.cloneNode(true);
    newRow.dataset.assetId = data.new_asset_id;

    // 선택 상태만 초기화
    newRow.classList.remove('row-selected');
    const numberCell = newRow.querySelector('.row-number-cell');
    if (numberCell) numberCell.classList.remove('selected');

    newRow.classList.add('new-row-highlight');
    afterRow.parentNode.insertBefore(newRow, afterRow.nextSibling);
    updateRowNumbers();
    setupNewRowEvents(newRow);

    setTimeout(() => { newRow.classList.remove('new-row-highlight'); }, 2000);

    return newRow;
}

// 새 행에 이벤트 리스너 설정 (이벤트 위임으로 대부분 불필요 → draggable만 설정)
function setupNewRowEvents(row) {
    row.setAttribute('draggable', true);
}

// 컨텍스트 메뉴 생성
function createContextMenu() {
    // 이미 존재하면 스킵
    if (document.getElementById('contextMenu')) return;

    const menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item" data-action="copy">
            <span>복사</span>
            <span class="shortcut">Ctrl+C</span>
        </div>
        <div class="context-menu-item" data-action="paste">
            <span>붙여넣기</span>
            <span class="shortcut">Ctrl+V</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="addRow">
            <span>새 열 추가</span>
            <span class="shortcut">+</span>
        </div>
        <div class="context-menu-item context-menu-item-danger" data-action="deleteRow">
            <span>열 삭제</span>
            <span class="shortcut">Del</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="clear">
            <span>선택 해제</span>
            <span class="shortcut">Esc</span>
        </div>
    `;

    document.body.appendChild(menu);

    // 메뉴 항목 클릭 이벤트
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation(); // 이벤트 전파 방지
            const action = this.dataset.action;
            const menuType = menu.dataset.menuType;

            switch (action) {
                case 'copy':
                    if (menuType === 'row') {
                        copyRow();
                    } else {
                        copyColumn();
                    }
                    break;
                case 'paste':
                    if (menuType === 'row' || copiedRowData) {
                        pasteRow();
                    } else {
                        pasteColumn();
                    }
                    break;
                case 'addRow':
                    createNewEmptyRow();
                    break;
                case 'deleteRow':
                    deleteSelectedRow();
                    break;
                case 'clear':
                    clearSelection();
                    break;
            }
            hideContextMenu();
        });
    });
}

// 컨텍스트 메뉴 표시
function showContextMenu(x, y, type) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    // 메뉴 타입 저장 (row 또는 column)
    menu.dataset.menuType = type;

    // 현재 선택된 열/행 정보를 메뉴용으로 저장
    menuSelectedColumn = selectedColumn;
    menuSelectedRow = selectedRow;

    // 붙여넣기 항상 활성화 (클립보드에서 읽어올 수 있으므로)
    const pasteItem = menu.querySelector('[data-action="paste"]');
    if (pasteItem) {
        pasteItem.style.opacity = '1';
        pasteItem.style.pointerEvents = 'auto';
    }

    // 화면 경계 체크
    const menuWidth = 150;
    const menuHeight = 150;

    if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');
}

// 컨텍스트 메뉴 숨기기
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.classList.remove('show');
    }
}

// 알림 표시
function showNotification(message) {
    // 기존 알림 제거
    const existing = document.querySelector('.copy-notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #2c3e50;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 1001;
        animation: fadeInOut 2s ease-in-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    }
`;
document.head.appendChild(style);
