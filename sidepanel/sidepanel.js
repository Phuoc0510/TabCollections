let groups = [];

async function loadAll() {
  groups = await chrome.runtime.sendMessage({ action: 'getGroups' });
  const data = await chrome.runtime.sendMessage({ action: 'getAllData' });
  for (const g of groups) {
    g.tabs = Object.values(data.tabs)
      .filter(t => t.groupId === g.id)
      .sort((a, b) => (b.position ?? b.addedAt) - (a.position ?? a.addedAt));
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  const list = document.getElementById('groups-list');
  const empty = document.getElementById('empty-state');

  if (groups.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = groups.map(g => `
    <div class="group-card" data-id="${g.id}">
      <div class="group-header">
        <span class="group-icon">${g.icon || '📁'}</span>
        <span class="group-name">${esc(g.name)}</span>
        <span class="group-meta">${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}</span>
        <button class="add-tab-btn" title="Add current tab">+</button>
      </div>
      <div class="group-tabs">
        ${g.tabs.map(t => `
          <div class="tab-entry" data-url="${esc(t.url)}">
            ${t.favicon ? `<img src="${t.favicon}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="tab-info">
              <div class="tab-title">${esc(t.title || t.url)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

document.getElementById('groups-list').addEventListener('click', async e => {
  const btn = e.target.closest('.add-tab-btn');
  if (btn) {
    const card = btn.closest('.group-card');
    const groupId = card.dataset.id;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    await chrome.runtime.sendMessage({
      action: 'addTabToGroup',
      tab: { title: tab.title, url: tab.url, favicon: tab.favIconUrl || '' },
      groupId
    });
    await loadAll();
    render();
    return;
  }
  const tabEntry = e.target.closest('.tab-entry');
  if (tabEntry) {
    chrome.tabs.update({ url: tabEntry.dataset.url });
  }
});

loadAll().then(render);
