## Context

YouTube 狼人殺遮蔽助手是 Chrome 擴充功能，使用 vanilla JS，架構為 popup（彈出視窗） → content script（YouTube 頁面） → background worker（API 代理）。目前「版面設定」的 9 組滑桿與編輯模式按鈕全部位於 popup.html 內，使用者必須在 popup 與 YouTube 影片頁面之間來回切換才能確認調整效果。

現有通訊流程：popup.js 透過 `chrome.tabs.sendMessage` 傳送 `updateLayoutConfig`、`resetLayoutConfig`、`toggleEditMode` 至 content.js；content.js 即時套用並重繪遮蔽面板。

## Goals / Non-Goals

**Goals:**
- 在 YouTube 影片頁面上注入一個浮動版面設定面板（Inline Layout Panel），讓使用者可以即時調整遮蔽容器位置與比例並立即看到效果
- 從 popup.html 移除版面設定區塊，改為一個「開啟版面設定」入口按鈕
- 搭配 UI/UX 優化，改善 popup 整體視覺層次與可讀性
- 保持 chrome.storage.sync 儲存格式不變，確保向下相容

**Non-Goals:**
- 不重新設計片段跳過設定區塊的 UI
- 不變更遮蔽面板（12 宮格）的核心邏輯
- 不引入任何前端框架（繼續使用 vanilla JS）
- 不改動 background.js 或 manifest.json

## Decisions

### 1. 浮動面板注入方式：content.js 動態建立 DOM

**選擇**: 在 content.js 中以 JavaScript 動態建立浮動面板的 DOM 結構與樣式，不使用獨立 HTML 檔案。

**理由**: 現有 content.js 已大量使用此模式（遮蔽面板、編輯模式 overlay 都是動態建立的）。不需要修改 manifest.json 的 `content_scripts`，也不需額外的 HTML inject 機制。

**替代方案**:
- Shadow DOM：更好的樣式隔離，但增加複雜度且現有 code 並未使用
- iframe：完全隔離但通訊更複雜，不適合需要即時互動的場景

### 2. 面板定位：影片播放器右上角浮動，支援拖移

**選擇**: 預設定位於影片播放器 (`#movie_player`) 右上角，使用 `position: fixed` + 計算偏移。支援拖移標題列來重新定位。

**理由**: 右上角通常不會遮擋重要的遊戲畫面（狼人殺 12 宮格位於影片兩側）。拖移功能讓使用者可以在需要時移動面板。

### 3. 面板觸發方式：popup 按鈕 + 影片頁面齒輪圖示

**選擇**:
- popup 中新增「📐 開啟版面設定」按鈕，透過 `chrome.tabs.sendMessage({ action: 'showLayoutPanel' })` 觸發
- content.js 在遮蔽層啟用時，於影片播放器角落顯示一個小齒輪按鈕 ⚙️，點擊可直接開關面板

**理由**: 雙入口降低使用門檻。齒輪按鈕讓使用者不需打開 popup 就能快速調整版面。

### 4. 面板與遮蔽層的通訊：直接函式呼叫

**選擇**: 浮動面板的滑桿事件直接呼叫 content.js 已有的 `applyLayoutConfig()`、`toggleEditMode()` 等函式，不走 chrome.runtime.sendMessage。

**理由**: 面板與遮蔽層在同一個 content script context 中執行，直接呼叫函式效能最好且最簡單。保留 popup → content 的 message 通道作為備用入口。

### 5. Popup UI 優化策略：漸進式改善

**選擇**: 保持現有 CSS 變數系統與深色主題，針對以下方向優化：
- 移除版面設定區塊後，popup 高度減少約 40%，整體更聚焦
- 改善各區塊間距與分隔
- 為「開啟版面設定」按鈕設計醒目的入口樣式

**理由**: 不做翻天覆地的 UI 重寫，避免引入新的設計債務。聚焦在移除版面設定後的空間重新配置。

### 6. 浮動面板收合狀態

**選擇**: 面板支援兩種狀態：
- **展開**: 顯示所有滑桿與控制項
- **收合**: 只顯示標題列（最小化），可再次點擊展開

面板狀態（展開/收合、位置）不持久化到 storage，每次開啟預設展開。

**理由**: 面板是臨時性操作 UI，使用者調整完畢後通常會關閉。持久化位置增加不必要的複雜度。

## Risks / Trade-offs

- **[YouTube DOM 變更]** → YouTube 可能更新播放器 DOM 結構，導致面板定位失準。Mitigation: 使用 `#movie_player` 或 `video` 元素作為錨點，配合 ResizeObserver 監聽大小變化。
- **[z-index 衝突]** → YouTube 頁面有大量 z-index 層級。Mitigation: 使用 `z-index: 10001`（高於現有遮蔽層的 9999-10000）。
- **[樣式污染]** → 注入的面板樣式可能受 YouTube CSS 影響。Mitigation: 面板所有 CSS class 使用 `wlp-` 前綴（werewolf layout panel），並為根容器設定 `all: initial` reset。
- **[全螢幕模式]** → 影片全螢幕時面板需跟隨。Mitigation: 監聽 `fullscreenchange` 事件，動態調整面板容器的掛載位置。
