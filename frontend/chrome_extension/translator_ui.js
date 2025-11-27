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
        /^The translation is[:：]/i,
    ];

    // 분리자 패턴 (종종 --- 로 구분되기도 함)
    const separatorPattern = /^[-—]{3,}\s*/m;

    let cleaned = text.trim();

    // 소개 문구 제거
    for (const pattern of introPatterns) {
        cleaned = cleaned.replace(pattern, "");
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
    const inputText = document.getElementById("input-text").innerText; // Changed from .value
    const charCounter = document.getElementById("char-counter");
    charCounter.textContent = `글자: ${inputText.length}`;
}

/**
 * 번역 결과 글자 수를 화면에 표시합니다.
 */
function updateOutputCharCounter(text = null) {
    const counter = document.getElementById("output-char-counter");
    const outputText =
        text !== null ? text : (document.getElementById("output-text")?.innerText ?? "");
    if (counter) {
        counter.textContent = `번역 글자: ${outputText.length}`;
    }
}

/**
 * 상태 표시기를 업데이트합니다.
 */
function updateStatus(message, type = "info", showSpinner = false) {
    const statusIndicator = document.getElementById("status-indicator");
    const statusText = document.getElementById("status-text");
    const spinner = statusIndicator.querySelector(".spinner");

    // 기존 타임아웃 제거
    if (statusIndicator.hideTimeout) {
        clearTimeout(statusIndicator.hideTimeout);
        statusIndicator.hideTimeout = null;
    }

    statusIndicator.className = `status-indicator ${type}`;
    statusText.textContent = message;

    if (showSpinner) {
        spinner.style.display = "block";
        statusIndicator.style.display = "flex";
        statusIndicator.style.opacity = "1";
    } else {
        spinner.style.display = "none";
        statusIndicator.style.display = type === "info" ? "none" : "block";
        statusIndicator.style.opacity = "1";

        // success 타입은 3초 후 자동 fade-out
        if (type === "success") {
            statusIndicator.hideTimeout = setTimeout(() => {
                statusIndicator.style.opacity = "0";
                // opacity 전환 후 display none
                setTimeout(() => {
                    statusIndicator.style.display = "none";
                }, 300);
            }, 3000);
        }
    }
}

/**
 * 진행 상황 모달을 표시합니다.
 */
function showProgress(message) {
    const progressContainer = document.getElementById("progress-container");
    const progressText = document.getElementById("progress-text");
    progressText.textContent = message;
    progressContainer.style.display = "flex";
}

/**
 * 진행 상황 모달을 숨깁니다.
 */
function hideProgress() {
    const progressContainer = document.getElementById("progress-container");
    progressContainer.style.display = "none";
}

/**
 * 진행바를 업데이트합니다.
 */
function updateProgressBar(percentage) {
    const progressBarFill = document.getElementById("progress-bar-fill");
    progressBarFill.style.width = `${percentage}%`;
}

/**
 * 선택된 API 제공자(provider)에 맞는 모델 목록을 서버에서 비동기적으로 불러옵니다.
 */
