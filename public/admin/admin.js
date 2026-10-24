const $ = (id) => document.getElementById(id);
// Kept so a row can be removed without refetching after a user is deleted.
let users = [];

const els = {
  rows: $('user-rows'),
  empty: $('empty-state'),
  toast: $('toast'),
};

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2200);
}

function money(cents, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

// Accepts a plain 'YYYY-MM-DD' date, or SQLite's 'YYYY-MM-DD HH:MM:SS' timestamp, which is in UTC
// and is converted so a user created late in the evening doesn't show up under tomorrow's date.
function prettyDate(iso) {
  if (!iso) return '—';
  let date;
  if (iso.length > 10) {
    date = new Date(`${iso.replace(' ', 'T')}Z`);
  } else {
    const [y, m, d] = iso.split('-').map(Number);
    date = new Date(y, m - 1, d);
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

async function deleteUser(user) {
  const expenses = user.expense_count === 1 ? '1 expense' : `${user.expense_count} expenses`;
  if (!confirm(`Delete ${user.name} and their ${expenses}? This can't be undone.`)) return;
  try {
    await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    users = users.filter((u) => u.id !== user.id);
    renderUsers();
    toast(`Deleted ${user.name} 🗑️`);
  } catch (err) {
    toast(err.message);
  }
}

function renderUsers() {
  els.rows.replaceChildren(...users.map((u) => {
    const tr = document.createElement('tr');
    const name = document.createElement('th');
    name.scope = 'row';
    name.textContent = u.name;
    tr.append(
      name,
      cell(u.currency),
      cell(u.expense_count, 'num'),
      cell(money(u.total_cents, u.currency), 'num'),
      cell(prettyDate(u.last_spent_on)),
      cell(prettyDate(u.created_at)),
    );

    const del = document.createElement('button');
    del.className = 'icon-btn delete-btn';
    del.type = 'button';
    del.title = 'Delete user';
    del.setAttribute('aria-label', `Delete ${u.name}`);
    del.textContent = '🗑️';
    del.addEventListener('click', () => deleteUser(u));
    const actions = document.createElement('td');
    actions.className = 'actions';
    actions.append(del);
    tr.append(actions);
    return tr;
  }));
  els.empty.hidden = users.length > 0;
}

api('/api/admin/users')
  .then((data) => {
    users = data;
    renderUsers();
  })
  .catch((err) => toast(err.message));
