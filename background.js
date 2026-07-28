importScripts('storage.js');
importScripts('tasks/tasks-logic.js');
importScripts('tasks/tasks-api.js');

const MENU_PARENT_ID = 'add-to-collection';
const TASKS_ALARM = 'tasks-reminder';
const TASKS_REMINDER_HOUR = 17;
const TASKS_REMINDER_MINUTE = 35;

async function rebuildContextMenu() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: MENU_PARENT_ID,
    title: 'Add to Tab Collection',
    contexts: ['tab']
  });

  const groups = await getGroups();

  for (const g of groups) {
    chrome.contextMenus.create({
      parentId: MENU_PARENT_ID,
      id: `group-${g.id}`,
      title: `${g.icon} ${g.name}`,
      contexts: ['tab']
    });
  }

  chrome.contextMenus.create({
    parentId: MENU_PARENT_ID,
    id: 'new-group',
    title: '➕ New Group...',
    contexts: ['tab']
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const groups = await getGroups();
  if (groups.length === 0) {
    await createGroup('General', '📁', '#4285f4');
  }
  rebuildContextMenu();

  ensureTasksReminder();
});

chrome.runtime.onStartup.addListener(ensureTasksReminder);

// The service worker restarts constantly under MV3, so only create the alarm when it is
// actually missing. Recreating it on every wake-up would keep pushing the next fire time back.
async function ensureTasksReminder() {
  const existing = await chrome.alarms.get(TASKS_ALARM);
  if (existing) return;
  const now = Date.now();
  const target = new Date();
  target.setHours(TASKS_REMINDER_HOUR, TASKS_REMINDER_MINUTE, 0, 0);
  let when = target.getTime();
  if (when <= now) when += 86400000;
  chrome.alarms.create(TASKS_ALARM, { when, periodInMinutes: 1440 });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.parentMenuItemId !== MENU_PARENT_ID) return;

  const tabInfo = { title: tab.title, url: tab.url, favicon: tab.favIconUrl || '' };

  if (info.menuItemId === 'new-group') {
    const group = await createGroup('New Group');
    await addTabToGroup(tabInfo, group.id);
    await rebuildContextMenu();
  } else if (info.menuItemId.startsWith('group-')) {
    const groupId = info.menuItemId.slice(6);
    await addTabToGroup(tabInfo, groupId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const handle = async (fn) => {
        try { sendResponse(await fn()); }
        catch (e) { sendResponse({ error: e.message }); }
      };
      switch (msg.action) {
        case 'getGroups':
          sendResponse(await getGroups());
          break;
        case 'getTabsByGroup':
          sendResponse(await getTabsByGroup(msg.groupId));
          break;
        case 'createGroup':
          await createGroup(msg.name, msg.icon, msg.color);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'updateGroup':
          await updateGroup(msg.id, msg.data);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'deleteGroup':
          await deleteGroup(msg.id);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'addTabToGroup':
          await addTabToGroup(msg.tab, msg.groupId);
          sendResponse({ ok: true });
          break;
        case 'removeTab':
          await removeTab(msg.tabId);
          sendResponse({ ok: true });
          break;
        case 'getAllData':
          sendResponse(await getAllData());
          break;
        case 'exportData':
          sendResponse(await exportData());
          break;
        case 'importData':
          await importData(msg.json);
          sendResponse({ ok: true });
          break;
        case 'updateGroupPositions':
          await updateGroupPositions(msg.orderedIds);
          sendResponse({ ok: true });
          break;
        case 'updateTabPositions':
          await updateTabPositions(msg.groupId, msg.orderedIds);
          sendResponse({ ok: true });
          break;
        case 'moveTabToGroup':
          await moveTabToGroup(msg.tabId, msg.targetGroupId);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'updateTab':
          await updateTab(msg.tabId, msg.updates);
          sendResponse({ ok: true });
          break;
        case 'getPages':
          sendResponse(await getPages());
          break;
        case 'createPage': {
          const newPage = await createPage(msg.name, msg.icon, msg.groupIds);
          sendResponse(newPage);
          break;
        }
        case 'deletePage':
          await deletePage(msg.id);
          sendResponse({ ok: true });
          break;
        case 'tasks:login':
          await handle(() => tasksLogin(msg.username, msg.password));
          break;
        case 'tasks:logout':
          await handle(() => tasksLogout());
          break;
        case 'tasks:me':
          await handle(() => tasksMe());
          break;
        case 'tasks:list':
          await handle(() => tasksList(msg.params || {}));
          break;
        case 'tasks:create':
          await handle(() => tasksCreate(msg.payload));
          break;
        case 'tasks:update':
          await handle(() => tasksUpdate(msg.id, msg.payload));
          break;
        case 'tasks:delete':
          await handle(() => tasksDelete(msg.id));
          break;
        case 'tasks:toggle':
          await handle(() => tasksToggle(msg.id, msg.done));
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-save') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      await chrome.storage.session.set({
        pendingQuickSave: { title: tab.title, url: tab.url, favicon: tab.favIconUrl || '' }
      });
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html?quick=1'),
        type: 'popup',
        width: 420,
        height: 360
      });
    } catch (err) {
      console.error('Quick Save failed:', err);
    }
  } else if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TASKS_ALARM) return;
  chrome.notifications.create(TASKS_ALARM, {
    type: 'basic',
    title: '⏰ Nhắc nhở Task',
    message: 'Đã 17h35, hãy xem xét lại bảng task hôm nay!',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    requireInteraction: true
  });
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId !== TASKS_ALARM) return;
  chrome.notifications.clear(TASKS_ALARM);

  // Reuse an already open tasks tab instead of piling up a new one per click.
  const url = chrome.runtime.getURL('newtab/newtab.html');
  const [existing] = await chrome.tabs.query({ url: url + '*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true, url: url + '?view=tasks' });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  chrome.tabs.create({ url: url + '?view=tasks' });
});

