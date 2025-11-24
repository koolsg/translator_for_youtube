// background.js

/**
 * 번역기 탭을 생성하고 세션 스토리지에 탭 ID를 저장합니다.
 * @param {string} url - 새로 생성할 탭에 로드할 URL
 */
function createTranslatorTab(url) {
  chrome.tabs.create({ url, active: true }, (newTab) => {
    // 세션 스토리지에 새 탭의 ID를 저장합니다.
    if (newTab.id) {
      chrome.storage.session.set({ translatorTabId: newTab.id });
    }
  });
}

/**
 * 기존 번역기 탭을 재사용하거나, 없으면 새로 생성합니다.
 * @param {string} newUrl - 탭에 표시할 새로운 URL
 */
async function reuseOrCreateTab(newUrl) {
  // 세션 스토리지에서 저장된 탭 ID를 가져옵니다.
  const { translatorTabId } = await chrome.storage.session.get('translatorTabId');

  if (translatorTabId) {
    try {
      // 저장된 ID로 탭 정보를 가져옵니다.
      const tab = await chrome.tabs.get(translatorTabId);
      // 탭이 존재하면 URL을 업데이트하고 활성화합니다.
      chrome.tabs.update(tab.id, { url: newUrl, active: true });
    } catch (error) {
      // 탭을 가져오는 데 실패하면 (예: 탭이 닫힌 경우), 새로운 탭을 생성합니다.
      console.log(`Translator tab with ID ${translatorTabId} not found. Creating a new one.`);
      createTranslatorTab(newUrl);
    }
  } else {
    // 저장된 탭 ID가 없으면 새로운 탭을 생성합니다.
    createTranslatorTab(newUrl);
  }
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'showVideoId' && request.data) {
        const { videoId, videoTitle, fullUrl } = request.data;
        if (videoId) {
            const url = new URL(chrome.runtime.getURL('translator_ui.html'));
            url.searchParams.set('videoId', videoId);
            url.searchParams.set('videoTitle', videoTitle);
            url.searchParams.set('fullUrl', fullUrl);

            // 탭을 재사용하거나 새로 생성하는 함수를 호출합니다.
            reuseOrCreateTab(url.href);
        }
    }
    // 비동기 작업을 처리하기 위해 true를 반환합니다.
    return true;
});

// YouTube 동영상 페이지로 SPA 네비게이션할 때 content.js를 주입합니다.
// (manifest content_scripts와 병행하여 모든 네비게이션 시나리오 커버)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // URL이 YouTube 동영상 페이지인지 확인합니다.
    if (details.url && details.url.includes("youtube.com/watch")) {
        // content.js를 해당 탭에 주입합니다. (중복 실행은 content.js의 플래그로 방지됨)
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            files: ["content.js"]
        });
    }
});

// 탭이 닫혔을 때 세션 스토리지에서 ID를 제거하여 정리합니다.
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const { translatorTabId } = await chrome.storage.session.get('translatorTabId');
    if (tabId === translatorTabId) {
        // 닫힌 탭이 번역기 탭이면 스토리지에서 ID를 제거합니다.
        chrome.storage.session.remove('translatorTabId');
        console.log(`Translator tab with ID ${tabId} closed. Removing from session storage.`);
    }
});
