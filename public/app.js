const CATEGORY_EMOJI = {
  Food: '🍓', Shopping: '🛍️', Transport: '🚌', Bills: '🧾',
  Fun: '🎀', Health: '💊', Gifts: '🎁', Other: '✨',
};
const STORAGE_KEY = 'expense-tracker:user';

const $ = (id) => document.getElementById(id);
const els = {
  userSelect: $('user-select'),
  newUserBtn: $('new-user-btn'),
  userFormCard: $('user-form-card'),
  userForm: $('user-form'),
  cancelUserBtn: $('cancel-user-btn'),
  currencySelect: $('currency-select'),
  tracker: $('tracker'),
  expenseForm: $('expense-form'),
  categorySelect: $('category-select'),
  list: $('expense-list'),
  empty: $('empty-state'),
  monthTotal: $('month-total'),
  allTotal: $('all-total'),
  toast: $('toast'),
};

const state = { users: [], currentUser: null, expenses: [] };

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
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

function money(cents) {
  const currency = state.currentUser?.currency || 'USD';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fillOptions(select, values) {
  select.replaceChildren(...values.map((v) => new Option(v, v)));
}

function renderUsers() {
  els.userSelect.replaceChildren(
    ...state.users.map((u) => new Option(`${u.emoji} ${u.name}`, u.id))
  );
  if (state.currentUser) els.userSelect.value = state.currentUser.id;
  els.userSelect.hidden = state.users.length === 0;
}

function renderExpenses() {
  const monthPrefix = today().slice(0, 7);
  let all = 0;
  let month = 0;

  const items = state.expenses.map((e) => {
    all += e.amount_cents;
    if (e.spent_on.startsWith(monthPrefix)) month += e.amount_cents;

    const li = document.createElement('li');
    li.className = 'expense';

    const icon = document.createElement('span');
    icon.className = 'expense-icon';
    icon.textContent = CATEGORY_EMOJI[e.category] || '✨';

    const main = document.createElement('div');
    main.className = 'expense-main';
    const desc = document.createElement('span');
    desc.className = 'expense-desc';
    desc.textContent = e.description;
    const meta = document.createElement('span');
    meta.className = 'expense-meta';
    meta.textContent = `${e.category} · ${prettyDate(e.spent_on)}`;
    main.append(desc, meta);

    const amount = document.createElement('span');
    amount.className = 'expense-amount';
    amount.textContent = money(e.amount_cents);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.title = 'Delete expense';
    del.setAttribute('aria-label', `Delete ${e.description}`);
    del.textContent = '🗑️';
    del.addEventListener('click', () => deleteExpense(e));

    li.append(icon, main, amount, del);
    return li;
  });

  els.list.replaceChildren(...items);
  els.empty.hidden = state.expenses.length > 0;
  els.monthTotal.textContent = money(month);
  els.allTotal.textContent = money(all);
}

function showUserForm(show) {
  els.userFormCard.hidden = !show;
  els.cancelUserBtn.hidden = state.users.length === 0;
  els.tracker.hidden = show || !state.currentUser;
  if (show) els.userForm.elements.name.focus();
}

async function selectUser(id) {
  state.currentUser = state.users.find((u) => u.id === Number(id)) || null;
  if (!state.currentUser) return;
  try { localStorage.setItem(STORAGE_KEY, state.currentUser.id); } catch {}
  renderUsers();
  state.expenses = await api(`/api/users/${state.currentUser.id}/expenses`);
  renderExpenses();
  showUserForm(false);
}

async function deleteExpense(expense) {
  if (!confirm(`Delete "${expense.description}"?`)) return;
  try {
    await api(`/api/expenses/${expense.id}`, { method: 'DELETE' });
    state.expenses = state.expenses.filter((e) => e.id !== expense.id);
    renderExpenses();
    toast('Deleted 🗑️');
  } catch (err) {
    toast(err.message);
  }
}

els.userSelect.addEventListener('change', (e) => selectUser(e.target.value));
els.newUserBtn.addEventListener('click', () => showUserForm(true));
els.cancelUserBtn.addEventListener('click', () => showUserForm(false));

els.userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(els.userForm);
  try {
    const user = await api('/api/users', { method: 'POST', body: Object.fromEntries(form) });
    state.users = [...state.users, user].sort((a, b) => a.name.localeCompare(b.name));
    els.userForm.reset();
    await selectUser(user.id);
    toast(`Hi ${user.name}! ${user.emoji}`);
  } catch (err) {
    toast(err.message);
  }
});

els.expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(els.expenseForm));
  try {
    const expense = await api(`/api/users/${state.currentUser.id}/expenses`, { method: 'POST', body });
    state.expenses = [expense, ...state.expenses].sort(
      (a, b) => b.spent_on.localeCompare(a.spent_on) || b.id - a.id
    );
    renderExpenses();
    els.expenseForm.reset();
    els.expenseForm.elements.date.value = today();
    els.expenseForm.elements.description.focus();
    toast('Added 💖');
  } catch (err) {
    toast(err.message);
  }
});

async function init() {
  const { users, categories, currencies } = await api('/api/users');
  state.users = users;
  fillOptions(els.categorySelect, categories);
  fillOptions(els.currencySelect, currencies);
  els.expenseForm.elements.date.value = today();
  renderUsers();

  if (users.length === 0) return showUserForm(true);

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  const initial = users.find((u) => String(u.id) === saved) || users[0];
  await selectUser(initial.id);
}

init().catch((err) => toast(err.message));
