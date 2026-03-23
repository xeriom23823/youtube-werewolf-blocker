// YouTube 狼人殺遮蔽助手 - Popup 控制腳本
document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggle');
  const statusValue = document.getElementById('status-value');
  const modeAll = document.getElementById('mode-all');
  const modeSelected = document.getElementById('mode-selected');
  const channelSection = document.getElementById('channel-section');
  const channelList = document.getElementById('channel-list');
  const channelNameInput = document.getElementById('channel-name');
  const addChannelButton = document.getElementById('add-channel');
  
  // 版面設定入口按鈕
  const openLayoutPanelButton = document.getElementById('open-layout-panel');

  // 片段設定相關元素
  const segmentHeader = document.getElementById('segment-header');
  const segmentContent = document.getElementById('segment-content');
  const segmentToggleIcon = document.getElementById('segment-toggle-icon');
  const analyzeVideoButton = document.getElementById('analyze-video');
  const analyzeButtonText = document.getElementById('analyze-button-text');
  const analyzeStatus = document.getElementById('analyze-status');
  const skipEnabledToggle = document.getElementById('skip-enabled');
  const skipNightToggle = document.getElementById('skip-night');
  const skipDrawToggle = document.getElementById('skip-draw');
  const skipOpeningToggle = document.getElementById('skip-opening');
  const skipReviewToggle = document.getElementById('skip-review');
  const segmentListElement = document.getElementById('segment-list');
  const segmentCountElement = document.getElementById('segment-count');
  const clearSegmentsButton = document.getElementById('clear-segments');
  
  let selectedChannels = [];
  let blockMode = 'all';
  let isAnalyzing = false;
  let customKeywords = [];

  // 載入設定
  loadSettings();
  
  // 添加切換按鈕事件監聽器
  toggleButton.addEventListener('click', function() {
    // 讀取當前狀態並切換
    chrome.storage.sync.get({ 'werewolfBlockerEnabled': false }, function(result) {
      const newStatus = !result.werewolfBlockerEnabled;
      
      // 保存新狀態到 Chrome 存儲
      chrome.storage.sync.set({ 'werewolfBlockerEnabled': newStatus });
      
      // 更新 UI
      updateUI(newStatus);
      
      // 向所有打開的 YouTube 標籤發送訊息以更新狀態
      sendStatusToTabs(newStatus);
    });
  });
  
  // 監聽模式選擇
  modeAll.addEventListener('change', function() {
    if (this.checked) {
      blockMode = 'all';
      updateChannelSectionVisibility();
      saveSettings();
      sendSettingsToTabs();
    }
  });
  
  modeSelected.addEventListener('change', function() {
    if (this.checked) {
      blockMode = 'selected';
      updateChannelSectionVisibility();
      saveSettings();
      sendSettingsToTabs();
    }
  });
  
  // 添加頻道按鈕事件
  addChannelButton.addEventListener('click', function() {
    addChannel();
  });
  
  // 按Enter鍵添加頻道
  channelNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addChannel();
    }
  });
  
  // 開啟版面設定面板
  if (openLayoutPanelButton) {
    openLayoutPanelButton.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/watch*"}, function(tabs) {
        if (tabs && tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'showLayoutPanel' }, function() {
            if (chrome.runtime.lastError) {
              console.log('無法開啟版面設定面板:', chrome.runtime.lastError);
            }
          });
        }
      });
    });

    // 檢查是否在 YouTube 影片頁面，否則 disable 按鈕
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/watch*"}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        openLayoutPanelButton.disabled = true;
        openLayoutPanelButton.title = '請先開啟 YouTube 影片頁面';
      }
    });
  }

  // 片段設定折疊/展開
  segmentHeader.addEventListener('click', function() {
    segmentContent.classList.toggle('show');
    segmentToggleIcon.classList.toggle('expanded');
  });
  
  // 初始化片段設定
  initializeSegmentSettings();
  
  // 添加頻道邏輯
  function addChannel() {
    const channelName = channelNameInput.value.trim();
    if (channelName && !selectedChannels.includes(channelName)) {
      selectedChannels.push(channelName);
      renderChannelList();
      saveSettings();
      sendSettingsToTabs();
      channelNameInput.value = '';
    }
  }
  
  // 移除頻道邏輯
  function removeChannel(index) {
    selectedChannels.splice(index, 1);
    renderChannelList();
    saveSettings();
    sendSettingsToTabs();
  }
  
  // 渲染頻道列表
  function renderChannelList() {
    channelList.innerHTML = '';
    if (selectedChannels.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'channel-item';
      emptyItem.textContent = '尚未添加任何頻道';
      channelList.appendChild(emptyItem);
    } else {
      selectedChannels.forEach((channel, index) => {
        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        
        const channelText = document.createElement('span');
        channelText.textContent = channel;
        channelItem.appendChild(channelText);
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-channel';
        removeButton.textContent = '移除';
        removeButton.addEventListener('click', () => removeChannel(index));
        channelItem.appendChild(removeButton);
        
        channelList.appendChild(channelItem);
      });
    }
  }
  
  // 更新頻道區域可見性
  function updateChannelSectionVisibility() {
    if (blockMode === 'selected') {
      channelSection.style.display = 'block';
    } else {
      channelSection.style.display = 'none';
    }
  }
  
  // 加載設定
  function loadSettings() {
    chrome.storage.sync.get({
      'werewolfBlockerEnabled': false,
      'werewolfBlockMode': 'all',
      'werewolfSelectedChannels': []
    }, function(result) {
      // 更新UI狀態
      updateUI(result.werewolfBlockerEnabled);

      // 更新模式選擇
      blockMode = result.werewolfBlockMode;
      if (blockMode === 'all') {
        modeAll.checked = true;
      } else {
        modeSelected.checked = true;
      }

      // 更新選定頻道
      selectedChannels = result.werewolfSelectedChannels;
      renderChannelList();
      updateChannelSectionVisibility();
    });
  }
  
  // 保存設定
  function saveSettings() {
    chrome.storage.sync.set({
      'werewolfBlockMode': blockMode,
      'werewolfSelectedChannels': selectedChannels
    });
  }
  
  // 更新 UI 顯示
  function updateUI(enabled) {
    if (enabled) {
      toggleButton.textContent = '關閉遮蔽';
      toggleButton.classList.add('active');
      statusValue.textContent = '已啟用';
    } else {
      toggleButton.textContent = '開啟遮蔽';
      toggleButton.classList.remove('active');
      statusValue.textContent = '已停用';
    }
  }
  
  // 向所有 YouTube 標籤發送狀態更新
  function sendStatusToTabs(status) {
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateBlockerStatus',
              enabled: status
            });
            console.log('已發送狀態更新到標籤:', tab.id, status);
          } catch (error) {
            console.log('發送訊息到標籤時出錯:', error);
          }
        });
      } else {
        console.log('未找到 YouTube 標籤');
      }
    });
  }
  
  // 向所有 YouTube 標籤發送設定更新
  function sendSettingsToTabs() {
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateBlockerSettings',
              blockMode: blockMode,
              selectedChannels: selectedChannels
            });
            console.log('已發送設定更新到標籤:', tab.id);
          } catch (error) {
            console.log('發送訊息到標籤時出錯:', error);
          }
        });
      }
    });
  }
  
  // ===== 片段設定相關函數 =====
  
  function initializeSegmentSettings() {
    loadSkipSettings();
    loadCurrentVideoSegments();
    setupSegmentEventListeners();
    loadCustomKeywords();
    setupCustomKeywordsEventListeners();
  }
  
  // 載入跳過設定
  function loadSkipSettings() {
    chrome.storage.sync.get({
      'werewolfSkipSettings': {
        night: true,
        draw: true,
        opening: false,
        review: false
      },
      'werewolfSkipEnabled': true
    }, function(result) {
      const settings = result.werewolfSkipSettings;
      
      skipEnabledToggle.checked = result.werewolfSkipEnabled;
      skipNightToggle.checked = settings.night;
      skipDrawToggle.checked = settings.draw;
      skipOpeningToggle.checked = settings.opening;
      skipReviewToggle.checked = settings.review;
    });
  }
  
  // 載入當前影片的片段資料
  function loadCurrentVideoSegments() {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getVideoSegments' }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('無法取得影片片段:', chrome.runtime.lastError);
            updateSegmentDisplay(null);
            return;
          }
          
          if (response && response.segments) {
            updateSegmentDisplay(response.segments);
          } else {
            updateSegmentDisplay(null);
          }
        });
      } else {
        updateSegmentDisplay(null);
        analyzeStatus.textContent = '請在 YouTube 影片頁面使用此功能';
        analyzeVideoButton.disabled = true;
      }
    });
  }
  
  // 更新片段顯示
  function updateSegmentDisplay(segments) {
    segmentListElement.innerHTML = '';
    
    if (!segments || segments.length === 0) {
      segmentCountElement.textContent = '0';
      const emptyItem = document.createElement('div');
      emptyItem.className = 'segment-item';
      emptyItem.style.color = '#777';
      emptyItem.style.justifyContent = 'center';
      emptyItem.textContent = '尚無片段資料';
      segmentListElement.appendChild(emptyItem);
      analyzeStatus.textContent = '尚未分析此影片';
      return;
    }
    
    segmentCountElement.textContent = segments.length.toString();
    analyzeStatus.textContent = `已偵測到 ${segments.length} 個片段`;
    
    const typeNames = {
      night: '🌙 夜間',
      draw: '🎴 抽牌',
      opening: '🎤 開場',
      review: '📋 復盤',
      speaking: '💬 發言',
      custom: '⏭️ 自訂'
    };
    
    segments.forEach(function(segment, index) {
      const segmentItem = document.createElement('div');
      segmentItem.className = 'segment-item';
      
      const segmentInfo = document.createElement('div');
      segmentInfo.className = 'segment-info';
      
      const segmentType = document.createElement('span');
      segmentType.className = 'segment-type';
      segmentType.textContent = typeNames[segment.type] || segment.type;
      segmentInfo.appendChild(segmentType);
      
      const segmentTime = document.createElement('span');
      segmentTime.className = 'segment-time';
      segmentTime.textContent = formatTime(segment.start) + ' - ' + formatTime(segment.end);
      segmentInfo.appendChild(segmentTime);
      
      segmentItem.appendChild(segmentInfo);
      
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'segment-buttons';
      
      const jumpButton = document.createElement('button');
      jumpButton.className = 'segment-jump';
      jumpButton.textContent = '跳至';
      jumpButton.addEventListener('click', function() {
        jumpToSegment(segment.start);
      });
      buttonsContainer.appendChild(jumpButton);
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'segment-delete';
      deleteButton.textContent = '×';
      deleteButton.title = '刪除此片段';
      deleteButton.addEventListener('click', function() {
        deleteSegment(index);
      });
      buttonsContainer.appendChild(deleteButton);
      
      segmentItem.appendChild(buttonsContainer);
      
      segmentListElement.appendChild(segmentItem);
    });
  }
  
  // 格式化時間 (秒 -> mm:ss)
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  }
  
  // 跳轉到片段
  function jumpToSegment(time) {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'skipToTime',
          time: time
        });
      }
    });
  }
  
  function deleteSegment(index) {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'deleteSegment',
          index: index
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('刪除片段失敗:', chrome.runtime.lastError);
            return;
          }
          if (response && response.success) {
            updateSegmentDisplay(response.segments);
            analyzeStatus.textContent = '已刪除片段';
          } else {
            alert(response?.error || '刪除片段失敗');
          }
        });
      }
    });
  }
  
  // 設置片段設定事件監聽
  function setupSegmentEventListeners() {
    // 分析按鈕
    analyzeVideoButton.addEventListener('click', function() {
      if (isAnalyzing) return;
      analyzeCurrentVideo();
    });
    
    // 跳過總開關
    skipEnabledToggle.addEventListener('change', function() {
      saveAndSendSkipSettings();
    });
    
    // 各階段跳過開關
    skipNightToggle.addEventListener('change', function() {
      saveAndSendSkipSettings();
    });
    
    skipDrawToggle.addEventListener('change', function() {
      saveAndSendSkipSettings();
    });
    
    skipOpeningToggle.addEventListener('change', function() {
      saveAndSendSkipSettings();
    });
    
    skipReviewToggle.addEventListener('change', function() {
      saveAndSendSkipSettings();
    });
    
    // 清除片段按鈕
    clearSegmentsButton.addEventListener('click', function() {
      clearCurrentVideoSegments();
    });
    
    // 手動新增片段按鈕
    const addManualSegmentButton = document.getElementById('add-manual-segment');
    const manualStartTimeInput = document.getElementById('manual-start-time');
    const manualEndTimeInput = document.getElementById('manual-end-time');
    const manualSegmentTypeSelect = document.getElementById('manual-segment-type');
    
    if (addManualSegmentButton) {
      addManualSegmentButton.addEventListener('click', function() {
        addManualSegment();
      });
    }
    
    // 時間輸入框按 Enter 鍵觸發新增
    if (manualStartTimeInput) {
      manualStartTimeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          manualEndTimeInput.focus();
        }
      });
    }
    if (manualEndTimeInput) {
      manualEndTimeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          addManualSegment();
        }
      });
    }
    
    // 「使用當前時間」按鈕
    const useCurrentStartBtn = document.getElementById('use-current-start');
    const useCurrentEndBtn = document.getElementById('use-current-end');
    
    if (useCurrentStartBtn) {
      useCurrentStartBtn.addEventListener('click', function() {
        getCurrentVideoTime(function(time) {
          if (time !== null) {
            manualStartTimeInput.value = formatTime(time);
          }
        });
      });
    }
    
    if (useCurrentEndBtn) {
      useCurrentEndBtn.addEventListener('click', function() {
        getCurrentVideoTime(function(time) {
          if (time !== null) {
            manualEndTimeInput.value = formatTime(time);
          }
        });
      });
    }
  }
  
  // 取得影片當前時間
  function getCurrentVideoTime(callback) {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getCurrentVideoTime' }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('無法取得影片時間:', chrome.runtime.lastError);
            callback(null);
            return;
          }
          if (response && response.success) {
            callback(response.time);
          } else {
            callback(null);
          }
        });
      } else {
        callback(null);
      }
    });
  }
  
  // 解析時間字串為秒數
  function parseTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    const parts = timeStr.trim().split(':').map(p => parseFloat(p.trim()));
    
    if (parts.some(p => isNaN(p) || p < 0)) return null;
    
    if (parts.length === 1) {
      // 只有秒數
      return parts[0];
    } else if (parts.length === 2) {
      // 分:秒
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // 時:分:秒
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return null;
  }
  
  // 格式化秒數為時間字串
  function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  // 手動新增片段
  function addManualSegment() {
    const manualStartTimeInput = document.getElementById('manual-start-time');
    const manualEndTimeInput = document.getElementById('manual-end-time');
    const manualSegmentTypeSelect = document.getElementById('manual-segment-type');
    
    const startTime = parseTimeString(manualStartTimeInput.value);
    const endTime = parseTimeString(manualEndTimeInput.value);
    const segmentType = manualSegmentTypeSelect.value;
    
    // 驗證
    if (startTime === null) {
      alert('請輸入有效的開始時間（例如：1:30）');
      manualStartTimeInput.focus();
      return;
    }
    
    if (endTime === null) {
      alert('請輸入有效的結束時間（例如：2:00）');
      manualEndTimeInput.focus();
      return;
    }
    
    if (endTime <= startTime) {
      alert('結束時間必須大於開始時間');
      manualEndTimeInput.focus();
      return;
    }
    
    // 類型標籤映射
    const typeLabels = {
      'night': '夜間環節',
      'draw': '抽牌環節',
      'opening': '開場環節',
      'review': '復盤環節',
      'custom': '自訂跳過'
    };
    
    const newSegment = {
      type: segmentType,
      label: typeLabels[segmentType] || '自訂跳過',
      startTime: startTime,
      endTime: endTime,
      manual: true
    };
    
    // 發送到 content script
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'addManualSegment',
          segment: newSegment
        }, function(response) {
          if (chrome.runtime.lastError) {
            alert('新增失敗，請確保在 YouTube 影片頁面使用');
            return;
          }
          
          if (response && response.success) {
            // 清空輸入框
            manualStartTimeInput.value = '';
            manualEndTimeInput.value = '';
            
            // 更新顯示
            updateSegmentDisplay(response.segments);
            analyzeStatus.textContent = `已新增片段：${formatTime(startTime)} - ${formatTime(endTime)}`;
          } else {
            alert(response?.error || '新增片段失敗');
          }
        });
      } else {
        alert('請在 YouTube 影片頁面使用此功能');
      }
    });
  }
  
  // 分析當前影片
  function analyzeCurrentVideo() {
    isAnalyzing = true;
    analyzeVideoButton.disabled = true;
    analyzeVideoButton.classList.add('analyzing');
    analyzeButtonText.textContent = '分析中...';
    analyzeStatus.textContent = '正在擷取字幕並分析...';
    
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'analyzeVideo' }, function(response) {
          isAnalyzing = false;
          analyzeVideoButton.disabled = false;
          analyzeVideoButton.classList.remove('analyzing');
          analyzeButtonText.textContent = '字幕規則分析';
          
          if (chrome.runtime.lastError) {
            console.log('分析失敗:', chrome.runtime.lastError);
            analyzeStatus.className = 'analyze-status error';
            analyzeStatus.textContent = '分析失敗，請重新整理頁面後再試';
            return;
          }
          
          if (response && response.success) {
            updateSegmentDisplay(response.segments);
            
            const segments = response.segments;
            const avgConfidence = segments.length > 0 
              ? segments.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / segments.length 
              : 0;
            
            if (segments.length === 0) {
              analyzeStatus.className = 'analyze-status warning';
              analyzeStatus.innerHTML = '分析完成，但未偵測到可跳過的片段。<br><small>可能原因：字幕內容不包含典型的狼人殺環節標記</small>';
            } else if (avgConfidence >= 0.7) {
              analyzeStatus.className = 'analyze-status success';
              analyzeStatus.innerHTML = `✅ 分析完成！偵測到 <strong>${segments.length}</strong> 個片段<br><small>平均信心度：${(avgConfidence * 100).toFixed(0)}%</small>`;
            } else if (avgConfidence >= 0.4) {
              analyzeStatus.className = 'analyze-status warning';
              analyzeStatus.innerHTML = `⚠️ 分析完成，偵測到 <strong>${segments.length}</strong> 個片段<br><small>信心度較低 (${(avgConfidence * 100).toFixed(0)}%)，建議手動確認</small>`;
            } else {
              analyzeStatus.className = 'analyze-status warning';
              analyzeStatus.innerHTML = `⚠️ 偵測到 <strong>${segments.length}</strong> 個可能片段<br><small>信心度低，建議使用手動標記功能</small>`;
            }
          } else {
            analyzeStatus.className = 'analyze-status error';
            const errorMsg = response?.error || '分析失敗，可能沒有可用的字幕';
            analyzeStatus.innerHTML = errorMsg.replace(/\n/g, '<br>');
          }
        });
      } else {
        isAnalyzing = false;
        analyzeVideoButton.disabled = false;
        analyzeVideoButton.classList.remove('analyzing');
        analyzeButtonText.textContent = '字幕規則分析';
        analyzeStatus.className = 'analyze-status info';
        analyzeStatus.textContent = '請在 YouTube 影片頁面使用此功能';
      }
    });
  }
  
  // 保存並發送跳過設定
  function saveAndSendSkipSettings() {
    const settings = {
      night: skipNightToggle.checked,
      draw: skipDrawToggle.checked,
      opening: skipOpeningToggle.checked,
      review: skipReviewToggle.checked
    };
    const enabled = skipEnabledToggle.checked;
    
    // 保存到 storage
    chrome.storage.sync.set({
      'werewolfSkipSettings': settings,
      'werewolfSkipEnabled': enabled
    });
    
    // 發送到 content script
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateSkipSettings',
              settings: settings,
              enabled: enabled
            });
          } catch (error) {
            console.log('發送跳過設定時出錯:', error);
          }
        });
      }
    });
  }
  
  // 清除當前影片的片段資料
  function clearCurrentVideoSegments() {
    chrome.tabs.query({active: true, currentWindow: true, url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'clearVideoSegments' }, function(response) {
          if (response && response.success) {
            updateSegmentDisplay(null);
            analyzeStatus.textContent = '已清除片段資料';
          }
        });
      }
    });
  }
  
  // ===== 自訂關鍵詞相關函數 =====
  
  const KEYWORD_TYPE_LABELS = {
    'night-start': '🌙 夜間開始',
    'night-end': '🌙 夜間結束',
    'review-start': '📋 復盤開始',
    'draw': '🎴 抽牌',
    'opening': '🎤 開場'
  };
  
  function loadCustomKeywords() {
    chrome.storage.sync.get({ 'werewolfCustomKeywords': [] }, function(result) {
      customKeywords = result.werewolfCustomKeywords || [];
      renderCustomKeywordsList();
    });
  }
  
  function saveCustomKeywords() {
    chrome.storage.sync.set({ 'werewolfCustomKeywords': customKeywords }, function() {
      sendCustomKeywordsToTabs();
    });
  }
  
  function sendCustomKeywordsToTabs() {
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateCustomKeywords',
              keywords: customKeywords
            });
          } catch (error) {
            console.log('發送自訂關鍵詞時出錯:', error);
          }
        });
      }
    });
  }
  
  function renderCustomKeywordsList() {
    const listElement = document.getElementById('custom-keywords-list');
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (customKeywords.length === 0) {
      listElement.innerHTML = '<div class="no-keywords-hint">尚未新增自訂關鍵詞</div>';
      return;
    }
    
    customKeywords.forEach(function(kw, index) {
      const item = document.createElement('div');
      item.className = 'keyword-item';
      
      const typeLabel = document.createElement('span');
      typeLabel.className = 'keyword-item-type';
      typeLabel.textContent = KEYWORD_TYPE_LABELS[kw.type] || kw.type;
      
      const textSpan = document.createElement('span');
      textSpan.className = 'keyword-item-text';
      textSpan.textContent = kw.text;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'keyword-remove-btn';
      removeBtn.textContent = '×';
      removeBtn.title = '移除此關鍵詞';
      removeBtn.addEventListener('click', function() {
        removeCustomKeyword(index);
      });
      
      item.appendChild(typeLabel);
      item.appendChild(textSpan);
      item.appendChild(removeBtn);
      listElement.appendChild(item);
    });
  }
  
  function addCustomKeyword() {
    const input = document.getElementById('custom-keyword-input');
    const typeSelect = document.getElementById('keyword-segment-type');
    
    const text = input.value.trim();
    const type = typeSelect.value;
    
    if (!text) {
      alert('請輸入關鍵詞');
      input.focus();
      return;
    }
    
    if (text.length < 2) {
      alert('關鍵詞至少需要 2 個字元');
      input.focus();
      return;
    }
    
    const exists = customKeywords.some(kw => kw.text === text && kw.type === type);
    if (exists) {
      alert('此關鍵詞已存在');
      input.focus();
      return;
    }
    
    customKeywords.push({
      type: type,
      text: text,
      weight: 7
    });
    
    saveCustomKeywords();
    renderCustomKeywordsList();
    input.value = '';
    input.focus();
  }
  
  function removeCustomKeyword(index) {
    if (index >= 0 && index < customKeywords.length) {
      customKeywords.splice(index, 1);
      saveCustomKeywords();
      renderCustomKeywordsList();
    }
  }
  
  function setupCustomKeywordsEventListeners() {
    const addBtn = document.getElementById('add-keyword-btn');
    const input = document.getElementById('custom-keyword-input');
    
    if (addBtn) {
      addBtn.addEventListener('click', addCustomKeyword);
    }
    
    if (input) {
      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          addCustomKeyword();
        }
      });
    }
  }
});