async function loadModelsForProvider(provider, selectedModelName = null) {
    const modelSelect = document.getElementById("model-select");
    modelSelect.innerHTML = "<option>모델 로딩 중...</option>";
    updateStatus("모델 목록을 불러오는 중...", "loading", true);

    try {
        const response = await fetch(`http://localhost:5000/models?provider=${provider}`);
        if (!response.ok) {
            throw new Error(`${response.status}: 모델 목록을 불러올 수 없습니다.`);
        }
        const models = await response.json();

        modelSelect.innerHTML = "";
        if (models.length === 0) {
            modelSelect.innerHTML = "<option>사용 가능한 모델 없음</option>";
            updateStatus("사용 가능한 모델이 없습니다", "error");
            return;
        }

        for (const modelName of models) {
            const option = document.createElement("option");
            option.value = modelName;
            const displayName = modelName.replace("models/", "");
            option.textContent = displayName;
            modelSelect.appendChild(option);
        }

        if (selectedModelName && models.includes(selectedModelName)) {
            modelSelect.value = selectedModelName;
        } else {
            modelSelect.value = models[0];
        }

        updateStatus(`${models.length}개 모델 로드 완료`, "success");
    } catch (error) {
        console.error("모델 로딩 오류:", error);
        modelSelect.innerHTML = "<option>모델 로딩 실패</option>";
        updateStatus(error.message || "모델 목록 로딩 실패", "error");
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
    const safeDetail = detail && typeof detail === "object" ? detail : {};
    const baseMessage =
        safeDetail.message ||
        "Gemini API 무료 사용량이 초과되어 번역을 진행할 수 없습니다. 잠시 후 다시 시도해주세요.";
    const retryAfterSeconds = safeDetail.retry_after_seconds;

    if (retryAfterSeconds) {
        const rounded = Math.max(1, Math.ceil(retryAfterSeconds));
        if (!baseMessage.includes("초")) {
            return `${baseMessage} (약 ${rounded}초 후 재시도 가능)`;
        }
    }

    return baseMessage;
}

/**
 * 지원되는 언어 목록을 동적으로 생성하여 드롭다운에 추가합니다.
 */
function loadLanguageOptions() {
    const languageSelect = document.getElementById("target-language-select");
    const popularLanguages = [
        { code: "ko", name: "한국어" },
        { code: "en", name: "영어" },
        { code: "ja", name: "일본어" },
        { code: "zh", name: "중국어" },
        { code: "es", name: "스페인어" },
        { code: "fr", name: "프랑스어" },
        { code: "de", name: "독일어" },
        { code: "ru", name: "러시아어" },
        { code: "pt", name: "포르투갈어" },
        { code: "it", name: "이탈리아어" },
    ];

    languageSelect.innerHTML = "";

    for (const lang of popularLanguages) {
        const option = document.createElement("option");
        option.value = lang.code;
        option.textContent = lang.name;
        if (lang.code === "ko") {
            option.selected = true;
        }
        languageSelect.appendChild(option);
    }
}

async function fetchAndDisplayTranscript(videoId, videoTitle, fullUrl) {
    const inputDiv = document.getElementById("input-text");
    if (!inputDiv) return;

    const timestampCheckbox = document.getElementById("timestamp-checkbox");
    const preserveTimestamps = timestampCheckbox.checked;

    inputDiv.innerHTML = `<div style="color: #888;">자막을 불러오는 중입니다...</div>`;
    updateStatus("자막 로딩 중...", "loading", true);

    try {
        const response = await fetch(
            `http://localhost:5000/get_transcript?video_id=${videoId}&preserve_timestamps=${preserveTimestamps}`,
        );
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "자막을 불러올 수 없습니다.");
        }
        const data = await response.json();

        const titleHTML = `<div style="font-size: 20px; font-weight: 500;">${videoTitle.trim()} - YouTube</div>`;
        const urlHTML = `<div style="font-size: 14px; color: #555; margin-bottom: 1em;">${fullUrl}</div>`;

        // HTML 특수 문자를 이스케이프하여 순수 텍스트로 처리되도록 합니다.
        const transcriptContent = data.transcript
            .split("\n")
            .map(
                (line) =>
                    `<div>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
            )
            .join("");

        inputDiv.innerHTML = titleHTML + urlHTML + transcriptContent;

        updateStatus("자막 로드 완료", "success");
        updateCharCounter();
        window.refreshScrollUnits?.();
    } catch (error) {
        console.error("자막 로딩 오류:", error);
        const titleHTML = `<div style="font-size: 20px; font-weight: 500;">${videoTitle.trim()} - YouTube</div>`;
        const urlHTML = `<div style="font-size: 14px; color: #555; margin-bottom: 1em;">${fullUrl}</div>`;
        const errorHTML = `<div style="color: red;">자막을 불러오는 데 실패했습니다: ${error.message}</div>`;
        inputDiv.innerHTML = titleHTML + urlHTML + errorHTML;
        updateStatus(`자막 로딩 실패: ${error.message}`, "error");
    }
}

window.addEventListener("DOMContentLoaded", () => {
    let videoId = "";
    let videoTitle = "";
    let fullUrl = "";

    try {
        const urlParams = new URLSearchParams(window.location.search);
        videoId = urlParams.get("videoId");
        videoTitle = urlParams.get("videoTitle");
        fullUrl = urlParams.get("fullUrl");
    } catch (e) {
        console.error("URL에서 동영상 정보를 읽는 데 실패했습니다.", e);
    }

    document.getElementById("input-text").addEventListener("input", updateCharCounter);
    updateCharCounter();
    updateOutputCharCounter("");
    loadLanguageOptions();

    const timestampCheckbox = document.getElementById("timestamp-checkbox");
    const showTimestamp = localStorage.getItem("show_timestamp") === "true";
    timestampCheckbox.checked = showTimestamp;

    timestampCheckbox.addEventListener("change", () => {
        localStorage.setItem("show_timestamp", timestampCheckbox.checked);
        if (videoId) {
            fetchAndDisplayTranscript(videoId, videoTitle, fullUrl);
        }
    });

    const streamingCheckbox = document.getElementById("streaming-checkbox");
    const useStreaming = localStorage.getItem("use_streaming") === "true";
    streamingCheckbox.checked = useStreaming;

    streamingCheckbox.addEventListener("change", () => {
        localStorage.setItem("use_streaming", streamingCheckbox.checked);
    });

    if (videoId) {
        fetchAndDisplayTranscript(videoId, videoTitle, fullUrl);
    } else {
        const inputDiv = document.getElementById("input-text");
        const placeholderHTML = `<div style="color: #888;">번역할 내용을 입력하거나 붙여넣으세요...</div>`;
        inputDiv.innerHTML = placeholderHTML;

        inputDiv.onfocus = function () {
            if (this.innerText.trim() === "번역할 내용을 입력하거나 붙여넣으세요...") {
                this.innerHTML = "";
                this.style.color = "black";
            }
        };
        inputDiv.onblur = function () {
            if (this.innerText.trim() === "") {
                this.innerHTML = placeholderHTML;
            }
        };
    }

    const providerSelect = document.getElementById("provider-select");
    const lastUsedProvider = localStorage.getItem("lastUsedProvider") || "gemini";
    const lastUsedModel = localStorage.getItem("lastUsedModel");
    providerSelect.value = lastUsedProvider;

    providerSelect.addEventListener("change", (e) => {
        loadModelsForProvider(e.target.value);
        localStorage.setItem("lastUsedProvider", e.target.value);
    });

    loadModelsForProvider(lastUsedProvider, lastUsedModel);

    // Cursor-based paragraph highlighting (seg-id 매핑)
    document.addEventListener("selectionchange", handleSelectionHighlight);
    document.getElementById("input-text").addEventListener("click", handleSelectionHighlight);
    document.getElementById("output-text").addEventListener("click", handleSelectionHighlight);

    // 초기 세그먼트 맵 생성
    refreshSegMaps();
});

document.getElementById("translate-button").addEventListener("click", () => {
    const streamingCheckbox = document.getElementById("streaming-checkbox");
    if (streamingCheckbox.checked) {
        handleStreamTranslation();
    } else {
        handleRegularTranslation();
    }
});

// ===== SEGMENT TAGGING HELPERS =====
const SEG_PREFIX = "[SEG-";
const SEG_PATTERN = /^\[SEG-(\d{4})\]\s*/;
let lastHighlightedSegId = null;

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function addSegmentMarkers(rawText) {
    const lines = rawText.split("\n");
    const segments = [];
    const taggedLines = lines.map((line, idx) => {
        const id = `SEG-${String(idx + 1).padStart(4, "0")}`;
        segments.push({ id, text: line });
        return `[${id}] ${line}`;
    });
    return { taggedText: taggedLines.join("\n"), segments };
}

function parseTaggedLines(taggedText) {
    const lines = taggedText.split("\n");
    return lines.map((line) => {
        const match = line.match(SEG_PATTERN);
        if (match) {
            const id = match[1] ? `SEG-${match[1]}` : null;
            const text = line.replace(SEG_PATTERN, "");
            return { id, text };
        }
        return { id: null, text: line };
    });
}

function renderParagraphs(element, paragraphs) {
    element.innerHTML = paragraphs
        .map(({ id, text }) => {
            const safe = escapeHtml(text);
            const segAttr = id ? ` data-seg-id="${id}"` : "";
            return `<div class="para"${segAttr}>${safe}</div>`;
        })
        .join("");
}

function clearHighlights() {
    for (const el of document.querySelectorAll(".highlighted-line")) {
        el.classList.remove("highlighted-line");
    }
    lastHighlightedSegId = null;
}

function highlightBySegId(segId) {
    if (!segId || segId === lastHighlightedSegId) return;
    const inputEl = document.querySelector(`#input-text [data-seg-id="${segId}"]`);
    const outputEl = document.querySelector(`#output-text [data-seg-id="${segId}"]`);

    for (const el of document.querySelectorAll(".highlighted-line")) {
        el.classList.remove("highlighted-line");
    }

    if (inputEl) inputEl.classList.add("highlighted-line");
    if (outputEl) outputEl.classList.add("highlighted-line");
    lastHighlightedSegId = segId;
}

const handleSelectionHighlight = debounce(() => {
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode) return;

    let node = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }
    if (!node || !node.closest) return;

    const para = node.closest(".para");
    if (!para) return;

    const container = para.closest("#input-text, #output-text");
    if (!container) return;

    const segId = para.getAttribute("data-seg-id");
    if (!segId) return;

    highlightBySegId(segId);
}, 50);

