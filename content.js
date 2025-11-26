// YouTube 狼人殺遮蔽助手
// 在左右两側添加黑色遮蔽層，避免看到身分標記與訊息

// ===== 全局變數定義 =====
let blockerEnabled = false; // 預設不啟用
let blockMode = 'all'; // 預設為所有頻道
let selectedChannels = []; // 儲存選定的頻道
let blockerPanels = {}; // 儲存各遮蔽面板的狀態 (1-12號)
let layoutConfig = {}; // 儲存版面配置
let editMode = false; // 版面編輯模式
let isUpdatingBlockers = false; // 防止重複更新的旗標
let isInitialized = false; // 初始化完成標記

// ===== DOM 快取 =====
const domCache = {
    videoContainer: null,
    videoElement: null,
    watchFlexy: null,
    lastCacheTime: 0
};

// 快取有效期 (毫秒)
const CACHE_DURATION = 2000;

// 獲取快取的 DOM 元素
function getCachedElement(key, selector) {
    const now = Date.now();
    if (!domCache[key] || now - domCache.lastCacheTime > CACHE_DURATION) {
        domCache[key] = document.querySelector(selector);
        domCache.lastCacheTime = now;
    }
    return domCache[key];
}

// 清除 DOM 快取
function clearDomCache() {
    domCache.videoContainer = null;
    domCache.videoElement = null;
    domCache.watchFlexy = null;
    domCache.lastCacheTime = 0;
}

// ===== 版面配置預設值 =====
function getDefaultLayoutConfig() {
    return {
        // 遮蔽容器位置與大小 (以百分比為單位)
        containerTop: 8,           // 容器頂部偏移 (%)
        containerHeight: 87,       // 容器高度 (%)
        containerWidth: 12,        // 容器寬度 (%)
        containerLeftOffset: 7,    // 左側容器距離左邊界 (%)
        containerRightOffset: 7,   // 右側容器距離右邊界 (%)
        
        // 上警控制按鈕位置
        voteButtonTop: 3,          // 上警按鈕頂部偏移 (%)
        
        // 區域比例 (身分區域寬度佔容器的比例)
        identityWidthRatio: 20.83, // 身分區域寬度比例 (%)
        
        // 訊息與上警區域的高度比例 (flex 值)
        messageFlexRatio: 2,       // 訊息區域 flex 值
        voteFlexRatio: 1           // 上警區域 flex 值
    };
}

// 初始化版面配置
layoutConfig = getDefaultLayoutConfig();

// ===== 初始化函數 =====
// 初始化每個遮蔽面板狀態為啟用
function initBlockerPanels() {
    for (let i = 1; i <= 12; i++) {
        blockerPanels[i] = {
            identity: true, // 身分遮蔽啟用
            message: true,  // 訊息遮蔽啟用
            vote: true      // 上警區域遮蔽啟用
        };
    }
}

// 初始化面板狀態
initBlockerPanels();

// ===== 輔助判斷函數 =====
// 檢查當前是否在觀看影片頁面 (使用快取)
let cachedIsWatchPage = null;
let lastUrlCheck = '';

function isWatchPage() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrlCheck) {
        lastUrlCheck = currentUrl;
        cachedIsWatchPage = currentUrl.includes('/watch');
    }
    return cachedIsWatchPage;
}

// 檢查當前頻道是否應該啟用遮蔽
function shouldEnableBlocker() {
    if (!blockerEnabled) return false;
    if (blockMode === 'all') return true;
    if (selectedChannels.length === 0) return false;
    
    const currentChannel = getCurrentChannelId();
    return currentChannel && selectedChannels.includes(currentChannel);
}

// 獲取當前頻道ID
function getCurrentChannelId() {
    if (!isWatchPage()) return null;
    
    // 方法1: 從頻道連結獲取
    const channelLink = document.querySelector('ytd-video-owner-renderer a');
    if (channelLink?.href) {
        const channelUrl = new URL(channelLink.href);
        const channelPath = channelUrl.pathname;
        if (channelPath.includes('@')) {
            return channelPath.split('/').filter(part => part.includes('@'))[0];
        }
    }
    
    // 方法2: 直接從頻道名稱區塊獲取
    const channelName = document.querySelector('ytd-video-owner-renderer #channel-name');
    if (channelName) {
        const text = channelName.textContent.trim();
        if (text?.includes('@')) {
            return text;
        }
    }
    
    // 方法3: 從頻道資訊區域獲取
    const ownerText = document.querySelector('#owner-text a');
    return ownerText ? ownerText.textContent.trim() : null;
}

// 檢測全螢幕模式
function isFullscreenMode() {
    // 快速檢查 document.fullscreenElement
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        return true;
    }
    
    // YouTube 特定全螢幕模式檢測 - 使用快取
    const watchFlexy = getCachedElement('watchFlexy', 'ytd-watch-flexy');
    if (watchFlexy?.hasAttribute('theater') || watchFlexy?.hasAttribute('fullscreen')) {
        return true;
    }
    
    // 檢查影片播放器尺寸
    const playerElement = getCachedElement('videoContainer', 'ytd-player');
    if (playerElement) {
        const playerRect = playerElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if ((playerRect.width / viewportWidth) > 0.9 && 
            (playerRect.height / viewportHeight) > 0.9) {
            return true;
        }
    }
    
    return false;
}

