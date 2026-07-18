importScripts('storage.js');

const MENU_PARENT_ID = 'add-to-collection';

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
});

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
  if (command !== 'quick-save') return;
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
});