let currentInputSegments = [];

function handleRegularTranslation() {
    const inputText = document.getElementById("input-text").innerText;
    const outputDiv = document.getElementById("output-text");
    const providerSelect = document.getElementById("provider-select");
    const selectedProvider = providerSelect.value;
    const selectedModel = document.getElementById("model-select").value;
    const targetLanguage = document.getElementById("target-language-select").value;
    const showNotification = document.getElementById("notification-checkbox").checked;

    const translateButton = document.getElementById("translate-button");
    const inputDiv = document.getElementById("input-text");

    if (!inputText.trim()) {
        updateStatus("번역할 내용을 입력해주세요", "error");
        return;
    }

    if (!selectedModel || selectedModel.includes("로딩") || selectedModel.includes("없음")) {
        updateStatus("사용 가능한 모델을 먼저 선택해주세요", "error");
        return;
    }

    const { taggedText, segments } = addSegmentMarkers(inputText);
    currentInputSegments = segments;

    translateButton.disabled = true;
    inputDiv.setAttribute("contenteditable", "false");
    updateStatus("번역 준비중...", "loading", true);

    let progressPhase = 0;
    const progressSteps = [
        "서버 연결중...",
        "요청 전송중...",
        "AI 번역 처리중...",
        "결과 수신중...",
        "완료 처리중...",
    ];
    showProgress(progressSteps[progressPhase]);
    updateProgressBar(10);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        updateStatus("요청이 3분을 초과하여 취소되었습니다", "error");
        hideProgress();
        translateButton.disabled = false;
        inputDiv.setAttribute("contenteditable", "true");
    }, 180000);

    const progressInterval = setInterval(() => {
        progressPhase = Math.min(progressPhase + 1, progressSteps.length - 1);
        showProgress(progressSteps[progressPhase]);
        updateProgressBar(10 + progressPhase * 20);
    }, 1000);

    fetch("http://localhost:5000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: taggedText,
            model: selectedModel,
            target_language: targetLanguage,
            show_notification: showNotification,
        }),
        signal: controller.signal,
    })
        .then((response) => {
            clearTimeout(timeoutId);
            updateProgressBar(70);
            showProgress("서버 응답 처리중...");

            if (!response.ok) {
                return parseErrorResponse(response).then((errBody) => {
                    const detail = errBody.detail ?? errBody;

                    if (response.status === 429) {
                        const message = formatRateLimitMessage(detail);
                        const rateLimitError = new Error(message);
                        rateLimitError.name = "RateLimitError";
                        rateLimitError.retryAfterSeconds = detail?.retry_after_seconds;
                        throw rateLimitError;
                    }

                    const errorMessage =
                        typeof detail === "string"
                            ? detail
                            : detail?.message || "알 수 없는 서버 오류";

                    if (response.status === 400) throw new Error(`입력 오류: ${errorMessage}`);
                    if (response.status === 500) throw new Error(`서버 내부 오류: ${errorMessage}`);
                    throw new Error(`HTTP ${response.status}: ${errorMessage}`);
                });
            }
            return response.json();
        })
        .then((data) => {
            updateProgressBar(90);
            showProgress("결과 표시중...");

            // AI가 추가한 불필요한 소개 문구를 제거하고 순수 번역 텍스트만 추출
            const cleanText = cleanTranslatedText(data.translated_text);

            // 태그 파싱 후 렌더링
            const parsedOutput = parseTaggedLines(cleanText);
            renderParagraphs(outputDiv, parsedOutput);
            if (currentInputSegments.length) {
                renderParagraphs(document.getElementById("input-text"), currentInputSegments);
                updateCharCounter();
            }

            updateOutputCharCounter(parsedOutput.map((p) => p.text).join("\n"));
            refreshSegMaps();
            window.refreshScrollUnits?.();
            localStorage.setItem("lastUsedProvider", selectedProvider);
            localStorage.setItem("lastUsedModel", selectedModel);
            updateProgressBar(100);
            setTimeout(() => {
                hideProgress();
                updateStatus(`${inputText.length}자 번역 완료`, "success");
            }, 500);
        })
        .catch((error) => {
            console.error("번역 오류:", error);
            hideProgress();
            clearInterval(progressInterval);
            const errorMessage = error.message;
            let userFriendlyMessage = "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
            if (error.name === "AbortError")
                userFriendlyMessage = "요청 시간이 초과되었습니다. 인터넷 연결을 확인해주세요.";
            else if (error.name === "TypeError" && error.message.includes("fetch"))
                userFriendlyMessage = "서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.";
            else if (error.name === "RateLimitError") userFriendlyMessage = errorMessage;
            else if (errorMessage.includes("입력 오류")) userFriendlyMessage = errorMessage;
            else if (errorMessage.includes("서버 내부 오류"))
                userFriendlyMessage =
                    "서버에서 번역을 처리하던 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            outputDiv.textContent = userFriendlyMessage;
            updateOutputCharCounter(userFriendlyMessage);
            updateStatus(userFriendlyMessage, "error");
        })
        .finally(() => {
            clearInterval(progressInterval);
            clearTimeout(timeoutId);
            translateButton.disabled = false;
            inputDiv.setAttribute("contenteditable", "true");
            if (translateButton.disabled === false) {
                updateStatus("준비 완료", "success");
            }
        });
}

