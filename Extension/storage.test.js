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
  const { getAllData, getGroups, createGroup, updateGroup, deleteGroup, addTabToGroup, getTabsByGroup, removeTab, exportData, importData } = await import('./storage.js');

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
  assert(parsed.version === 1 && Array.isArray(parsed.groups) && Array.isArray(parsed.tabs), 'exportData format');

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

  console.log('\nAll tests passed.');
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
