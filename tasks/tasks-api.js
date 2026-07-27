const TASKS_API_BASE = 'https://tasks.minhtuong.io.vn/api/';

async function tasksApi(path, method = 'GET', body) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(TASKS_API_BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  if (!res.ok) throw new Error(data.error || 'API error ' + res.status);
  return data;
}

async function tasksLogin(username, password) {
  return tasksApi('login', 'POST', { username, password });
}

async function tasksLogout() {
  return tasksApi('logout', 'POST', {});
}

async function tasksMe() {
  return tasksApi('me', 'GET');
}

async function tasksList(queryParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== 'all') q.set(k, v);
  }
  const qs = q.toString();
  const d = await tasksApi('tasks' + (qs ? '?' + qs : ''), 'GET');
  return d.tasks || d || [];
}

async function tasksCreate(payload) {
  return tasksApi('tasks/create', 'POST', payload);
}

async function tasksUpdate(id, payload) {
  return tasksApi('tasks/update', 'POST', { id, ...payload });
}

async function tasksDelete(id) {
  return tasksApi('tasks/delete', 'POST', { id });
}

async function tasksToggle(id, done) {
  return tasksApi('tasks/toggle', 'POST', { id, done });
}
