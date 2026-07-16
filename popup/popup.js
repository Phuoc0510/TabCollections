let pendingNewIcon = '📁';
let pendingNewColor = '#4285f4';

document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tab-list');
  const groupSelect = document.getElementById('group-select');
  const addBtn = document.getElementById('add-to-group-btn');
  const manageBtn = document.getElementById('manage-groups-btn');
  const newGroupForm = document.getElementById('new-group-form');

  const [tabs, initialGroups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.runtime.sendMessage({ action: 'getGroups' })
  ]);

  let groups = [...initialGroups];

  function faviconUrl(tab) {
    if (tab.favIconUrl) return tab.favIconUrl;
    try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(tab.url).hostname)}&sz=16`; }
    catch { return ''; }
  }

  function renderTabs() {
    tabList.innerHTML = tabs.map(t => `
      <label class="tab-item">
        <input type="checkbox" value="${t.id}">
        <img src="${faviconUrl(t)}" alt="" onerror="this.style.display='none'">
        <span class="tab-title">${t.title || t.url}</span>
      </label>
    `).join('');
  }

  function updateButtonState() {
    const checked = tabList.querySelectorAll('input[type="checkbox"]:checked');
    addBtn.disabled = checked.length === 0 || !groupSelect.value;
  }

  function renderGroups() {
    groupSelect.innerHTML = '<option value="">Select group...</option>' +
      groups.map(g => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join('') +
      '<option value="__new__">➕ New Group...</option>';
  }

  function showNewGroupForm() {
    newGroupForm.style.display = 'block';
    groupSelect.style.display = 'none';
    addBtn.style.display = 'none';
    document.getElementById('new-group-name').value = '';
    document.getElementById('new-group-name').focus();
    pendingNewIcon = '📁';
    pendingNewColor = '#4285f4';
    renderIconPicker();
    renderColorPicker();
  }

  function hideNewGroupForm() {
    newGroupForm.style.display = 'none';
    groupSelect.style.display = '';
    addBtn.style.display = '';
    groupSelect.value = '';
    updateButtonState();
  }

  function renderIconPicker() {
    const container = document.getElementById('new-group-icons');
    container.innerHTML = ICONS.map(i =>
      `<div class="pop-pick${i === pendingNewIcon ? ' selected' : ''}" data-value="${i}">${i}</div>`
    ).join('');
    container.querySelectorAll('.pop-pick').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.pop-pick').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        pendingNewIcon = el.dataset.value;
      });
    });
  }

  function renderColorPicker() {
    const container = document.getElementById('new-group-colors');
    container.innerHTML = COLORS.map(c =>
      `<div class="pop-pick pop-pick-color${c === pendingNewColor ? ' selected' : ''}" data-value="${c}" style="background:${c}"></div>`
    ).join('');
    container.querySelectorAll('.pop-pick').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.pop-pick').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        pendingNewColor = el.dataset.value;
      });
    });
  }

  tabList.addEventListener('change', updateButtonState);

  groupSelect.addEventListener('change', async (e) => {
    updateButtonState();
    if (e.target.value === '__new__') {
      showNewGroupForm();
    }
  });

  document.getElementById('create-group-cancel').addEventListener('click', hideNewGroupForm);

  document.getElementById('create-group-confirm').addEventListener('click', async () => {
    const name = document.getElementById('new-group-name').value.trim();
    if (!name) return;
    await chrome.runtime.sendMessage({ action: 'createGroup', name, icon: pendingNewIcon, color: pendingNewColor });
    const updatedGroups = await chrome.runtime.sendMessage({ action: 'getGroups' });
    groups = [...updatedGroups];
    renderGroups();
    groupSelect.value = groups[groups.length - 1].id;
    hideNewGroupForm();
    updateButtonState();
  });

  document.getElementById('new-group-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('create-group-confirm').click();
    if (e.key === 'Escape') hideNewGroupForm();
  });

  addBtn.addEventListener('click', async () => {
    const groupId = groupSelect.value;
    if (!groupId) return;
    const checked = tabList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTabs = tabs.filter(t => Array.from(checked).some(c => c.value == t.id));
    for (const t of selectedTabs) {
      await chrome.runtime.sendMessage({
        action: 'addTabToGroup',
        tab: { title: t.title, url: t.url, favicon: t.favIconUrl || '' },
        groupId
      });
    }
    window.close();
  });

  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') });
  });

  renderTabs();
  renderGroups();
});
