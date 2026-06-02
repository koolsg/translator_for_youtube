/**
 * 서버 주소 설정
 * 포트를 변경할 경우 이 값과 manifest.json의 host_permissions를 함께 수정하세요.
 */
const SERVER_BASE_URL = "http://localhost:5000/api/translator";

// 원문 언어 코드 (YouTube 자막에서 공급되면 업데이트, 직접 입력은 "unknown")
let currentSourceLang = "unknown";

// ===== TTS VOICE NOTIFICATION FUNCTIONALITY =====
let voices = [];

/**
 * 브라우저가 지원하는 TTS 목소리 목록을 가져와 드롭다운에 매핑합니다.
 */
function populateVoiceList() {
    if (typeof speechSynthesis === "undefined") return;
    
    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById("voice-select");
    if (!voiceSelect) return;
    
    const selectedVoiceName = localStorage.getItem("voice_notification_voice");
    voiceSelect.innerHTML = "";
    
    if (voices.length === 0) {
        const option = document.createElement("option");
        option.textContent = "사용 가능한 목소리 없음";
        option.value = "";
        voiceSelect.appendChild(option);
        updateSpeakButtonState();
        return;
    }
    
    // 한국어 -> 영어 -> 일본어 -> 중국어 -> 기타 언어 순으로 정렬하여 사용자 편의성 제공
    const sortedVoices = [...voices].sort((a, b) => {
        const aKo = a.lang.startsWith("ko") ? 1 : 0;
        const bKo = b.lang.startsWith("ko") ? 1 : 0;
        if (aKo !== bKo) return bKo - aKo;
        
        const aEn = a.lang.startsWith("en") ? 1 : 0;
        const bEn = b.lang.startsWith("en") ? 1 : 0;
        if (aEn !== bEn) return bEn - aEn;
        
        const aJa = a.lang.startsWith("ja") ? 1 : 0;
        const bJa = b.lang.startsWith("ja") ? 1 : 0;
        if (aJa !== bJa) return bJa - aJa;
        
        const aZh = a.lang.startsWith("zh") ? 1 : 0;
        const bZh = b.lang.startsWith("zh") ? 1 : 0;
        if (aZh !== bZh) return bZh - aZh;
        
        return a.lang.localeCompare(b.lang);
    });
    
    sortedVoices.forEach((voice) => {
        const option = document.createElement("option");
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.name;
        
        if (voice.name === selectedVoiceName) {
            option.selected = true;
        } else if (!selectedVoiceName && voice.lang.startsWith("ko")) {
            // 디폴트로 한국어 목소리가 지정되지 않았을 때 첫 한국어 목소리 자동 선택
            if (![...voiceSelect.options].some(opt => opt.selected)) {
                option.selected = true;
            }
        }
        voiceSelect.appendChild(option);
    });
    
    // 아무것도 선택되지 않았다면 첫 번째 목소리 지정
    if (voiceSelect.selectedIndex === -1 && voiceSelect.options.length > 0) {
        voiceSelect.options[0].selected = true;
    }

    updateSpeakButtonState();
}

// Chrome 등 비동기 목소리 로드 대응
if (typeof speechSynthesis !== "undefined") {
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
    populateVoiceList();
}

/**
 * 체크박스 상태에 따라 목소리 선택 상자와 테스트 버튼 활성/비활성화
 */
function updateVoiceUIState() {
    const voiceCheckbox = document.getElementById("voice-notification-checkbox");
    const voiceSelect = document.getElementById("voice-select");
    const voiceTestBtn = document.getElementById("voice-test-btn");
    
    if (!voiceCheckbox || !voiceSelect || !voiceTestBtn) return;
    
    const isEnabled = voiceCheckbox.checked;
    voiceSelect.disabled = !isEnabled;
    voiceTestBtn.disabled = !isEnabled;
}

/**
 * 선택한 목소리로 짧은 안내 멘트를 미리 들려줍니다.
 */
