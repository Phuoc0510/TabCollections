const STORAGE_KEY = 'tabCollector';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function getAllData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || { groups: {}, tabs: {} };
}

async function saveAllData(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function getGroups() {
  const data = await getAllData();
  return Object.values(data.groups).sort((a, b) => (b.position ?? b.updatedAt) - (a.position ?? a.updatedAt));
}

async function getTabsByGroup(groupId) {
  const data = await getAllData();
  return Object.values(data.tabs)
    .filter(t => t.groupId === groupId)
    .sort((a, b) => (b.position ?? b.addedAt) - (a.position ?? a.addedAt));
}

async function createGroup(name, icon = '💻', color = '#4285f4') {
  const data = await getAllData();
  const now = Date.now();
  const group = { id: uuid(), name, icon, color, createdAt: now, updatedAt: now, position: now };
  data.groups[group.id] = group;
  await saveAllData(data);
  return group;
}

async function updateGroup(id, updates) {
  const data = await getAllData();
  if (!data.groups[id]) throw new Error('Group not found');
  data.groups[id] = { ...data.groups[id], ...updates, updatedAt: Date.now() };
  await saveAllData(data);
}

async function deleteGroup(id) {
  const data = await getAllData();
  delete data.groups[id];
  Object.keys(data.tabs).forEach(k => {
    if (data.tabs[k].groupId === id) delete data.tabs[k];
  });
  await saveAllData(data);
}

async function addTabToGroup(tabInfo, groupId) {
  const data = await getAllData();
  if (!data.groups[groupId]) throw new Error('Group not found');
  const dup = Object.values(data.tabs).find(t => t.url === tabInfo.url && t.groupId === groupId);
  if (dup) return null;
  const entry = {
    id: uuid(),
    title: tabInfo.title || tabInfo.url,
    url: tabInfo.url,
    favicon: tabInfo.favicon || '',
    groupId,
    addedAt: Date.now(),
    position: Date.now()
  };
  data.tabs[entry.id] = entry;
  data.groups[groupId].updatedAt = Date.now();
  await saveAllData(data);
  return entry;
}

async function removeTab(tabId) {
  const data = await getAllData();
  delete data.tabs[tabId];
  await saveAllData(data);
}

async function updateGroupPositions(orderedIds) {
  const data = await getAllData();
  orderedIds.forEach((id, idx) => {
    if (data.groups[id]) {
      data.groups[id].position = orderedIds.length - idx;
    }
  });
  await saveAllData(data);
}

async function updateTabPositions(groupId, orderedIds) {
  const data = await getAllData();
  orderedIds.forEach((id, idx) => {
    if (data.tabs[id] && data.tabs[id].groupId === groupId) {
      data.tabs[id].position = orderedIds.length - idx;
    }
  });
  await saveAllData(data);
}

async function exportData() {
  const data = await getAllData();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: Object.values(data.groups),
    tabs: Object.values(data.tabs)
  }, null, 2);
}

async function importData(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.version || !Array.isArray(parsed.groups) || !Array.isArray(parsed.tabs)) {
    throw new Error('Invalid import format');
  }
  const data = await getAllData();
  for (const g of parsed.groups) {
    if (!data.groups[g.id]) data.groups[g.id] = g;
  }
  for (const t of parsed.tabs) {
    if (!data.tabs[t.id] && data.groups[t.groupId]) data.tabs[t.id] = t;
  }
  await saveAllData(data);
}

async function moveTabToGroup(tabId, targetGroupId) {
  const data = await getAllData();
  if (!data.groups[targetGroupId]) throw new Error('Target group not found');
  if (!data.tabs[tabId]) throw new Error('Tab not found');
  data.tabs[tabId].groupId = targetGroupId;
  data.tabs[tabId].position = Date.now();
  data.groups[targetGroupId].updatedAt = Date.now();
  await saveAllData(data);
}

if (typeof module !== 'undefined') {
  module.exports = { getAllData, saveAllData, getGroups, getTabsByGroup, createGroup, updateGroup, deleteGroup, addTabToGroup, removeTab, updateGroupPositions, updateTabPositions, exportData, importData, moveTabToGroup };
}