// ===== 狀態管理函數 =====
// 載入遮蔽器狀態
function loadBlockerStatus() {
    chrome.storage?.sync.get([
        'werewolfBlockerEnabled',
        'werewolfBlockMode',
        'werewolfSelectedChannels',
        'werewolfBlockerPanels',
        'werewolfLayoutConfig'
    ], function(result) {
        blockerEnabled = result.werewolfBlockerEnabled ?? false;
        blockMode = result.werewolfBlockMode ?? 'all';
        selectedChannels = result.werewolfSelectedChannels ?? [];
        
        // 如果有儲存的面板狀態，則載入
        if (result.werewolfBlockerPanels) {
            blockerPanels = result.werewolfBlockerPanels;
        } else {
            initBlockerPanels();
        }
        
        // 載入版面配置
        if (result.werewolfLayoutConfig) {
            layoutConfig = { ...getDefaultLayoutConfig(), ...result.werewolfLayoutConfig };
        } else {
            layoutConfig = getDefaultLayoutConfig();
        }
        
        isInitialized = true;
        
        // 使用 requestAnimationFrame 進行 UI 更新
        requestAnimationFrame(() => {
            if (isWatchPage()) {
                shouldEnableBlocker() ? hideIdentityInfo() : removeBlockers();
            }
        });
    });
}

// 保存插件狀態到Chrome存儲
function saveBlockerStatus(status) {
    blockerEnabled = status;
    chrome.storage?.sync.set({ 'werewolfBlockerEnabled': status });
}

// 保存面板狀態
function saveBlockerPanelsState() {
    chrome.storage?.sync.set({ 'werewolfBlockerPanels': blockerPanels });
}

// 載入面板狀態
function loadBlockerPanelsState() {
    chrome.storage?.sync.get('werewolfBlockerPanels', function(result) {
        if (result.werewolfBlockerPanels) {
            blockerPanels = result.werewolfBlockerPanels;
        } else {
            initBlockerPanels();
        }
    });
}

// 重置所有面板為啟用狀態
function resetBlockerPanels() {
    initBlockerPanels();
    saveBlockerPanelsState();
}

// ===== 版面配置管理函數 =====
// 載入版面配置
function loadLayoutConfig() {
    chrome.storage?.sync.get({ 'werewolfLayoutConfig': null }, function(result) {
        if (result.werewolfLayoutConfig) {
            layoutConfig = { ...getDefaultLayoutConfig(), ...result.werewolfLayoutConfig };
        } else {
            layoutConfig = getDefaultLayoutConfig();
        }
        console.log("讀取到的版面配置:", layoutConfig);
    });
}

// 保存版面配置
function saveLayoutConfig() {
    chrome.storage?.sync.set({ 'werewolfLayoutConfig': layoutConfig });
}

// 重置版面配置為預設值
function resetLayoutConfig() {
    layoutConfig = getDefaultLayoutConfig();
    saveLayoutConfig();
}

// ===== 事件處理函數 =====
// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateBlockerStatus') {
        console.log("收到更新狀態請求:", request.enabled);
        blockerEnabled = request.enabled;
        
        if (blockerEnabled) {
            resetBlockerPanels();
        }
        
        if (isWatchPage()) {
            if (shouldEnableBlocker()) {
                hideIdentityInfo();
            } else {
                removeBlockers();
            }
        }
    } else if (request.action === 'updateBlockerSettings') {
        console.log("收到更新設定請求:", request);
        blockMode = request.blockMode;
        selectedChannels = request.selectedChannels;
        
        resetBlockerPanels();
        
        if (isWatchPage()) {
            if (shouldEnableBlocker()) {
                hideIdentityInfo();
            } else {
                removeBlockers();
            }
        }
    } else if (request.action === 'updateLayoutConfig') {
        console.log("收到更新版面配置請求:", request.layoutConfig);
        layoutConfig = { ...getDefaultLayoutConfig(), ...request.layoutConfig };
        saveLayoutConfig();
        
        // 立即重新繪製遮蔽層以應用新配置
        if (isWatchPage() && shouldEnableBlocker()) {
            hideIdentityInfo();
        }
    } else if (request.action === 'resetLayoutConfig') {
        console.log("收到重置版面配置請求");
        resetLayoutConfig();
        
        // 立即重新繪製遮蔽層以應用新配置
        if (isWatchPage() && shouldEnableBlocker()) {
            hideIdentityInfo();
        }
        
        // 回傳預設配置給 popup
        sendResponse({ layoutConfig: layoutConfig });
        return true; // 表示會異步回應
    } else if (request.action === 'getLayoutConfig') {
        // 回傳當前版面配置給 popup
        sendResponse({ layoutConfig: layoutConfig });
        return true;
    } else if (request.action === 'toggleEditMode') {
        console.log("切換編輯模式:", request.enabled);
        editMode = request.enabled;
        
        // 立即重新繪製遮蔽層以應用編輯模式
        if (isWatchPage() && shouldEnableBlocker()) {
            forceUpdateBlockers();
        }
    }
});