function playVoiceTest() {
    if (typeof speechSynthesis === "undefined") return;
    
    const voiceCheckbox = document.getElementById("voice-notification-checkbox");
    if (!voiceCheckbox || !voiceCheckbox.checked) return;
    
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    const voiceSelect = document.getElementById("voice-select");
    const selectedVoiceName = voiceSelect ? voiceSelect.value : null;
    const selectedVoice = voices.find(v => v.name === selectedVoiceName);
    
    let message = "안녕하세요. 유튜브 번역기 안내 음성입니다.";
    if (selectedVoice) {
        const lang = selectedVoice.lang.toLowerCase();
        if (lang.startsWith("en")) {
            message = "Hello. This is the YouTube Translator voice.";
        } else if (lang.startsWith("ja")) {
            message = "こんにちは。YouTube翻訳の音声です。";
        } else if (lang.startsWith("zh")) {
            message = "你好，这是 YouTube 翻译器的声音。";
        } else if (lang.startsWith("es")) {
            message = "Hola. Esta es la voz del traductor de YouTube.";
        } else if (lang.startsWith("fr")) {
            message = "Bonjour. C'est la voix du traducteur de YouTube.";
        } else if (lang.startsWith("de")) {
            message = "Hallo. Dies ist die Stimme des YouTube-Übersetzers.";
        }
    }
    
    const utterance = new SpeechSynthesisUtterance(message);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    }
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    speechSynthesis.speak(utterance);
}

/**
 * 번역이 완료되었을 때 지정된 목소리로 번역 완료를 안내합니다.
 */
function speakTranslationComplete() {
    const voiceCheckbox = document.getElementById("voice-notification-checkbox");
    if (!voiceCheckbox || !voiceCheckbox.checked) return;
    
    if (typeof speechSynthesis === "undefined") return;
    
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    
    const voiceSelect = document.getElementById("voice-select");
    const selectedVoiceName = voiceSelect ? voiceSelect.value : null;
    const selectedVoice = voices.find(v => v.name === selectedVoiceName);
    
    let message = "번역이 완료되었습니다.";
    if (selectedVoice) {
        const lang = selectedVoice.lang.toLowerCase();
        if (lang.startsWith("en")) {
            message = "Translation is complete.";
        } else if (lang.startsWith("ja")) {
            message = "翻訳が完了しました。";
        } else if (lang.startsWith("zh")) {
            message = "翻译已完成。";
        } else if (lang.startsWith("es")) {
            message = "La traducción está completa.";
        } else if (lang.startsWith("fr")) {
            message = "La traduction est terminée.";
        } else if (lang.startsWith("de")) {
            message = "Die Übersetzung ist abgeschlossen.";
        }
    }
    
    const utterance = new SpeechSynthesisUtterance(message);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    }
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    speechSynthesis.speak(utterance);
}


/**
 * 번역 결과 텍스트가 있을 때 음성 읽기 버튼을 활성화/비활성화합니다.
 */
function updateSpeakButtonState() {
    const speakBtn = document.getElementById("speak-translation-btn");
    const outputTextEl = document.getElementById("output-text");
    if (!speakBtn || !outputTextEl) return;

    const text = outputTextEl.innerText.trim();
    if (text && typeof speechSynthesis !== "undefined" && voices.length > 0) {
        speakBtn.disabled = false;
    } else {
        speakBtn.disabled = true;
        if (typeof speechSynthesis !== "undefined" && speechSynthesis.speaking) {
            speechSynthesis.cancel();
            speakBtn.innerHTML = "🔊 읽어주기";
            speakBtn.classList.remove("playing");
        }
    }
}

/**
 * 번역 결과 창에 표시된 번역 텍스트를 선택된 음성으로 읽어줍니다.
 */
