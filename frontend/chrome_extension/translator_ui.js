/**
 * AI 모델이 추가한 불필요한 소개 문구를 제거하고 순수 번역 텍스트만 반환합니다.
 */
function cleanTranslatedText(text) {
    if (!text) return text;

    // 일반적인 AI 소개 문구 패턴들
    const introPatterns = [
        /^다음은 해당 텍스트의 한국어 번역입니다\.\s*/i,
        /^다음은 .* 번역입니다\.\s*/i,
        /^한국어 번역[:：]/i,
        /^영어 번역[:：]/i,
        /^번역[:：]/i,
        /^Here's the .* translation[:：]/i,
        /^The translation is[:：]/i
    ];

    // 분리자 패턴 (종종 --- 로 구분되기도 함)
    const separatorPattern = /^[-—]{3,}\s*/m;

    let cleaned = text.trim();

    // 소개 문구 제거
    for (const pattern of introPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }

    // --- 이후 내용이 실제 번역인 경우 추출
    const separatorMatch = cleaned.match(separatorPattern);
    if (separatorMatch) {
        const parts = cleaned.split(separatorMatch[0]);
        if (parts.length > 1 && parts[1].trim()) {
            cleaned = parts[1].trim();
        }
    }

    return cleaned;
}

/**
 * 입력된 텍스트의 글자 수를 세어 화면에 표시합니다.
 */
function updateCharCounter() {
    const inputText = document.getElementById('input-text').innerText; // Changed from .value
    const charCounter = document.getElementById('char-counter');
    charCounter.textContent = `글자: ${inputText.length}`;
}

/**
 * 상태 표시기를 업데이트합니다.
 */
function updateStatus(message, type = 'info', showSpinner = false) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const spinner = statusIndicator.querySelector('.spinner');

    // 기존 타임아웃 제거
    if (statusIndicator.hideTimeout) {
        clearTimeout(statusIndicator.hideTimeout);
        statusIndicator.hideTimeout = null;
    }

    statusIndicator.className = `status-indicator ${type}`;
    statusText.textContent = message;

    if (showSpinner) {
        spinner.style.display = 'block';
        statusIndicator.style.display = 'flex';
        statusIndicator.style.opacity = '1';
    } else {
        spinner.style.display = 'none';
        statusIndicator.style.display = type === 'info' ? 'none' : 'block';
        statusIndicator.style.opacity = '1';

        // success 타입은 3초 후 자동 fade-out
        if (type === 'success') {
            statusIndicator.hideTimeout = setTimeout(() => {
                statusIndicator.style.opacity = '0';
                // opacity 전환 후 display none
                setTimeout(() => {
                    statusIndicator.style.display = 'none';
                }, 300);
            }, 3000);
        }
    }
}

/**
 * 진행 상황 모달을 표시합니다.
 */
function showProgress(message) {
    const progressContainer = document.getElementById('progress-container');
    const progressText = document.getElementById('progress-text');
    progressText.textContent = message;
    progressContainer.style.display = 'flex';
}

/**
 * 진행 상황 모달을 숨깁니다.
 */
function hideProgress() {
    const progressContainer = document.getElementById('progress-container');
    progressContainer.style.display = 'none';
}

/**
 * 진행바를 업데이트합니다.
 */
function updateProgressBar(percentage) {
    const progressBarFill = document.getElementById('progress-bar-fill');
    progressBarFill.style.width = `${percentage}%`;
}

/**
 * 선택된 API 제공자(provider)에 맞는 모델 목록을 서버에서 비동기적으로 불러옵니다.
 */
async function loadModelsForProvider(provider, selectedModelName = null) {
    const modelSelect = document.getElementById('model-select');
    modelSelect.innerHTML = '<option>모델 로딩 중...</option>';
    updateStatus('모델 목록을 불러오는 중...', 'loading', true);

    try {
        const response = await fetch(`http://localhost:5000/models?provider=${provider}`);
        if (!response.ok) {
            throw new Error(`${response.status}: 모델 목록을 불러올 수 없습니다.`);
        }
        const models = await response.json();

        modelSelect.innerHTML = '';
        if (models.length === 0) {
            modelSelect.innerHTML = '<option>사용 가능한 모델 없음</option>';
            updateStatus('사용 가능한 모델이 없습니다', 'error');
            return;
        }

        models.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            let displayName = modelName.replace('models/', '');
            option.textContent = displayName;
            modelSelect.appendChild(option);
        });

        if (selectedModelName) {
            modelSelect.value = selectedModelName;
        }

        updateStatus(`${models.length}개 모델 로드 완료`, 'success');

    } catch (error) {
        console.error('모델 로딩 오류:', error);
        modelSelect.innerHTML = '<option>모델 로딩 실패</option>';
        updateStatus(error.message || '모델 목록 로딩 실패', 'error');
    }
}