// ===== UI 創建函數 =====
// 創建身份遮蔽層
function hideIdentityInfo() {
    try {
        // 基本條件檢查
        if (!isWatchPage() || !shouldEnableBlocker()) {
            removeBlockers();
            return;
        }

        // 使用快取獲取影片播放器容器
        const videoContainer = getCachedElement('videoContainer', 'ytd-player');
        if (!videoContainer) {
            return;
        }

        // 獲取影片元素
        if (!domCache.videoElement) {
            domCache.videoElement = videoContainer.querySelector('video');
        }
        if (!domCache.videoElement) {
            removeBlockers();
            return;
        }

        if (!blockerEnabled) {
            removeBlockers();
            return;
        }
        
        const isFullscreen = isFullscreenMode();
        
        // 移除之前的遮蔽層
        removeBlockers();
        
        // 使用 DocumentFragment 批次創建 DOM
        const fragment = document.createDocumentFragment();
        
        // 創建遮蔽層容器
        const [leftMainBlocker, rightMainBlocker] = createMainBlockers(isFullscreen);
        
        // 創建左側6個遮蔽面板
        for (let i = 1; i <= 6; i++) {
            leftMainBlocker.appendChild(createBlockerPanel(i, isFullscreen, 'left'));
        }
        
        // 創建右側6個遮蔽面板
        for (let i = 7; i <= 12; i++) {
            rightMainBlocker.appendChild(createBlockerPanel(i, isFullscreen, 'right'));
        }
        
        fragment.appendChild(leftMainBlocker);
        fragment.appendChild(rightMainBlocker);
        
        // 創建中間上方的上警區域統一控制按鈕
        const voteButton = createVoteControlButton(isFullscreen);
        if (voteButton) fragment.appendChild(voteButton);
        
        // 一次性添加到 DOM
        const parent = isFullscreen ? document.body : videoContainer;
        parent.appendChild(fragment);
        
    } catch (error) {
        console.error("YouTube 狼人殺遮蔽助手發生錯誤:", error);
        removeBlockers();
    }
}

// 創建主要遮蔽容器
function createMainBlockers(isFullscreen) {
    const leftMainBlocker = document.createElement("div");
    const rightMainBlocker = document.createElement("div");
    
    leftMainBlocker.className = "identity-blocker-container left";
    rightMainBlocker.className = "identity-blocker-container right";
    
    // 從 layoutConfig 讀取配置數值
    const topValue = isFullscreen ? `${layoutConfig.containerTop}vh` : `${layoutConfig.containerTop}%`;
    const heightValue = isFullscreen ? `${layoutConfig.containerHeight}vh` : `${layoutConfig.containerHeight}%`;
    
    // 設定容器的基本樣式
    const containerStyle = {
        position: isFullscreen ? "fixed" : "absolute",
        zIndex: "9999",
        top: topValue,
        height: heightValue,
        width: `${layoutConfig.containerWidth}%`,
        display: "flex",
        flexDirection: "column"
    };
    
    Object.assign(leftMainBlocker.style, containerStyle, { left: `${layoutConfig.containerLeftOffset}%` });
    Object.assign(rightMainBlocker.style, containerStyle, { right: `${layoutConfig.containerRightOffset}%` });
    
    return [leftMainBlocker, rightMainBlocker];
}

// 創建單個遮蔽面板
function createBlockerPanel(panelNumber, isFullscreen, side) {
    const panelContainer = document.createElement("div");
    panelContainer.className = `identity-blocker panel-${panelNumber}`;
    panelContainer.id = `blocker-panel-${panelNumber}`;
    
    // 設定面板樣式 - 編輯模式時顯示框線
    const borderStyle = editMode 
        ? "2px dashed rgba(255, 255, 0, 0.8)" 
        : "1px solid rgba(255, 255, 255, 0.1)";
    
    Object.assign(panelContainer.style, {
        flex: "1",
        position: "relative",
        border: borderStyle,
        display: "flex",
        flexDirection: side === 'left' ? "row" : "row-reverse", // 水平排列，根據側邊調整方向
        pointerEvents: "auto"
    });

    // 創建身分遮蔽區域
    const identityBlocker = createIdentitySection(panelNumber, side);
    
    // 創建右側容器（包含訊息和上警區域）
    const messageContainer = createMessageContainer(panelNumber);
    
    // 創建訊息遮蔽區域
    const messageBlocker = createMessageSection(panelNumber);
    
    // 創建上警遮蔽區域
    const voteBlocker = createVoteSection(panelNumber);
    
    // 如果訊息區域關閉，則上警區域也需要關閉
    if (!blockerPanels[panelNumber].message) {
        blockerPanels[panelNumber].vote = false;
    }
    
    // 創建數字標籤
    const numberLabel = createNumberLabel(panelNumber, side);
    
    // 添加訊息和上警區域到其容器
    messageContainer.appendChild(messageBlocker);
    messageContainer.appendChild(voteBlocker);
    
    // 添加元素到主面板
    panelContainer.appendChild(identityBlocker);
    panelContainer.appendChild(messageContainer);
    panelContainer.appendChild(numberLabel);
    
    return panelContainer;
}

