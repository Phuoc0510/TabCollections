global.chrome = {
  storage: {
    local: {
      get: async (_keys) => ({}),
      set: async (_items) => {},
      remove: async (_keys) => {},
    }
  }
};

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    throw new Error(message);
  }
  console.log('PASS:', message);
}

async function main() {
  const { getAllData, saveAllData, getGroups, createGroup, updateGroup, deleteGroup, addTabToGroup, getTabsByGroup, removeTab, exportData, importData, moveTabToGroup, updateTab, getPages, createPage, updatePage, deletePage, addGroupToPage, removeGroupFromPage } = await import('./storage.js');

  let stored = {};
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async (items) => { stored = { ...stored, ...items }; };
  chrome.storage.local.remove = async (keys) => { for (const k of keys) delete stored[k]; };

  // Test 1: createGroup returns a group with id, name, icon, color, timestamps
  const g = await createGroup('Work', '💼', '#ea4335');
  assert(g.id && g.name === 'Work' && g.icon === '💼' && g.color === '#ea4335' && g.createdAt > 0, 'createGroup basic');

  // Test 2: addTabToGroup adds tab entry with correct fields
  const tab = { title: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' };
  const entry = await addTabToGroup(tab, g.id);
  assert(entry.id && entry.title === 'GitHub' && entry.url === 'https://github.com' && entry.groupId === g.id, 'addTabToGroup fields');

  // Test 3: getTabsByGroup returns tabs for group
  let tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 1 && tabs[0].title === 'GitHub', 'getTabsByGroup');

  // Test 4: duplicate URL in same group is rejected
  const dup = await addTabToGroup(tab, g.id);
  assert(dup === null, 'duplicate URL rejected');

  // Test 5: removeTab removes tab entry
  await removeTab(entry.id);
  tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 0, 'removeTab');

  // Test 6: getAllData returns full structure
  const data = await getAllData();
  assert(typeof data.groups === 'object' && typeof data.tabs === 'object', 'getAllData shape');

  // Test 7: exportData returns valid JSON string
  const jsonStr = await exportData();
  const parsed = JSON.parse(jsonStr);
  assert(parsed.version === 2 && Array.isArray(parsed.groups) && Array.isArray(parsed.tabs) && Array.isArray(parsed.pages), 'exportData format');

  // Test 8: importData merges data
  const importJson = JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01',
    groups: [{ id: 'g1', name: 'Imported', icon: '📦', createdAt: 1, updatedAt: 1 }],
    tabs: [{ id: 't1', title: 'Test', url: 'https://test.com', favicon: '', groupId: 'g1', addedAt: 1 }]
  });
  await importData(importJson);
  const groupsData = await getAllData();
  assert(groupsData.groups['g1'].name === 'Imported', 'importData merge');

  // Test 9: getGroups returns groups sorted by updatedAt descending
  await createGroup('Later', '📁');
  await new Promise(r => setTimeout(r, 5));
  const g3 = await createGroup('Earlier', '📁');
  const groups = await getGroups();
  assert(groups[0].updatedAt >= groups[1].updatedAt && groups[1].updatedAt >= groups[2].updatedAt, 'getGroups sort order');

  // Test 10: updateGroup renames group and updates updatedAt
  const oldUpdated = g3.updatedAt;
  await new Promise(r => setTimeout(r, 5));
  await updateGroup(g3.id, { name: 'Renamed' });
  const dataAfter = await getAllData();
  assert(dataAfter.groups[g3.id].name === 'Renamed', 'updateGroup name');
  assert(dataAfter.groups[g3.id].updatedAt > oldUpdated, 'updateGroup updatedAt increased');

  // Test 11: deleteGroup removes group and its tabs
  const g4 = await createGroup('ToDelete', '🗑️');
  const t1 = await addTabToGroup({ title: 'Tab1', url: 'https://one.com' }, g4.id);
  const t2 = await addTabToGroup({ title: 'Tab2', url: 'https://two.com' }, g4.id);
  await deleteGroup(g4.id);
  const afterDelete = await getAllData();
  assert(!afterDelete.groups[g4.id], 'deleteGroup removed group');
  assert(!afterDelete.tabs[t1.id], 'deleteGroup removed tab1');
  assert(!afterDelete.tabs[t2.id], 'deleteGroup removed tab2');

  // Test 12: importData does NOT overwrite existing group (collision)
  const existingGroup = await createGroup('Original', '🛡️');
  const existingId = existingGroup.id;
  const originalName = existingGroup.name;
  const collidingImport = JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01',
    groups: [{ id: existingId, name: 'OverwriteAttempt', icon: '❌', createdAt: 1, updatedAt: 1 }],
    tabs: []
  });
  await importData(collidingImport);
  const afterCollision = await getAllData();
  assert(afterCollision.groups[existingId].name === originalName, 'importData does not overwrite existing group');

  // Test 13: addTabToGroup with non-existent groupId throws
  try {
    await addTabToGroup({ title: 'Fail', url: 'https://fail.com' }, 'nonexistent-id');
    assert(false, 'addTabToGroup should have thrown');
  } catch (e) {
    assert(e.message === 'Group not found', 'addTabToGroup throws for invalid groupId');
  }

  // Test 14: moveTabToGroup changes groupId
  {
    const name = 'moveTabToGroup changes groupId';
    const data = { groups: { g1: { id: 'g1', name: 'A', updatedAt: 1000 }, g2: { id: 'g2', name: 'B', updatedAt: 2000 } }, tabs: { t1: { id: 't1', url: 'https://x.com', groupId: 'g1', addedAt: 500, position: 500 } } };
    await saveAllData(data);
    await moveTabToGroup('t1', 'g2');
    const result = await getTabsByGroup('g2');
    assert(result.length === 1, 'tab should be in g2');
    assert(result[0].groupId === 'g2', 'groupId should be g2');
    assert(result[0].id === 't1', 'tab id should stay t1');
    console.log(`PASS: ${name}`);
  }

  // Test 15: updateTab changes title, keeps other fields unchanged
  {
    const tabEntry = await addTabToGroup({ title: 'OrigTitle', url: 'https://orig.com' }, 'g1');
    await updateTab(tabEntry.id, { title: 'New Title' });
    const data = await getAllData();
    assert(data.tabs[tabEntry.id].title === 'New Title', 'updateTab changes title');
    assert(data.tabs[tabEntry.id].url === 'https://orig.com', 'updateTab keeps other fields unchanged');
  }

  // Test 16: updateTab changes url
  {
    const data1 = await getAllData();
    const targetTab = Object.values(data1.tabs).find(t => t.title === 'New Title');
    await updateTab(targetTab.id, { url: 'https://newurl.com' });
    const data2 = await getAllData();
    assert(data2.tabs[targetTab.id].url === 'https://newurl.com', 'updateTab changes url');
  }

  // Test 17: updateTab throws for invalid tabId
  try {
    await updateTab('nonexistent', { title: 'x' });
    assert(false, 'updateTab should have thrown');
  } catch (e) {
    assert(e.message.includes('not found'), 'updateTab throws for invalid tabId');
  }

  // Test 18: createPage & getPages
  const p1 = await createPage('Work', '💼', ['group-id-1']);
  assert(p1.id && p1.name === 'Work' && p1.icon === '💼' && Array.isArray(p1.groupIds), 'createPage basic');

  // Test 19: getPages returns pages sorted by position
  const p2 = await createPage('Personal', '👤', []);
  let pages = await getPages();
  assert(pages.length === 2 && pages[0].name === 'Work', 'getPages sorted by position');

  // Test 20: updatePage renames page
  await updatePage(p1.id, { name: 'Office' });
  pages = await getPages();
  assert(pages.find(p => p.id === p1.id).name === 'Office', 'updatePage name');

  // Test 21: deletePage removes page (groups inside are NOT deleted)
  await deletePage(p2.id);
  pages = await getPages();
  assert(pages.length === 1 && pages[0].id === p1.id, 'deletePage');

  // Test 22: addGroupToPage / removeGroupFromPage
  const g_temp = await createGroup('Temp', '📁');
  await addGroupToPage(p1.id, g_temp.id);
  let pagesData = await getAllData();
  assert(pagesData.pages[p1.id].groupIds.includes(g_temp.id), 'addGroupToPage');
  await removeGroupFromPage(p1.id, g_temp.id);
  pagesData = await getAllData();
  assert(!pagesData.pages[p1.id].groupIds.includes(g_temp.id), 'removeGroupFromPage');

  // Test 23: exportData version updated and includes pages
  await createPage('ExpPage', '📄', []);
  const jsonStr2 = await exportData();
  const parsed2 = JSON.parse(jsonStr2);
  assert(parsed2.version === 2 && Array.isArray(parsed2.pages), 'exportData version 2 includes pages');

  // Test 24: importData v2 includes pages
  await saveAllData({ groups: {}, tabs: {} });
  const newImport = JSON.stringify({
    version: 2,
    exportedAt: '2026-01-01',
    groups: [],
    tabs: [],
    pages: [{ id: 'p-import', name: 'Imported Page', icon: '📄', position: 0, groupIds: [] }]
  });
  await importData(newImport);
  const afterV2 = await getAllData();
  assert(afterV2.pages && afterV2.pages['p-import'], 'importData v2 includes pages');

  // Test 25: updatePage with non-existent ID throws
  try {
    await updatePage('nonexistent', { name: 'Fail' });
    assert(false, 'updatePage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'updatePage throws for invalid pageId');
  }

  // Test 26: addGroupToPage with non-existent pageId throws
  try {
    await addGroupToPage('bad-page', 'good-group');
    assert(false, 'addGroupToPage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'addGroupToPage throws for invalid pageId');
  }

  // Test 27: removeGroupFromPage with non-existent pageId throws
  try {
    await removeGroupFromPage('bad-page', 'good-group');
    assert(false, 'removeGroupFromPage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'removeGroupFromPage throws for invalid pageId');
  }

  console.log('\nAll tests passed.');
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
