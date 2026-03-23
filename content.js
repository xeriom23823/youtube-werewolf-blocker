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

// ===== 片段跳過功能相關變數 =====
let currentVideoId = null; // 當前影片 ID
let videoSegments = []; // 當前影片的片段標記
let segmentSkipSettings = { // 各階段跳過設定
    night: true,      // 夜間環節預設跳過
    draw: true,       // 抽牌環節預設跳過
    opening: false,   // 開場環節預設不跳過
    review: false
};
let isAnalyzing = false;
let skipEnabled = true;
let lastSkipTime = 0;
let skipNotificationEnabled = true;
let customKeywords = [];

// ===== 狼人殺階段識別規則（強化版）=====
const SEGMENT_RULES = {
    // 夜間環節關鍵詞 (繁體/簡體) - 權重越高越可靠
    night: {
        start: [
            // 高權重 - 非常明確的夜間開始標誌
            { text: '天黑請閉眼', weight: 10 },
            { text: '天黑请闭眼', weight: 10 },
            { text: '請閉眼', weight: 8 },
            { text: '请闭眼', weight: 8 },
            { text: '進入黑夜', weight: 8 },
            { text: '进入黑夜', weight: 8 },
            // 中權重
            { text: '閉眼', weight: 5 },
            { text: '闭眼', weight: 5 },
            { text: '天黑了', weight: 6 },
            { text: '夜晚來臨', weight: 6 },
            { text: '夜晚来临', weight: 6 },
            { text: '進入夜晚', weight: 7 },
            { text: '进入夜晚', weight: 7 },
            // 次要線索 - 角色行動提示
            { text: '狼人請睜眼', weight: 6 },
            { text: '狼人请睁眼', weight: 6 },
            { text: '預言家請睜眼', weight: 5 },
            { text: '预言家请睁眼', weight: 5 },
            { text: '守衛請睜眼', weight: 5 },
            { text: '守卫请睁眼', weight: 5 },
            { text: '女巫請睜眼', weight: 5 },
            { text: '女巫请睁眼', weight: 5 }
        ],
        end: [
            // 高權重 - 非常明確的夜間結束標誌
            { text: '天亮請睜眼', weight: 10 },
            { text: '天亮请睁眼', weight: 10 },
            { text: '天亮了', weight: 9 },
            { text: '請睜眼', weight: 7 },
            { text: '请睁眼', weight: 7 },
            // 中權重
            { text: '睜眼', weight: 4 },
            { text: '睁眼', weight: 4 },
            { text: '天亮', weight: 6 },
            { text: '白天來臨', weight: 7 },
            { text: '白天来临', weight: 7 },
            { text: '進入白天', weight: 7 },
            { text: '进入白天', weight: 7 },
            // 發言開始也意味著夜晚結束
            { text: '請發言', weight: 5 },
            { text: '请发言', weight: 5 },
            { text: '開始發言', weight: 5 },
            { text: '开始发言', weight: 5 }
        ],
        label: '夜間環節',
        minDuration: 5,  // 夜間環節最少持續時間（秒）
        maxDuration: 300 // 夜間環節最長持續時間（秒）
    },
    // 發言環節關鍵詞
    speaking: {
        markers: [
            { text: '號玩家發言', weight: 8 },
            { text: '号玩家发言', weight: 8 },
            { text: '號發言', weight: 7 },
            { text: '号发言', weight: 7 },
            { text: '開始發言', weight: 6 },
            { text: '开始发言', weight: 6 },
            { text: '請發言', weight: 6 },
            { text: '请发言', weight: 6 },
            { text: '輪到', weight: 4 },
            { text: '轮到', weight: 4 },
            { text: '你的發言', weight: 5 },
            { text: '你的发言', weight: 5 }
        ],
        label: '發言環節'
    },
    // 復盤環節關鍵詞
    review: {
        start: [
            // 高權重 - 明確的遊戲結束標誌
            { text: '遊戲結束', weight: 10 },
            { text: '游戏结束', weight: 10 },
            { text: '本局結束', weight: 10 },
            { text: '本局结束', weight: 10 },
            { text: '公布身份', weight: 9 },
            { text: '公布身分', weight: 9 },
            // 中權重
            { text: '狼人勝利', weight: 8 },
            { text: '狼人胜利', weight: 8 },
            { text: '好人勝利', weight: 8 },
            { text: '好人胜利', weight: 8 },
            { text: '村民勝利', weight: 8 },
            { text: '村民胜利', weight: 8 },
            { text: '來復盤', weight: 7 },
            { text: '来复盘', weight: 7 },
            { text: '復盤', weight: 5 },
            { text: '复盘', weight: 5 },
            { text: '勝利', weight: 4 },
            { text: '胜利', weight: 4 },
            { text: '賽後', weight: 6 },
            { text: '赛后', weight: 6 }
        ],
        label: '復盤環節'
    },
    // 抽牌環節關鍵詞
    draw: {
        markers: [
            { text: '查看身份', weight: 8 },
            { text: '查看身分', weight: 8 },
            { text: '確認身份', weight: 8 },
            { text: '确认身份', weight: 8 },
            { text: '抽牌', weight: 7 },
            { text: '看牌', weight: 6 },
            { text: '請查看', weight: 6 },
            { text: '请查看', weight: 6 },
            { text: '底牌', weight: 5 },
            { text: '發牌', weight: 6 },
            { text: '发牌', weight: 6 }
        ],
        label: '抽牌環節'
    },
    // 開場環節關鍵詞
    opening: {
        markers: [
            { text: '歡迎來到', weight: 7 },
            { text: '欢迎来到', weight: 7 },
            { text: '歡迎', weight: 4 },
            { text: '欢迎', weight: 4 },
            { text: '嘉賓', weight: 5 },
            { text: '嘉宾', weight: 5 },
            { text: '今天', weight: 2 },
            { text: '本期', weight: 4 },
            { text: '大家好', weight: 3 }
        ],
        label: '開場環節'
    }
};

// ===== 文字正規化與模糊匹配工具 =====

// 常見 ASR 錯字對照表
const ASR_CORRECTIONS = {
    // 睜/增/正 混淆
    '增眼': '睜眼', '正眼': '睜眼', '爭眼': '睜眼',
    '增開': '睜開', '正開': '睜開',
    // 閉/必/比 混淆  
    '必眼': '閉眼', '比眼': '閉眼', '壁眼': '閉眼',
    // 天亮/天涼 混淆
    '天涼了': '天亮了', '天量了': '天亮了',
    // 天黑/天嘿 混淆
    '天嘿': '天黑', '天黑額': '天黑了',
    // 狼人/浪人 混淆
    '浪人': '狼人', '郎人': '狼人',
    // 發言/發演 混淆
    '發演': '發言', '法言': '發言',
    // 預言家/語言家 混淆
    '語言家': '預言家', '預言架': '預言家',
    // 守衛/首位 混淆
    '首位': '守衛', '手衛': '守衛',
    // 女巫/女無 混淆
    '女無': '女巫', '女屋': '女巫',
    // 復盤/父盤 混淆
    '父盤': '復盤', '覆盤': '復盤', '夫盤': '復盤',
    // 身份/身分/深分 混淆
    '深分': '身份', '身分': '身份',
    // 結束/潔束 混淆
    '潔束': '結束', '節束': '結束',
    // 勝利/聖禮 混淆
    '聖禮': '勝利', '盛利': '勝利'
};