// 創建身分區域
function createIdentitySection(panelNumber, side) {
    const identityBlocker = document.createElement("div");
    identityBlocker.className = `identity-section panel-${panelNumber}-identity`;
    identityBlocker.id = `blocker-panel-${panelNumber}-identity`;
    
    // 計算身分區域寬度與訊息區域寬度
    const identityWidth = layoutConfig.identityWidthRatio;
    
    // 設定基本樣式
    const commonStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        width: `${identityWidth}%`,
        height: "100%"  // 身分區域通常佔據全高
    };
    
    Object.assign(identityBlocker.style, commonStyle, {
        backgroundColor: getBlockerBackgroundColor(blockerPanels[panelNumber].identity, 'identity'),
        border: editMode ? "1px solid rgba(255, 0, 0, 0.8)" : "none"
    });
    
    // 創建身分區域控制按鈕，設為預設隱藏，僅在滑鼠懸停時顯示
    const identityButton = createBlockerButton(
        blockerPanels[panelNumber].identity ? "關閉身分" : "開啟身分",
        panelNumber,
        'identity'
    );
    
    // 針對身分區域按鈕特殊處理 - 預設隱藏
    identityButton.style.display = 'none';
    
    // 添加按鈕到區域
    identityBlocker.appendChild(identityButton);
    
    // 為身分區域添加滑鼠事件，控制按鈕顯示/隱藏
    if (blockerPanels[panelNumber].identity) {
        identityBlocker.addEventListener('mouseenter', () => {
            identityButton.style.display = 'block';
        });
        
        identityBlocker.addEventListener('mouseleave', () => {
            identityButton.style.display = 'none';
        });
    }
    
    return identityBlocker;
}

// 創建訊息容器
function createMessageContainer(panelNumber) {
    const messageContainer = document.createElement("div");
    messageContainer.className = `message-container-${panelNumber}`;
    
    // 計算訊息容器寬度 (100% - 身分區域寬度)
    const messageContainerWidth = 100 - layoutConfig.identityWidthRatio;
    
    Object.assign(messageContainer.style, {
        display: "flex",
        flexDirection: "column", // 垂直排列訊息和上警區域
        flex: "1", // 佔據剩餘空間
        width: `${messageContainerWidth}%`
    });
    
    return messageContainer;
}

// 創建訊息區域
function createMessageSection(panelNumber) {
    const messageBlocker = document.createElement("div");
    messageBlocker.className = `message-section panel-${panelNumber}-message`;
    messageBlocker.id = `blocker-panel-${panelNumber}-message`;
    
    const commonStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flex: String(layoutConfig.messageFlexRatio) // 從配置讀取 flex 值
    };
    
    Object.assign(messageBlocker.style, commonStyle, {
        backgroundColor: getBlockerBackgroundColor(blockerPanels[panelNumber].message, 'message'),
        border: editMode ? "1px solid rgba(0, 255, 0, 0.8)" : "none"
    });
    
    // 創建訊息區域控制按鈕
    const messageButton = createBlockerButton(
        blockerPanels[panelNumber].message ? "關閉訊息" : "開啟訊息",
        panelNumber,
        'message'
    );
    
    // 添加按鈕到訊息區域
    messageBlocker.appendChild(messageButton);
    
    return messageBlocker;
}

// 創建上警區域
function createVoteSection(panelNumber) {
    const voteBlocker = document.createElement("div");
    voteBlocker.className = `vote-section panel-${panelNumber}-vote`;
    voteBlocker.id = `blocker-panel-${panelNumber}-vote`;
    
    const commonStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flex: String(layoutConfig.voteFlexRatio) // 從配置讀取 flex 值
    };
    
    Object.assign(voteBlocker.style, commonStyle, {
        backgroundColor: getBlockerBackgroundColor(blockerPanels[panelNumber].vote, 'vote'),
        border: editMode ? "1px solid rgba(0, 0, 255, 0.8)" : "none"
    });
    
    return voteBlocker;
}

// 創建數字標籤
function createNumberLabel(panelNumber, side) {
    const numberLabel = document.createElement("div");
    numberLabel.className = "blocker-number";
    numberLabel.textContent = panelNumber;
    
    Object.assign(numberLabel.style, {
        position: "absolute",
        top: "5px",
        [side === 'left' ? 'left' : 'right']: "5px",
        fontSize: "16px",
        fontWeight: "bold",
        color: "rgba(255, 255, 255, 0.7)",
        textShadow: "1px 1px 2px black",
        zIndex: "10001",
        padding: "2px 5px",
        borderRadius: "3px",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        display: blockerPanels[panelNumber].identity ? "block" : "none"
    });
    
    return numberLabel;
}

