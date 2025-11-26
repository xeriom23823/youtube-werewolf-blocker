# YouTube 狼人殺遮蔽助手 🐺

一款專為 YouTube 狼人殺影片觀眾設計的 Chrome 瀏覽器擴充功能，能夠智能遮蔽玩家身分資訊和敏感訊息，避免爆雷並提升觀影體驗。

![Extension Version](https://img.shields.io/badge/version-1.3-blue.svg)
![Chrome Web Store](https://img.shields.io/badge/platform-Chrome-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎯 功能特色

### 核心功能
- **智能遮蔽系統**：自動識別並遮蔽影片中的身分資訊區域
- **分區域控制**：支援身分、訊息、上警區域的獨立控制
- **12號位支援**：完整支援標準狼人殺 12 位玩家配置
- **全螢幕適配**：在一般、劇場模式、全螢幕模式下均能正常運作
- **動態版面配置**：支援自訂容器位置、大小和區域比例
- **編輯模式**：視覺化編輯模式，用彩色框線標示各區域便於調整

### 操作模式
- **所有頻道模式**：對所有 YouTube 頻道啟用遮蔽功能
- **指定頻道模式**：僅對特定頻道啟用遮蔽功能
- **一鍵控制**：支援批量開啟/關閉所有上警區域
- **版面配置**：通過 Slider 動態調整遮蔽區域位置和大小
- **編輯模式**：視覺化標示各區域，便於精確調整

### 技術特性
- **即時響應**：支援 YouTube 單頁應用的動態載入
- **視窗適配**：自動適應不同螢幕尺寸和顯示模式
- **狀態保存**：自動保存用戶設定和面板狀態
- **效能優化**：使用防抖動機制減少不必要的重繪

## 📸 功能截圖

### 主控面板
- 左右兩側遮蔽面板，每側 6 個位置
- 每個位置包含身分區域、訊息區域、上警區域
- 數字標籤清楚標示玩家位置

### 控制介面
- 簡潔的彈出式控制面板
- 頻道管理功能
- 一鍵切換開關

## 🚀 安裝指南

### 從 Chrome Web Store 安裝（推薦）
1. 進到 Chrome Web Store
2. 搜尋「YouTube 狼人殺遮蔽助手」
3. 點擊「加到 Chrome」安裝

### 手動安裝開發版
1. 下載或複製此專案到本機
```bash
git clone https://github.com/yourusername/youtube-werewolf-blocker.git
```

2. 打開 Chrome 瀏覽器，進到 `chrome://extensions/`

3. 開啟右上角的「開發者模式」

4. 點擊「載入未封裝項目」

5. 選擇專案資料夾

6. 擴充功能就會生效

## 🎮 使用說明

### 基本使用
1. **開啟功能**：點擊瀏覽器工具列的擴充功能圖示，開啟遮蔽功能
2. **看影片**：進到 YouTube 狼人殺影片頁面
3. **自動遮蔽**：擴充功能會自動在影片播放機兩側顯示遮蔽面板

### 進階操作
- **個別區域控制**：點擊各區域按鈕可個別開啟/關閉遮蔽
- **批量控制**：使用頂部中央按鈕一鍵控制所有上警區域
- **頻道設定**：在彈出式面板中管理特定頻道的遮蔽規則
- **版面調整**：展開「📐 版面設定」區塊，使用 Slider 調整容器位置、大小和區域比例
- **編輯模式**：點擊「🔧 開啟編輯模式」，各區域將以彩色框線和半透明背景顯示：
  - 紅色框線 + 紅色半透明 = 身分區域
  - 綠色框線 + 綠色半透明 = 訊息區域
  - 藍色框線 + 藍色半透明 = 上警區域
  - 黃色虛線 = 面板邊界

### 快捷操作
- 滑鼠懸停在身分區域上可顯示控制按鈕
- 訊息區域關閉時會自動關閉對應的上警區域
- 支持拖曳調整（未來版本）

## ⚙️ 設定選項

### 遮蔽模式
- **所有頻道**：對所有 YouTube 頻道開啟遮蔽
- **指定頻道**：僅對加入清單的頻道開啟遮蔽

### 區域控制
- **身分區域**：遮蔽玩家身分標記
- **訊息區域**：遮蔽玩家發言內容
- **上警區域**：遮蔽上警投票區域

### 版面設定選項
- **容器位置**：調整遮蔽容器的頂部偏移、高度、寬度和左右邊距
- **區域比例**：自訂身分區域寬度、訊息/上警區域的高度比例
- **控制按鈕**：調整上警控制按鈕的位置
- **重設為預設值**：一鍵重設所有配置到預設值

## 🛠️ 開發資訊

### 技術架構
```
youtube-werewolf-blocker/
├── manifest.json          # 擴充功能配置檔
├── content.js             # 主要功能腳本
├── popup.html             # 控制面板 HTML
├── popup.js               # 控制面板邏輯
├── styles.css             # 樣式表
└── icons/                 # 圖示資源
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    └── logo.webp
```

### 核心技術
- **Manifest V3**：使用最新的 Chrome 擴充功能規範
- **Content Scripts**：直接操作 YouTube 頁面 DOM
- **Chrome Storage API**：跨分頁同步設定狀態
- **MutationObserver**：監聽頁面動態變化
- **ResizeObserver**：響應視窗大小變化

### 相容性
- Chrome 88+ (Manifest V3 支援)
- YouTube 網頁版（所有地區）
- 支援所有顯示模式（一般、劇場、全螢幕）

## 🐛 已知問題

### 目前限制
- 僅支援 Chrome 瀏覽器
- 需要 YouTube 頁面完全載入後才能生效
- 版面配置以百分比為單位，自動適應全螢幕和普通模式

### 優化計劃
- [x] 優化載入速度
- [ ] 跳過上帝與夜間環節功能

## 🤝 貢獻指南

歡迎各種形式的貢獻！

### 回報問題
1. 進到 [Issues](https://github.com/yourusername/youtube-werewolf-blocker/issues) 頁面
2. 描述問題現象和重現步驟
3. 提供瀏覽器版本和影片連結

### 提交修改
1. 複製分支此專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交修改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

### 開發環境設置
```bash
# 複製專案
git clone https://github.com/yourusername/youtube-werewolf-blocker.git

# 進入專案目錄
cd youtube-werewolf-blocker

# 載入到 Chrome 進行測試
# 進到 chrome://extensions/ 並載入未封裝項目
```

## 📝 更新日誌

### v1.3 (當前版本)
- ✨ 新增動態版面配置系統 - 支援通過 Slider 調整所有遮蔽區域
- ✨ 新增視覺化編輯模式 - 用彩色框線和半透明背景標示各區域
- ✨ 優化按鈕事件處理 - 改用全局事件監聽，解決事件監聽器丟失問題
- 🐛 修復 MutationObserver 頻繁觸發導致按鈕失效的問題
- 🐛 修復按鈕顯示時影響布局的問題（改用絕對定位）
- 🐛 修復上警控制按鈕狀態更新不及時的問題
- ⚡ 優化 DOM 更新策略 - 只更新改變的區域，不重建整個遮蔽層
- 🎨 改善按鈕視覺效果和響應速度

### v1.2
- ✨ 新增批量控制上警區域功能
- 🐛 修復全螢幕模式下的顯示問題
- ⚡ 優化效能，減少不必要的重繪
- 🎨 改善使用者介面

### v1.1
- ✨ 新增指定頻道模式
- 🔧 改進設定保存機制
- 🐛 修復劇場模式適配問題

### v1.0
- 🎉 首次發布
- ✨ 基本遮蔽功能
- ✨ 12號位支援
- ✨ 響應式佈局

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 授權條款。

## 🙏 致謝

- 感謝所有狼人殺愛好者的建議和回饋
- 感謝開源社群提供的技術支援
- 特別感謝測試用戶的耐心協助

## 📞 聯絡方式

- **Issues**：[GitHub Issues](https://github.com/yourusername/youtube-werewolf-blocker/issues)
- **Email**：xeriom23823@gmail.com
- **討論**：[GitHub Discussions](https://github.com/yourusername/youtube-werewolf-blocker/discussions)

---

**注意**：本擴充功能僅供個人娛樂使用，請遵守 YouTube 服務條款和相關法律法規。

**Disclaimer**: This extension is for personal entertainment use only. Please comply with YouTube's Terms of Service and applicable laws and regulations.
