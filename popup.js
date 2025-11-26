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
  
  let selectedChannels = [];
  let blockMode = 'all'; // 預設為所有頻道
  let layoutConfig = getDefaultLayoutConfig(); // 版面配置
  let editMode = false; // 編輯模式

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
});