// 獲取遮蔽區域的背景顏色
function getBlockerBackgroundColor(isEnabled, section) {
    if (!isEnabled) return "transparent";
    
    // 編輯模式時使用半透明背景
    if (editMode) {
        switch (section) {
            case 'identity':
                return "rgba(255, 0, 0, 0.3)"; // 紅色半透明
            case 'message':
                return "rgba(0, 255, 0, 0.3)"; // 綠色半透明
            case 'vote':
                return "rgba(0, 0, 255, 0.3)"; // 藍色半透明
            default:
                return "rgba(0, 0, 0, 0.5)";
        }
    }
    
    return "rgba(0, 0, 0, 1.0)";
}

// 創建按鈕輔助函數 - 使用面板號碼和區域類型而非閉包
function createBlockerButton(text, panelNumber, section) {
    const button = document.createElement("button");
    button.className = "blocker-toggle-button";
    button.textContent = text;
    button.dataset.panelNumber = panelNumber;
    button.dataset.section = section;
    
    // 使用絕對定位避免影響布局
    Object.assign(button.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        padding: "5px 10px",
        fontSize: "11px",
        backgroundColor: "rgba(255, 255, 255, 0.4)",
        color: "white",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        borderRadius: "4px",
        cursor: "pointer",
        opacity: "1",
        pointerEvents: "auto",
        zIndex: "10002",
        fontWeight: "bold",
        textShadow: "1px 1px 1px black",
        whiteSpace: "nowrap"
    });
    
    // 使用命名函數而非匿名函數，並經由全局處理器
    button.addEventListener("click", handleBlockerButtonClick, true);
    
    return button;
}

// 全局按鈕點擊處理器
function handleBlockerButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    const button = event.currentTarget;
    const panelNumber = parseInt(button.dataset.panelNumber);
    const section = button.dataset.section;
    
    if (!panelNumber || !section) {
        console.warn("按鈕缺少必要資料");
        return;
    }
    
    console.log(`按鈕點擊: 面板 ${panelNumber}, 區域 ${section}`);
    
    // 切換區域狀態
    performToggleSection(panelNumber, section);
}

// 執行區域切換
function performToggleSection(panelNumber, section) {
    // 檢查面板號碼是否有效
    if (!blockerPanels[panelNumber]) {
        console.warn(`面板 ${panelNumber} 不存在`);
        return;
    }
    
    // 切換此面板的指定區域狀態
    blockerPanels[panelNumber][section] = !blockerPanels[panelNumber][section];
    
    // 處理訊息與上警區域的聯動關係
    if (section === 'message' && !blockerPanels[panelNumber].message) {
        blockerPanels[panelNumber].vote = false;
    }
    
    console.log(`${panelNumber}號面板 ${section} 遮蔽狀態:`, blockerPanels[panelNumber][section]);
    
    // 保存狀態
    saveBlockerPanelsState();
    
    // 直接更新 DOM 而不是重建整個遮蔽層
    updateSingleSectionVisual(panelNumber, section);
    
    // 更新中央控制按鈕狀態
    updateVoteControlButton();
}

// 更新單一區域的視覺效果
function updateSingleSectionVisual(panelNumber, section) {
    const elementId = `blocker-panel-${panelNumber}-${section}`;
    const element = document.getElementById(elementId);
    
    if (!element) {
        console.warn(`找不到元素: ${elementId}`);
        return;
    }
    
    const isEnabled = blockerPanels[panelNumber][section];
    
    // 更新背景色
    element.style.backgroundColor = getBlockerBackgroundColor(isEnabled, section);
    
    // 更新按鈕文字
    const button = element.querySelector('.blocker-toggle-button');
    if (button) {
        const enableText = section === 'identity' ? "開啟身分" : 
                          section === 'message' ? "開啟訊息" : "開啟上警";
        const disableText = section === 'identity' ? "關閉身分" : 
                           section === 'message' ? "關閉訊息" : "關閉上警";
        button.textContent = isEnabled ? disableText : enableText;
        
        // 身分區域按鈕特殊處理
        if (section === 'identity') {
            button.style.display = isEnabled ? 'none' : 'block';
        }
    }
    
    // 更新數字標籤 (只適用於身分區域)
    if (section === 'identity') {
        const numberLabel = document.querySelector(`#blocker-panel-${panelNumber} .blocker-number`);
        if (numberLabel) {
            numberLabel.style.display = isEnabled ? 'block' : 'none';
        }
    }
    
    // 如果關閉訊息區域，同時更新上警區域
    if (section === 'message' && !isEnabled) {
        updateSingleSectionVisual(panelNumber, 'vote');
    }
}

// 強制更新遮蔽層（用於版面配置變更或編輯模式切換）
function forceUpdateBlockers() {
    if (isUpdatingBlockers) return;
    isUpdatingBlockers = true;
    
    removeBlockers();
    
    // 短暂延遲後重建
    setTimeout(() => {
        hideIdentityInfo();
        isUpdatingBlockers = false;
    }, 50);
}