// 文字正規化函數
function normalizeText(text) {
    if (!text) return '';
    
    let normalized = text
        // 移除多餘空白
        .replace(/\s+/g, ' ')
        .trim()
        // 全形轉半形數字
        .replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        // 全形轉半形英文
        .replace(/[Ａ-Ｚａ-ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
        // 移除常見標點符號
        .replace(/[，。！？、；：""''【】《》（）\[\]]/g, ' ')
        // 移除 HTML 實體
        .replace(/&[a-z]+;/gi, ' ')
        // 移除多餘空白（再次清理）
        .replace(/\s+/g, ' ')
        .trim();
    
    // 套用 ASR 錯字修正
    for (const [wrong, correct] of Object.entries(ASR_CORRECTIONS)) {
        normalized = normalized.replace(new RegExp(wrong, 'g'), correct);
    }
    
    return normalized;
}

// 計算編輯距離（Levenshtein Distance）
function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    
    // 如果其中一個字串為空
    if (m === 0) return n;
    if (n === 0) return m;
    
    // 建立距離矩陣
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,      // 刪除
                dp[i][j - 1] + 1,      // 插入
                dp[i - 1][j - 1] + cost // 替換
            );
        }
    }
    
    return dp[m][n];
}

// 模糊匹配：檢查文字是否與關鍵詞相似
function fuzzyMatch(text, keyword, maxDistance = 2) {
    // 先嘗試精確匹配
    if (text.includes(keyword)) {
        return { matched: true, distance: 0, exact: true };
    }
    
    // 對於較短的關鍵詞，只接受更小的編輯距離
    const allowedDistance = Math.min(maxDistance, Math.floor(keyword.length / 2));
    
    // 滑動窗口模糊匹配
    const keywordLen = keyword.length;
    for (let i = 0; i <= text.length - keywordLen + allowedDistance; i++) {
        const windowEnd = Math.min(i + keywordLen + allowedDistance, text.length);
        const window = text.substring(i, windowEnd);
        
        // 在窗口內尋找最佳匹配
        for (let len = keywordLen - allowedDistance; len <= keywordLen + allowedDistance && len <= window.length; len++) {
            const substr = window.substring(0, len);
            const distance = levenshteinDistance(substr, keyword);
            
            if (distance <= allowedDistance) {
                return { matched: true, distance: distance, exact: false };
            }
        }
    }
    
    return { matched: false, distance: Infinity, exact: false };
}

// 計算關鍵詞匹配信心分數
function calculateMatchScore(text, keywordRules) {
    const normalizedText = normalizeText(text);
    let totalScore = 0;
    let matchedKeywords = [];
    
    for (const rule of keywordRules) {
        const keyword = typeof rule === 'string' ? rule : rule.text;
        const weight = typeof rule === 'string' ? 5 : rule.weight;
        
        // 嘗試精確匹配
        if (normalizedText.includes(keyword)) {
            totalScore += weight;
            matchedKeywords.push({ keyword, weight, exact: true });
            continue;
        }
        
        // 嘗試模糊匹配（僅對較長的關鍵詞）
        if (keyword.length >= 3) {
            const fuzzyResult = fuzzyMatch(normalizedText, keyword, 1);
            if (fuzzyResult.matched && !fuzzyResult.exact) {
                // 模糊匹配給予較低分數
                const adjustedWeight = Math.floor(weight * 0.6);
                totalScore += adjustedWeight;
                matchedKeywords.push({ keyword, weight: adjustedWeight, exact: false, distance: fuzzyResult.distance });
            }
        }
    }
    
    return { score: totalScore, matchedKeywords };
}

// ===== 片段分析核心函數 =====

// 從 URL 獲取影片 ID
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

// 請求抓取字幕 - 多種方法嘗試
async function fetchSubtitles(videoId) {
    console.log('開始抓取字幕，影片ID:', videoId);
    
    // 首先提取字幕軌道
    const captionTracks = extractFullCaptionTracksFromPage();
    
    if (!captionTracks || captionTracks.length === 0) {
        console.log('無法提取字幕軌道');
        throw new Error('無法獲取字幕軌道');
    }
    
    const targetTrack = selectBestCaptionTrack(captionTracks);
    console.log('選擇字幕軌道:', targetTrack.languageCode, 'URL長度:', targetTrack.baseUrl?.length);
    
    // 方法0: 直接在 Content Script 中 fetch (攜帶 cookies)
    try {
        console.log('嘗試方法0: Content Script Fetch with credentials...');
        const subtitles = await fetchSubtitleDirect(targetTrack.baseUrl);
        if (subtitles && subtitles.length > 0) {
            console.log('方法0成功，字幕數:', subtitles.length);
            return subtitles;
        }
    } catch (e) {
        console.log('方法0失敗:', e.message);
    }
    
    // 方法1: 讓 Background Script 抓取
    try {
        console.log('嘗試方法1: Background Script 抓取完整 URL...');
        const subtitles = await fetchSubtitleContentViaBackground(targetTrack.baseUrl);
        if (subtitles && subtitles.length > 0) {
            console.log('方法1成功，字幕數:', subtitles.length);
            return subtitles;
        }
    } catch (e) {
        console.log('方法1失敗:', e.message);
    }
    
    // 方法2: 使用 Background Script 的 Innertube API
    try {
        console.log('嘗試方法2: Background Script (Innertube API)...');
        const subtitles = await fetchSubtitlesViaBackground(videoId);
        if (subtitles && subtitles.length > 0) {
            console.log('方法2成功，字幕數:', subtitles.length);
            return subtitles;
        }
    } catch (e) {
        console.log('方法2失敗:', e.message);
    }
    
    // 如果所有方法都失敗
    throw new Error('無法獲取字幕');
}