function speakTranslationContent() {
    if (typeof speechSynthesis === "undefined") return;

    const outputTextEl = document.getElementById("output-text");
    const speakBtn = document.getElementById("speak-translation-btn");
    if (!outputTextEl || !speakBtn) return;

    // 이미 재생 중이면 정지 (토글 기능)
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        speakBtn.innerHTML = "🔊 읽어주기";
        speakBtn.classList.remove("playing");
        return;
    }

    const textToSpeak = outputTextEl.innerText.trim();
    if (!textToSpeak) {
        updateStatus("읽어줄 번역 결과가 없습니다.", "error");
        return;
    }

    const voiceSelect = document.getElementById("voice-select");
    const selectedVoiceName = voiceSelect ? voiceSelect.value : null;
    const selectedVoice = voices.find(v => v.name === selectedVoiceName);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } else {
        const targetLanguage = document.getElementById("target-language-select")?.value;
        if (targetLanguage) {
            utterance.lang = targetLanguage;
        }
    }

    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
        speakBtn.innerHTML = "⏹ 멈춤";
        speakBtn.classList.add("playing");
    };

    utterance.onend = () => {
        speakBtn.innerHTML = "🔊 읽어주기";
        speakBtn.classList.remove("playing");
    };

    utterance.onerror = (e) => {
        console.error("번역 읽기 오류:", e);
        speakBtn.innerHTML = "🔊 읽어주기";
        speakBtn.classList.remove("playing");
    };

    speechSynthesis.speak(utterance);
}


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
        const response = await fetch(`${SERVER_BASE_URL}/models?provider=${provider}`);
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
 * Provide user-friendly hints when network-level errors occur.
 */
function buildNetworkErrorMessage(error) {
    const msg = error?.message || "";

    // 온라인 여부 우선 확인
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return "네트워크 오류: 현재 오프라인 상태입니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
    }

    // 브라우저 fetch가 노출하는 대표 오류 코드 매핑
    const codeHints = [
        {
            key: "ERR_NAME_NOT_RESOLVED",
            text: "DNS 해석 실패: localhost 이름을 해석하지 못했습니다. hosts/프록시 설정을 확인하세요.",
        },
        {
            key: "ERR_CONNECTION_REFUSED",
            text: `연결 거부: 서버(${SERVER_BASE_URL})가 꺼져 있거나 포트가 다릅니다. 서버를 실행했는지 확인하세요.`,
        },
        {
            key: "ERR_CONNECTION_TIMED_OUT",
            text: "연결 시간 초과: 방화벽/VPN/프록시로 요청이 막혔거나 서버 응답이 없습니다.",
        },
        {
            key: "ERR_BLOCKED_BY_CLIENT",
            text: "클라이언트 차단: Adblock/보안 확장 프로그램이 요청을 차단했습니다. 예외 등록 후 다시 시도하세요.",
        },
        {
            key: "ERR_INTERNET_DISCONNECTED",
            text: "인터넷 연결이 끊어졌습니다. 네트워크를 복구한 뒤 다시 시도하세요.",
        },
        {
            key: "Failed to fetch",
            text: "요청을 전송하지 못했습니다. 서버 주소·포트, 프록시 차단 여부를 확인하세요.",
        },
    ];

    for (const hint of codeHints) {
        if (msg.includes(hint.key)) {
            return `네트워크 오류: ${hint.text}`;
        }
    }

    const detailLine = msg ? `원인 힌트: ${msg}` : null;
    const reasons = [
        `- 서버(${SERVER_BASE_URL})가 실행 중인지 확인하세요.`,
        `- VPN/프록시/기업망, 방화벽이 ${SERVER_BASE_URL} 접근을 막지 않는지 확인하세요.`,
        "- 브라우저 보안 설정 또는 다른 확장 프로그램(Adblock 등)이 요청을 차단하지 않는지 확인하세요.",
        "- 서버 포트나 프로토콜(http/https)이 변경되지 않았는지 확인하세요.",
    ];

    return [
        "네트워크 오류로 번역 결과를 불러오지 못했습니다.",
        detailLine,
        "가능한 원인:",
        ...reasons,
    ]
        .filter(Boolean)
        .join("\n");
}

