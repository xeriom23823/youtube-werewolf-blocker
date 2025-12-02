// YouTube 狼人殺遮蔽助手 - Background Service Worker
// 處理字幕 API 請求，避免 CORS 限制

// ===== 常量定義 =====
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CONTEXT = {
    client: {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00',
        hl: 'zh-TW',
        gl: 'TW'
    }
};

// ===== 字幕抓取相關 =====

// 使用 Innertube API 獲取字幕 URL
async function fetchCaptionUrlViaInnertube(videoId) {
    try {
        console.log('嘗試使用 Innertube API 獲取字幕:', videoId);
        
        const requestBody = {
            videoId: videoId,
            context: INNERTUBE_CONTEXT
        };
        console.log('Innertube 請求內容:', JSON.stringify(requestBody));
        
        const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Innertube 回應狀態:', response.status);
        
        if (!response.ok) {
            throw new Error(`Innertube API 請求失敗: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Innertube 回應資料鍵:', Object.keys(data));
        
        // 從回應中提取字幕軌道
        const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (!captions || captions.length === 0) {
            console.log('Innertube API 回應中沒有字幕');
            console.log('playabilityStatus:', data?.playabilityStatus?.status);
            return null;
        }
        
        console.log('Innertube 找到字幕軌道:', captions.length);
        for (const c of captions) {
            console.log(`  - ${c.languageCode}: ${c.baseUrl?.substring(0, 60)}...`);
        }
        
        // 選擇最佳字幕軌道
        const langPriority = ['zh-TW', 'zh-Hant', 'zh-CN', 'zh-Hans', 'zh'];
        let targetTrack = null;
        
        for (const lang of langPriority) {
            targetTrack = captions.find(c => 
                c.languageCode === lang || 
                (c.languageCode && c.languageCode.startsWith(lang))
            );
            if (targetTrack) {
                console.log('選擇字幕語言:', targetTrack.languageCode);
                break;
            }
        }
        
        if (!targetTrack) {
            targetTrack = captions[0];
            console.log('使用第一個可用字幕:', targetTrack.languageCode);
        }
        
        return targetTrack.baseUrl;
    } catch (e) {
        console.log('Innertube API 失敗:', e.message);
        return null;
    }
}

// 從 YouTube 頁面抓取字幕資料
async function fetchYouTubeSubtitles(videoId, lang = 'zh-TW') {
    try {
        console.log('開始抓取字幕，影片ID:', videoId);
        
        // 方法1: 使用 Innertube API (最可靠)
        console.log('使用 Innertube API...');
        const innertubeUrl = await fetchCaptionUrlViaInnertube(videoId);
        console.log('Innertube URL:', innertubeUrl ? innertubeUrl.substring(0, 100) + '...' : 'null');
        
        if (innertubeUrl) {
            const result = await fetchSubtitleByUrl(innertubeUrl);
            console.log('Innertube 結果:', result.success ? `成功 ${result.subtitles?.length} 條` : result.error);
            if (result.success) {
                return result;
            }
        }
        
        // 方法2: 從影片頁面取得字幕資訊
        console.log('嘗試從頁面獲取字幕...');
        const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const pageResponse = await fetch(videoPageUrl, {
            headers: {
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await pageResponse.text();
        
        // 提取所有可用的字幕 URL
        const subtitleUrls = extractSubtitleUrls(html);
        
        if (subtitleUrls.length === 0) {
            console.log('此影片沒有字幕');
            return { success: false, error: '此影片沒有可用字幕' };
        }
        
        console.log('找到字幕 URL 數量:', subtitleUrls.length);
        
        // 優先順序：繁體中文 > 簡體中文 > 任何中文 > 第一個可用
        let targetUrl = selectBestSubtitleUrl(subtitleUrls);
        
        if (!targetUrl) {
            return { success: false, error: '無法取得字幕 URL' };
        }
        
        // 抓取字幕內容
        return await fetchSubtitleByUrl(targetUrl);
        
    } catch (error) {
        console.error('抓取字幕時發生錯誤:', error);
        return { success: false, error: error.message };
    }
}

// 選擇最佳字幕 URL
function selectBestSubtitleUrl(subtitleUrls) {
    // 優先順序：繁體中文 > 簡體中文 > 任何中文 > 第一個可用
    for (const sub of subtitleUrls) {
        if (sub.lang === 'zh-TW' || sub.lang === 'zh-Hant') {
            console.log('使用繁體中文字幕');
            return sub.url;
        }
    }
    
    for (const sub of subtitleUrls) {
        if (sub.lang === 'zh-CN' || sub.lang === 'zh-Hans') {
            console.log('使用簡體中文字幕');
            return sub.url;
        }
    }
    
    for (const sub of subtitleUrls) {
        if (sub.lang && sub.lang.startsWith('zh')) {
            console.log('使用中文字幕:', sub.lang);
            return sub.url;
        }
    }
    
    if (subtitleUrls.length > 0) {
        console.log('使用第一個可用字幕:', subtitleUrls[0].lang);
        return subtitleUrls[0].url;
    }
    
    return null;
}

// 從 HTML 中提取字幕 URL
function extractSubtitleUrls(html) {
    const subtitleUrls = [];
    
    // 方法1: 直接匹配 baseUrl
    const baseUrlRegex = /"baseUrl"\s*:\s*"(https?:\\?\/\\?\/[^"]*timedtext[^"]*)"/g;
    let match;
    
    while ((match = baseUrlRegex.exec(html)) !== null) {
        let url = match[1];
        // 解碼轉義字元
        url = url.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        
        // 提取語言代碼
        const langMatch = url.match(/[&?]lang=([^&]+)/);
        const lang = langMatch ? langMatch[1] : 'unknown';
        
        // 避免重複
        if (!subtitleUrls.find(s => s.lang === lang)) {
            subtitleUrls.push({ url, lang });
        }
    }
    
    // 方法2: 嘗試解析 captionTracks JSON
    if (subtitleUrls.length === 0) {
        const captionMatch = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])(?=\s*,|\s*})/);
        if (captionMatch) {
            try {
                const tracks = JSON.parse(captionMatch[1]);
                for (const track of tracks) {
                    if (track.baseUrl) {
                        let url = track.baseUrl.replace(/\\u0026/g, '&');
                        subtitleUrls.push({
                            url,
                            lang: track.languageCode || 'unknown'
                        });
                    }
                }
            } catch (e) {
                console.log('captionTracks 解析失敗:', e.message);
            }
        }
    }
    
    return subtitleUrls;
}

// 使用 baseUrl 抓取字幕
async function fetchSubtitleByUrl(baseUrl) {
    if (!baseUrl) {
        return { success: false, error: '沒有提供字幕 URL' };
    }
    
    // 解碼 URL
    let url = baseUrl.replace(/\\u0026/g, '&');
    console.log('準備抓取字幕 URL (解碼後):', url.substring(0, 100) + '...');
    console.log('完整 URL:', url);
    
    // 從 URL 中提取 video ID 和語言
    const videoIdMatch = url.match(/[?&]v=([^&]+)/);
    const langMatch = url.match(/[?&]lang=([^&]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    const lang = langMatch ? langMatch[1] : 'zh-Hant';
    
    console.log('提取 videoId:', videoId, 'lang:', lang);
    
    // 方法A: 嘗試簡化的 timedtext URL (只用必要參數)
    if (videoId) {
        console.log('嘗試方法A: 簡化 timedtext URL...');
        const simpleUrls = [
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`,
            `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`,
        ];
        
        for (const simpleUrl of simpleUrls) {
            try {
                console.log('嘗試簡化 URL:', simpleUrl);
                const resp = await fetch(simpleUrl);
                console.log('簡化 URL 回應狀態:', resp.status);
                if (resp.ok) {
                    const text = await resp.text();
                    console.log('簡化 URL 回應長度:', text.length);
                    if (text && text.length > 10) {
                        let subtitles = [];
                        if (text.trim().startsWith('{')) {
                            subtitles = parseJSON3Subtitles(JSON.parse(text));
                        } else if (text.includes('<text')) {
                            subtitles = parseXMLSubtitles(text);
                        }
                        if (subtitles.length > 0) {
                            console.log('方法A 成功! 字幕數:', subtitles.length);
                            return { success: true, subtitles, format: 'simple' };
                        }
                    }
                }
            } catch (e) {
                console.log('簡化 URL 失敗:', e.message);
            }
        }
    }
    
    // 方法B: 嘗試原始 URL 的不同格式
    console.log('嘗試方法B: 原始 URL 不同格式...');
    const formats = ['json3', 'srv3', 'vtt'];
    
    for (const fmt of formats) {
        try {
            let fetchUrl = url;
            if (fetchUrl.includes('&fmt=')) {
                fetchUrl = fetchUrl.replace(/&fmt=[^&]+/, `&fmt=${fmt}`);
            } else {
                fetchUrl += `&fmt=${fmt}`;
            }
            
            console.log(`嘗試 ${fmt} 格式，URL 長度: ${fetchUrl.length}`);
            
            const response = await fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
                }
            });
            
            console.log(`${fmt} 格式請求狀態: ${response.status}`);
            
            if (!response.ok) {
                console.log(`${fmt} 格式請求失敗: ${response.status}`);
                continue;
            }
            
            const text = await response.text();
            console.log(`${fmt} 格式回應長度: ${text.length}, 前100字: ${text.substring(0, 100)}`);
            
            if (!text || text.trim().length === 0) {
                console.log(`${fmt} 格式回應為空`);
                continue;
            }
            
            // 解析字幕
            let subtitles = [];
            
            if (fmt === 'json3' && text.trim().startsWith('{')) {
                const data = JSON.parse(text);
                subtitles = parseJSON3Subtitles(data);
            } else if (text.includes('<text')) {
                subtitles = parseXMLSubtitles(text);
            } else if (text.includes('WEBVTT')) {
                subtitles = parseVTTSubtitles(text);
            }
            
            if (subtitles.length > 0) {
                console.log(`成功解析 ${fmt} 格式，字幕數: ${subtitles.length}`);
                return {
                    success: true,
                    subtitles: subtitles,
                    format: fmt
                };
            }
        } catch (e) {
            console.log(`${fmt} 格式處理失敗:`, e.message);
        }
    }
    
    return { success: false, error: '無法獲取字幕內容' };
}

