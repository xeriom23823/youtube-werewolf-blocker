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
// 檢查當前是否在觀看影片頁面
function isWatchPage() {
    return window.location.href.includes('/watch');
}

// 檢查當前頻道是否應該啟用遮蔽
function shouldEnableBlocker() {
    if (!blockerEnabled) return false;
    if (blockMode === 'all') return true;
    
    const currentChannel = getCurrentChannelId();
    if (currentChannel && selectedChannels.includes(currentChannel)) {
        console.log("當前頻道在選定列表中，啟用遮蔽");
        return true;
    }
    
    return false;
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
    // YouTube 特定全螢幕模式檢測
    if (document.querySelector('.ytp-fullscreen') || 
        document.querySelector('ytd-watch-flexy[theater]') ||
        document.querySelector('.ytd-player-fullscreen')) {
        return true;
    }
    
    // 檢查影片播放器尺寸佔據整個視窗的情況
    const playerElement = document.querySelector('ytd-player');
    if (playerElement) {
        const playerRect = playerElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // 播放器尺寸超過視窗90%視為全螢幕
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
    chrome.storage?.sync.get({ 
        'werewolfBlockerEnabled': false,
        'werewolfBlockMode': 'all',
        'werewolfSelectedChannels': [],
        'werewolfBlockerPanels': null,
        'werewolfLayoutConfig': null
    }, function(result) {
        blockerEnabled = result.werewolfBlockerEnabled;
        blockMode = result.werewolfBlockMode;
        selectedChannels = result.werewolfSelectedChannels;
        
        // 如果有儲存的面板狀態，則載入
        if (result.werewolfBlockerPanels) {
            blockerPanels = result.werewolfBlockerPanels;
        } else {
            initBlockerPanels(); // 否則初始化
        }
        
        // 載入版面配置
        if (result.werewolfLayoutConfig) {
            layoutConfig = { ...getDefaultLayoutConfig(), ...result.werewolfLayoutConfig };
        } else {
            layoutConfig = getDefaultLayoutConfig();
        }
        
        console.log("讀取到的插件狀態:", {
            enabled: blockerEnabled,
            mode: blockMode,
            channels: selectedChannels,
            panels: blockerPanels,
            layout: layoutConfig
        });
        
        resetBlockerPanels();
        
        // 根據狀態顯示或隱藏遮蔽層
        if (isWatchPage()) {
            if (shouldEnableBlocker()) {
                hideIdentityInfo();
            } else {
                removeBlockers();
            }
        } else {
            removeBlockers();
        }
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

        // 找到 YouTube 影片播放器容器
        const videoContainer = document.querySelector("ytd-player");
        if (!videoContainer) {
            console.log("找不到影片播放器容器");
            return;
        }

        // 找到實際的影片元素
        const videoElement = videoContainer.querySelector("video");
        if (!videoElement) {
            console.log("找不到影片元素");
            removeBlockers();
            return;
        }

        // 如果插件禁用，則移除遮蔽層並返回
        if (!blockerEnabled) {
            removeBlockers();
            return;
        }
        
        // 檢測全螢幕模式
        const isFullscreen = isFullscreenMode();
        console.log("全螢幕模式檢測: ", isFullscreen);
        
        // 移除之前的遮蔽層
        removeBlockers();
        
        // 創建遮蔽層容器
        const [leftMainBlocker, rightMainBlocker] = createMainBlockers(isFullscreen);
        
        // 創建左側6個遮蔽面板
        for (let i = 1; i <= 6; i++) {
            const panel = createBlockerPanel(i, isFullscreen, 'left');
            leftMainBlocker.appendChild(panel);
        }
        
        // 創建右側6個遮蔽面板
        for (let i = 7; i <= 12; i++) {
            const panel = createBlockerPanel(i, isFullscreen, 'right');
            rightMainBlocker.appendChild(panel);
        }
        
        // 創建中間上方的上警區域統一控制按鈕
        createVoteControlButton(isFullscreen);
        
        // 將容器添加到適合的父元素
        if (isFullscreen) {
            document.body.appendChild(leftMainBlocker);
            document.body.appendChild(rightMainBlocker);
            console.log("已掛載全螢幕模式遮蔽層");
        } else {
            videoContainer.appendChild(leftMainBlocker);
            videoContainer.appendChild(rightMainBlocker);
            console.log("已掛載非全螢幕模式遮蔽層");
        }
    } catch (error) {
        console.error("YouTube 狼人殺遮蔽助手發生錯誤:", error);
        removeBlockers(); // 出錯時移除遮蔽層以避免用戶體驗問題
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
    const oldButton = document.getElementById('vote-control-button');
    if (oldButton) {
        oldButton.remove();
    }

    // 檢查是否有所有面板的上警狀態
    let allVoteEnabled = true;
    for (let i = 1; i <= 12; i++) {
        // 只考慮訊息區域開啟的面板
        if (blockerPanels[i].message && !blockerPanels[i].vote) {
            allVoteEnabled = false;
            break;
        }
    }

    // 創建按鈕容器
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'vote-control-container';
    
    // 從 layoutConfig 讀取上警按鈕位置
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

    // 直接註冊點擊事件 - 每次點擊時實時計算狀態
    button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        console.log("上警控制按鈕點擊");
        
        // 實時計算當前狀態
        let currentAllVoteEnabled = true;
        for (let i = 1; i <= 12; i++) {
            if (blockerPanels[i].message && !blockerPanels[i].vote) {
                currentAllVoteEnabled = false;
                break;
            }
        }
        
        // 切換到相反狀態
        toggleAllVoteBlockers(!currentAllVoteEnabled);
    }, true);

    // 組合元素
    buttonContainer.appendChild(button);

    // 添加到 DOM
    const parent = isFullscreen ? document.body : document.querySelector("ytd-player");
    if (parent) {
        parent.appendChild(buttonContainer);
    }

    return button;
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
    
    // 監聽 URL 變化
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastURL) {
            lastURL = window.location.href;
            console.log("URL 變化檢測到:", lastURL);
            
            // URL 變化時重置面板狀態並更新遮蔽
            resetBlockerPanels();
            
            if (isWatchPage()) {
                setTimeout(() => {
                    shouldEnableBlocker() ? hideIdentityInfo() : removeBlockers();
                }, 500);
            } else {
                removeBlockers();
            }
        }
    });
    
    // 監聽影響 URL 更改的 DOM 變化
    const titleElement = document.querySelector('head > title');
    if (titleElement) {
        urlObserver.observe(titleElement, { subtree: true, characterData: true, childList: true });
    }
}