async function handleStreamTranslation() {
    const inputText = document.getElementById("input-text").innerText;
    const outputDiv = document.getElementById("output-text");
    const modelSelect = document.getElementById("model-select");
    const selectedModel = modelSelect.value;
    const targetLanguage = document.getElementById("target-language-select").value;
    const showNotification = document.getElementById("notification-checkbox").checked;
    const selectedProvider = document.getElementById("provider-select").value;

    const translateButton = document.getElementById("translate-button");
    const inputDiv = document.getElementById("input-text");

    if (!inputText.trim()) {
        updateStatus("번역할 내용을 입력해주세요", "error");
        return;
    }

    const { taggedText, segments } = addSegmentMarkers(inputText);
    currentInputSegments = segments;

    translateButton.disabled = true;
    inputDiv.setAttribute("contenteditable", "false");
    outputDiv.textContent = ""; // Clear previous results
    updateOutputCharCounter("");
    updateStatus("스트리밍 번역 중...", "loading", true);

    const controller = new AbortController();
    const abortHandler = () => controller.abort();

    try {
        // 탭을 닫거나 이동할 때 요청을 취소하기 위한 이벤트 리스너 추가
        window.addEventListener("beforeunload", abortHandler);

        const response = await fetch("http://localhost:5000/translate_stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: taggedText,
                model: selectedModel,
                target_language: targetLanguage,
                show_notification: showNotification,
            }),
            signal: controller.signal, // AbortController의 signal을 fetch에 전달
        });

        if (!response.ok) {
            const errorText = await response.text();
            const parsed = parseErrorText(errorText);
            const detail = parsed.detail ?? parsed;

            if (response.status === 429) {
                const message = formatRateLimitMessage(detail);
                const rateLimitError = new Error(message);
                rateLimitError.name = "RateLimitError";
                rateLimitError.retryAfterSeconds = detail?.retry_after_seconds;
                throw rateLimitError;
            }

            const message =
                typeof detail === "string"
                    ? detail
                    : detail?.message || "스트리밍 연결에 실패했습니다.";
            throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            // 중간 표시 시에도 태그를 잠시 보여줄 수 있지만, 최종 렌더에서 제거합니다.
            outputDiv.textContent = fullResponse;
            updateOutputCharCounter(outputDiv.innerText);
        }

        // 스트리밍 완료 후 AI 소개 문구 정리
        const cleanText = cleanTranslatedText(fullResponse);
        const parsedOutput = parseTaggedLines(cleanText);
        renderParagraphs(outputDiv, parsedOutput);
        if (currentInputSegments.length) {
            renderParagraphs(document.getElementById("input-text"), currentInputSegments);
            updateCharCounter();
        }
        updateOutputCharCounter(parsedOutput.map((p) => p.text).join("\n"));

        refreshSegMaps();
        window.refreshScrollUnits?.();

        updateStatus("스트리밍 완료", "success");
        // 마지막 사용 모델/프로바이더 저장
        localStorage.setItem("lastUsedProvider", document.getElementById("provider-select").value);
        localStorage.setItem("lastUsedModel", selectedModel);
        if (showNotification) {
            // Assuming NotificationService is available or handled elsewhere
        }
    } catch (error) {
        console.error("스트리밍 번역 오류:", error);
        if (error.name === "AbortError") {
            outputDiv.textContent = "번역이 사용자에 의해 취소되었습니다.";
            updateStatus("번역 취소됨", "warning");
        } else {
            const message =
                error.name === "RateLimitError" ? error.message : `오류: ${error.message}`;
            outputDiv.textContent = message;
            updateOutputCharCounter(message);
            updateStatus(message, "error");
        }
    } finally {
        // 작업이 끝나면 이벤트 리스너를 제거하여 메모리 누수 방지
        window.removeEventListener("beforeunload", abortHandler);
        translateButton.disabled = false;
        inputDiv.setAttribute("contenteditable", "true");
    }
}

