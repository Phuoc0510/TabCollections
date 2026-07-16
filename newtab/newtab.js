let groups = [];
let modalCallback = null;
const expandedGroupIds = new Set();
let expandedInitialized = false;

const $ = id => document.getElementById(id);

function showStatus(msg, type) {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = type;
  bar.style.display = 'block';
  setTimeout(() => { bar.style.display = 'none'; }, 3000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function timeAgoStr(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function faviconUrl(t) {
  if (t.favicon) return t.favicon;
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(t.url).hostname)}&sz=16`; }
  catch { return ''; }
}

async function loadAll() {
  groups = await chrome.runtime.sendMessage({ action: 'getGroups' });
  const data = await chrome.runtime.sendMessage({ action: 'getAllData' });
  for (const g of groups) {
    g.tabs = Object.values(data.tabs).filter(t => t.groupId === g.id).sort((a, b) => b.addedAt - a.addedAt);
  }
}

function renderTabEntry(t) {
  const title = t.title || (() => { try { return new URL(t.url).hostname; } catch { return 'Untitled'; } })();
  const displayUrl = t.url.length > 60 ? t.url.slice(0, 57) + '...' : t.url;
  const imgSrc = faviconUrl(t);
  return `<div class="tab-entry" data-id="${t.id}">
    ${imgSrc ? `<img src="${imgSrc}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="tab-info">
      <div class="tab-title">${esc(title)}</div>
      <div class="tab-url">${esc(displayUrl)}</div>
    </div>
    <a class="tab-open" href="${esc(t.url)}" target="_blank">Open</a>
    <button class="tab-delete" data-id="${t.id}">✕</button>
  </div>`;
}

async function render() {
  await loadAll();
  if (!expandedInitialized) {
    groups.forEach(g => expandedGroupIds.add(g.id));
    expandedInitialized = true;
  }

  const grid = $('groups-grid');
  const empty = $('empty-state');

  if (groups.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = groups.map(g => {
    const isExpanded = expandedGroupIds.has(g.id);
    const timeAgo = g.updatedAt ? timeAgoStr(g.updatedAt) : '';
    const tabsHtml = g.tabs && g.tabs.length
      ? `<div class="group-tabs">${g.tabs.map(renderTabEntry).join('')}</div>`
      : `<div class="group-tabs group-tabs-empty">No tabs yet. Use the extension popup to add tabs.</div>`;

    return `<article class="group-card${isExpanded ? ' is-expanded' : ''}" draggable="true" data-id="${g.id}">
      <div class="group-color-bar" style="background:${g.color || '#4285f4'}"></div>
      <div class="group-card-inner">
        <button class="group-header group-toggle" data-id="${g.id}" aria-expanded="${isExpanded}" aria-controls="group-content-${g.id}">
          <span class="group-icon">${g.icon || '📁'}</span>
          <span class="group-name">${esc(g.name)}</span>
          <span class="group-meta">${g.tabs ? g.tabs.length : 0} tab${(g.tabs ? g.tabs.length : 0) !== 1 ? 's' : ''}${timeAgo ? ' · ' + timeAgo : ''}</span>
          <span class="group-chevron" aria-hidden="true">⌄</span>
        </button>
        <div id="group-content-${g.id}" class="group-content"${isExpanded ? '' : ' hidden'}>
          <div class="group-actions">
            <button class="group-open-all-btn" data-id="${g.id}">Open All</button>
            <button class="group-edit-btn" data-id="${g.id}">Edit</button>
            <button class="group-delete-btn" data-id="${g.id}">Delete</button>
          </div>
          ${tabsHtml}
        </div>
      </div>
    </article>`;
  }).join('');

}

$('groups-grid').addEventListener('click', async e => {
  const groupCard = e.target.closest('.group-card');
  if (!groupCard) return;

  const groupId = groupCard.dataset.id;

  const toggle = e.target.closest('.group-toggle');
  if (toggle) {
    if (expandedGroupIds.has(groupId)) expandedGroupIds.delete(groupId);
    else expandedGroupIds.add(groupId);
    await render();
    return;
  }

  const tabDelete = e.target.closest('.tab-delete');
  if (tabDelete) {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ action: 'removeTab', tabId: tabDelete.dataset.id });
    await render();
    return;
  }

  const tabOpen = e.target.closest('.tab-open');
  if (tabOpen) {
    e.preventDefault();
    e.stopPropagation();
    await chrome.tabs.create({ url: tabOpen.href });
    return;
  }

  const tabEntry = e.target.closest('.tab-entry');
  if (tabEntry) {
    await chrome.tabs.create({ url: tabEntry.querySelector('.tab-open').href });
    return;
  }

  const openAllBtn = e.target.closest('.group-open-all-btn');
  if (openAllBtn) {
    const g = groups.find(x => x.id === openAllBtn.dataset.id);
    if (!g || !g.tabs) return;
    for (const t of g.tabs) await chrome.tabs.create({ url: t.url });
    showStatus(`Opened ${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}`, 'success');
    return;
  }

  const editBtn = e.target.closest('.group-edit-btn');
  if (editBtn) {
    const g = groups.find(x => x.id === editBtn.dataset.id);
    if (g) showEditModal(g);
    return;
  }

  const deleteBtn = e.target.closest('.group-delete-btn');
  if (deleteBtn) {
    const g = groups.find(x => x.id === deleteBtn.dataset.id);
    if (!g) return;
    if (await showConfirm(`Delete "${g.name}" and all its tabs?`)) {
      await chrome.runtime.sendMessage({ action: 'deleteGroup', id: g.id });
      await render();
      showStatus(`Deleted "${g.name}"`, 'success');
    }
    return;
  }
});

// ── Drag and drop reorder ──

let dragSrcId = null;
let dragSrcEl = null;
let isDragging = false;
let pendingRender = false;

$('groups-grid').addEventListener('dragstart', e => {
  const card = e.target.closest('.group-card');
  if (!card) return;
  pendingRender = false;
  isDragging = true;
  dragSrcEl = card;
  dragSrcId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
  card.style.opacity = '0.35';
});

$('groups-grid').addEventListener('dragover', e => {
  e.preventDefault();
  if (!dragSrcEl || !dragSrcEl.isConnected) { dragSrcEl = null; return; }
  const target = e.target.closest('.group-card');
  if (!target) return;
  e.dataTransfer.dropEffect = 'move';

  const grid = target.parentNode;
  const rect = target.getBoundingClientRect();
  const before = e.clientY < rect.top + rect.height / 2;

  if (target === dragSrcEl) {
    const cards = [...grid.querySelectorAll('.group-card')];
    const idx = cards.indexOf(target);
    const edge = 20;
    if (before && idx > 0 && e.clientY < rect.top + edge) {
      grid.insertBefore(dragSrcEl, cards[idx - 1]);
    } else if (!before && idx < cards.length - 1 && e.clientY > rect.bottom - edge) {
      grid.insertBefore(dragSrcEl, cards[idx + 1].nextSibling);
    }
    return;
  }

  if (before) {
    grid.insertBefore(dragSrcEl, target);
  } else {
    grid.insertBefore(dragSrcEl, target.nextSibling);
  }
});

$('groups-grid').addEventListener('drop', e => {
  e.preventDefault();
});

$('groups-grid').addEventListener('dragend', async e => {
  if (dragSrcEl) dragSrcEl.style.opacity = '';
  isDragging = false;
  const srcId = dragSrcId;
  dragSrcEl = null;
  dragSrcId = null;
  if (srcId) {
    const cards = [...$('groups-grid').querySelectorAll('.group-card')];
    const ids = cards.map(c => c.dataset.id);
    await chrome.runtime.sendMessage({ action: 'updateGroupPositions', orderedIds: ids });
  }
  if (pendingRender) {
    pendingRender = false;
    render();
  }
});

function showConfirm(message) {
  return new Promise(resolve => {
    $('confirm-message').textContent = message;
    $('confirm-overlay').style.display = 'flex';
    $('confirm-ok-btn').onclick = () => { hideConfirm(); resolve(true); };
    $('confirm-cancel-btn').onclick = () => { hideConfirm(); resolve(false); };
    $('confirm-overlay').onclick = e => {
      if (e.target === $('confirm-overlay')) { hideConfirm(); resolve(false); }
    };
  });
}

function hideConfirm() {
  $('confirm-overlay').style.display = 'none';
  $('confirm-ok-btn').onclick = null;
  $('confirm-cancel-btn').onclick = null;
  $('confirm-overlay').onclick = null;
}

function renderIconGrid(scroll, term, selectedIcon) {
  const cats = term
    ? ICON_CATEGORIES.filter(c => c.name.toLowerCase().includes(term))
    : ICON_CATEGORIES;

  scroll.innerHTML = cats.map(cat =>
    `<div class="icon-cat">
      <div class="icon-cat-name">${cat.name}</div>
      <div class="icon-grid">
        ${cat.icons.map(i =>
          `<div class="icon-item${i === selectedIcon ? ' selected' : ''}" data-value="${i}">${i}</div>`
        ).join('')}
      </div>
    </div>`
  ).join('');

  scroll.querySelectorAll('.icon-item').forEach(el => {
    el.addEventListener('click', () => {
      scroll.querySelectorAll('.icon-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function showModal(title, name, icon, color, onConfirm) {
  $('modal-title').textContent = title;
  $('group-name-input').value = name;
  $('modal-confirm-btn').textContent = title.startsWith('Edit') ? 'Save' : 'Create';
  modalCallback = onConfirm;

  const iconPicker = $('icon-picker');
  iconPicker.innerHTML =
    '<input type="text" class="icon-search" id="icon-search" placeholder="🔍 Search icons...">' +
    '<div class="icon-grid-scroll"></div>';

  renderIconGrid($('icon-picker').querySelector('.icon-grid-scroll'), '', icon);
  document.getElementById('icon-search').addEventListener('input', () => {
    const t = document.getElementById('icon-search').value.toLowerCase().trim();
    renderIconGrid($('icon-picker').querySelector('.icon-grid-scroll'), t, icon);
  });

  const colorPicker = $('color-picker');
  colorPicker.innerHTML = COLORS.map(c =>
    `<div class="pick-option pick-color${c === color ? ' selected' : ''}" data-value="${c}" style="background:${c}"></div>`
  ).join('');
  colorPicker.querySelectorAll('.pick-option').forEach(el => {
    el.addEventListener('click', () => {
      colorPicker.querySelectorAll('.pick-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  $('modal-overlay').style.display = 'flex';
  $('group-name-input').focus();
}

function hideModal() {
  $('modal-overlay').style.display = 'none';
  $('group-name-input').classList.remove('error');
  $('name-error').style.display = 'none';
  modalCallback = null;
}

$('new-group-btn').addEventListener('click', () => {
  showModal('New Collection', '', '📁', '#4285f4', async (name, icon, color) => {
    await chrome.runtime.sendMessage({ action: 'createGroup', name, icon, color });
    await render();
    showStatus(`Created "${name}"`, 'success');
  });
});

$('modal-confirm-btn').addEventListener('click', () => {
  const name = $('group-name-input').value.trim();
  const nameErr = $('name-error');
  if (!name) {
    $('group-name-input').classList.add('error');
    nameErr.style.display = 'block';
    return;
  }
  nameErr.style.display = 'none';
  $('group-name-input').classList.remove('error');
  const iconEl = $('icon-picker').querySelector('.selected');
  const icon = iconEl ? iconEl.dataset.value : '📁';
  const colorEl = $('color-picker').querySelector('.selected');
  const color = colorEl ? colorEl.dataset.value : '#4285f4';
  if (modalCallback) modalCallback(name, icon, color);
  hideModal();
});

$('modal-cancel-btn').addEventListener('click', hideModal);
$('modal-overlay').addEventListener('click', e => {
  if (e.target === $('modal-overlay')) hideModal();
});
$('group-name-input').addEventListener('input', () => {
  $('group-name-input').classList.remove('error');
  $('name-error').style.display = 'none';
});
$('group-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('modal-confirm-btn').click();
  if (e.key === 'Escape') hideModal();
});

function showEditModal(g) {
  showModal('Edit Collection', g.name, g.icon || '📁', g.color || '#4285f4', async (name, icon, color) => {
    await chrome.runtime.sendMessage({ action: 'updateGroup', id: g.id, data: { name, icon, color } });
    await render();
    showStatus('Updated', 'success');
  });
}

// Background customization
const BG_KEY = 'tabCollectorBg';
const PRESETS = [
  { label: 'None', val: '' },
  { label: 'Mountains', val: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200' },
  { label: 'Forest', val: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200' },
  { label: 'Ocean', val: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1200' },
  { label: 'City', val: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200' },
  { label: 'Stars', val: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c1e?w=1200' },
  { label: 'Abstract', val: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1200' },
];

async function loadBg() {
  const result = await chrome.storage.local.get(BG_KEY);
  return result[BG_KEY] || '';
}

async function saveBg(url) {
  await chrome.storage.local.set({ [BG_KEY]: url });
}

async function applyBg(url) {
  if (url) {
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.classList.add('has-bg');
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    document.body.classList.remove('has-bg');
  }
}

function showBgModal() {
  const overlay = $('bg-modal-overlay');
  const presetsEl = $('bg-presets');
  const inputEl = $('bg-url-input');

  presetsEl.innerHTML = PRESETS.map(p =>
    `<div class="bg-preset" data-value="${p.val}" style="background-image:url(${p.val || ''})" title="${p.label}"></div>`
  ).join('');

  loadBg().then(current => {
    inputEl.value = current;
    presetsEl.querySelectorAll('.bg-preset').forEach(el => {
      if (el.dataset.value === current) el.classList.add('selected');
      el.addEventListener('click', () => {
        presetsEl.querySelectorAll('.bg-preset').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        inputEl.value = el.dataset.value;
      });
    });
  });

  overlay.style.display = 'flex';
}

const dropZone = $('bg-drop-zone');
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showStatus('Unsupported file type. Use .jpg, .png, .gif, or .webp', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showStatus('File too large (max 5MB)', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dataUrl = reader.result;
      await saveBg(dataUrl);
      await applyBg(dataUrl);
      $('bg-url-input').value = '📎 ' + file.name;
      $('bg-presets').querySelectorAll('.bg-preset').forEach(el => el.classList.remove('selected'));
      showStatus('Background applied', 'success');
    } catch (err) {
      showStatus('Failed to save background: ' + err.message, 'error');
    }
  };
  reader.onerror = () => {
    showStatus('Failed to read image file', 'error');
  };
  reader.readAsDataURL(file);
});

$('customize-btn').addEventListener('click', showBgModal);

$('bg-cancel-btn').addEventListener('click', () => { $('bg-modal-overlay').style.display = 'none'; });
$('bg-modal-overlay').addEventListener('click', e => {
  if (e.target === $('bg-modal-overlay')) $('bg-modal-overlay').style.display = 'none';
});

$('bg-confirm-btn').addEventListener('click', async () => {
  const url = $('bg-url-input').value.trim();
  if (url.startsWith('📎 ')) {
    $('bg-modal-overlay').style.display = 'none';
    return;
  }
  await saveBg(url);
  await applyBg(url);
  $('bg-modal-overlay').style.display = 'none';
  showStatus(url ? 'Background applied' : 'Background removed', 'success');
});

$('bg-remove-btn').addEventListener('click', async () => {
  $('bg-url-input').value = '';
  await saveBg('');
  await applyBg('');
  $('bg-modal-overlay').style.display = 'none';
  showStatus('Background removed', 'success');
});

// Init background on load
loadBg().then(applyBg);

$('export-btn').addEventListener('click', async () => {
  const json = await chrome.runtime.sendMessage({ action: 'exportData' });
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-collection-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus('Exported', 'success');
});

$('import-btn').addEventListener('click', () => $('import-input').click());

$('import-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await chrome.runtime.sendMessage({ action: 'importData', json: text });
    await render();
    showStatus('Imported successfully', 'success');
  } catch (err) {
    showStatus('Import failed: ' + err.message, 'error');
  }
  e.target.value = '';
});

render();

const STORAGE_KEY = 'tabCollector';
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    if (isDragging) { pendingRender = true; return; }
    render();
  }
});