// 解析 JSON3 格式字幕
function parseJSON3Subtitles(data) {
    const subtitles = [];
    
    if (!data.events) {
        return subtitles;
    }
    
    for (const event of data.events) {
        // 跳過沒有文字的事件
        if (!event.segs) continue;
        
        // 組合文字
        let text = '';
        for (const seg of event.segs) {
            if (seg.utf8) {
                text += seg.utf8;
            }
        }
        
        // 清理文字
        text = text.trim();
        if (!text) continue;
        
        // 時間戳記 (毫秒轉秒)
        const startTime = (event.tStartMs || 0) / 1000;
        const duration = (event.dDurationMs || 0) / 1000;
        const endTime = startTime + duration;
        
        subtitles.push({
            start: startTime,
            end: endTime,
            text: text
        });
    }
    
    return subtitles;
}

// 解析 XML 格式字幕 (YouTube 的傳統格式)
function parseXMLSubtitles(xmlText) {
    const subtitles = [];
    
    // 使用正則表達式解析 XML
    const textRegex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let match;
    
    while ((match = textRegex.exec(xmlText)) !== null) {
        const start = parseFloat(match[1]);
        const duration = parseFloat(match[2]);
        let text = match[3];
        
        // 解碼 HTML 實體
        text = decodeHTMLEntities(text);
        text = text.trim();
        
        if (text) {
            subtitles.push({
                start: start,
                end: start + duration,
                text: text
            });
        }
    }
    
    return subtitles;
}