// 創建中間上方的上警區域統一控制按鈕
function createVoteControlButton(isFullscreen) {
    // 移除舊的按鈕（如果存在）
    const oldButton = document.getElementById('vote-control-container');
    if (oldButton) oldButton.remove();

    // 檢查是否有所有面板的上警狀態
    let allVoteEnabled = true;
    for (let i = 1; i <= 12; i++) {
        if (blockerPanels[i].message && !blockerPanels[i].vote) {
            allVoteEnabled = false;
            break;
        }
    }

    // 創建按鈕容器
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'vote-control-container';
    
    const topValue = isFullscreen ? `${layoutConfig.voteButtonTop}vh` : `${layoutConfig.voteButtonTop}%`;
    
    Object.assign(buttonContainer.style, {
        position: isFullscreen ? 'fixed' : 'absolute',
        top: topValue,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '10000',
        padding: '5px 10px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto'
    });
    
    // 創建按鈕
    const button = document.createElement('button');
    button.id = 'vote-control-button';
    button.textContent = allVoteEnabled ? '關閉所有上警區' : '開啟所有上警區';
    
    Object.assign(button.style, {
        padding: '8px 15px',
        backgroundColor: allVoteEnabled ? 'rgba(255, 100, 100, 0.9)' : 'rgba(100, 255, 100, 0.9)',
        color: 'black',
        border: '2px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '13px'
    });

    button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        let currentAllVoteEnabled = true;
        for (let i = 1; i <= 12; i++) {
            if (blockerPanels[i].message && !blockerPanels[i].vote) {
                currentAllVoteEnabled = false;
                break;
            }
        }
        
        toggleAllVoteBlockers(!currentAllVoteEnabled);
    }, true);

    buttonContainer.appendChild(button);
    return buttonContainer;
}

// ===== UI 更新函數 =====
// 切換遮蔽區域狀態
function toggleBlockerSection(event, panelNumber, section, element, numberLabel) {
    // 阻止事件冒泡，防止觸發到上層元素的事件
    event.stopPropagation();
    event.preventDefault();
    
    // 檢查面板號碼是否有效
    if (!blockerPanels[panelNumber]) {
        console.warn(`面板 ${panelNumber} 不存在`);
        return;
    }
    
    // 切換此面板的指定區域狀態
    blockerPanels[panelNumber][section] = !blockerPanels[panelNumber][section];
    
    // 處理訊息與上警區域的聯動關係
    if (section === 'message' && !blockerPanels[panelNumber][section]) {
        // 如果訊息區域被關閉，則同時關閉上警區域
        blockerPanels[panelNumber].vote = false;
        
        // 更新上警區域 DOM
        updateVoteBlockerVisual(panelNumber);
    }
    
    // 更新區域外觀
    updateSectionVisual(panelNumber, section, element, numberLabel);
    
    // 輸出用於除錯
    console.log(`${panelNumber}號面板 ${section} 遮蔽狀態:`, blockerPanels[panelNumber][section], 
        '樣式:', element.style.backgroundColor,
        'cssText:', element.style.cssText);
    
    // 保存狀態
    saveBlockerPanelsState();
    
    // 更新中央控制按鈕狀態
    if (section === 'vote') {
        updateVoteControlButton();
    }
}

// 更新區域視覺效果
function updateSectionVisual(panelNumber, section, element, numberLabel) {
    if (blockerPanels[panelNumber][section]) {
        // 啟用遮蔽 (顯示黑色)
        element.style.cssText += 'background-color: rgba(0, 0, 0, 1.0) !important;';
        element.classList.remove('blocker-transparent');
        
        // 找到按鈕並更新
        const button = element.querySelector('.blocker-toggle-button');
        if (button) {
            // 根據區域類型更新按鈕文字
            button.textContent = section === 'identity' ? "關閉身分" : 
                               section === 'message' ? "關閉訊息" : "關閉上警";
            
            button.style.display = 'block';
            
            // 視覺反饋
            button.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
            setTimeout(() => {
                button.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
            }, 200);
        }
        
        // 顯示數字標籤 (只適用於身分區域)
        if (numberLabel && section === 'identity') {
            numberLabel.style.display = 'block';
        }
    } else {
        // 停用遮蔽 (透明)
        element.style.cssText += 'background-color: transparent !important; background: none !important;';
        element.classList.add('blocker-transparent');
        
        // 找到按鈕
        const button = element.querySelector('.blocker-toggle-button');
        if (button) {
            // 根據區域類型更新按鈕文字與顯示狀態
            button.textContent = section === 'identity' ? "開啟身分" : 
                               section === 'message' ? "開啟訊息" : "開啟上警";
            
            button.style.display = section === 'identity' ? 'none' : 'block';
        }
        
        // 隱藏數字標籤 (只適用於身分區域)
        if (numberLabel && section === 'identity') {
            numberLabel.style.display = 'none';
        }
    }
}