// 스크롤 동기화 상태 관리
let isScrollSyncEnabled = false;
let isScrollingProgrammatically = false;
let inputSegList = [];
let outputSegList = [];
let inputSegById = {};
let outputSegById = {};

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
    const indicator = document.getElementById("sync-indicator");
    indicator.className = "sync-indicator";

    if (state === "active") {
        indicator.classList.add("active");
    } else if (state === "syncing") {
        indicator.classList.add("active", "syncing");
    } else {
        // inactive
    }
}

function refreshSegMaps() {
    const inputText = document.getElementById("input-text");
    const outputText = document.getElementById("output-text");
    inputSegList = Array.from(inputText.querySelectorAll(".para[data-seg-id]"));
    outputSegList = Array.from(outputText.querySelectorAll(".para[data-seg-id]"));
    inputSegById = Object.fromEntries(inputSegList.map((el) => [el.dataset.segId, el]));
    outputSegById = Object.fromEntries(outputSegList.map((el) => [el.dataset.segId, el]));
}

function getCurrentSegId(container, segList) {
    if (!segList || segList.length === 0) return null;
    const mid = container.scrollTop + container.clientHeight / 2;
    let bestId = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const el of segList) {
        const dist = Math.abs(el.offsetTop - mid);
        if (dist < bestDist) {
            bestDist = dist;
            bestId = el.dataset.segId;
        }
    }
    return bestId;
}

