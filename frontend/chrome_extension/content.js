// content.js

// 스크립트가 중복 실행되는 것을 방지하기 위한 플래그
if (window.hasMyTranslatorContentScript) {
    // 이미 스크립트가 주입되었다면, 아무것도 하지 않고 종료
} else {
    window.hasMyTranslatorContentScript = true;

    // 유튜브 페이지에 아이콘 버튼을 만들고, 클릭 시 background.js로 메시지를 보냅니다.
    async function ensureIcon(button) {
        try {
            const response = await fetch(chrome.runtime.getURL('icon.svg'));
            if (!response.ok) throw new Error('Icon load failed');
            const svgText = await response.text();
            button.innerHTML = svgText.replace('<svg', '<svg style="fill: currentColor; display: block; margin: 0 auto; width: 24px; height: 24px;"');
        } catch (error) {
            console.error(error);
            button.textContent = 'NT'; // Fallback text
        }
    }

    function createSimpleButton() {
        if (document.querySelector('button[data-simple-new-tab-button]')) return;

        const settingsButton = document.querySelector('.ytp-settings-button');
        if (!settingsButton) return;

        const playerControls = settingsButton.parentElement;
        if (!playerControls) return;

        const newTabButton = document.createElement('button');
        newTabButton.className = 'ytp-button';
        newTabButton.dataset.simpleNewTabButton = 'true';
        newTabButton.title = 'YouTube Translator';

        ensureIcon(newTabButton); // Use icon instead of text

        newTabButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const videoId = new URL(window.location.href).searchParams.get('v');
            const fullUrl = window.location.href;
            const videoTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent.trim() || 'Unknown Title';

            if (videoId) {
                // 메시지를 보내기 전에 chrome.runtime 컨텍스트가 유효한지 확인합니다.
                if (chrome.runtime && chrome.runtime.id) {
                    try {
                        chrome.runtime.sendMessage({ action: 'showVideoId', data:{ fullUrl: fullUrl, videoTitle: videoTitle, videoId: videoId }}, () => {
                            if (chrome.runtime.lastError) {
                                // 오류 메시지를 경고(warn) 대신 정보(log)로 변경하여, 심각한 문제처럼 보이지 않게 합니다.
                                console.log(
                                    '메시지 전송 실패 (페이지 이동 또는 확장 프로그램 리로드로 인해 발생할 수 있음):',
                                    chrome.runtime.lastError.message
                                );
                            }
                        });
                    } catch (error) {
                        // 이 catch 블록은 거의 실행되지 않지만, 만약을 위해 유지합니다.
                        console.warn(
                            '메시지 전송 중 예외 발생:',
                            error.message
                        );
                    }
                } else {
                    // 컨텍스트가 이미 무효화된 경우, 아무 작업도 하지 않고 로그만 남깁니다.
                    console.log('확장 프로그램 컨텍스트가 무효화되어 메시지를 전송할 수 없습니다.');
                }
            } else {
                console.error('YouTube Video ID not found.');
            }
        });

        playerControls.insertBefore(newTabButton, settingsButton);
    }

    const observer = new MutationObserver(() => {
        createSimpleButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    createSimpleButton();
}