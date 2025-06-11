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
  
  let selectedChannels = [];
  let blockMode = 'all'; // 預設為所有頻道

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
});