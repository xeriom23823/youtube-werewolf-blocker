## 1. Popup UI 改造

- [x] 1.1 從 popup.html 移除整個「版面設定」區塊（layout-settings div，含 layout-header、layout-content、所有滑桿、edit-mode-toggle、reset-layout 按鈕）
- [x] 1.2 在 popup.html 的頻道設定與片段跳過設定之間，新增「📐 開啟版面設定」入口按鈕（使用 primary-gradient 樣式）
- [x] 1.3 從 popup.js 移除版面設定相關程式碼：setupLayoutSliders()、updateSliderValue()、updateLayoutSliders()、saveLayoutConfig()、sendLayoutToTabs()、editMode 相關邏輯
- [x] 1.4 在 popup.js 中為「開啟版面設定」按鈕實作事件處理：向當前 YouTube tab 發送 `showLayoutPanel` 訊息；若無 YouTube tab 則 disable 按鈕並顯示提示
- [x] 1.5 調整 popup.html 的 CSS：移除 layout-settings 相關樣式，為入口按鈕新增醒目樣式，確認移除後各區塊間距一致

## 2. 浮動面板基礎建構（content.js）

- [ ] 2.1 在 content.js 中新增 `createLayoutPanel()` 函式：動態建立浮動面板 DOM 結構（root container、header、body、close/minimize 按鈕），所有 class 使用 `wlp-` 前綴
- [ ] 2.2 在 content.js 中新增 `createLayoutPanelStyles()` 函式：注入面板的 CSS 樣式（`all: initial` reset、深色主題配色、滑桿樣式），使用 `<style id="wlp-styles">` 標籤
- [ ] 2.3 實作面板的顯示/隱藏邏輯：`showLayoutPanel()` 與 `hideLayoutPanel()` 函式，控制面板的可見性

## 3. 齒輪圖示入口

- [ ] 3.1 在遮蔽層啟用時，於影片播放器右上角注入一個齒輪圖示按鈕（⚙️），使用 `wlp-gear-btn` class
- [ ] 3.2 齒輪按鈕點擊事件：切換面板的顯示/隱藏
- [ ] 3.3 遮蔽層停用或非 watch page 時，移除齒輪按鈕

## 4. 面板滑桿與控制項

- [ ] 4.1 在面板 body 中建立 3 組滑桿群組（遮蔽容器位置 5 項、區域比例 3 項、控制按鈕 1 項），含標題、標籤與數值顯示
- [ ] 4.2 滑桿 `input` 事件：即時更新數值顯示並直接呼叫 content.js 的版面重繪函式（不走 chrome.runtime.sendMessage）
- [ ] 4.3 滑桿 `change` 事件：更新 `layoutConfig` 物件並保存至 `chrome.storage.sync`
- [ ] 4.4 實作「🔧 編輯模式」切換按鈕：直接操作 content.js 的 `editMode` 變數並呼叫 `forceUpdateBlockers()`
- [ ] 4.5 實作「🔄 恢復預設值」按鈕：呼叫既有 `resetLayoutConfig()`，並更新面板內所有滑桿的顯示值

## 5. 面板拖移與收合

- [ ] 5.1 實作面板 header 的拖移功能：mousedown/mousemove/mouseup 事件處理，更新面板 position
- [ ] 5.2 加入視窗邊界限制：拖移時確保面板不超出 viewport
- [ ] 5.3 實作收合/展開功能：minimize 按鈕切換面板 body 的顯示/隱藏，按鈕圖示在 ▼/▲ 之間切換

## 6. 訊息處理與全螢幕

- [ ] 6.1 在 content.js 的 `chrome.runtime.onMessage` 監聽器中新增 `showLayoutPanel` 與 `hideLayoutPanel` action 處理
- [ ] 6.2 監聽 `fullscreenchange` 事件：全螢幕切換時確保面板仍然可見且可操作
- [ ] 6.3 面板開啟時，滑桿值需從當前 `layoutConfig` 同步（確保 popup 或 storage 的變更也能反映）

## 7. 樣式最終調整

- [ ] 7.1 為面板套用與 popup 一致的深色主題（使用相同的 CSS 變數色值：--dark-bg、--card-bg、--primary-gradient 等）
- [ ] 7.2 確保面板在 YouTube 頁面上的 z-index（10001）不與現有元素衝突
- [ ] 7.3 加入面板出現/消失的過渡動畫（fadeIn/fadeOut，0.3s ease）
- [ ] 7.4 驗證 `prefers-reduced-motion` media query 對面板動畫的效果