function scrollToSeg(targetContainer, segId, options = {}) {
    const { updateHighlight = true } = options;
    const targetMap = targetContainer.id === "input-text" ? inputSegById : outputSegById;
    const el = targetMap[segId];
    if (!el) return;
    isScrollingProgrammatically = true;
    const centerOffset = targetContainer.clientHeight / 2;
    const targetTop = Math.max(0, el.offsetTop - centerOffset);
    targetContainer.scrollTop = targetTop;
    if (updateHighlight) highlightBySegId(segId);
    setTimeout(() => {
        isScrollingProgrammatically = false;
        if (isScrollSyncEnabled) updateSyncIndicator("active");
    }, 50);
}

// 스크롤 동기화 설정 함수
function setupScrollSynchronization() {
    const inputText = document.getElementById("input-text");
    const outputText = document.getElementById("output-text");
    const scrollSyncCheckbox = document.getElementById("scroll-sync-checkbox");

    function refreshScrollUnits(options = {}) {
        refreshSegMaps();
        if (!isScrollSyncEnabled) return;

        const direction = options.direction === "outputToInput" ? "outputToInput" : "inputToOutput";
        if (direction === "inputToOutput") {
            const segId = getCurrentSegId(inputText, inputSegList);
            if (segId) scrollToSeg(outputText, segId);
        } else {
            const segId = getCurrentSegId(outputText, outputSegList);
            if (segId) scrollToSeg(inputText, segId);
        }
    }

    window.refreshScrollUnits = refreshScrollUnits;

    // 스크롤 이벤트 리스너 (seg-id 매핑 기반)
    const onInputScroll = debounce(() => {
        if (!isScrollSyncEnabled || isScrollingProgrammatically) return;
        const segId = getCurrentSegId(inputText, inputSegList);
        if (segId) scrollToSeg(outputText, segId, { updateHighlight: false });
    }, 30);

    const onOutputScroll = debounce(() => {
        if (!isScrollSyncEnabled || isScrollingProgrammatically) return;
        const segId = getCurrentSegId(outputText, outputSegList);
        if (segId) scrollToSeg(inputText, segId, { updateHighlight: false });
    }, 30);

    inputText.addEventListener("scroll", onInputScroll);
    outputText.addEventListener("scroll", onOutputScroll);

    // 토글 이벤트
    scrollSyncCheckbox.addEventListener("change", (e) => {
        isScrollSyncEnabled = e.target.checked;
        localStorage.setItem("scroll_sync_enabled", isScrollSyncEnabled);

        if (isScrollSyncEnabled) {
            refreshSegMaps(); // 토글 시점에 맵 업데이트
            updateSyncIndicator("active"); // 인디케이터 활성화
            updateStatus("스크롤 동기화 활성화", "success");
        } else {
            updateSyncIndicator("inactive"); // 인디케이터 비활성화
            updateStatus("스크롤 동기화 비활성화", "info");
        }
    });

    // 저장된 설정 로드 및 초기 상태 설정
    const savedSetting = localStorage.getItem("scroll_sync_enabled");
    if (savedSetting === "true") {
        scrollSyncCheckbox.checked = true;
        isScrollSyncEnabled = true;
        updateSyncIndicator("active"); // 초기 로드시 인디케이터 활성화
        refreshSegMaps();
    }
}

// 스크롤 동기화 초기화 (DOM 로드 후)
window.addEventListener("DOMContentLoaded", () => {
    setupScrollSynchronization();
});
