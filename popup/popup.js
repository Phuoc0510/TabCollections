let pendingNewIcon = '📁';
let pendingNewColor = '#4285f4';

function showStatus(msg, type) {
  let el = document.getElementById('popup-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'popup-status';
    el.style.cssText = 'padding:6px 10px;margin:6px 0;border-radius:6px;font-size:12px;text-align:center;display:none';
    document.getElementById('app').insertBefore(el, document.getElementById('bottom-actions'));
  }
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'error' ? '#fce8e6' : '#e6f4ea';
  el.style.color = type === 'error' ? '#c5221f' : '#1e7e34';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function handleQuickSave() {
  const sessionData = await chrome.storage.session.get('pendingQuickSave');
  const pending = sessionData.pendingQuickSave;
  if (!pending) {
    document.body.innerHTML = '<div class="popup-app" style="padding:20px;text-align:center"><p>No tab to save.</p></div>';
    return;
  }

  document.getElementById('tabs-section').style.display = 'none';
  document.getElementById('actions').style.display = 'none';
  document.getElementById('bottom-actions').style.display = 'none';
  document.getElementById('new-group-form').style.display = 'none';
  const qsSection = document.getElementById('quick-save-section');
  qsSection.style.display = 'block';

  const groups = await chrome.runtime.sendMessage({ action: 'getGroups' });

  const qsFavicon = document.getElementById('qs-favicon');
  const qsTitle = document.getElementById('qs-title');
  const qsUrl = document.getElementById('qs-url');
  const qsGroupSelect = document.getElementById('qs-group-select');
  const qsSaveBtn = document.getElementById('qs-save-btn');
  const qsDone = document.getElementById('qs-done');

  qsFavicon.src = pending.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(pending.url).hostname)}&sz=16`;
  qsFavicon.onerror = () => { qsFavicon.style.display = 'none'; };
  qsTitle.textContent = pending.title || pending.url;
  qsUrl.textContent = pending.url;

  qsGroupSelect.innerHTML = groups.map(g =>
    `<option value="${g.id}">${g.icon} ${g.name}</option>`
  ).join('');
  qsGroupSelect.value = groups.length > 0 ? groups[0].id : '';
  qsSaveBtn.disabled = !qsGroupSelect.value;

  qsGroupSelect.addEventListener('change', () => {
    qsSaveBtn.disabled = !qsGroupSelect.value;
  });

  qsSaveBtn.addEventListener('click', async () => {
    const groupId = qsGroupSelect.value;
    if (!groupId) return;
    qsSaveBtn.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'addTabToGroup',
        tab: pending,
        groupId
      });
      if (response && response.error) throw new Error(response.error);
      qsSection.querySelector('.popup-actions').style.display = 'none';
      qsDone.style.display = 'block';
      qsDone.textContent = '✓ Saved!';
      qsDone.style.color = '';
      await chrome.storage.session.remove('pendingQuickSave');
      setTimeout(() => window.close(), 1200);
    } catch (err) {
      qsSaveBtn.disabled = false;
      qsDone.style.display = 'block';
      qsDone.textContent = '✕ Failed: ' + err.message;
      qsDone.style.color = 'var(--danger, #c5221f)';
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tab-list');
  const groupSelect = document.getElementById('group-select');
  const addBtn = document.getElementById('add-to-group-btn');
  const manageBtn = document.getElementById('manage-groups-btn');
  const newGroupForm = document.getElementById('new-group-form');

  if (window.location.search.includes('quick=1')) {
    await handleQuickSave();
    return;
  }

  const [tabs, initialGroups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.runtime.sendMessage({ action: 'getGroups' })
  ]);

  let groups = [...initialGroups];


  function renderTabs() {
    tabList.innerHTML = tabs.map(t => `
      <label class="tab-item">
        <input type="checkbox" value="${t.id}"${t.active ? ' checked' : ''}>
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
    groupSelect.innerHTML = groups.map(g => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join('') +
      '<option value="__new__">+ New Group...</option>';
    if (!groupSelect.value && groups.length > 0) {
      groupSelect.value = groups[0].id;
    }
    updateButtonState();
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
    const term = (document.getElementById('icon-search')?.value || '').toLowerCase().trim();

    container.innerHTML =
      '<input type="text" class="icon-search" id="icon-search" placeholder="Search icons...">' +
      '<div class="icon-grid-scroll"></div>';

    const scroll = container.querySelector('.icon-grid-scroll');
    renderIconGrid(scroll, term);
    document.getElementById('icon-search').addEventListener('input', () => {
      const t = document.getElementById('icon-search').value.toLowerCase().trim();
      renderIconGrid(scroll, t);
    });
  }

  function renderIconGrid(scroll, term) {
    const cats = term
      ? ICON_CATEGORIES.filter(c => c.name.toLowerCase().includes(term))
      : ICON_CATEGORIES;

    scroll.innerHTML = cats.map(cat =>
      `<div class="icon-cat">
        <div class="icon-cat-name">${cat.name}</div>
        <div class="icon-grid">
          ${cat.icons.map(i =>
            `<div class="icon-item${i === pendingNewIcon ? ' selected' : ''}" data-value="${i}">${i}</div>`
          ).join('')}
        </div>
      </div>`
    ).join('');

    scroll.querySelectorAll('.icon-item').forEach(el => {
      el.addEventListener('click', () => {
        scroll.querySelectorAll('.icon-item').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        pendingNewIcon = el.dataset.value;
      });
    });
  }

  function renderColorPicker() {
    const container = document.getElementById('new-group-colors');
    container.innerHTML = COLORS.map(c =>
      `<div class="pick-color${c === pendingNewColor ? ' selected' : ''}" data-value="${c}" style="background:${c}"></div>`
    ).join('');
    container.querySelectorAll('.pick-color').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.pick-color').forEach(x => x.classList.remove('selected'));
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
    addBtn.disabled = true;
    const checked = tabList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTabs = tabs.filter(t => Array.from(checked).some(c => c.value == t.id));
    try {
      for (const t of selectedTabs) {
        const response = await chrome.runtime.sendMessage({
          action: 'addTabToGroup',
          tab: { title: t.title, url: t.url, favicon: t.favIconUrl || '' },
          groupId
        });
        if (response && response.error) throw new Error(response.error);
      }
      window.close();
    } catch (err) {
      addBtn.disabled = false;
      showStatus && showStatus('Failed to add tabs: ' + err.message, 'error');
    }
  });

  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') });
  });

  renderTabs();
  renderGroups();
});
