// 실시간 동기화 WebSocket 클라이언트
let socket = null;
const debounceTimers = new Map(); // 디바운스 타이머
const pendingChanges = new Map(); // 저장 대기 중인 변경사항
const DEBOUNCE_DELAY = 2000; // 2초 디바운스
const otherUsersCells = new Map(); // 다른 사용자가 편집 중인 셀 추적

// 사용자별 색상 (최대 10명)
const userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

// WebSocket 연결
function connectWebSocket() {
    socket = new WebSocket(wsUrl);

    socket.onopen = function() {
        console.log('WebSocket 연결 성공');
        updateSyncStatus('연결됨', 'success');

        // 서버에 접속 알림
        socket.send(JSON.stringify({
            action: 'join',
            user_id: userId,
            username: username
        }));
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.type === 'update') {
            updateCellFromServer(data.asset_id, data.field_name, data.field_value);
        } else if (data.type === 'user_join') {
            updateConnectedUsers(data.users);
            if (data.user_id !== userId) {
                console.log(`${data.username}님이 접속했습니다.`);
            }
        } else if (data.type === 'user_leave') {
            updateConnectedUsers(data.users);
            clearUserFocus(data.user_id);
            // 퇴장 알림 비활성화
        } else if (data.type === 'user_focus') {
            if (data.user_id !== userId) {
                showUserFocus(data.user_id, data.username, data.asset_id, data.field_name);
            }
        } else if (data.type === 'user_blur') {
            if (data.user_id !== userId) {
                clearUserFocus(data.user_id);
            }
        } else if (data.type === 'error') {
            console.error('서버 오류:', data.message);
        }
    };

    socket.onclose = function() {
        console.log('WebSocket 연결 종료');
        updateSyncStatus('연결 끊김', 'error');
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket 오류:', error);
        updateSyncStatus('오류 발생', 'error');
    };
}

// 동기화 상태 업데이트
function updateSyncStatus(message, status) {
    const statusElement = document.getElementById('syncStatus');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status-' + status;
    }
}

// 접속자 목록 업데이트 (나를 제외한 다른 사용자만 표시)
function updateConnectedUsers(users) {
    const container = document.getElementById('connectedUsers');
    if (!container) return;

    container.innerHTML = '';

    // 나를 제외한 다른 사용자만 필터링
    const otherUsers = users.filter(user => user.user_id !== userId);

    if (otherUsers.length === 0) {
        const noUsers = document.createElement('span');
        noUsers.className = 'no-users';
        noUsers.textContent = '없음';
        container.appendChild(noUsers);
    } else {
        otherUsers.forEach((user, index) => {
            const userBadge = document.createElement('span');
            userBadge.className = 'user-badge';
            userBadge.style.backgroundColor = userColors[index % userColors.length];
            userBadge.textContent = user.username;
            userBadge.dataset.userId = user.user_id;
            container.appendChild(userBadge);
        });
    }
}

// 다른 사용자의 편집 위치 표시
function showUserFocus(otherUserId, otherUsername, assetId, fieldName) {
    // 이전 포커스 제거
    clearUserFocus(otherUserId);

    const row = document.querySelector(`tr[data-asset-id="${assetId}"]`);
    if (row) {
        const cell = row.querySelector(`td[data-field="${fieldName}"]`);
        if (cell) {
            // 사용자별 색상 가져오기
            const userBadges = document.querySelectorAll('.user-badge');
            let colorIndex = 0;
            userBadges.forEach((badge, index) => {
                if (parseInt(badge.dataset.userId) === otherUserId) {
                    colorIndex = index;
                }
            });

            const color = userColors[colorIndex % userColors.length];

            // 셀에 편집 중 표시
            cell.classList.add('editing-by-other');
            cell.style.boxShadow = `inset 0 0 0 2px ${color}`;
            cell.dataset.editingUser = otherUsername;

            // 사용자 이름 라벨 추가
            const label = document.createElement('div');
            label.className = 'editing-user-label';
            label.textContent = otherUsername;
            label.style.backgroundColor = color;
            label.dataset.forUser = otherUserId;
            cell.appendChild(label);

            // 추적 맵에 저장
            otherUsersCells.set(otherUserId, { assetId, fieldName, cell });
        }
    }
}

// 다른 사용자의 포커스 제거
function clearUserFocus(otherUserId) {
    const cellInfo = otherUsersCells.get(otherUserId);
    if (cellInfo && cellInfo.cell) {
        cellInfo.cell.classList.remove('editing-by-other');
        cellInfo.cell.style.boxShadow = '';
        delete cellInfo.cell.dataset.editingUser;

        // 라벨 제거
        const label = cellInfo.cell.querySelector(`.editing-user-label[data-for-user="${otherUserId}"]`);
        if (label) {
            label.remove();
        }
    }
    otherUsersCells.delete(otherUserId);
}

// 서버로부터 받은 업데이트를 셀에 반영
function updateCellFromServer(assetId, fieldName, fieldValue) {
    const row = document.querySelector(`tr[data-asset-id="${assetId}"]`);
    if (row) {
        const cell = row.querySelector(`td[data-field="${fieldName}"]`);
        if (cell && cell.textContent !== fieldValue) {
            if (document.activeElement !== cell) {
                cell.textContent = fieldValue;
                cell.classList.add('updated-by-other');
                setTimeout(() => {
                    cell.classList.remove('updated-by-other');
                }, 2000);
            }
        }
    }
}

