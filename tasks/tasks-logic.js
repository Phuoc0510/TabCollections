/* exported TASKS_WEB_BASE, TASKS_API_BASE, TASK_MEMBERS, TASK_MEMBER_LABEL, TASK_PRIO_COLORS,
   vnDayKey, vnToday, vnNowInputValue, vnShiftDay, safeColor, taskSpan, classifyTask,
   bucketTasks, applyTaskFilters, picBadgeText, rangeToApiParams, buildBoardDeepLink */

/**
 * Pure logic for the Tasks view: no DOM, no chrome.* APIs.
 * Runs both in the service worker and the new tab page, and is unit-testable from Node.
 */

const TASKS_WEB_BASE = 'https://tasks.minhtuong.io.vn/';
const TASKS_API_BASE = TASKS_WEB_BASE + 'api/';

// Must stay in sync with MEMBERS in the Task Management worker.
const TASK_MEMBERS = ['tuong', 'dung', 'phuoc', 'tran', 'cuong', 'hao'];
const TASK_MEMBER_LABEL = {
  tuong: 'Tường',
  dung: 'Dung',
  phuoc: 'Phước',
  tran: 'Trân',
  cuong: 'Cường',
  hao: 'Hào',
};

const TASK_PRIO_COLORS = { low: '#22c55e', normal: '#3b82f6', high: '#ef4444' };

// The web app pins every date to Vietnam time (GMT+7), never to the machine timezone.
const TASK_VN_OFFSET_MS = 7 * 3600 * 1000;
const TASK_DAY_MS = 86400000;

/** epoch ms -> "YYYY-MM-DD" in Vietnam time. */
function vnDayKey(ms) {
  const d = new Date(ms + TASK_VN_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today in Vietnam time. */
function vnToday(nowMs) {
  return vnDayKey(nowMs == null ? Date.now() : nowMs);
}

/** Value for <input type="datetime-local"> in Vietnam time: "YYYY-MM-DDTHH:mm". */
function vnNowInputValue(nowMs) {
  const d = new Date((nowMs == null ? Date.now() : nowMs) + TASK_VN_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Add/subtract days from a "YYYY-MM-DD" key. */
function vnShiftDay(dayKey, n) {
  const m = String(dayKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dayKey;
  return vnDayKey(Date.UTC(+m[1], +m[2] - 1, +m[3]) - TASK_VN_OFFSET_MS + n * TASK_DAY_MS);
}

/**
 * Only let valid hex through. A task's `color` is free-form text supplied through the API;
 * interpolating it straight into a style attribute would let it break out of the attribute.
 */
function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? String(value) : fallback;
}

const taskDayOf = (s) => (s ? String(s).slice(0, 10) : null);

/**
 * Real day range of a task as { from, to } ("YYYY-MM-DD"), or null when it has no dates.
 * Multi-day tasks have different start and due days, so both ends must be considered.
 */
function taskSpan(t) {
  const s = taskDayOf(t.start);
  const e = taskDayOf(t.due);
  if (!s && !e) return null;
  const from = s || e;
  const to = e || s;
  return to < from ? { from: to, to: from } : { from, to };
}

/**
 * Classify by time only; `done` is handled by the status filter instead.
 * sticky   - no dates, shows every day
 * overdue  - past its end day
 * today    - running today (from <= today <= to)
 * upcoming - starts later
 */
function classifyTask(t, today) {
  const span = taskSpan(t);
  if (!span) return 'sticky';
  if (span.to < today) return 'overdue';
  if (span.from <= today) return 'today';
  return 'upcoming';
}

/** Sort key: overdue items must order by full date + time, not by time of day alone. */
function taskSortKey(t) {
  return String(t.start || t.due || '');
}

/**
 * `upcomingUntil` ("YYYY-MM-DD", optional) caps how far the upcoming column looks ahead.
 * The API bound cannot do this job on its own - see rangeToApiParams.
 */
function bucketTasks(items, today, upcomingUntil) {
  const out = { overdue: [], today: [], sticky: [], upcoming: [] };
  for (const t of items || []) {
    const kind = classifyTask(t, today);
    if (kind === 'upcoming' && upcomingUntil && taskSpan(t).from > upcomingUntil) continue;
    out[kind].push(t);
  }
  const byDateTime = (a, b) => taskSortKey(a).localeCompare(taskSortKey(b));
  const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'vi');
  out.overdue.sort(byDateTime);
  out.today.sort(byDateTime);
  out.upcoming.sort(byDateTime);
  out.sticky.sort(byTitle);
  return out;
}

/**
 * Browser-side filters. `pic` and the date range are already applied server-side.
 * status: all | todo | done - priority: all | low | normal | high - search: title + note.
 */
function applyTaskFilters(items, filters) {
  const f = filters || {};
  const status = f.status || 'all';
  const priority = f.priority || 'all';
  const term = String(f.search || '').trim().toLowerCase();

  return (items || []).filter((t) => {
    if (status === 'todo' && t.done) return false;
    if (status === 'done' && !t.done) return false;
    if (priority !== 'all' && (t.priority || 'normal') !== priority) return false;
    if (term) {
      const hay = `${t.title || ''} ${t.note || ''}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

/** Compact PIC badge: empty / single name / initials / "Cả team". */
function picBadgeText(pic) {
  const keys = Array.isArray(pic) ? pic.filter((k) => TASK_MEMBER_LABEL[k]) : [];
  if (!keys.length) return '';
  if (keys.length >= TASK_MEMBERS.length) return 'Cả team';
  if (keys.length === 1) return TASK_MEMBER_LABEL[keys[0]];
  return keys.map((k) => TASK_MEMBER_LABEL[k][0]).join('');
}

// How far past today the API bound reaches. Only a payload guard, never the display cut.
const TASK_FETCH_HORIZON_DAYS = 30;

/**
 * Date range sent to the API. It trims the far future, which is where the payload grows,
 * but it deliberately does NOT match the visible range.
 *
 * The server filters on `due` (falling back to `start`), so a tight `to = today` would drop
 * a task running 25/07 -> 30/07: its due date is past the bound even though it is active
 * today. The bound therefore reaches a horizon ahead, and the columns are cut client-side.
 *
 * No `from` either: the overdue column has to look back indefinitely.
 */
function rangeToApiParams(range, today) {
  if (range === 'all') return {};
  return { to: vnShiftDay(today, TASK_FETCH_HORIZON_DAYS) };
}

/** Last day the "Sắp tới" column shows, or null when the scope is unbounded. */
function upcomingLimit(range, today) {
  if (range === 'week') return vnShiftDay(today, 7);
  return null;
}

/** Link to the full board carrying the current filters (see the web app's deep-link docs). */
function buildBoardDeepLink(base, filters) {
  const f = filters || {};
  const q = new URLSearchParams();
  const view = f.range === 'all' ? 'month' : f.range === 'week' ? 'week' : 'day';
  q.set('view', view);
  q.set('date', f.today || 'today');
  if (f.pic && f.pic !== 'all') q.set('pic', f.pic);
  if (f.status && f.status !== 'all') q.set('status', f.status);
  return `${base || TASKS_WEB_BASE}?${q.toString()}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    TASKS_WEB_BASE,
    TASKS_API_BASE,
    TASK_MEMBERS,
    TASK_MEMBER_LABEL,
    TASK_PRIO_COLORS,
    vnDayKey,
    vnToday,
    vnNowInputValue,
    vnShiftDay,
    safeColor,
    taskSpan,
    classifyTask,
    bucketTasks,
    applyTaskFilters,
    picBadgeText,
    rangeToApiParams,
    upcomingLimit,
    buildBoardDeepLink,
  };
}
