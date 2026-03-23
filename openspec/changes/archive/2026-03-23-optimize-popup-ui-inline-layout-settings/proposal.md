## Why

目前「版面設定」位於擴充功能彈出視窗中，使用者在拖動滑桿調整遮蔽容器位置時，必須在彈出視窗與 YouTube 影片頁面之間來回切換才能確認效果，體驗割裂且低效。此外彈出視窗整體 UI 缺乏視覺層次，資訊密度高但可讀性不足。

## What Changes

- **移除** 彈出視窗中的「📐 版面設定」區塊（含所有滑桿與編輯模式按鈕）
- **新增** 嵌入於 YouTube 影片頁面的浮動版面設定面板（Inline Layout Panel），讓使用者可在影片上即時預覽並調整遮蔽容器位置與比例
- **新增** 彈出視窗中的「開啟版面設定」入口按鈕，點擊後在影片頁面喚起浮動面板
- **優化** 彈出視窗整體 UI 設計：改善視覺層次、排版、配色與互動回饋

## Capabilities

### New Capabilities
- `inline-layout-panel`: 嵌入 YouTube 影片頁面的浮動版面設定面板，包含所有佈局滑桿、編輯模式切換、重設按鈕，支援拖移定位與收合，與 content.js 直接通訊實現即時預覽

### Modified Capabilities
- `popup-ui`: 彈出視窗 UI 重新設計，移除版面設定區塊，新增「開啟版面設定」按鈕，並優化整體視覺層次與排版

## Impact

- `popup.html` / `popup.js`：移除版面設定 HTML 區塊及對應滑桿事件處理；新增「開啟版面設定」按鈕及 sendMessage 呼叫
- `content.js`：新增 `showLayoutPanel` / `hideLayoutPanel` message 處理；注入浮動面板 DOM 與事件邏輯；保留既有 `updateLayoutConfig`、`resetLayoutConfig`、`toggleEditMode` 訊息處理
- `styles.css`：新增浮動面板樣式（定位、動畫、滑桿外觀）
- 不影響 `background.js` 或 manifest.json
- 無 breaking changes：儲存格式 (`werewolfLayoutConfig` in chrome.storage.sync) 保持不變