/**
 * 서버가 살아있는지 헬스 체크 (없으면 404라도 응답하면 '생존'으로 간주)
 */
async function checkServerHealth() {
    try {
        const res = await fetch(`${SERVER_BASE_URL}/health`, { method: "GET" });
        if (res.ok || res.status === 404) return { ok: true, status: res.status };
        return { ok: false, status: res.status };
    } catch (e) {
        return { ok: false, status: null, error: e };
    }
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

    const sanitizedTitle = escapeHtml((videoTitle ?? "").trim());
    const titleDisplay = sanitizedTitle ? `${sanitizedTitle} - YouTube` : "YouTube";
    const sanitizedUrl = escapeHtml(fullUrl ?? "");
    const titleHTML = `<div style="font-size: 20px; font-weight: 500;">${titleDisplay}</div>`;
    const urlHTML = `<div style="font-size: 14px; color: #555; margin-bottom: 1em;">${sanitizedUrl}</div>`;

    inputDiv.innerHTML = `<div style="color: #888;">자막을 불러오는 중입니다...</div>`;
    updateStatus("자막 로딩 중...", "loading", true);

    try {
        const response = await fetch(
            `${SERVER_BASE_URL}/get_transcript?video_id=${videoId}&preserve_timestamps=${preserveTimestamps}`,
        );
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "자막을 불러올 수 없습니다.");
        }
        const data = await response.json();

        // 원문 언어 코드 저장 (벤치마크에 사용)
        currentSourceLang = data.language_code || "unknown";

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
        const safeErrorMessage = escapeHtml(error.message || "");
        const errorHTML = `<div style="color: red;">자막을 불러오는 데 실패했습니다: ${safeErrorMessage}</div>`;
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

    // TTS Voice Notification UI 복원 및 바인딩
    const voiceCheckbox = document.getElementById("voice-notification-checkbox");
    const voiceSelect = document.getElementById("voice-select");
    const voiceTestBtn = document.getElementById("voice-test-btn");
    const speakTranslationBtn = document.getElementById("speak-translation-btn");

    if (voiceCheckbox && voiceSelect && voiceTestBtn) {
        const savedVoiceEnabled = localStorage.getItem("voice_notification_enabled") !== "false";
        voiceCheckbox.checked = savedVoiceEnabled;

        voiceCheckbox.addEventListener("change", () => {
            localStorage.setItem("voice_notification_enabled", voiceCheckbox.checked);
            updateVoiceUIState();
        });

        voiceSelect.addEventListener("change", () => {
            localStorage.setItem("voice_notification_voice", voiceSelect.value);
            updateSpeakButtonState();
        });

        voiceTestBtn.addEventListener("click", () => {
            playVoiceTest();
        });

        updateVoiceUIState();
        populateVoiceList();
    }

    if (speakTranslationBtn) {
        speakTranslationBtn.addEventListener("click", () => {
            speakTranslationContent();
        });
        updateSpeakButtonState();
    }

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

/**
 * AI의 번역 결과(parsedOutput)를 원문 세그먼트(currentInputSegments)의 ID 순서에 맞춰 1:1로 결합하고 정렬합니다.
 * AI가 누락한 세그먼트가 있다면 원본 텍스트를 폴백으로 사용하며 앞에 '(번역 누락)' 표시를 붙여 줄 밀림을 완전히 방지합니다.
 */