// 更新上警控制按鈕狀態
function updateVoteControlButton() {
    const button = document.getElementById('vote-control-button');
    if (button) {
        // 檢查是否所有面板的上警區域都已啟用
        let allVoteEnabled = true;

        for (let i = 1; i <= 12; i++) {
            // 只考慮訊息區域開啟的面板
            if (blockerPanels[i].message && !blockerPanels[i].vote) {
                allVoteEnabled = false;
                break;
            }
        }

        // 更新按鈕文字與樣式
        button.textContent = allVoteEnabled ? '關閉所有上警區' : '開啟所有上警區';
        button.style.backgroundColor = allVoteEnabled ? 'rgba(255, 100, 100, 0.8)' : 'rgba(100, 255, 100, 0.8)';
        
        console.log(`更新上警控制按鈕: ${button.textContent}`);
    }
}

// 切換所有上警區域的顯示狀態
function toggleAllVoteBlockers(enable) {
    console.log(`嘗試${enable ? '開啟' : '關閉'}所有上警區域`);
    
    // 在執行之前檢查狀態，避免不必要的更新
    let allPanelsAtDesiredState = true;
    
    for (let i = 1; i <= 12; i++) {
        if (blockerPanels[i].message) {  // 只處理訊息區域啟用的面板
            if ((enable && !blockerPanels[i].vote) || (!enable && blockerPanels[i].vote)) {
                allPanelsAtDesiredState = false;
                break;
            }
        }
    }
    
    // 如果已經都是想要的狀態，則不需要執行後續步驟
    if (allPanelsAtDesiredState) {
        console.log("所有面板已經處於目標狀態，不需更新");
        return;
    }
    
    // 更新所有面板的上警區域狀態
    let changesMade = false;
    
    for (let i = 1; i <= 12; i++) {
        // 只處理訊息區域啟用的面板
        if (blockerPanels[i].message) {
            const shouldChange = (enable && !blockerPanels[i].vote) || (!enable && blockerPanels[i].vote);
            
            if (shouldChange) {
                blockerPanels[i].vote = enable;
                changesMade = true;
                console.log(`${enable ? '開啟' : '關閉'}面板 ${i} 的上警區域`);
            }
        }
    }
    
    // 只有當確實有變更時才保存狀態並更新UI
    if (changesMade) {
        // 保存狀態
        saveBlockerPanelsState();
        
        // 立即更新所有上警區域的視覺效果，而不必重繪整個界面
        for (let i = 1; i <= 12; i++) {
            updateVoteBlockerVisual(i);
        }
        
        // 更新控制按鈕狀態
        updateVoteControlButton();
    }
}

// 直接更新上警區域視覺效果的輔助函數
function updateVoteBlockerVisual(panelNumber) {
    const voteElement = document.getElementById(`blocker-panel-${panelNumber}-vote`);
    if (voteElement) {
        if (blockerPanels[panelNumber].vote) {
            voteElement.style.cssText += 'background-color: rgba(0, 0, 0, 1.0) !important;';
            voteElement.classList.remove('blocker-transparent');
        } else {
            voteElement.style.cssText += 'background-color: transparent !important; background: none !important;';
            voteElement.classList.add('blocker-transparent');
        }
    }
}

// 針對單個面板控制上警區顯示狀態
function toggleVoteBlocker(panelNumber, enable) {
    if (blockerPanels[panelNumber]) {
        // 如果要啟用上警區，需檢查訊息區是否啟用
        blockerPanels[panelNumber].vote = enable && blockerPanels[panelNumber].message;
        
        // 更新 DOM 元素
        updateVoteBlockerVisual(panelNumber);
        
        // 保存狀態
        saveBlockerPanelsState();
        
        // 更新中央控制按鈕狀態
        updateVoteControlButton();
    }
}

// ===== 工具函數 =====
// 輔助函數：移除所有遮蔽層
function removeBlockers() {
    const oldBlockers = document.querySelectorAll(".identity-blocker-container");
    oldBlockers.forEach(blocker => blocker.remove());
    
    const voteControl = document.getElementById('vote-control-container');
    if (voteControl) voteControl.remove();
}

// 使用防抖動函數限制頻繁呼叫
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 防抖動版本的遮蔽函數
const debouncedHideIdentityInfo = debounce(hideIdentityInfo, 150);

// URL 變化監聽，處理 YouTube 的單頁應用導航
function setupURLChangeListener() {
    let lastURL = window.location.href;
    
    // 使用 Navigation API (如果可用) 或 popstate
    window.addEventListener('popstate', handleURLChange);
    
    // 監聽 URL 變化 - 合併到 unifiedObserver 中，此處只處理 history API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        handleURLChange();
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        handleURLChange();
    };
    
    function handleURLChange() {
        if (window.location.href !== lastURL) {
            lastURL = window.location.href;
            clearDomCache();
            cachedIsWatchPage = null;
            
            // URL 變化時重置面板狀態
            resetBlockerPanels();
            
            // 使用 requestAnimationFrame 而非 setTimeout
            requestAnimationFrame(() => {
                if (isWatchPage()) {
                    shouldEnableBlocker() ? hideIdentityInfo() : removeBlockers();
                } else {
                    removeBlockers();
                }
            });
        }
    }
}