async function parseErrorResponse(response) {
    const text = await response.text();
    return parseErrorText(text);
}

function parseErrorText(text) {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (error) {
        return { detail: text };
    }
}

function formatRateLimitMessage(detail) {
    const safeDetail = detail && typeof detail === 'object' ? detail : {};
    const baseMessage = safeDetail.message || 'Gemini API 무료 사용량이 초과되어 번역을 진행할 수 없습니다. 잠시 후 다시 시도해주세요.';
    const retryAfterSeconds = safeDetail.retry_after_seconds;

    if (retryAfterSeconds) {
        const rounded = Math.max(1, Math.ceil(retryAfterSeconds));
        if (!baseMessage.includes('초')) {
            return `${baseMessage} (약 ${rounded}초 후 재시도 가능)`;
        }
    }

    return baseMessage;
}

/**
 * 지원되는 언어 목록을 동적으로 생성하여 드롭다운에 추가합니다.
 */
function loadLanguageOptions() {
    const languageSelect = document.getElementById('target-language-select');
    const popularLanguages = [
        { code: 'ko', name: '한국어' }, { code: 'en', name: '영어' }, { code: 'ja', name: '일본어' }, { code: 'zh', name: '중국어' }, { code: 'es', name: '스페인어' }, { code: 'fr', name: '프랑스어' }, { code: 'de', name: '독일어' }, { code: 'ru', name: '러시아어' }, { code: 'pt', name: '포르투갈어' }, { code: 'it', name: '이탈리아어' }
    ];

    languageSelect.innerHTML = '';

    popularLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        if (lang.code === 'ko') {
            option.selected = true;
        }
        languageSelect.appendChild(option);
    });
}