function alignTranslationWithInput(parsedOutput, currentInputSegments) {
    if (!currentInputSegments || currentInputSegments.length === 0) {
        return parsedOutput;
    }

    const outputMap = new Map();
    parsedOutput.forEach((item) => {
        if (item.id) {
            outputMap.set(item.id, item.text);
        }
    });

    return currentInputSegments.map((inputSeg) => {
        const translatedText = outputMap.get(inputSeg.id);
        if (translatedText !== undefined && translatedText.trim() !== "") {
            return { id: inputSeg.id, text: translatedText };
        } else {
            console.warn(`Translation missing for segment ${inputSeg.id}. Falling back to original.`);
            return { id: inputSeg.id, text: `(번역 누락) ${inputSeg.text}` };
        }
    });
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

    const benchmarkStartTime = Date.now();

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

    let translationSucceeded = false;

    fetch(`${SERVER_BASE_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            text: taggedText,
            model: selectedModel,
            target_language: targetLanguage,
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
                    // 500이나 기타 상태도 LLM/서버에서 온 원문 메시지를 그대로 전달
                    throw new Error(errorMessage);
                });
            }
            return response.json();
        })
        .then((data) => {
            updateProgressBar(90);
            showProgress("결과 표시중...");

            // AI가 추가한 불필요한 소개 문구를 제거하고 순수 번역 텍스트만 추출
            const cleanText = cleanTranslatedText(data.translated_text);

            const parsedOutput = parseTaggedLines(cleanText);
            const alignedOutput = alignTranslationWithInput(parsedOutput, currentInputSegments);
            renderParagraphs(outputDiv, alignedOutput);
            if (currentInputSegments.length) {
                renderParagraphs(document.getElementById("input-text"), currentInputSegments);
                updateCharCounter();
            }

            updateOutputCharCounter(alignedOutput.map((p) => p.text).join("\n"));
            refreshSegMaps();
            window.refreshScrollUnits?.();
            localStorage.setItem("lastUsedProvider", selectedProvider);
            localStorage.setItem("lastUsedModel", selectedModel);
            translationSucceeded = true;
            updateProgressBar(100);
            // 벤치마크 기록 저장 (fire-and-forget)
            postBenchmarkRecord({
                model: selectedModel,
                provider: selectedProvider,
                source_lang: currentSourceLang,
                target_lang: targetLanguage,
                char_count: inputText.length,
                elapsed_ms: Date.now() - benchmarkStartTime,
                mode: "normal",
            });
            setTimeout(() => {
                hideProgress();
                updateStatus(`${inputText.length}자 번역 완료`, "success");
                if (showNotification && chrome?.notifications) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: 'icon.svg',
                        title: 'Youtube Translator',
                        message: '요청하신 번역이 성공적으로 완료되었습니다.'
                    });
                }
                // 번역 완료 음성 알림 출력 및 버튼 활성화
                speakTranslationComplete();
                updateSpeakButtonState();
            }, 500);
        })
        .catch(async (error) => {
            console.error("번역 오류:", error);
            hideProgress();
            clearInterval(progressInterval);
            const errorMessage = error.message;
            let userFriendlyMessage =
                errorMessage || "알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
            if (error.name === "AbortError") {
                userFriendlyMessage = "요청 시간이 초과되었습니다. 인터넷 연결을 확인해주세요.";
            } else if (error.name === "TypeError" && error.message.includes("fetch")) {
                const health = await checkServerHealth();
                const base = buildNetworkErrorMessage(error);
                const healthNote = health.ok
                    ? "(서버 헬스체크: 응답 OK)"
                    : "(서버 헬스체크 실패: 서버 실행 여부 확인)";
                userFriendlyMessage = `${base}\n${healthNote}`;
            } else if (error.name === "RateLimitError") {
                userFriendlyMessage = errorMessage;
            } else if (errorMessage.includes("입력 오류")) {
                userFriendlyMessage = errorMessage;
            } else {
                // LLM/서버 원문 메시지를 그대로 노출
                userFriendlyMessage = errorMessage;
            }
            outputDiv.textContent = userFriendlyMessage;
            updateOutputCharCounter(userFriendlyMessage);
            updateStatus(userFriendlyMessage, "error");
        })
        .finally(() => {
            clearInterval(progressInterval);
            clearTimeout(timeoutId);
            translateButton.disabled = false;
            inputDiv.setAttribute("contenteditable", "true");
            if (translationSucceeded) {
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

    const benchmarkStartTime = Date.now();

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

        const response = await fetch(`${SERVER_BASE_URL}/translate_stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: taggedText,
                model: selectedModel,
                target_language: targetLanguage,
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
        const alignedOutput = alignTranslationWithInput(parsedOutput, currentInputSegments);
        renderParagraphs(outputDiv, alignedOutput);
        if (currentInputSegments.length) {
            renderParagraphs(document.getElementById("input-text"), currentInputSegments);
            updateCharCounter();
        }
        updateOutputCharCounter(alignedOutput.map((p) => p.text).join("\n"));

        refreshSegMaps();
        window.refreshScrollUnits?.();

        updateStatus("스트리밍 완료", "success");
        // 벤치마크 기록 저장 (fire-and-forget)
        postBenchmarkRecord({
            model: selectedModel,
            provider: document.getElementById("provider-select").value,
            source_lang: currentSourceLang,
            target_lang: targetLanguage,
            char_count: inputText.length,
            elapsed_ms: Date.now() - benchmarkStartTime,
            mode: "stream",
        });
        // 마지막 사용 모델/프로바이더 저장
        localStorage.setItem("lastUsedProvider", document.getElementById("provider-select").value);
        localStorage.setItem("lastUsedModel", selectedModel);
        if (showNotification && chrome?.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.svg',
                title: 'Youtube Translator',
                message: '요청하신 번역이 성공적으로 완료되었습니다.'
            });
        }
        // 번역 완료 음성 알림 출력 (스트리밍) 및 버튼 활성화
        speakTranslationComplete();
        updateSpeakButtonState();
    } catch (error) {
        console.error("스트리밍 번역 오류:", error);
        if (error.name === "AbortError") {
            outputDiv.textContent = "번역이 사용자에 의해 취소되었습니다.";
            updateStatus("번역 취소됨", "warning");
        } else {
            let message = error.name === "RateLimitError" ? error.message : error.message;
            if (error.name === "TypeError" && error.message.includes("fetch")) {
                const health = await checkServerHealth();
                const base = buildNetworkErrorMessage(error);
                const healthNote = health.ok
                    ? "(서버 헬스체크: 응답 OK)"
                    : "(서버 헬스체크 실패: 서버 실행 여부 확인)";
                message = `${base}\n${healthNote}`;
            } else {
                // LLM/서버 원문 메시지를 그대로 노출
                message = error.message;
            }
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

// ===== 벤치마크 패널 =====

const LANG_NAMES = {
    ko: "한국어", en: "영어", ja: "일본어", zh: "중국어",
    es: "스페인어", fr: "프랑스어", de: "독일어",
    ru: "러시아어", pt: "포르투갈어", it: "이탈리아어",
    unknown: "?",
};

function getLangName(code) {
    if (!code) return "?";
    return LANG_NAMES[code] || code;
}

function formatElapsed(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}초`;
}

function elapsedClass(ms) {
    if (ms > 30000) return "very-slow";
    if (ms > 10000) return "slow";
    return "";
}

function formatTimestamp(iso) {
    try {
        const d = new Date(iso);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${mm}-${dd} ${hh}:${min}`;
    } catch {
        return iso;
    }
}