// 解碼 HTML 實體
function decodeHTMLEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#32;': ' ',
        '&nbsp;': ' '
    };
    
    return text.replace(/&[#\w]+;/g, (entity) => {
        return entities[entity] || entity;
    });
}

// 解析 VTT 格式字幕
function parseVTTSubtitles(vttText) {
    const subtitles = [];
    const lines = vttText.split('\n');
    let currentSub = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 匹配時間戳記 00:00:00.000 --> 00:00:00.000
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
        if (timeMatch) {
            if (currentSub && currentSub.text) {
                subtitles.push(currentSub);
            }
            currentSub = {
                start: parseVTTTime(timeMatch[1]),
                end: parseVTTTime(timeMatch[2]),
                text: ''
            };
        } else if (currentSub && line && !line.match(/^\d+$/) && line !== 'WEBVTT') {
            currentSub.text += (currentSub.text ? ' ' : '') + line;
        }
    }
    
    if (currentSub && currentSub.text) {
        subtitles.push(currentSub);
    }
    
    return subtitles;
}

// 解析 VTT 時間格式
function parseVTTTime(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
}

// ===== 訊息監聽 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchSubtitles') {
        console.log('收到字幕抓取請求:', request.videoId);
        
        // 異步處理字幕抓取
        fetchYouTubeSubtitles(request.videoId, request.lang || 'zh-TW')
            .then(result => {
                console.log('字幕抓取結果:', result.success ? `${result.subtitles?.length} 條字幕` : result.error);
                sendResponse(result);
            })
            .catch(error => {
                console.error('字幕抓取錯誤:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // 返回 true 表示會異步回應
        return true;
    }
    
    // 使用指定的 baseUrl 抓取字幕
    if (request.action === 'fetchSubtitleByUrl') {
        console.log('收到字幕 URL 抓取請求');
        
        fetchSubtitleByUrl(request.baseUrl)
            .then(result => {
                console.log('字幕抓取結果:', result.success ? `${result.subtitles?.length} 條字幕` : result.error);
                sendResponse(result);
            })
            .catch(error => {
                console.error('字幕抓取錯誤:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
    
    if (request.action === 'getVideoInfo') {
        // 獲取影片資訊
        sendResponse({ success: true });
        return true;
    }
});

// Service Worker 啟動日誌
console.log('YouTube 狼人殺遮蔽助手 Background Service Worker 已啟動');