// 直接在 Content Script 中 fetch 字幕
async function fetchSubtitleDirect(baseUrl) {
    // 準備 URL
    let url = baseUrl.replace(/\\u0026/g, '&');
    
    // 嘗試不同格式
    const formats = ['json3', 'srv3', ''];
    
    for (const fmt of formats) {
        try {
            let fetchUrl = url;
            if (fmt) {
                if (fetchUrl.includes('&fmt=')) {
                    fetchUrl = fetchUrl.replace(/&fmt=[^&]+/, `&fmt=${fmt}`);
                } else {
                    fetchUrl += `&fmt=${fmt}`;
                }
            }
            
            console.log(`嘗試格式 ${fmt || 'default'}，URL: ${fetchUrl.substring(0, 80)}...`);
            
            const response = await fetch(fetchUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json, text/xml, */*'
                }
            });
            
            console.log(`格式 ${fmt || 'default'} 回應狀態: ${response.status}`);
            console.log(`Content-Type: ${response.headers.get('content-type')}`);
            
            if (!response.ok) {
                console.log(`格式 ${fmt || 'default'} 請求失敗: ${response.status}`);
                continue;
            }
            
            const text = await response.text();
            console.log(`格式 ${fmt || 'default'} 回應長度: ${text.length}`);
            console.log(`回應前200字: ${text.substring(0, 200)}`);
            
            if (!text || text.trim().length === 0) {
                console.log(`格式 ${fmt || 'default'} 回應為空`);
                continue;
            }
            
            // 解析字幕
            let subtitles = [];
            
            if (text.trim().startsWith('{')) {
                // JSON3 格式
                const data = JSON.parse(text);
                if (data.events) {
                    for (const event of data.events) {
                        if (!event.segs) continue;
                        let eventText = '';
                        for (const seg of event.segs) {
                            if (seg.utf8) eventText += seg.utf8;
                        }
                        eventText = eventText.trim();
                        if (!eventText) continue;
                        subtitles.push({
                            start: (event.tStartMs || 0) / 1000,
                            end: ((event.tStartMs || 0) + (event.dDurationMs || 0)) / 1000,
                            text: eventText
                        });
                    }
                }
            } else if (text.includes('<text')) {
                // XML 格式
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/xml');
                const textNodes = doc.querySelectorAll('text');
                textNodes.forEach(node => {
                    const start = parseFloat(node.getAttribute('start') || '0');
                    const dur = parseFloat(node.getAttribute('dur') || '0');
                    const content = node.textContent.trim();
                    if (content) {
                        subtitles.push({
                            start: start,
                            end: start + dur,
                            text: content
                        });
                    }
                });
            }
            
            if (subtitles.length > 0) {
                console.log(`成功解析 ${fmt || 'default'} 格式，字幕數: ${subtitles.length}`);
                return subtitles;
            }
        } catch (e) {
            console.log(`格式 ${fmt || 'default'} 處理失敗:`, e.message);
        }
    }
    
    return null;
}

// 從頁面提取完整的字幕軌道資訊 (包含簽名)
function extractFullCaptionTracksFromPage() {
    try {
        console.log('開始提取完整字幕軌道...');
        
        // 方法1: 從 script 標籤中搜尋完整的 captionTracks
        const scripts = document.querySelectorAll('script');
        console.log('找到 script 標籤數量:', scripts.length);
        
        for (const script of scripts) {
            const text = script.textContent || '';
            
            // 檢查是否包含 captionTracks
            if (text.includes('"captionTracks"') && text.includes('"baseUrl"')) {
                console.log('找到包含 captionTracks 的 script，長度:', text.length);
                
                // 找到 captionTracks 的位置
                const captionStart = text.indexOf('"captionTracks"');
                if (captionStart === -1) continue;
                
                // 從 captionTracks 開始找到完整的陣列
                const arrayStart = text.indexOf('[', captionStart);
                if (arrayStart === -1) continue;
                
                // 找到對應的結束括號
                let depth = 0;
                let arrayEnd = -1;
                for (let i = arrayStart; i < text.length && i < arrayStart + 50000; i++) {
                    if (text[i] === '[') depth++;
                    if (text[i] === ']') depth--;
                    if (depth === 0) {
                        arrayEnd = i + 1;
                        break;
                    }
                }
                
                if (arrayEnd > arrayStart) {
                    const jsonStr = text.substring(arrayStart, arrayEnd);
                    console.log('提取的 JSON 長度:', jsonStr.length);
                    console.log('JSON 前200字:', jsonStr.substring(0, 200));
                    
                    try {
                        const tracks = JSON.parse(jsonStr);
                        if (tracks && tracks.length > 0 && tracks[0].baseUrl) {
                            const firstUrl = tracks[0].baseUrl;
                            console.log('第一個 baseUrl 長度:', firstUrl.length);
                            console.log('baseUrl 包含 signature:', firstUrl.includes('signature'));
                            
                            // 解碼 URL 中的轉義字元
                            for (const track of tracks) {
                                if (track.baseUrl) {
                                    track.baseUrl = track.baseUrl.replace(/\\u0026/g, '&');
                                }
                            }
                            
                            console.log('解碼後 baseUrl 長度:', tracks[0].baseUrl.length);
                            return tracks;
                        }
                    } catch (e) {
                        console.log('解析 captionTracks 失敗:', e.message);
                    }
                }
            }
        }
        
        console.log('script 標籤方法失敗，嘗試 HTML 搜尋...');
        
        // 方法2: 從頁面 HTML 直接搜尋完整的 baseUrl (包含 signature)
        const html = document.documentElement.innerHTML;
        console.log('HTML 長度:', html.length);
        
        // 搜尋包含完整簽名的 timedtext URL
        const urlPattern = /"baseUrl"\s*:\s*"(https:[^"]*timedtext[^"]*)"/g;
        const tracks = [];
        let match;
        
        while ((match = urlPattern.exec(html)) !== null) {
            let url = match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            
            console.log('找到 URL，長度:', url.length, '包含 signature:', url.includes('signature'));
            
            // 提取語言代碼
            const langMatch = url.match(/[&?]lang=([^&]+)/);
            const lang = langMatch ? langMatch[1] : 'unknown';
            
            // 避免重複
            if (!tracks.find(t => t.languageCode === lang)) {
                tracks.push({
                    baseUrl: url,
                    languageCode: lang
                });
            }
        }
        
        if (tracks.length > 0) {
            console.log('HTML 搜尋找到', tracks.length, '個字幕軌道');
            return tracks;
        }
        
        // 方法3: 回退到原有方法
        console.log('使用回退方法提取字幕軌道');
        return extractCaptionTracksFromHTML();
    } catch (e) {
        console.log('extractFullCaptionTracksFromPage 錯誤:', e.message);
        return null;
    }
}

// 輔助函數: 延遲
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 使用 XMLHttpRequest 抓取字幕（在頁面上下文中）
function fetchSubtitleWithXHR(baseUrl) {
    return new Promise((resolve, reject) => {
        // 解碼 URL
        let url = baseUrl.replace(/\\u0026/g, '&');
        
        // 嘗試 json3 格式
        if (url.includes('&fmt=')) {
            url = url.replace(/&fmt=[^&]+/, '&fmt=json3');
        } else {
            url += '&fmt=json3';
        }
        
        console.log('XHR 請求字幕:', url.substring(0, 80) + '...');
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;  // 攜帶 cookies
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                const text = xhr.responseText;
                console.log('XHR 回應長度:', text.length);
                
                if (text && text.trim().length > 0) {
                    try {
                        if (text.trim().startsWith('{')) {
                            const data = JSON.parse(text);
                            const subtitles = parseJSON3SubtitlesLocal(data);
                            if (subtitles.length > 0) {
                                resolve(subtitles);
                                return;
                            }
                        } else if (text.includes('<text')) {
                            const subtitles = parseXMLSubtitlesLocal(text);
                            if (subtitles.length > 0) {
                                resolve(subtitles);
                                return;
                            }
                        }
                    } catch (e) {
                        console.log('解析失敗:', e.message);
                    }
                }
            }
            reject(new Error('XHR 無法獲取有效字幕'));
        };
        
        xhr.onerror = function() {
            reject(new Error('XHR 請求失敗'));
        };
        
        xhr.send();
    });
}

// 本地解析 JSON3 字幕
function parseJSON3SubtitlesLocal(data) {
    const subtitles = [];
    if (!data || !data.events) return subtitles;
    
    for (const event of data.events) {
        if (!event.segs) continue;
        let text = event.segs.map(seg => seg.utf8 || '').join('').trim();
        if (!text) continue;
        
        subtitles.push({
            start: (event.tStartMs || 0) / 1000,
            end: ((event.tStartMs || 0) + (event.dDurationMs || 0)) / 1000,
            text: text
        });
    }
    return subtitles;
}

// 本地解析 XML 字幕
function parseXMLSubtitlesLocal(xmlText) {
    const subtitles = [];
    const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let match;
    
    while ((match = regex.exec(xmlText)) !== null) {
        let text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
        
        if (text) {
            subtitles.push({
                start: parseFloat(match[1]),
                end: parseFloat(match[1]) + parseFloat(match[2]),
                text: text
            });
        }
    }
    return subtitles;
}

// 從頁面 HTML 提取字幕軌道
function extractCaptionTracksFromHTML() {
    const html = document.documentElement.innerHTML;
    
    // 嘗試匹配 captionTracks
    const match = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])(?=\s*,\s*")/);
    if (match) {
        try {
            let jsonStr = match[1];
            // 找到正確的結束位置
            let bracketCount = 0;
            let endIndex = 0;
            for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '[') bracketCount++;
                if (jsonStr[i] === ']') bracketCount--;
                if (bracketCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
            if (endIndex > 0) {
                jsonStr = jsonStr.substring(0, endIndex);
            }
            
            const tracks = JSON.parse(jsonStr);
            if (tracks && tracks.length > 0) {
                console.log('成功解析 captionTracks，軌道數:', tracks.length);
                return tracks;
            }
        } catch (e) {
            console.log('JSON 解析失敗:', e.message);
        }
    }
    
    return null;
}

// 選擇最佳字幕軌道
function selectBestCaptionTrack(captionTracks) {
    const langPriority = ['zh-TW', 'zh-Hant', 'zh-CN', 'zh-Hans', 'zh'];
    
    for (const lang of langPriority) {
        const track = captionTracks.find(t => 
            t.languageCode === lang || 
            (t.languageCode && t.languageCode.startsWith(lang))
        );
        if (track) return track;
    }
    
    return captionTracks[0];
}

// 讓 Background Script 抓取字幕內容 (使用 baseUrl)
function fetchSubtitleContentViaBackground(baseUrl) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'fetchSubtitleByUrl', baseUrl: baseUrl },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.success) {
                    resolve(response.subtitles);
                } else {
                    reject(new Error(response?.error || '字幕抓取失敗'));
                }
            }
        );
    });
}

// 讓 Background Script 直接抓取字幕 (使用 videoId)
function fetchSubtitlesViaBackground(videoId) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'fetchSubtitles', videoId: videoId },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.success) {
                    resolve(response.subtitles);
                } else {
                    reject(new Error(response?.error || '字幕抓取失敗'));
                }
            }
        );
    });
}

// 分析字幕並識別片段（強化版：使用信心分數系統）
function analyzeSubtitles(subtitles) {
    const segments = [];
    const analysisLog = [];
    
    const rules = getEffectiveRules();
    
    let nightCandidate = null;
    let reviewCandidate = null;
    
    const NIGHT_START_THRESHOLD = 5;
    const NIGHT_END_THRESHOLD = 5;
    const REVIEW_START_THRESHOLD = 6;
    const DRAW_THRESHOLD = 5;
    
    console.log(`開始分析 ${subtitles.length} 條字幕（含 ${customKeywords.length} 個自訂關鍵詞）...`);
    
    for (let i = 0; i < subtitles.length; i++) {
        const subtitle = subtitles[i];
        const text = subtitle.text;
        const startTime = subtitle.start;
        const endTime = subtitle.end;
        const normalizedText = normalizeText(text);
        
        if (nightCandidate === null) {
            const nightStartMatch = calculateMatchScore(text, rules.night.start);
            if (nightStartMatch.score >= NIGHT_START_THRESHOLD) {
                nightCandidate = {
                    startTime: startTime,
                    startScore: nightStartMatch.score,
                    startKeywords: nightStartMatch.matchedKeywords
                };
                console.log(`🌙 候選夜間開始 [信心:${nightStartMatch.score}]: ${formatTimeForLog(startTime)} - "${text.substring(0, 30)}..."`);
                analysisLog.push({
                    type: 'night_start_candidate',
                    time: startTime,
                    score: nightStartMatch.score,
                    keywords: nightStartMatch.matchedKeywords
                });
            }
        } else {
            const nightEndMatch = calculateMatchScore(text, rules.night.end);
            
            if (nightEndMatch.score >= NIGHT_END_THRESHOLD) {
                const duration = startTime - nightCandidate.startTime;
                const minDuration = rules.night.minDuration || 5;
                const maxDuration = rules.night.maxDuration || 300;
                
                if (duration >= minDuration && duration <= maxDuration) {
                    const combinedScore = (nightCandidate.startScore + nightEndMatch.score) / 2;
                    const confidence = Math.min(1, combinedScore / 15);
                    
                    segments.push({
                        type: 'night',
                        start: nightCandidate.startTime,
                        end: startTime,
                        label: rules.night.label,
                        shouldSkip: segmentSkipSettings.night,
                        confidence: confidence,
                        matchInfo: {
                            startScore: nightCandidate.startScore,
                            endScore: nightEndMatch.score,
                            startKeywords: nightCandidate.startKeywords,
                            endKeywords: nightEndMatch.matchedKeywords
                        }
                    });
                    
                    console.log(`✅ 確認夜間環節 [信心:${(confidence * 100).toFixed(0)}%]: ${formatTimeForLog(nightCandidate.startTime)} - ${formatTimeForLog(startTime)} (${duration.toFixed(1)}s)`);
                    analysisLog.push({
                        type: 'night_confirmed',
                        start: nightCandidate.startTime,
                        end: startTime,
                        confidence: confidence
                    });
                    
                    nightCandidate = null;
                } else if (duration > maxDuration) {
                    console.log(`⚠️ 夜間候選超時 (${duration.toFixed(1)}s > ${maxDuration}s)，重置`);
                    nightCandidate = null;
                }
            }
        }
        
        if (reviewCandidate === null) {
            const reviewMatch = calculateMatchScore(text, rules.review.start);
            if (reviewMatch.score >= REVIEW_START_THRESHOLD) {
                reviewCandidate = {
                    startTime: startTime,
                    startScore: reviewMatch.score,
                    startKeywords: reviewMatch.matchedKeywords
                };
                console.log(`📋 候選復盤開始 [信心:${reviewMatch.score}]: ${formatTimeForLog(startTime)} - "${text.substring(0, 30)}..."`);
                analysisLog.push({
                    type: 'review_start_candidate',
                    time: startTime,
                    score: reviewMatch.score,
                    keywords: reviewMatch.matchedKeywords
                });
            }
        }
        
        const drawMatch = calculateMatchScore(text, rules.draw.markers);
        if (drawMatch.score >= DRAW_THRESHOLD) {
            const drawStart = Math.max(0, startTime - 5);
            const drawEnd = endTime + 15;
            
            const isDuplicate = segments.some(s => 
                s.type === 'draw' && 
                Math.abs(s.start - drawStart) < 20
            );
            
            if (!isDuplicate) {
                const confidence = Math.min(1, drawMatch.score / 10);
                segments.push({
                    type: 'draw',
                    start: drawStart,
                    end: drawEnd,
                    label: rules.draw.label,
                    shouldSkip: segmentSkipSettings.draw,
                    confidence: confidence,
                    matchInfo: {
                        score: drawMatch.score,
                        keywords: drawMatch.matchedKeywords
                    }
                });
                console.log(`🎴 抽牌環節 [信心:${(confidence * 100).toFixed(0)}%]: ${formatTimeForLog(drawStart)} - ${formatTimeForLog(drawEnd)}`);
            }
        }
    }
    
    if (nightCandidate !== null && subtitles.length > 0) {
        const lastSubtitle = subtitles[subtitles.length - 1];
        const duration = lastSubtitle.end - nightCandidate.startTime;
        const maxDuration = rules.night.maxDuration || 300;
        
        if (duration <= maxDuration && duration >= 5) {
            const confidence = Math.min(0.5, nightCandidate.startScore / 20);
            segments.push({
                type: 'night',
                start: nightCandidate.startTime,
                end: lastSubtitle.end,
                label: rules.night.label + ' (未偵測到結束)',
                shouldSkip: segmentSkipSettings.night,
                confidence: confidence,
                matchInfo: {
                    startScore: nightCandidate.startScore,
                    endScore: 0,
                    note: '未偵測到結束關鍵詞'
                }
            });
            console.log(`⚠️ 夜間環節（未結束）[信心:${(confidence * 100).toFixed(0)}%]: ${formatTimeForLog(nightCandidate.startTime)} - ${formatTimeForLog(lastSubtitle.end)}`);
        }
    }
    
    if (reviewCandidate !== null && subtitles.length > 0) {
        const lastSubtitle = subtitles[subtitles.length - 1];
        const confidence = Math.min(1, reviewCandidate.startScore / 12);
        
        segments.push({
            type: 'review',
            start: reviewCandidate.startTime,
            end: lastSubtitle.end + 60,
            label: rules.review.label,
            shouldSkip: segmentSkipSettings.review,
            confidence: confidence,
            matchInfo: {
                startScore: reviewCandidate.startScore,
                startKeywords: reviewCandidate.startKeywords
            }
        });
        console.log(`📋 復盤環節 [信心:${(confidence * 100).toFixed(0)}%]: ${formatTimeForLog(reviewCandidate.startTime)} - 影片結尾`);
    }
    
    // 按開始時間排序
    segments.sort((a, b) => a.start - b.start);
    
    // 合併重疊的相同類型片段
    const mergedSegments = mergeOverlappingSegments(segments);
    
    // 產生分析摘要
    const summary = generateAnalysisSummary(mergedSegments);
    console.log('📊 分析摘要:', summary);
    
    return mergedSegments;
}

// 格式化時間供日誌使用
function formatTimeForLog(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 產生分析摘要
function generateAnalysisSummary(segments) {
    const summary = {
        total: segments.length,
        byType: {},
        avgConfidence: 0
    };
    
    let totalConfidence = 0;
    
    for (const seg of segments) {
        if (!summary.byType[seg.type]) {
            summary.byType[seg.type] = { count: 0, totalDuration: 0 };
        }
        summary.byType[seg.type].count++;
        summary.byType[seg.type].totalDuration += (seg.end - seg.start);
        totalConfidence += (seg.confidence || 0.5);
    }
    
    summary.avgConfidence = segments.length > 0 ? (totalConfidence / segments.length) : 0;
    
    return summary;
}

// 合併重疊的相同類型片段
function mergeOverlappingSegments(segments) {
    if (segments.length === 0) return segments;
    
    const merged = [];
    let current = { ...segments[0] };
    
    for (let i = 1; i < segments.length; i++) {
        const next = segments[i];
        
        // 如果是相同類型且重疊或相鄰（5秒內）
        if (current.type === next.type && next.start <= current.end + 5) {
            // 合併
            current.end = Math.max(current.end, next.end);
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    
    return merged;
}

// 執行影片分析
async function analyzeCurrentVideo() {
    const videoId = getVideoId();
    if (!videoId) {
        console.log('無法獲取影片 ID');
        return { success: false, error: '無法獲取影片 ID' };
    }
    
    if (isAnalyzing) {
        console.log('分析進行中...');
        return { success: false, error: '分析進行中' };
    }
    
    isAnalyzing = true;
    currentVideoId = videoId;
    
    try {
        console.log(`開始分析影片: ${videoId}`);
        
        // 抓取字幕
        const subtitles = await fetchSubtitles(videoId);
        console.log(`獲取到 ${subtitles.length} 條字幕`);
        
        if (subtitles.length === 0) {
            isAnalyzing = false;
            return { success: false, error: '影片無可用字幕' };
        }
        
        // 分析字幕
        const segments = analyzeSubtitles(subtitles);
        console.log(`識別到 ${segments.length} 個片段`);
        
        // 儲存結果
        videoSegments = segments;
        await saveVideoSegments(videoId, segments);
        
        // 設置時間監聽
        setupVideoTimeListener();
        
        isAnalyzing = false;
        
        return { 
            success: true, 
            segments: segments,
            subtitleCount: subtitles.length
        };
    } catch (error) {
        console.error('影片分析失敗:', error);
        isAnalyzing = false;
        return { 
            success: false, 
            error: '字幕獲取失敗（YouTube 已限制存取）。\n請使用下方「手動新增片段」功能標記要跳過的時間段。'
        };
    }
}

// ===== 片段儲存與載入 =====

// 儲存影片片段資料
async function saveVideoSegments(videoId, segments) {
    const key = `werewolfSegments_${videoId}`;
    const data = {
        segments: segments,
        analyzedAt: Date.now(),
        version: '1.0'
    };
    
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: data }, () => {
            console.log(`已儲存 ${segments.length} 個片段標記`);
            resolve();
        });
    });
}

// 載入影片片段資料
async function loadVideoSegments(videoId) {
    const key = `werewolfSegments_${videoId}`;
    
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            if (result[key]) {
                console.log(`載入已儲存的片段資料: ${result[key].segments.length} 個片段`);
                resolve(result[key]);
            } else {
                resolve(null);
            }
        });
    });
}

// 載入跳過設定
function loadSkipSettings() {
    chrome.storage.sync.get({
        'werewolfSkipSettings': segmentSkipSettings,
        'werewolfSkipEnabled': true,
        'werewolfSkipNotification': true
    }, (result) => {
        segmentSkipSettings = result.werewolfSkipSettings;
        skipEnabled = result.werewolfSkipEnabled;
        skipNotificationEnabled = result.werewolfSkipNotification;
        console.log('載入跳過設定:', segmentSkipSettings);
    });
}

// 儲存跳過設定
function saveSkipSettings() {
    chrome.storage.sync.set({
        'werewolfSkipSettings': segmentSkipSettings,
        'werewolfSkipEnabled': skipEnabled,
        'werewolfSkipNotification': skipNotificationEnabled
    });
}

function loadCustomKeywords() {
    chrome.storage.sync.get({ 'werewolfCustomKeywords': [] }, (result) => {
        customKeywords = result.werewolfCustomKeywords || [];
        console.log('載入自訂關鍵詞:', customKeywords.length, '個');
    });
}

function saveCustomKeywords() {
    chrome.storage.sync.set({ 'werewolfCustomKeywords': customKeywords });
}

function getEffectiveRules() {
    const rules = JSON.parse(JSON.stringify(SEGMENT_RULES));
    
    for (const kw of customKeywords) {
        const keyword = { text: kw.text, weight: kw.weight || 7 };
        
        switch (kw.type) {
            case 'night-start':
                if (rules.night && rules.night.start) {
                    rules.night.start.push(keyword);
                }
                break;
            case 'night-end':
                if (rules.night && rules.night.end) {
                    rules.night.end.push(keyword);
                }
                break;
            case 'review-start':
                if (rules.review && rules.review.start) {
                    rules.review.start.push(keyword);
                }
                break;
            case 'draw':
                if (rules.draw && rules.draw.markers) {
                    rules.draw.markers.push(keyword);
                }
                break;
            case 'opening':
                if (rules.opening && rules.opening.markers) {
                    rules.opening.markers.push(keyword);
                }
                break;
        }
    }
    
    return rules;
}

// ===== 影片時間監聽與自動跳過 =====

let timeUpdateListener = null;

// 設置影片時間監聽器
function setupVideoTimeListener() {
    const video = document.querySelector('video');
    if (!video) {
        console.log('找不到影片元素');
        return;
    }
    
    // 移除舊的監聽器
    if (timeUpdateListener) {
        video.removeEventListener('timeupdate', timeUpdateListener);
    }
    
    // 建立新的監聽器
    timeUpdateListener = () => {
        if (!skipEnabled || videoSegments.length === 0) return;
        
        const currentTime = video.currentTime;
        checkAndSkipSegment(video, currentTime);
    };
    
    video.addEventListener('timeupdate', timeUpdateListener);
    console.log('已設置影片時間監聽器');
}

// 檢查並跳過片段
function checkAndSkipSegment(video, currentTime) {
    // 防止連續跳過 (至少間隔2秒)
    if (Date.now() - lastSkipTime < 2000) return;
    
    for (const segment of videoSegments) {
        // 檢查是否應該跳過此類型的片段
        if (!segmentSkipSettings[segment.type]) continue;
        
        // 檢查當前時間是否在片段範圍內
        if (currentTime >= segment.start && currentTime < segment.end - 1) {
            console.log(`跳過 ${segment.label}: ${segment.start}s -> ${segment.end}s`);
            
            // 跳到片段結束
            video.currentTime = segment.end;
            lastSkipTime = Date.now();
            
            // 顯示跳過提示
            if (skipNotificationEnabled) {
                showSkipNotification(segment.label);
            }
            
            break;
        }
    }
}

// 顯示跳過提示
function showSkipNotification(label) {
    // 移除舊的提示
    const oldNotification = document.getElementById('skip-notification');
    if (oldNotification) oldNotification.remove();
    
    // 建立新的提示
    const notification = document.createElement('div');
    notification.id = 'skip-notification';
    notification.textContent = `已跳過: ${label}`;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        padding: '10px 20px',
        borderRadius: '5px',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: '99999',
        transition: 'opacity 0.3s',
        pointerEvents: 'none'
    });
    
    document.body.appendChild(notification);
    
    // 2秒後淡出
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 清除影片片段資料
function clearVideoSegments() {
    videoSegments = [];
    currentVideoId = null;
    
    if (timeUpdateListener) {
        const video = document.querySelector('video');
        if (video) {
            video.removeEventListener('timeupdate', timeUpdateListener);
        }
        timeUpdateListener = null;
    }
}

// 當影片變更時的處理
async function handleVideoChange() {
    const newVideoId = getVideoId();
    
    if (newVideoId && newVideoId !== currentVideoId) {
        console.log(`影片變更: ${currentVideoId} -> ${newVideoId}`);
        currentVideoId = newVideoId;
        
        // 嘗試載入已儲存的片段資料
        const savedData = await loadVideoSegments(newVideoId);
        
        if (savedData) {
            videoSegments = savedData.segments;
            // 更新跳過設定
            videoSegments.forEach(seg => {
                seg.shouldSkip = segmentSkipSettings[seg.type] ?? seg.shouldSkip;
            });
            setupVideoTimeListener();
            console.log('已載入儲存的片段資料');
        } else {
            videoSegments = [];
            console.log('此影片尚未分析');
        }
    }
}

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

// ===== 浮動版面設定面板（Inline Layout Panel）=====

let layoutPanelVisible = false;
let layoutPanelMinimized = false;
let layoutPanelDragging = false;
let layoutPanelDragOffsetX = 0;
let layoutPanelDragOffsetY = 0;

// 2.2 注入面板 CSS 樣式
function createLayoutPanelStyles() {
    if (document.getElementById('wlp-styles')) return;
    const style = document.createElement('style');
    style.id = 'wlp-styles';
    style.textContent = `
        #wlp-root {
            all: initial;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft JhengHei', '微軟正黑體', sans-serif;
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            background: rgba(15, 15, 35, 0.97);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(102,126,234,0.15);
            z-index: 10001;
            display: none;
            overflow: hidden;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            user-select: none;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        #wlp-root.wlp-visible {
            display: block;
            animation: wlpFadeIn 0.3s ease;
        }
        #wlp-root.wlp-hiding {
            animation: wlpFadeOut 0.3s ease forwards;
        }
        @keyframes wlpFadeIn {
            from { opacity: 0; transform: scale(0.95) translateY(-8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes wlpFadeOut {
            from { opacity: 1; transform: scale(1) translateY(0); }
            to   { opacity: 0; transform: scale(0.95) translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
            #wlp-root, #wlp-root.wlp-visible, #wlp-root.wlp-hiding {
                animation: none !important;
                transition: none !important;
            }
        }
        .wlp-header {
            all: initial;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background: linear-gradient(135deg, rgba(102,126,234,0.25) 0%, rgba(118,75,162,0.25) 100%);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            cursor: grab;
            position: relative;
            border-top-left-radius: 14px;
            border-top-right-radius: 14px;
        }
        .wlp-header:active { cursor: grabbing; }
        .wlp-title {
            all: initial;
            font-family: inherit;
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            letter-spacing: 0.4px;
            pointer-events: none;
        }
        .wlp-header-btns {
            all: initial;
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .wlp-btn {
            all: initial;
            font-family: inherit;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            color: rgba(255,255,255,0.7);
            transition: background 0.2s ease, color 0.2s ease;
        }
        .wlp-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .wlp-body {
            all: initial;
            font-family: inherit;
            display: block;
            padding: 14px;
            max-height: 70vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(102,126,234,0.4) transparent;
        }
        .wlp-body::-webkit-scrollbar { width: 4px; }
        .wlp-body::-webkit-scrollbar-thumb { background: rgba(102,126,234,0.4); border-radius: 4px; }
        .wlp-group {
            all: initial;
            font-family: inherit;
            display: block;
            margin-bottom: 14px;
            padding: 12px;
            background: rgba(0,0,0,0.25);
            border-radius: 10px;
            border: 1px solid rgba(102,126,234,0.1);
        }
        .wlp-group-title {
            all: initial;
            font-family: inherit;
            display: block;
            font-size: 10px;
            font-weight: 700;
            color: rgba(180,180,212,0.9);
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(102,126,234,0.2);
        }
        .wlp-slider-item {
            all: initial;
            font-family: inherit;
            display: block;
            margin-bottom: 12px;
        }
        .wlp-slider-label {
            all: initial;
            font-family: inherit;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 12px;
            color: rgba(180,180,212,0.85);
        }
        .wlp-slider-value {
            all: initial;
            font-family: inherit;
            color: #4facfe;
            font-weight: 700;
            min-width: 44px;
            text-align: right;
            padding: 1px 6px;
            background: rgba(79,172,254,0.12);
            border-radius: 5px;
            font-size: 11px;
        }
        .wlp-slider {
            all: initial;
            display: block;
            width: 100%;
            height: 6px;
            -webkit-appearance: none;
            appearance: none;
            background: rgba(0,0,0,0.35);
            border-radius: 8px;
            outline: none;
            cursor: pointer;
        }
        .wlp-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(79,172,254,0.5);
            transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .wlp-slider::-webkit-slider-thumb:hover {
            box-shadow: 0 3px 10px rgba(79,172,254,0.7);
            transform: scale(1.15);
        }
        .wlp-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border-radius: 50%;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(79,172,254,0.5);
        }
        .wlp-action-btn {
            all: initial;
            font-family: inherit;
            display: block;
            width: 100%;
            box-sizing: border-box;
            padding: 10px 14px;
            border-radius: 9px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 10px;
            text-align: center;
            transition: box-shadow 0.2s ease, transform 0.2s ease;
            letter-spacing: 0.3px;
        }
        .wlp-action-btn:last-child { margin-bottom: 0; }
        .wlp-action-btn:active { transform: scale(0.97); }
        .wlp-edit-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            box-shadow: 0 3px 10px rgba(102,126,234,0.35);
        }
        .wlp-edit-btn:hover { box-shadow: 0 5px 16px rgba(102,126,234,0.55); transform: translateY(-1px); }
        .wlp-edit-btn.wlp-active {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            box-shadow: 0 3px 10px rgba(250,112,154,0.5);
            animation: wlpPulse 2s ease infinite;
        }
        @keyframes wlpPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.82; }
        }
        @media (prefers-reduced-motion: reduce) {
            .wlp-edit-btn.wlp-active { animation: none; }
        }
        .wlp-reset-btn {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: #fff;
            box-shadow: 0 3px 10px rgba(240,147,251,0.3);
        }
        .wlp-reset-btn:hover { box-shadow: 0 5px 16px rgba(240,147,251,0.5); transform: translateY(-1px); }
        /* gear button */
        #wlp-gear {
            all: initial;
            position: fixed;
            top: 74px;
            right: 10px;
            width: 32px;
            height: 32px;
            background: rgba(15,15,35,0.88);
            border: 1px solid rgba(102,126,234,0.4);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10002;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
            backdrop-filter: blur(8px);
        }
        #wlp-gear:hover {
            background: rgba(102,126,234,0.3);
            transform: scale(1.1) rotate(30deg);
            box-shadow: 0 4px 14px rgba(102,126,234,0.5);
        }
    `;
    document.head.appendChild(style);
}

// 2.1 建立面板 DOM 結構
function createLayoutPanel() {
    if (document.getElementById('wlp-root')) return;
    createLayoutPanelStyles();

    const root = document.createElement('div');
    root.id = 'wlp-root';

    // Header
    const header = document.createElement('div');
    header.className = 'wlp-header';

    const title = document.createElement('span');
    title.className = 'wlp-title';
    title.textContent = '📐 版面設定';

    const headerBtns = document.createElement('div');
    headerBtns.className = 'wlp-header-btns';

    const minBtn = document.createElement('span');
    minBtn.className = 'wlp-btn';
    minBtn.id = 'wlp-min-btn';
    minBtn.textContent = '▼';
    minBtn.title = '收合';

    const closeBtn = document.createElement('span');
    closeBtn.className = 'wlp-btn';
    closeBtn.id = 'wlp-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = '關閉';

    headerBtns.appendChild(minBtn);
    headerBtns.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(headerBtns);

    // Body
    const body = document.createElement('div');
    body.className = 'wlp-body';
    body.id = 'wlp-body';

    // 4.1 Sliders definition
    const sliderGroups = [
        {
            title: '遮蔽容器位置',
            sliders: [
                { id: 'containerTop', label: '頂部偏移', min: 0, max: 20, step: 0.5, unit: '%' },
                { id: 'containerHeight', label: '容器高度', min: 50, max: 100, step: 1, unit: '%' },
                { id: 'containerWidth', label: '容器寬度', min: 5, max: 25, step: 0.5, unit: '%' },
                { id: 'containerLeftOffset', label: '左側邊距', min: 0, max: 20, step: 0.5, unit: '%' },
                { id: 'containerRightOffset', label: '右側邊距', min: 0, max: 20, step: 0.5, unit: '%' }
            ]
        },
        {
            title: '區域比例',
            sliders: [
                { id: 'identityWidthRatio', label: '身分區寬度', min: 10, max: 50, step: 0.5, unit: '%' },
                { id: 'messageFlexRatio', label: '訊息區高度比例', min: 1, max: 5, step: 0.5, unit: '' },
                { id: 'voteFlexRatio', label: '上警區高度比例', min: 0.5, max: 3, step: 0.5, unit: '' }
            ]
        },
        {
            title: '控制按鈕',
            sliders: [
                { id: 'voteButtonTop', label: '上警按鈕頂部偏移', min: 0, max: 15, step: 0.5, unit: '%' }
            ]
        }
    ];

    sliderGroups.forEach(function(group) {
        const groupEl = document.createElement('div');
        groupEl.className = 'wlp-group';

        const groupTitle = document.createElement('span');
        groupTitle.className = 'wlp-group-title';
        groupTitle.textContent = group.title;
        groupEl.appendChild(groupTitle);

        group.sliders.forEach(function(s) {
            const item = document.createElement('div');
            item.className = 'wlp-slider-item';

            const labelRow = document.createElement('div');
            labelRow.className = 'wlp-slider-label';

            const labelText = document.createElement('span');
            labelText.textContent = s.label;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'wlp-slider-value';
            valueSpan.id = 'wlp-val-' + s.id;
            const curVal = layoutConfig[s.id] !== undefined ? layoutConfig[s.id] : 0;
            valueSpan.textContent = curVal + s.unit;

            labelRow.appendChild(labelText);
            labelRow.appendChild(valueSpan);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'wlp-slider';
            slider.id = 'wlp-' + s.id;
            slider.min = s.min;
            slider.max = s.max;
            slider.step = s.step;
            slider.value = curVal;

            // 4.2 input: real-time update + immediate redraw
            slider.addEventListener('input', function() {
                const v = parseFloat(this.value);
                valueSpan.textContent = v + s.unit;
                layoutConfig[s.id] = v;
                if (isWatchPage() && shouldEnableBlocker()) {
                    hideIdentityInfo();
                }
            });

            // 4.3 change: persist to storage
            slider.addEventListener('change', function() {
                layoutConfig[s.id] = parseFloat(this.value);
                saveLayoutConfig();
            });

            item.appendChild(labelRow);
            item.appendChild(slider);
            groupEl.appendChild(item);
        });

        body.appendChild(groupEl);
    });

    // 4.4 Edit mode button
    const editBtn = document.createElement('button');
    editBtn.className = 'wlp-action-btn wlp-edit-btn';
    editBtn.id = 'wlp-edit-btn';
    editBtn.textContent = '🔧 開啟編輯模式';
    editBtn.addEventListener('click', function() {
        editMode = !editMode;
        if (editMode) {
            editBtn.textContent = '🔧 關閉編輯模式';
            editBtn.classList.add('wlp-active');
        } else {
            editBtn.textContent = '🔧 開啟編輯模式';
            editBtn.classList.remove('wlp-active');
        }
        if (isWatchPage() && shouldEnableBlocker()) {
            forceUpdateBlockers();
        }
    });
    body.appendChild(editBtn);

    // 4.5 Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'wlp-action-btn wlp-reset-btn';
    resetBtn.textContent = '🔄 恢復預設值';
    resetBtn.addEventListener('click', function() {
        resetLayoutConfig();
        syncPanelSliders();
        if (isWatchPage() && shouldEnableBlocker()) {
            hideIdentityInfo();
        }
    });
    body.appendChild(resetBtn);

    root.appendChild(header);
    root.appendChild(body);
    document.body.appendChild(root);

    // 2.3 Close button
    closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hideLayoutPanel();
    });

    // 5.3 Minimize button
    minBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        layoutPanelMinimized = !layoutPanelMinimized;
        body.style.display = layoutPanelMinimized ? 'none' : 'block';
        minBtn.textContent = layoutPanelMinimized ? '▲' : '▼';
        minBtn.title = layoutPanelMinimized ? '展開' : '收合';
    });

    // 5.1 Drag
    header.addEventListener('mousedown', function(e) {
        if (e.target === closeBtn || e.target === minBtn) return;
        layoutPanelDragging = true;
        const rect = root.getBoundingClientRect();
        layoutPanelDragOffsetX = e.clientX - rect.left;
        layoutPanelDragOffsetY = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!layoutPanelDragging) return;
        const panel = document.getElementById('wlp-root');
        if (!panel) return;
        // 5.2 Viewport boundary constraint
        const pw = panel.offsetWidth;
        const ph = panel.offsetHeight;
        let newLeft = e.clientX - layoutPanelDragOffsetX;
        let newTop = e.clientY - layoutPanelDragOffsetY;
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - pw));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - ph));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
        layoutPanelDragging = false;
    });

    // 6.2 Fullscreen: re-parent panel when entering/exiting fullscreen
    document.addEventListener('fullscreenchange', function() {
        const panel = document.getElementById('wlp-root');
        const gear = document.getElementById('wlp-gear');
        if (!panel) return;
        const fsEl = document.fullscreenElement;
        if (fsEl) {
            fsEl.appendChild(panel);
            if (gear) fsEl.appendChild(gear);
        } else {
            document.body.appendChild(panel);
            if (gear) document.body.appendChild(gear);
        }
    });
}

// 6.3 Sync panel sliders from current layoutConfig
function syncPanelSliders() {
    const sliderIds = [
        { id: 'containerTop', unit: '%' },
        { id: 'containerHeight', unit: '%' },
        { id: 'containerWidth', unit: '%' },
        { id: 'containerLeftOffset', unit: '%' },
        { id: 'containerRightOffset', unit: '%' },
        { id: 'voteButtonTop', unit: '%' },
        { id: 'identityWidthRatio', unit: '%' },
        { id: 'messageFlexRatio', unit: '' },
        { id: 'voteFlexRatio', unit: '' }
    ];
    sliderIds.forEach(function(s) {
        const slider = document.getElementById('wlp-' + s.id);
        const valEl = document.getElementById('wlp-val-' + s.id);
        const v = layoutConfig[s.id];
        if (slider && v !== undefined) slider.value = v;
        if (valEl && v !== undefined) valEl.textContent = v + s.unit;
    });
    // sync edit mode button state
    const editBtn = document.getElementById('wlp-edit-btn');
    if (editBtn) {
        if (editMode) {
            editBtn.textContent = '🔧 關閉編輯模式';
            editBtn.classList.add('wlp-active');
        } else {
            editBtn.textContent = '🔧 開啟編輯模式';
            editBtn.classList.remove('wlp-active');
        }
    }
}

// 2.3 Show panel
function showLayoutPanel() {
    createLayoutPanel();
    const panel = document.getElementById('wlp-root');
    if (!panel) return;
    panel.classList.remove('wlp-hiding');
    panel.classList.add('wlp-visible');
    layoutPanelVisible = true;
    // 6.3 Sync sliders with current config
    syncPanelSliders();
}

// 2.3 Hide panel
function hideLayoutPanel() {
    const panel = document.getElementById('wlp-root');
    if (!panel) return;
    panel.classList.add('wlp-hiding');
    setTimeout(function() {
        panel.classList.remove('wlp-visible');
        panel.classList.remove('wlp-hiding');
        layoutPanelVisible = false;
    }, 300);
}

// 3.1 Inject gear button
function injectGearButton() {
    if (document.getElementById('wlp-gear')) return;
    createLayoutPanelStyles();
    const gear = document.createElement('div');
    gear.id = 'wlp-gear';
    gear.textContent = '⚙';
    gear.title = '版面設定';
    // 3.2 Toggle panel on click
    gear.addEventListener('click', function() {
        if (layoutPanelVisible) {
            hideLayoutPanel();
        } else {
            showLayoutPanel();
        }
    });
    document.body.appendChild(gear);
}

// 3.3 Remove gear button
function removeGearButton() {
    const gear = document.getElementById('wlp-gear');
    if (gear) gear.remove();
}

// 監聽 storage 變更，確保跨分頁/跨影片套用同一組排版參數
function setupLayoutConfigChangeListener() {
    try {
        chrome.storage?.onChanged?.addListener((changes, areaName) => {
            if (areaName !== 'sync') return;
            if (!changes.werewolfLayoutConfig) return;

            const next = changes.werewolfLayoutConfig.newValue;
            layoutConfig = { ...getDefaultLayoutConfig(), ...(next || {}) };
            console.log('偵測到版面配置更新，已套用:', layoutConfig);

            if (isWatchPage() && shouldEnableBlocker()) {
                requestAnimationFrame(() => {
                    hideIdentityInfo();
                });
            }
        });
    } catch (e) {
        console.log('setupLayoutConfigChangeListener 失敗:', e?.message);
    }
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
    } else if (request.action === 'showLayoutPanel') {
        // 6.1 顯示浮動版面設定面板
        showLayoutPanel();
    } else if (request.action === 'hideLayoutPanel') {
        // 6.1 隱藏浮動版面設定面板
        hideLayoutPanel();
    }
    // ===== 片段分析相關訊息處理 =====
    else if (request.action === 'analyzeVideo') {
        console.log("收到分析影片請求");
        analyzeCurrentVideo().then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // 異步回應
    } else if (request.action === 'getVideoSegments') {
        sendResponse({
            success: true,
            videoId: currentVideoId,
            segments: videoSegments,
            isAnalyzing: isAnalyzing
        });
        return true;
    } else if (request.action === 'updateSkipSettings') {
        console.log("收到更新跳過設定請求:", request.settings);
        segmentSkipSettings = { ...segmentSkipSettings, ...request.settings };
        skipEnabled = request.skipEnabled ?? skipEnabled;
        skipNotificationEnabled = request.skipNotification ?? skipNotificationEnabled;
        saveSkipSettings();
        
        // 更新已載入片段的跳過狀態
        videoSegments.forEach(seg => {
            seg.shouldSkip = segmentSkipSettings[seg.type] ?? seg.shouldSkip;
        });
        
        sendResponse({ success: true });
        return true;
    } else if (request.action === 'getSkipSettings') {
        sendResponse({
            success: true,
            settings: segmentSkipSettings,
            skipEnabled: skipEnabled,
            skipNotification: skipNotificationEnabled
        });
        return true;
    } else if (request.action === 'clearVideoSegments') {
        const videoId = request.videoId || currentVideoId;
        if (videoId) {
            const key = `werewolfSegments_${videoId}`;
            chrome.storage.local.remove(key, () => {
                if (videoId === currentVideoId) {
                    clearVideoSegments();
                }
                console.log(`已清除影片 ${videoId} 的片段資料`);
                sendResponse({ success: true });
            });
        } else {
            sendResponse({ success: false, error: '無影片 ID' });
        }
        return true;
    } else if (request.action === 'addManualSegment') {
        const videoId = currentVideoId || getVideoId();
        if (!videoId) {
            sendResponse({ success: false, error: '無法獲取影片 ID' });
            return true;
        }
        
        const newSegment = request.segment;
        if (!newSegment || (newSegment.start === undefined && newSegment.startTime === undefined)) {
            sendResponse({ success: false, error: '片段資料無效' });
            return true;
        }
        
        const segmentToAdd = {
            type: newSegment.type || 'custom',
            start: newSegment.start ?? newSegment.startTime,
            end: newSegment.end ?? newSegment.endTime,
            label: newSegment.label || '手動標記',
            shouldSkip: true,
            manual: true,
            confidence: 1.0
        };
        
        loadVideoSegments(videoId).then((data) => {
            let segments = data?.segments || videoSegments || [];
            
            segments.push(segmentToAdd);
            segments.sort((a, b) => (a.start ?? a.startTime) - (b.start ?? b.startTime));
            
            const mergedSegments = mergeOverlappingSegments(segments);
            videoSegments = mergedSegments;
            
            saveVideoSegments(videoId, mergedSegments).then(() => {
                console.log(`已新增手動片段: ${segmentToAdd.start} - ${segmentToAdd.end} (${segmentToAdd.type})`);
                sendResponse({ success: true, segments: mergedSegments });
            });
        });
        return true;
    } else if (request.action === 'getCurrentVideoTime') {
        const video = document.querySelector('video');
        if (video) {
            sendResponse({ success: true, time: video.currentTime, duration: video.duration });
        } else {
            sendResponse({ success: false, error: '找不到影片' });
        }
        return true;
    } else if (request.action === 'markSegmentStart') {
        const video = document.querySelector('video');
        if (video) {
            const currentTime = video.currentTime;
            sendResponse({ success: true, time: currentTime });
        } else {
            sendResponse({ success: false, error: '找不到影片' });
        }
        return true;
    } else if (request.action === 'skipToTime') {
        const video = document.querySelector('video');
        if (video && request.time !== undefined) {
            video.currentTime = request.time;
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: '無法跳轉' });
        }
        return true;
    } else if (request.action === 'updateCustomKeywords') {
        console.log("收到更新自訂關鍵詞請求:", request.keywords);
        customKeywords = request.keywords || [];
        saveCustomKeywords();
        sendResponse({ success: true });
        return true;
    } else if (request.action === 'getCustomKeywords') {
        sendResponse({ success: true, keywords: customKeywords });
        return true;
    } else if (request.action === 'deleteSegment') {
        const videoId = currentVideoId || getVideoId();
        const index = request.index;
        
        if (!videoId) {
            sendResponse({ success: false, error: '無法獲取影片 ID' });
            return true;
        }
        
        if (index === undefined || index < 0 || index >= videoSegments.length) {
            sendResponse({ success: false, error: '無效的片段索引' });
            return true;
        }
        
        const removedSegment = videoSegments.splice(index, 1)[0];
        console.log(`已刪除片段: ${removedSegment.type} (${removedSegment.start} - ${removedSegment.end})`);
        
        saveVideoSegments(videoId, videoSegments).then(() => {
            sendResponse({ success: true, segments: videoSegments });
        });
        return true;
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

        // 3.1 Inject gear button when blocker is active
        injectGearButton();

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

    // 3.3 Remove gear button only when truly disabling (checked by caller context)
    if (!isWatchPage() || !shouldEnableBlocker()) {
        removeGearButton();
        hideLayoutPanel();
    }
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
            
            // 處理影片片段
            if (isWatchPage()) {
                handleVideoChange();
            } else {
                clearVideoSegments();
            }
            
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

// ===== 初始化和主要事件監聯 =====
// 當 YouTube 網頁載入時執行
function initializeExtension() {
    if (isInitialized) return;
    
    loadBlockerStatus();

    setupLayoutConfigChangeListener();
    
    loadSkipSettings();
    
    loadCustomKeywords();
    
    setupURLChangeListener();
    
    if (isWatchPage()) {
        handleVideoChange();
    }
    
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