// ===== 事件監聽設置 =====
// 設置全螢幕相關的事件監聽
function setupFullscreenEventListeners() {
    // 監聽標準全螢幕事件
    const fullscreenEvents = [
        'fullscreenchange', 
        'webkitfullscreenchange', 
        'mozfullscreenchange', 
        'MSFullscreenChange'
    ];
    
    fullscreenEvents.forEach(eventName => {
        document.addEventListener(eventName, () => {
            console.log(`${eventName} 事件觸發`);
            if (isWatchPage() && blockerEnabled) {
                setTimeout(hideIdentityInfo, 100);
            }
        });
    });
    
    // 監聽YouTube特定的全螢幕相關按鈕點擊
    document.addEventListener('click', (e) => {
        const fullscreenTargets = [
            '.ytp-fullscreen-button', 
            '.ytp-size-button',
            '.ytp-miniplayer-button',
            '[aria-label*="全螢幕"]',
            '[title*="全螢幕"]'
        ];
        
        const clickedFullscreenElement = fullscreenTargets.some(selector => 
            e.target.matches?.(selector) || e.target.closest?.(selector));
            
        if (clickedFullscreenElement && isWatchPage() && blockerEnabled) {
            console.log("YouTube全螢幕相關按鈕點擊");
            setTimeout(hideIdentityInfo, 200);
        }
    });
}

// 監聽劇場模式切換
function setupTheaterModeDetection() {
    const theaterModeObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'theater' && 
                isWatchPage() && blockerEnabled) {
                console.log("劇場模式變化偵測到");
                setTimeout(hideIdentityInfo, 200);
                break;
            }
        }
    });
    
    // 監聽 ytd-watch-flexy 的 theater 屬性變化
    const watchFlexy = document.querySelector('ytd-watch-flexy');
    if (watchFlexy) {
        theaterModeObserver.observe(watchFlexy, { 
            attributes: true, 
            attributeFilter: ['theater'] 
        });
    } else {
        // 如果元素不存在，等待它出現
        const bodyObserver = new MutationObserver(debounce(() => {
            const watchElement = document.querySelector('ytd-watch-flexy');
            if (watchElement) {
                theaterModeObserver.observe(watchElement, { 
                    attributes: true, 
                    attributeFilter: ['theater'] 
                });
                bodyObserver.disconnect();
            }
        }, 500));
        
        bodyObserver.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }
}

