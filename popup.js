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
  
  // 版面設定相關元素
  const layoutHeader = document.getElementById('layout-header');
  const layoutContent = document.getElementById('layout-content');
  const layoutToggleIcon = document.getElementById('layout-toggle-icon');
  const resetLayoutButton = document.getElementById('reset-layout');
  const editModeToggle = document.getElementById('edit-mode-toggle');
  const editModeHint = document.getElementById('edit-mode-hint');
  
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
  let blockMode = 'all'; // 預設為所有頻道
  let layoutConfig = getDefaultLayoutConfig(); // 版面配置
  let editMode = false; // 編輯模式
  let isAnalyzing = false; // 分析中狀態

  // 版面配置預設值（與 content.js 保持一致）
  function getDefaultLayoutConfig() {
    return {
      containerTop: 8,
      containerHeight: 87,
      containerWidth: 12,
      containerLeftOffset: 7,
      containerRightOffset: 7,
      voteButtonTop: 3,
      identityWidthRatio: 20.83,
      messageFlexRatio: 2,
      voteFlexRatio: 1
    };
  }

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
  
  // 版面設定折疊/展開
  layoutHeader.addEventListener('click', function() {
    layoutContent.classList.toggle('show');
    layoutToggleIcon.classList.toggle('expanded');
  });
  
  // 片段設定折疊/展開
  segmentHeader.addEventListener('click', function() {
    segmentContent.classList.toggle('show');
    segmentToggleIcon.classList.toggle('expanded');
  });
  
  // 初始化片段設定
  initializeSegmentSettings();
  
  // 恢復預設值按鈕
  resetLayoutButton.addEventListener('click', function() {
    // 向 content script 發送重置請求
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'resetLayoutConfig' }, function(response) {
          if (response && response.layoutConfig) {
            layoutConfig = response.layoutConfig;
            updateLayoutSliders();
          } else {
            // 如果沒有回應，使用本地預設值
            layoutConfig = getDefaultLayoutConfig();
            updateLayoutSliders();
            saveLayoutConfig();
            sendLayoutToTabs();
          }
        });
      } else {
        // 沒有 YouTube 標籤，直接重置本地
        layoutConfig = getDefaultLayoutConfig();
        updateLayoutSliders();
        saveLayoutConfig();
      }
    });
  });
  
  // 設置所有 slider 的事件監聽
  setupLayoutSliders();
  
  // 編輯模式切換
  editModeToggle.addEventListener('click', function() {
    editMode = !editMode;
    updateEditModeUI();
    sendEditModeToTabs();
  });
  
  // 更新編輯模式 UI
  function updateEditModeUI() {
    if (editMode) {
      editModeToggle.textContent = '🔧 關閉編輯模式';
      editModeToggle.classList.add('active');
      editModeHint.classList.add('show');
    } else {
      editModeToggle.textContent = '🔧 開啟編輯模式';
      editModeToggle.classList.remove('active');
      editModeHint.classList.remove('show');
    }
  }
  
  // 向所有 YouTube 標籤發送編輯模式更新
  function sendEditModeToTabs() {
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'toggleEditMode',
              enabled: editMode
            });
            console.log('已發送編輯模式更新到標籤:', tab.id, editMode);
          } catch (error) {
            console.log('發送編輯模式到標籤時出錯:', error);
          }
        });
      }
    });
  }
  
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
      'werewolfSelectedChannels': [],
      'werewolfLayoutConfig': null
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
      
      // 更新版面配置
      if (result.werewolfLayoutConfig) {
        layoutConfig = { ...getDefaultLayoutConfig(), ...result.werewolfLayoutConfig };
      } else {
        layoutConfig = getDefaultLayoutConfig();
      }
      updateLayoutSliders();
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
  
  // ===== 版面配置相關函數 =====
  
  // 設置版面配置 slider 事件監聽
  function setupLayoutSliders() {
    const sliderIds = [
      'containerTop',
      'containerHeight', 
      'containerWidth',
      'containerLeftOffset',
      'containerRightOffset',
      'voteButtonTop',
      'identityWidthRatio',
      'messageFlexRatio',
      'voteFlexRatio'
    ];
    
    sliderIds.forEach(function(id) {
      const slider = document.getElementById(id);
      if (slider) {
        // 滑動時即時更新數值顯示
        slider.addEventListener('input', function() {
          updateSliderValue(id, this.value);
        });
        
        // 滑動結束時保存並發送更新
        slider.addEventListener('change', function() {
          layoutConfig[id] = parseFloat(this.value);
          saveLayoutConfig();
          sendLayoutToTabs();
        });
      }
    });
  }
  
  // 更新 slider 數值顯示
  function updateSliderValue(id, value) {
    const valueElement = document.getElementById(id + '-value');
    if (valueElement) {
      // 根據不同的配置項顯示不同的單位
      if (id === 'messageFlexRatio' || id === 'voteFlexRatio') {
        valueElement.textContent = value;
      } else {
        valueElement.textContent = value + '%';
      }
    }
  }
  
  // 更新所有 slider 的顯示值
  function updateLayoutSliders() {
    const sliderIds = [
      'containerTop',
      'containerHeight', 
      'containerWidth',
      'containerLeftOffset',
      'containerRightOffset',
      'voteButtonTop',
      'identityWidthRatio',
      'messageFlexRatio',
      'voteFlexRatio'
    ];
    
    sliderIds.forEach(function(id) {
      const slider = document.getElementById(id);
      if (slider && layoutConfig[id] !== undefined) {
        slider.value = layoutConfig[id];
        updateSliderValue(id, layoutConfig[id]);
      }
    });
  }
  
  // 保存版面配置
  function saveLayoutConfig() {
    chrome.storage.sync.set({ 'werewolfLayoutConfig': layoutConfig });
  }
  
  // 向所有 YouTube 標籤發送版面配置更新
  function sendLayoutToTabs() {
    chrome.tabs.query({url: "*://www.youtube.com/*"}, function(tabs) {
      if (tabs && tabs.length > 0) {
        tabs.forEach(function(tab) {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateLayoutConfig',
              layoutConfig: layoutConfig
            });
            console.log('已發送版面配置更新到標籤:', tab.id);
          } catch (error) {
            console.log('發送版面配置到標籤時出錯:', error);
          }
        });
      }
    });
  }
  
  // ===== 片段設定相關函數 =====
  
  // 初始化片段設定
  function initializeSegmentSettings() {
    // 載入跳過設定
    loadSkipSettings();
    
    // 載入當前影片的片段資料
    loadCurrentVideoSegments();
    
    // 設置事件監聽
    setupSegmentEventListeners();
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
    
    // 片段類型名稱映射
    const typeNames = {
      night: '🌙 夜間',
      draw: '🎴 抽牌',
      opening: '🎤 開場',
      review: '📋 復盤',
      speaking: '💬 發言'
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
      
      // 跳轉按鈕
      const jumpButton = document.createElement('button');
      jumpButton.className = 'segment-jump';
      jumpButton.textContent = '跳至';
      jumpButton.addEventListener('click', function() {
        jumpToSegment(segment.start);
      });
      segmentItem.appendChild(jumpButton);
      
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
          analyzeButtonText.textContent = 'AI 分析字幕';
          
          if (chrome.runtime.lastError) {
            console.log('分析失敗:', chrome.runtime.lastError);
            analyzeStatus.textContent = '分析失敗，請重新整理頁面後再試';
            return;
          }
          
          if (response && response.success) {
            updateSegmentDisplay(response.segments);
            analyzeStatus.textContent = `分析完成！偵測到 ${response.segments.length} 個片段`;
          } else {
            // 使用 innerHTML 支援換行
            const errorMsg = response?.error || '分析失敗，可能沒有可用的字幕';
            analyzeStatus.innerHTML = errorMsg.replace(/\n/g, '<br>');
          }
        });
      } else {
        isAnalyzing = false;
        analyzeVideoButton.disabled = false;
        analyzeVideoButton.classList.remove('analyzing');
        analyzeButtonText.textContent = 'AI 分析字幕';
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
});