/**
 * 벤치마크 기록 1건을 백엔드에 저장합니다 (fire-and-forget).
 */
async function postBenchmarkRecord(record) {
    try {
        await fetch(`${SERVER_BASE_URL}/benchmark`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
        });
    } catch (e) {
        console.warn("벤치마크 저장 실패 (무시됨):", e);
    }
}

/**
 * 벤치마크 기록 전체를 백엔드에서 불러옵니다.
 */
async function fetchBenchmarkRecords() {
    const res = await fetch(`${SERVER_BASE_URL}/benchmark`);
    if (!res.ok) throw new Error("벤치마크 데이터 로드 실패");
    const data = await res.json();
    return data.records || [];
}

/**
 * 벤치마크 기록 전체를 삭제합니다.
 */
async function deleteBenchmarkRecords() {
    await fetch(`${SERVER_BASE_URL}/benchmark`, { method: "DELETE" });
}

/**
 * 기록 배열을 HTML 테이블로 렌더링합니다.
 */
function renderBenchmarkTable(records) {
    const content = document.getElementById("benchmark-content");
    const badge = document.getElementById("benchmark-count-badge");
    badge.textContent = records.length;

    if (records.length === 0) {
        content.innerHTML = `<div class="benchmark-empty">번역 기록이 없습니다.<br><small style="color:#94a3b8;">\ubc88\uc5ed\uc744 \uc644\ub8cc\ud558\uba74 \uc790\ub3d9\uc73c\ub85c \uae30\ub85d\ub429\ub2c8\ub2e4.</small></div>`;
        return;
    }

    const rows = records.map((r, i) => {
        const srcName = getLangName(r.source_lang);
        const tgtName = getLangName(r.target_lang);
        const langStr = r.source_lang === "unknown"
            ? `→ ${tgtName}`
            : `${r.source_lang} → ${tgtName}`;
        const elapsed = formatElapsed(r.elapsed_ms);
        const cls = elapsedClass(r.elapsed_ms);
        const modeLabel = r.mode === "stream" ? "스트림" : "일반";
        const modeClass = r.mode === "stream" ? "stream" : "normal";
        const modelDisplay = r.model.replace("models/", "");
        const charStr = r.char_count.toLocaleString() + "\uc790";
        return `<tr>
            <td style="color:var(--text-secondary);font-size:12px;">${i + 1}</td>
            <td style="color:var(--text-secondary);font-size:12px;white-space:nowrap;">${formatTimestamp(r.timestamp)}</td>
            <td style="font-size:12px;text-transform:capitalize;">${r.provider}</td>
            <td><span class="bm-model">${escapeHtml(modelDisplay)}</span></td>
            <td><span class="bm-lang">${escapeHtml(langStr)}</span></td>
            <td style="text-align:right;font-size:12px;">${charStr}</td>
            <td><span class="bm-time ${cls}">${elapsed}</span></td>
            <td><span class="bm-mode ${modeClass}">${modeLabel}</span></td>
        </tr>`;
    }).join("");

    content.innerHTML = `
        <table class="benchmark-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>일시</th>
                    <th>프로바이더</th>
                    <th>모델</th>
                    <th>언어</th>
                    <th style="text-align:right;">원문 글자</th>
                    <th>소요 시간</th>
                    <th>모드</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

/**
 * 벤치마크 패널 열기/닫기를 토글합니다.
 */
async function toggleBenchmarkPanel() {
    const panel = document.getElementById("benchmark-panel");
    const isOpen = panel.classList.contains("open");

    if (isOpen) {
        panel.classList.remove("open");
        return;
    }

    panel.classList.add("open");

    const content = document.getElementById("benchmark-content");
    content.innerHTML = `<div class="benchmark-loading">불러오는 중...</div>`;

    try {
        const records = await fetchBenchmarkRecords();
        renderBenchmarkTable(records);
    } catch (e) {
        content.innerHTML = `<div class="benchmark-empty" style="color:#ef4444;">데이터를 불러오지 못했습니다.<br><small>서버가 실행 중인지 확인해주세요.</small></div>`;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    // 벤치마크 패널 이벤트 등록
    document.getElementById("benchmark-btn").addEventListener("click", toggleBenchmarkPanel);
    document.getElementById("benchmark-close-btn").addEventListener("click", () => {
        document.getElementById("benchmark-panel").classList.remove("open");
    });
    document.getElementById("benchmark-clear-btn").addEventListener("click", async () => {
        if (!confirm("벤치마크 기록을 모두 삭제하시겠습니까?")) return;
        try {
            await deleteBenchmarkRecords();
            renderBenchmarkTable([]);
        } catch (e) {
            alert("삭제에 실패했습니다. 서버 상태를 확인해주세요.");
        }
    });
});