// 全螢幕偵測設置 - 增強版
function setupYouTubeFullscreenDetection() {
    console.log("設置 YouTube 全螢幕偵測");
    
    if (!isWatchPage()) return;
    
    // 監聽播放器容器
    const playerContainer = document.querySelector('ytd-player');
    if (playerContainer) {
        console.log("找到播放器容器，設置監聽");
        
        // 使用 ResizeObserver 監聽播放器容器大小變化
        const resizeObserver = new ResizeObserver(debounce(() => {
            console.log("播放器大小變化偵測到");
            if (isWatchPage() && blockerEnabled) {
                setTimeout(hideIdentityInfo, 200);
            }
        }, 150));
        
        resizeObserver.observe(playerContainer);
        
        // 監聽播放器容器類別變化
        const classObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log("播放器類別變化偵測到");
                    if (isWatchPage() && blockerEnabled) {
                        setTimeout(hideIdentityInfo, 200);
                    }
                    break;
                }
            }
        });
        
        classObserver.observe(playerContainer, { 
            attributes: true, 
            attributeFilter: ['class'] 
        });
        
        // 同時監聽影片元素的大小變化
        const videoElement = playerContainer.querySelector('video');
        if (videoElement) {
            resizeObserver.observe(videoElement);
        }
        
        // 監聽控制按鈕
        const setupButtonListener = (selector, name) => {
            const button = document.querySelector(selector);
            if (button) {
                button.addEventListener('click', () => {
                    console.log(`${name}按鈕點擊事件捕獲`);
                    if (isWatchPage() && blockerEnabled) {
                        setTimeout(hideIdentityInfo, 200);
                    }
                });
            }
        };
        
        // 設置按鈕監聽
        setupButtonListener('.ytp-fullscreen-button', '全螢幕');
        setupButtonListener('.ytp-size-button', '劇場模式');
    }
    
    // 設置劇場模式監聽
    setupTheaterModeDetection();
}

// ===== 初始化和主要事件監聽 =====
// 當 YouTube 網頁載入時執行
window.addEventListener('load', function() {
    // 載入遮蔽器狀態
    loadBlockerStatus();
    
    // 設置 URL 變化監聽
    setupURLChangeListener();
    
    // 設置全螢幕事件監聽
    setupFullscreenEventListeners();
    
    // 稍微延遲初始化，確保頁面完全載入
    setTimeout(() => {
        if (isWatchPage() && shouldEnableBlocker()) {
            hideIdentityInfo();
        }
        
        setupYouTubeFullscreenDetection();
    }, 500);
});

// 監聽視窗大小變更事件
window.addEventListener('resize', () => {
    if (isWatchPage() && shouldEnableBlocker()) {
        debouncedHideIdentityInfo();
    }
});

// 監聽網頁動態變更（如 AJAX 加載新影片）- 只檢查遮蔽層是否存在
let lastMutationCheck = 0;
const observer = new MutationObserver(() => {
    // 限制檢查頻率，每 500ms 最多檢查一次
    const now = Date.now();
    if (now - lastMutationCheck < 500) return;
    lastMutationCheck = now;
    
    if (isWatchPage() && shouldEnableBlocker() && !isUpdatingBlockers) {
        // 只檢查遮蔽層是否存在，不重建
        const existingBlockers = document.querySelectorAll('.identity-blocker-container');
        if (existingBlockers.length === 0) {
            console.log('MutationObserver: 遮蔽層不存在，重新創建');
            hideIdentityInfo();
        }
    }
});

observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
});

// 使用較低頻率的檢查來確保遮蔽層正常顯示（只在遮蔽層不存在時才重建）
setInterval(() => {
    if (isWatchPage() && blockerEnabled && !isUpdatingBlockers) {
        // 檢查遮蔽層是否存在，只有不存在時才重建
        const existingBlockers = document.querySelectorAll('.identity-blocker-container');
        if (existingBlockers.length === 0) {
            console.log('定時檢查: 遮蔽層不存在，重新創建');
            hideIdentityInfo();
        }
    }
}, 3000); // 延長到 3 秒

// 在 DOM 變化時重新檢查是否需要設置檢測
const setupObserver = new MutationObserver(debounce(() => {
    if (document.querySelector('ytd-player') && 
        !window._fullscreenDetectionSetup &&
        isWatchPage()) {
        setupYouTubeFullscreenDetection();
        window._fullscreenDetectionSetup = true;
    }
}, 1000));

setupObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
});