// ===== 事件監聽設置 =====
// 設置全螢幕相關的事件監聽
function setupFullscreenEventListeners() {
    // 監聽標準全螢幕事件 - 使用單一處理器
    const handleFullscreenChange = () => {
        if (isWatchPage() && blockerEnabled) {
            requestAnimationFrame(hideIdentityInfo);
        }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // 監聽YouTube特定的全螢幕相關按鈕點擊 - 使用事件委派
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches?.('.ytp-fullscreen-button, .ytp-size-button') || 
            target.closest?.('.ytp-fullscreen-button, .ytp-size-button')) {
            if (isWatchPage() && blockerEnabled) {
                // 使用 requestAnimationFrame 而非 setTimeout
                requestAnimationFrame(() => {
                    setTimeout(hideIdentityInfo, 50);
                });
            }
        }
    }, { passive: true });
}

// 監聽劇場模式切換
function setupTheaterModeDetection() {
    const watchFlexy = getCachedElement('watchFlexy', 'ytd-watch-flexy');
    if (!watchFlexy) return;
    
    const theaterModeObserver = new MutationObserver(() => {
        if (isWatchPage() && blockerEnabled) {
            requestAnimationFrame(hideIdentityInfo);
        }
    });
    
    theaterModeObserver.observe(watchFlexy, { 
        attributes: true, 
        attributeFilter: ['theater', 'fullscreen'] 
    });
}

// 全螢幕偵測設置 - 簡化版
function setupYouTubeFullscreenDetection() {
    if (!isWatchPage()) return;
    
    const playerContainer = getCachedElement('videoContainer', 'ytd-player');
    if (!playerContainer) return;
    
    // 使用單一 ResizeObserver 監聽大小變化
    const resizeObserver = new ResizeObserver(debounce(() => {
        if (isWatchPage() && blockerEnabled) {
            requestAnimationFrame(hideIdentityInfo);
        }
    }, 200));
    
    resizeObserver.observe(playerContainer);
    
    // 監聽影片元素大小變化
    const videoElement = playerContainer.querySelector('video');
    if (videoElement) {
        resizeObserver.observe(videoElement);
    }
    
    // 設置劇場模式監聽
    setupTheaterModeDetection();
}

// ===== 初始化和主要事件監聽 =====
// 當 YouTube 網頁載入時執行
function initializeExtension() {
    if (isInitialized) return;
    
    // 載入遮蔽器狀態
    loadBlockerStatus();
    
    // 設置 URL 變化監聽
    setupURLChangeListener();
    
    // 設置全螢幕事件監聽（延遲執行，非關鍵路徑）
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(setupFullscreenEventListeners);
        requestIdleCallback(setupYouTubeFullscreenDetection);
    } else {
        setTimeout(setupFullscreenEventListeners, 100);
        setTimeout(setupYouTubeFullscreenDetection, 200);
    }
}

// 使用 DOMContentLoaded 更早啟動
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension, { once: true });
} else {
    initializeExtension();
}

// 監聽視窗大小變更事件 - 使用 requestAnimationFrame 優化
let resizeScheduled = false;
window.addEventListener('resize', () => {
    if (!resizeScheduled && isWatchPage() && shouldEnableBlocker()) {
        resizeScheduled = true;
        requestAnimationFrame(() => {
            debouncedHideIdentityInfo();
            resizeScheduled = false;
        });
    }
});

// 統一的 MutationObserver - 合併多個觀察器
let lastMutationCheck = 0;
const MUTATION_THROTTLE = 1000; // 提高到 1 秒

const unifiedObserver = new MutationObserver((mutations) => {
    const now = Date.now();
    if (now - lastMutationCheck < MUTATION_THROTTLE) return;
    
    // 檢查是否有需要處理的變化
    let needsUpdate = false;
    let urlChanged = false;
    
    for (const mutation of mutations) {
        // 檢查 URL 變化（通過 title 變化）
        if (mutation.target.nodeName === 'TITLE') {
            urlChanged = true;
            break;
        }
        // 檢查播放器相關變化
        if (mutation.target.id === 'movie_player' || 
            mutation.target.classList?.contains('html5-video-player')) {
            needsUpdate = true;
            break;
        }
    }
    
    lastMutationCheck = now;
    
    if (urlChanged) {
        clearDomCache();
        cachedIsWatchPage = null;
    }
    
    if (isWatchPage() && shouldEnableBlocker() && !isUpdatingBlockers) {
        const existingBlockers = document.querySelectorAll('.identity-blocker-container');
        if (existingBlockers.length === 0 || needsUpdate) {
            requestAnimationFrame(hideIdentityInfo);
        }
    }
});

// 只觀察必要的變化
unifiedObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
});

// 使用 visibility change 代替 setInterval 進行檢查
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isWatchPage() && blockerEnabled) {
        const existingBlockers = document.querySelectorAll('.identity-blocker-container');
        if (existingBlockers.length === 0) {
            requestAnimationFrame(hideIdentityInfo);
        }
    }
});