// 변경사항을 서버로 전송
function sendUpdate(assetId, fieldName, fieldValue) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log(`[서버 전송] ${fieldName} = "${fieldValue}"`);
        socket.send(JSON.stringify({
            action: 'update',
            asset_id: assetId,
            field_name: fieldName,
            field_value: fieldValue,
            user_id: userId
        }));
    }
}

// 포커스 이벤트 전송
function sendFocus(assetId, fieldName) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'focus',
            asset_id: assetId,
            field_name: fieldName
        }));
    }
}

// 블러 이벤트 전송
function sendBlur() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'blur'
        }));
    }
}

// 변경사항 확정 (최종 저장) - 디바운스 후에만 호출됨
function commitChange(cell) {
    const row = cell.closest('tr');
    if (!row) return;

    const assetId = row.dataset.assetId;
    const fieldName = cell.dataset.field;
    const fieldValue = cell.textContent.trim();
    const originalValue = cell.dataset.originalValue || '';
    const key = `${assetId}|${fieldName}`;
    const isCustomField = cell.dataset.custom === 'true';

    // 디바운스 타이머 취소
    if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
        debounceTimers.delete(key);
    }

    // pendingChanges에서 제거
    pendingChanges.delete(key);

    // 값이 실제로 변경되었는지 확인
    if (fieldValue !== originalValue) {
        console.log(`[최종 저장] ${fieldName}: "${originalValue}" → "${fieldValue}"${isCustomField ? ' (사용자정의필드)' : ''}`);

        if (isCustomField) {
            // 사용자 정의 필드는 AJAX로 저장
            saveCustomFieldValue(assetId, fieldName, fieldValue);
        } else {
            // 기본 필드는 WebSocket으로 전송
            sendUpdate(assetId, fieldName, fieldValue);
        }

        // 시각적 피드백
        cell.classList.add('changed');
        setTimeout(() => {
            cell.classList.remove('changed');
        }, 3000);

        // 원래 값 업데이트
        cell.dataset.originalValue = fieldValue;
    }

    cell.classList.remove('editing');
}

// 사용자 정의 필드 값 저장 (AJAX)
function saveCustomFieldValue(assetId, fieldKey, value) {
    fetch('/custom-field-value/update/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            asset_id: assetId,
            field_key: fieldKey,
            value: value
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`[사용자정의필드 저장 완료] ${fieldKey}`);
        } else {
            console.error('사용자정의필드 저장 실패:', data.error);
        }
    })
    .catch(error => {
        console.error('사용자정의필드 저장 오류:', error);
    });
}

// 디바운스된 변경사항 저장
function debouncedCommit(cell) {
    const row = cell.closest('tr');
    if (!row) return;

    const assetId = row.dataset.assetId;
    const fieldName = cell.dataset.field;
    const key = `${assetId}|${fieldName}`;

    // 기존 타이머 취소
    if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
    }

    // pending 상태로 저장 (페이지 나갈 때 사용)
    pendingChanges.set(key, cell);

    // 새 타이머 설정 (2초 후 저장)
    const timer = setTimeout(() => {
        commitChange(cell);
        debounceTimers.delete(key);
    }, DEBOUNCE_DELAY);

    debounceTimers.set(key, timer);
}

// 모든 대기 중인 변경사항 즉시 저장 (페이지 나갈 때)
function flushAllPendingChanges() {
    // 모든 디바운스 타이머 취소하고 즉시 저장
    debounceTimers.forEach((timer) => {
        clearTimeout(timer);
    });
    debounceTimers.clear();

    // 대기 중인 모든 변경사항 저장
    pendingChanges.forEach((cell) => {
        commitChange(cell);
    });
    pendingChanges.clear();
}

// 셀 편집 이벤트 리스너 (최적화: 이벤트 위임 - 46,900개 리스너 → 4개 리스너)
document.addEventListener('DOMContentLoaded', function() {
    const table = document.getElementById('assetTable');
    if (!table) return;

    // focusin/focusout은 focus/blur와 달리 버블링됨 → 이벤트 위임 가능
    table.addEventListener('focusin', function(e) {
        const cell = e.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        cell.dataset.originalValue = cell.textContent;
        const row = cell.closest('tr');
        if (row) {
            sendFocus(row.dataset.assetId, cell.dataset.field);
        }
    });

    table.addEventListener('input', function(e) {
        const cell = e.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        cell.classList.add('editing');
        debouncedCommit(cell);
    });

    table.addEventListener('focusout', function(e) {
        const cell = e.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        commitChange(cell);
        sendBlur();
    });

    table.addEventListener('keydown', function(e) {
        const cell = e.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commitChange(cell);
            cell.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const row = cell.closest('tr');
            if (row) {
                const key = `${row.dataset.assetId}|${cell.dataset.field}`;
                if (debounceTimers.has(key)) {
                    clearTimeout(debounceTimers.get(key));
                    debounceTimers.delete(key);
                }
                pendingChanges.delete(key);
            }
            cell.textContent = cell.dataset.originalValue || '';
            cell.classList.remove('editing');
            cell.blur();
        }
    });

    connectWebSocket();
});

// 페이지 나가기 전 모든 변경사항 저장
window.addEventListener('beforeunload', function() {
    flushAllPendingChanges();

    if (socket) {
        socket.close();
    }
});

// visibilitychange 이벤트로 탭 전환 시에도 저장
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        flushAllPendingChanges();
    }
});
