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

chrome.runtime.onInstalled.addListener(() => {
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
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true;
});
