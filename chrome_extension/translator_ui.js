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
        const transcriptContent = data.transcript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        inputDiv.innerHTML = titleHTML + urlHTML + transcriptContent;

        updateStatus('자막 로드 완료', 'success');
        updateCharCounter();
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
            return response.json().then(err => {
                const errorMessage = err.detail || '알 수 없는 서버 오류';
                if (response.status === 400) throw new Error(`입력 오류: ${errorMessage}`);
                else if (response.status === 500) throw new Error(`서버 내부 오류: ${errorMessage}`);
                else throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            });
        }
        return response.json();
    })
    .then(data => {
        updateProgressBar(90);
        showProgress('결과 표시중...');
        outputDiv.textContent = data.translated_text;
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
            throw new Error(JSON.parse(errorText).detail || '스트리밍 연결에 실패했습니다.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            outputDiv.textContent += chunk;
        }

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
            outputDiv.textContent = `오류: ${error.message}`;
            updateStatus(`오류: ${error.message}`, 'error');
        }
    } finally {
        // 작업이 끝나면 이벤트 리스너를 제거하여 메모리 누수 방지
        window.removeEventListener('beforeunload', abortHandler);
        translateButton.disabled = false;
        inputDiv.setAttribute('contenteditable', 'true');
    }
}