async function fetchAndDisplayTranscript(videoId, videoTitle, fullUrl) {
    const inputDiv = document.getElementById('input-text');
    if (!inputDiv) return;

    const timestampCheckbox = document.getElementById('timestamp-checkbox');
    const preserveTimestamps = timestampCheckbox.checked;

    inputDiv.innerHTML = `<div style="color: #888;">자막을 불러오는 중입니다...</div>`;
    updateStatus('자막 로딩 중...', 'loading', true);

    try {
        const response = await fetch(`http://localhost:5000/get_transcript?video_id=${videoId}&preserve_timestamps=${preserveTimestamps}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '자막을 불러올 수 없습니다.');
        }
        const data = await response.json();

        const titleHTML = `<div style="font-size: 20px; font-weight: 500;">${videoTitle.trim()} - YouTube</div>`;
        const urlHTML = `<div style="font-size: 14px; color: #555; margin-bottom: 1em;">${fullUrl}</div>`;

        // HTML 특수 문자를 이스케이프하여 순수 텍스트로 처리되도록 합니다.
        const transcriptContent = data.transcript.split('\n').map(line => `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`).join('');

        inputDiv.innerHTML = titleHTML + urlHTML + transcriptContent;

        updateStatus('자막 로드 완료', 'success');
        updateCharCounter();
        window.refreshScrollUnits?.();
    } catch (error) {
        console.error('자막 로딩 오류:', error);
        const titleHTML = `<div style="font-size: 20px; font-weight: 500;">${videoTitle.trim()} - YouTube</div>`;
        const urlHTML = `<div style="font-size: 14px; color: #555; margin-bottom: 1em;">${fullUrl}</div>`;
        const errorHTML = `<div style="color: red;">자막을 불러오는 데 실패했습니다: ${error.message}</div>`;
        inputDiv.innerHTML = titleHTML + urlHTML + errorHTML;
        updateStatus(`자막 로딩 실패: ${error.message}`, 'error');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    let videoId = '';
    let videoTitle = '';
    let fullUrl = '';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        videoId = urlParams.get('videoId');
        videoTitle = urlParams.get('videoTitle');
        fullUrl = urlParams.get('fullUrl');
    } catch (e) {
        console.error('URL에서 동영상 정보를 읽는 데 실패했습니다.', e);
    }

    document.getElementById('input-text').addEventListener('input', updateCharCounter);
    updateCharCounter();
    loadLanguageOptions();

    const timestampCheckbox = document.getElementById('timestamp-checkbox');
    const showTimestamp = localStorage.getItem('show_timestamp') === 'true';
    timestampCheckbox.checked = showTimestamp;

    timestampCheckbox.addEventListener('change', () => {
        localStorage.setItem('show_timestamp', timestampCheckbox.checked);
        if (videoId) {
            fetchAndDisplayTranscript(videoId, videoTitle, fullUrl);
        }
    });

    const streamingCheckbox = document.getElementById('streaming-checkbox');
    const useStreaming = localStorage.getItem('use_streaming') === 'true';
    streamingCheckbox.checked = useStreaming;

    streamingCheckbox.addEventListener('change', () => {
        localStorage.setItem('use_streaming', streamingCheckbox.checked);
    });

    if (videoId) {
        fetchAndDisplayTranscript(videoId, videoTitle, fullUrl);
    } else {
        const inputDiv = document.getElementById('input-text');
        const placeholderHTML = `<div style="color: #888;">번역할 내용을 입력하거나 붙여넣으세요...</div>`;
        inputDiv.innerHTML = placeholderHTML;

        inputDiv.onfocus = function() {
            if (this.innerText.trim() === '번역할 내용을 입력하거나 붙여넣으세요...') {
                this.innerHTML = '';
                this.style.color = 'black';
            }
        };
        inputDiv.onblur = function() {
            if (this.innerText.trim() === '') {
                this.innerHTML = placeholderHTML;
            }
        };
    }

    const providerSelect = document.getElementById('provider-select');
    const lastUsedProvider = localStorage.getItem('lastUsedProvider') || 'gemini';
    const lastUsedModel = localStorage.getItem('lastUsedModel');
    providerSelect.value = lastUsedProvider;

    providerSelect.addEventListener('change', (e) => {
        loadModelsForProvider(e.target.value);
    });

    loadModelsForProvider(lastUsedProvider, lastUsedModel);
});

document.getElementById('translate-button').addEventListener('click', () => {
    const streamingCheckbox = document.getElementById('streaming-checkbox');
    if (streamingCheckbox.checked) {
        handleStreamTranslation();
    } else {
        handleRegularTranslation();
    }
});

function handleRegularTranslation() {
    const inputText = document.getElementById('input-text').innerText;
    const outputDiv = document.getElementById('output-text');
    const providerSelect = document.getElementById('provider-select');
    const selectedProvider = providerSelect.value;
    const selectedModel = document.getElementById('model-select').value;
    const targetLanguage = document.getElementById('target-language-select').value;
    const showNotification = document.getElementById('notification-checkbox').checked;

    const translateButton = document.getElementById('translate-button');
    const inputDiv = document.getElementById('input-text');

    if (!inputText.trim()) {
        updateStatus('번역할 내용을 입력해주세요', 'error');
        return;
    }

    if (!selectedModel || selectedModel.includes('로딩') || selectedModel.includes('없음')) {
        updateStatus('사용 가능한 모델을 먼저 선택해주세요', 'error');
        return;
    }

    translateButton.disabled = true;
    inputDiv.setAttribute('contenteditable', 'false');
    updateStatus('번역 준비중...', 'loading', true);

    let progressPhase = 0;
    const progressSteps = [ '서버 연결중...', '요청 전송중...', 'AI 번역 처리중...', '결과 수신중...', '완료 처리중...' ];
    showProgress(progressSteps[progressPhase]);
    updateProgressBar(10);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        updateStatus('요청이 3분을 초과하여 취소되었습니다', 'error');
        hideProgress();
        translateButton.disabled = false;
        inputDiv.setAttribute('contenteditable', 'true');
    }, 180000);

    const progressInterval = setInterval(() => {
        progressPhase = Math.min(progressPhase + 1, progressSteps.length - 1);
        showProgress(progressSteps[progressPhase]);
        updateProgressBar(10 + (progressPhase * 20));
    }, 1000);

    fetch('http://localhost:5000/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: inputText,
            model: selectedModel,
            target_language: targetLanguage,
            show_notification: showNotification
        }),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        updateProgressBar(70);
        showProgress('서버 응답 처리중...');

        if (!response.ok) {
            return parseErrorResponse(response).then(errBody => {
                const detail = errBody.detail ?? errBody;

                if (response.status === 429) {
                    const message = formatRateLimitMessage(detail);
                    const rateLimitError = new Error(message);
                    rateLimitError.name = 'RateLimitError';
                    rateLimitError.retryAfterSeconds = detail && detail.retry_after_seconds;
                    throw rateLimitError;
                }

                const errorMessage = typeof detail === 'string'
                    ? detail
                    : (detail && detail.message) || '알 수 없는 서버 오류';

                if (response.status === 400) throw new Error(`입력 오류: ${errorMessage}`);
                if (response.status === 500) throw new Error(`서버 내부 오류: ${errorMessage}`);
                throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            });
        }
        return response.json();
    })
    .then(data => {
        updateProgressBar(90);
        showProgress('결과 표시중...');

        // AI가 추가한 불필요한 소개 문구를 제거하고 순수 번역 텍스트만 추출
        let cleanText = cleanTranslatedText(data.translated_text);

        outputDiv.innerHTML = cleanText.split('\n').map(line => `<div>${line}</div>`).join('');
        window.refreshScrollUnits?.();
        localStorage.setItem('lastUsedProvider', selectedProvider);
        localStorage.setItem('lastUsedModel', selectedModel);
        updateProgressBar(100);
        setTimeout(() => {
            hideProgress();
            updateStatus(`${inputText.length}자 번역 완료`, 'success');
        }, 500);
    })
    .catch(error => {
        console.error('번역 오류:', error);
        hideProgress();
        clearInterval(progressInterval);
        let errorMessage = error.message;
        let userFriendlyMessage = '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
        if (error.name === 'AbortError') userFriendlyMessage = '요청 시간이 초과되었습니다. 인터넷 연결을 확인해주세요.';
        else if (error.name === 'TypeError' && error.message.includes('fetch')) userFriendlyMessage = '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
        else if (error.name === 'RateLimitError') userFriendlyMessage = errorMessage;
        else if (errorMessage.includes('입력 오류')) userFriendlyMessage = errorMessage;
        else if (errorMessage.includes('서버 내부 오류')) userFriendlyMessage = '서버에서 번역을 처리하던 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        outputDiv.textContent = userFriendlyMessage;
        updateStatus(userFriendlyMessage, 'error');
    })
    .finally(() => {
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        translateButton.disabled = false;
        inputDiv.setAttribute('contenteditable', 'true');
        if (translateButton.disabled === false) {
            updateStatus('준비 완료', 'success');
        }
    });
}

async function handleStreamTranslation() {
    const inputText = document.getElementById('input-text').innerText;
    const outputDiv = document.getElementById('output-text');
    const selectedModel = document.getElementById('model-select').value;
    const targetLanguage = document.getElementById('target-language-select').value;
    const showNotification = document.getElementById('notification-checkbox').checked;

    const translateButton = document.getElementById('translate-button');
    const inputDiv = document.getElementById('input-text');

    if (!inputText.trim()) {
        updateStatus('번역할 내용을 입력해주세요', 'error');
        return;
    }

    translateButton.disabled = true;
    inputDiv.setAttribute('contenteditable', 'false');
    outputDiv.textContent = ''; // Clear previous results
    updateStatus('스트리밍 번역 중...', 'loading', true);

    const controller = new AbortController();
    const abortHandler = () => controller.abort();

    try {
        // 탭을 닫거나 이동할 때 요청을 취소하기 위한 이벤트 리스너 추가
        window.addEventListener('beforeunload', abortHandler);

        const response = await fetch('http://localhost:5000/translate_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: inputText,
                model: selectedModel,
                target_language: targetLanguage,
                show_notification: showNotification
            }),
            signal: controller.signal // AbortController의 signal을 fetch에 전달
        });

        if (!response.ok) {
            const errorText = await response.text();
            const parsed = parseErrorText(errorText);
            const detail = parsed.detail ?? parsed;

            if (response.status === 429) {
                const message = formatRateLimitMessage(detail);
                const rateLimitError = new Error(message);
                rateLimitError.name = 'RateLimitError';
                rateLimitError.retryAfterSeconds = detail && detail.retry_after_seconds;
                throw rateLimitError;
            }

            const message = typeof detail === 'string'
                ? detail
                : (detail && detail.message) || '스트리밍 연결에 실패했습니다.';
            throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            outputDiv.innerHTML = fullResponse.split('\n').map(line => `<div>${line}</div>`).join(''); // 실시간 표시
        }

        // 스트리밍 완료 후 AI 소개 문구 정리
        const cleanText = cleanTranslatedText(fullResponse);
        if (cleanText !== fullResponse) {
            outputDiv.innerHTML = cleanText.split('\n').map(line => `<div>${line}</div>`).join(''); // 정제된 텍스트로 교체
        }

        window.refreshScrollUnits?.();

        updateStatus('스트리밍 완료', 'success');
        if (showNotification) {
            // Assuming NotificationService is available or handled elsewhere
        }

    } catch (error) {
        console.error('스트리밍 번역 오류:', error);
        if (error.name === 'AbortError') {
            outputDiv.textContent = '번역이 사용자에 의해 취소되었습니다.';
            updateStatus('번역 취소됨', 'warning');
        } else {
            const message = error.name === 'RateLimitError'
                ? error.message
                : `오류: ${error.message}`;
            outputDiv.textContent = message;
            updateStatus(message, 'error');
        }
    } finally {
        // 작업이 끝나면 이벤트 리스너를 제거하여 메모리 누수 방지
        window.removeEventListener('beforeunload', abortHandler);
        translateButton.disabled = false;
        inputDiv.setAttribute('contenteditable', 'true');
    }
}

// 스크롤 동기화 상태 관리
let isScrollSyncEnabled = false;
let isScrollingProgrammatically = false;

// 의미 단위로 텍스트 나누기 (줄바꿈 기준)
function splitTextIntoSemanticUnits(text) {
    const lines = text.split('\n');
    const units = [];
    let totalLength = 0;

    for (const line of lines) {
        const start = totalLength;
        const length = line.length;
        units.push({
            text: line,
            start,
            end: start + length,
            length
        });
        totalLength += length + 1; // 줄바꿈 문자 가정
    }

    return units;
}

function calculateSyncScrollPosition(sourceUnits, targetUnits, sourceScrollTop, sourceScrollHeight, sourceClientHeight, targetScrollHeight, targetClientHeight) {
    if (!sourceUnits.length || !targetUnits.length) return 0;

    const currentSourceUnitIndex = findCurrentUnitIndex(sourceUnits, sourceScrollTop, sourceScrollHeight, sourceClientHeight);

    // 대응하는 타겟 유닛 찾기 (1:1 매핑 가정)
    const targetUnitIndex = Math.min(currentSourceUnitIndex, targetUnits.length - 1);
    const targetUnit = targetUnits[targetUnitIndex];

    // 타겟 유닛의 상대적 위치를 기반으로 스크롤 위치 계산
    const totalTargetLength = targetUnits[targetUnits.length - 1].end;
    if (totalTargetLength === 0) return 0;

    const targetUnitRatio = targetUnit.start / totalTargetLength;
    const targetScrollRange = targetScrollHeight - targetClientHeight;
    const targetScrollTop = targetScrollRange > 0 ? targetScrollRange * targetUnitRatio : 0;

    return Math.max(0, targetScrollTop);
}

// 디바운스 함수
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 스크롤 인디케이터 업데이트 함수
function updateSyncIndicator(state) {
    const indicator = document.getElementById('sync-indicator');
    indicator.className = 'sync-indicator';

    if (state === 'active') {
        indicator.classList.add('active');
    } else if (state === 'syncing') {
        indicator.classList.add('active', 'syncing');
    } else {
        // inactive - remove all classes, keep base class
    }
}

function findCurrentUnitIndex(units, scrollTop, scrollHeight, clientHeight) {
    if (!units.length) return -1;

    const scrollRange = scrollHeight - clientHeight;
    const scrollRatio = scrollRange > 0 ? scrollTop / scrollRange : 0;
    const scrolledLength = (units[units.length - 1].end) * scrollRatio;

    for (let i = 0; i < units.length; i++) {
        if (units[i].start <= scrolledLength && units[i].end >= scrolledLength) {
            return i;
        }
    }

    return units.length - 1;
}

function performScrollSync(sourceElement, targetElement, sourceUnits, targetUnits) {
    if (!isScrollSyncEnabled || isScrollingProgrammatically) return;

    updateSyncIndicator('syncing');

    isScrollingProgrammatically = true;

    const sourceScrollTop = sourceElement.scrollTop;
    const sourceScrollHeight = sourceElement.scrollHeight;
    const sourceClientHeight = sourceElement.clientHeight;
    const targetScrollHeight = targetElement.scrollHeight;
    const targetClientHeight = targetElement.clientHeight;

    const targetScrollTop = calculateSyncScrollPosition(
        sourceUnits,
        targetUnits,
        sourceScrollTop,
        sourceScrollHeight,
        sourceClientHeight,
        targetScrollHeight,
        targetClientHeight
    );

    targetElement.scrollTop = targetScrollTop;

    const currentSourceUnitIndex = findCurrentUnitIndex(sourceUnits, sourceScrollTop, sourceScrollHeight, sourceClientHeight);
    if (currentSourceUnitIndex !== -1) {
        const targetUnitIndex = Math.min(currentSourceUnitIndex, targetUnits.length - 1);
        const targetLineElement = targetElement.children[targetUnitIndex];

        if (targetLineElement) {
            const previouslyHighlighted = targetElement.querySelector('.highlighted-line');
            if (previouslyHighlighted) {
                previouslyHighlighted.classList.remove('highlighted-line');
            }
            targetLineElement.classList.add('highlighted-line');
        }
    }

    setTimeout(() => {
        isScrollingProgrammatically = false;
        if (isScrollSyncEnabled) {
            updateSyncIndicator('active');
        }
    }, 100);
}

const debouncedSyncScroll = debounce((sourceElement, targetElement, sourceUnits, targetUnits) => {
    performScrollSync(sourceElement, targetElement, sourceUnits, targetUnits);
}, 50);

// 스크롤 동기화 설정 함수
function setupScrollSynchronization() {
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const scrollSyncCheckbox = document.getElementById('scroll-sync-checkbox');

    let inputUnits = [];
    let outputUnits = [];

    // 초기 text units 생성
    function updateTextUnits() {
        inputUnits = splitTextIntoSemanticUnits(inputText.textContent || '');
        outputUnits = splitTextIntoSemanticUnits(outputText.textContent || '');
    }

    // 텍스트 변경 시 유닛 업데이트 (디바운스 적용)
    const updateUnitsDebounced = debounce(updateTextUnits, 300);

    inputText.addEventListener('input', updateUnitsDebounced);
    inputText.addEventListener('keyup', updateUnitsDebounced);

    // 초기 업데이트
    updateTextUnits();

    function refreshScrollUnits(options = {}) {
        updateTextUnits();

        if (!isScrollSyncEnabled) return;

        const direction = options.direction === 'outputToInput' ? 'outputToInput' : 'inputToOutput';

        if (direction === 'inputToOutput') {
            performScrollSync(inputText, outputText, inputUnits, outputUnits);
        } else {
            performScrollSync(outputText, inputText, outputUnits, inputUnits);
        }
    }

    window.refreshScrollUnits = refreshScrollUnits;

    // 스크롤 이벤트 리스너
    function onInputScroll() {
        if (!isScrollSyncEnabled) return;
        debouncedSyncScroll(inputText, outputText, inputUnits, outputUnits);
    }

    function onOutputScroll() {
        if (!isScrollSyncEnabled) return;
        debouncedSyncScroll(outputText, inputText, outputUnits, inputUnits);
    }

    inputText.addEventListener('scroll', onInputScroll);
    outputText.addEventListener('scroll', onOutputScroll);

    // 토글 이벤트
    scrollSyncCheckbox.addEventListener('change', (e) => {
        isScrollSyncEnabled = e.target.checked;
        localStorage.setItem('scroll_sync_enabled', isScrollSyncEnabled);

        if (isScrollSyncEnabled) {
            updateTextUnits(); // 토글 시점에 유닛 업데이트
            updateSyncIndicator('active'); // 인디케이터 활성화
            updateStatus('스크롤 동기화 활성화', 'success');
        } else {
            updateSyncIndicator('inactive'); // 인디케이터 비활성화
            updateStatus('스크롤 동기화 비활성화', 'info');
        }
    });

    // 저장된 설정 로드 및 초기 상태 설정
    const savedSetting = localStorage.getItem('scroll_sync_enabled');
    if (savedSetting === 'true') {
        scrollSyncCheckbox.checked = true;
        isScrollSyncEnabled = true;
        updateSyncIndicator('active'); // 초기 로드시 인디케이터 활성화
    }
}

// 스크롤 동기화 초기화 (DOM 로드 후)
window.addEventListener('DOMContentLoaded', () => {
    setupScrollSynchronization();
});
