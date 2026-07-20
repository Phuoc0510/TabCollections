global.chrome = {
  storage: {
    local: {
      get: async (keys) => ({}),
      set: async (items) => {},
      remove: async (keys) => {},
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
  const { getAllData, saveAllData, getGroups, createGroup, updateGroup, deleteGroup, addTabToGroup, getTabsByGroup, removeTab, togglePinGroup, softDeleteGroup, softDeleteTab, restoreGroup, restoreTab, purgeDeleted, updateGroupPositions, updateTabPositions, exportData, importData, moveTabToGroup, getPages, createPage, updatePage, deletePage, addGroupToPage, removeGroupFromPage } = await import('./storage.js');

  let stored = {};
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async (items) => { stored = { ...stored, ...items }; };
  chrome.storage.local.remove = async (keys) => { for (const k of keys) delete stored[k]; };

  // Test 1: createGroup returns a group with id, name, icon, color, timestamps
  let g = await createGroup('Work', '💼', '#ea4335');
  assert(g.id && g.name === 'Work' && g.icon === '💼' && g.color === '#ea4335' && g.createdAt > 0, 'createGroup basic');

  // Test 2: addTabToGroup adds tab entry with correct fields
  let tab = { title: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' };
  let entry = await addTabToGroup(tab, g.id);
  assert(entry.id && entry.title === 'GitHub' && entry.url === 'https://github.com' && entry.groupId === g.id, 'addTabToGroup fields');

  // Test 3: getTabsByGroup returns tabs for group
  let tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 1 && tabs[0].title === 'GitHub', 'getTabsByGroup');

  // Test 4: duplicate URL in same group is rejected
  let dup = await addTabToGroup(tab, g.id);
  assert(dup === null, 'duplicate URL rejected');

  // Test 5: removeTab removes tab entry
  await removeTab(entry.id);
  tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 0, 'removeTab');

  // Test 6: getAllData returns full structure
  let data = await getAllData();
  assert(typeof data.groups === 'object' && typeof data.tabs === 'object', 'getAllData shape');

  // Test 7: exportData returns valid JSON string
  let jsonStr = await exportData();
  let parsed = JSON.parse(jsonStr);
  assert(parsed.version === 2 && Array.isArray(parsed.groups) && Array.isArray(parsed.tabs) && Array.isArray(parsed.pages), 'exportData format');

  // Test 8: importData merges data
  let importJson = JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01',
    groups: [{ id: 'g1', name: 'Imported', icon: '📦', createdAt: 1, updatedAt: 1 }],
    tabs: [{ id: 't1', title: 'Test', url: 'https://test.com', favicon: '', groupId: 'g1', addedAt: 1 }]
  });
  await importData(importJson);
  let groupsData = await getAllData();
  assert(groupsData.groups['g1'].name === 'Imported', 'importData merge');

  // Test 9: getGroups returns groups sorted by updatedAt descending
  let g2 = await createGroup('Later', '📁');
  await new Promise(r => setTimeout(r, 5));
  let g3 = await createGroup('Earlier', '📁');
  let groups = await getGroups();
  assert(groups[0].updatedAt >= groups[1].updatedAt && groups[1].updatedAt >= groups[2].updatedAt, 'getGroups sort order');

  // Test 10: updateGroup renames group and updates updatedAt
  let oldUpdated = g3.updatedAt;
  await new Promise(r => setTimeout(r, 5));
  await updateGroup(g3.id, { name: 'Renamed' });
  let dataAfter = await getAllData();
  assert(dataAfter.groups[g3.id].name === 'Renamed', 'updateGroup name');
  assert(dataAfter.groups[g3.id].updatedAt > oldUpdated, 'updateGroup updatedAt increased');

  // Test 11: deleteGroup removes group and its tabs
  let g4 = await createGroup('ToDelete', '🗑️');
  let t1 = await addTabToGroup({ title: 'Tab1', url: 'https://one.com' }, g4.id);
  let t2 = await addTabToGroup({ title: 'Tab2', url: 'https://two.com' }, g4.id);
  await deleteGroup(g4.id);
  let afterDelete = await getAllData();
  assert(!afterDelete.groups[g4.id], 'deleteGroup removed group');
  assert(!afterDelete.tabs[t1.id], 'deleteGroup removed tab1');
  assert(!afterDelete.tabs[t2.id], 'deleteGroup removed tab2');

  // Test 12: importData does NOT overwrite existing group (collision)
  let existingGroup = await createGroup('Original', '🛡️');
  let existingId = existingGroup.id;
  let originalName = existingGroup.name;
  let collidingImport = JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01',
    groups: [{ id: existingId, name: 'OverwriteAttempt', icon: '❌', createdAt: 1, updatedAt: 1 }],
    tabs: []
  });
  await importData(collidingImport);
  let afterCollision = await getAllData();
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

  // Test 15: createPage & getPages
  let p1 = await createPage('Work', '💼', ['group-id-1']);
  assert(p1.id && p1.name === 'Work' && p1.icon === '💼' && Array.isArray(p1.groupIds), 'createPage basic');

  // Test 16: getPages returns pages sorted by position
  let p2 = await createPage('Personal', '👤', []);
  let pages = await getPages();
  assert(pages.length === 2 && pages[0].name === 'Work', 'getPages sorted by position');

  // Test 17: updatePage renames page
  await updatePage(p1.id, { name: 'Office' });
  pages = await getPages();
  assert(pages.find(p => p.id === p1.id).name === 'Office', 'updatePage name');

  // Test 18: deletePage removes page (groups inside are NOT deleted)
  await deletePage(p2.id);
  pages = await getPages();
  assert(pages.length === 1 && pages[0].id === p1.id, 'deletePage');

  // Test 19: addGroupToPage / removeGroupFromPage
  let g_temp = await createGroup('Temp', '📁');
  await addGroupToPage(p1.id, g_temp.id);
  let pagesData = await getAllData();
  assert(pagesData.pages[p1.id].groupIds.includes(g_temp.id), 'addGroupToPage');
  await removeGroupFromPage(p1.id, g_temp.id);
  pagesData = await getAllData();
  assert(!pagesData.pages[p1.id].groupIds.includes(g_temp.id), 'removeGroupFromPage');

  // Test 20: exportData version updated and includes pages
  let p_exp = await createPage('ExpPage', '📄', []);
  let jsonStr2 = await exportData();
  let parsed2 = JSON.parse(jsonStr2);
  assert(parsed2.version === 2 && Array.isArray(parsed2.pages), 'exportData version 2 includes pages');

  // Test 21: importData v2 includes pages
  await saveAllData({ groups: {}, tabs: {} });
  let newImport = JSON.stringify({
    version: 2,
    exportedAt: '2026-01-01',
    groups: [],
    tabs: [],
    pages: [{ id: 'p-import', name: 'Imported Page', icon: '📄', position: 0, groupIds: [] }]
  });
  await importData(newImport);
  let afterV2 = await getAllData();
  assert(afterV2.pages && afterV2.pages['p-import'], 'importData v2 includes pages');

  // Test 22: updatePage with non-existent ID throws
  try {
    await updatePage('nonexistent', { name: 'Fail' });
    assert(false, 'updatePage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'updatePage throws for invalid pageId');
  }

  // Test 23: addGroupToPage with non-existent pageId throws
  try {
    await addGroupToPage('bad-page', 'good-group');
    assert(false, 'addGroupToPage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'addGroupToPage throws for invalid pageId');
  }

  // Test 24: removeGroupFromPage with non-existent pageId throws
  try {
    await removeGroupFromPage('bad-page', 'good-group');
    assert(false, 'removeGroupFromPage should have thrown');
  } catch (e) {
    assert(e.message === 'Page not found', 'removeGroupFromPage throws for invalid pageId');
  }

  // Test 25: togglePinGroup toggles pinned field
  {
    let g = await createGroup('PinTest', '📌');
    assert(g.pinned === undefined || g.pinned === false, 'togglePinGroup initially false');
    await togglePinGroup(g.id);
    let data = await getAllData();
    assert(data.groups[g.id].pinned === true, 'togglePinGroup sets pinned true');
    await togglePinGroup(g.id);
    data = await getAllData();
    assert(data.groups[g.id].pinned === false, 'togglePinGroup sets pinned false');
  }

  // Test 26: softDeleteGroup sets deletedAt on group and tabs
  {
    let g = await createGroup('DelTest', '🗑️');
    let tab = await addTabToGroup({ title: 'DelTab', url: 'https://deltest.com' }, g.id);
    await softDeleteGroup(g.id);
    let data = await getAllData();
    assert(data.groups[g.id].deletedAt > 0, 'softDeleteGroup sets deletedAt');
    assert(data.tabs[tab.id].deletedAt > 0, 'softDeleteGroup deletes tabs too');
    let groups = await getGroups();
    assert(!groups.find(x => x.id === g.id), 'getGroups hides soft-deleted group');
  }

  // Test 27: restoreGroup clears deletedAt
  {
    let g = await createGroup('RestTest', '♻️');
    let tab = await addTabToGroup({ title: 'RestTab', url: 'https://resttest.com' }, g.id);
    await softDeleteGroup(g.id);
    await restoreGroup(g.id);
    let data = await getAllData();
    assert(data.groups[g.id].deletedAt === null, 'restoreGroup clears deletedAt');
    assert(data.tabs[tab.id].deletedAt === null, 'restoreGroup restores tabs');
    let groups = await getGroups();
    assert(groups.find(x => x.id === g.id), 'getGroups shows restored group');
  }

  // Test 28: softDeleteTab / restoreTab single tab
  {
    let g = await createGroup('SingleTab', '📄');
    let t1 = await addTabToGroup({ title: 'Keep', url: 'https://keep.com' }, g.id);
    let t2 = await addTabToGroup({ title: 'Remove', url: 'https://remove.com' }, g.id);
    await softDeleteTab(t2.id);
    let tabs = await getTabsByGroup(g.id);
    assert(tabs.length === 1 && tabs[0].id === t1.id, 'softDeleteTab removes single tab from view');
    await restoreTab(t2.id);
    tabs = await getTabsByGroup(g.id);
    assert(tabs.length === 2, 'restoreTab brings tab back');
  }

  // Test 29: purgeDeleted hard-deletes expired items
  {
    let g = await createGroup('Expired', '⏰');
    await softDeleteGroup(g.id);
    let data = await getAllData();
    data.groups[g.id].deletedAt = Date.now() - 60000;
    await saveAllData(data);
    await purgeDeleted();
    data = await getAllData();
    assert(!data.groups[g.id], 'purgeDeleted removes expired group');
  }

  console.log('\nAll tests passed.');
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
