const CATEGORY_EMOJI = {
  Food: '🍓', Shopping: '🛍️', Travel: '✈️', Health: '💊', Gifts: '🎁', Other: '✨',
};
const STORAGE_KEY = 'expense-tracker:user';
// Used until the server sends its own default, so amounts never briefly show in another currency.
let defaultCurrency = 'INR';

const $ = (id) => document.getElementById(id);
const els = {
  userSelect: $('user-select'),
  newUserBtn: $('new-user-btn'),
  userFormCard: $('user-form-card'),
  userForm: $('user-form'),
  cancelUserBtn: $('cancel-user-btn'),
  currencySelect: $('currency-select'),
  tracker: $('tracker'),
  addExpenseBtn: $('add-expense-btn'),
  expenseDialog: $('expense-dialog'),
  expenseDialogTitle: $('expense-dialog-title'),
  expenseForm: $('expense-form'),
  expenseError: $('expense-error'),
  expenseSubmitBtn: $('expense-submit-btn'),
  cancelExpenseBtn: $('cancel-expense-btn'),
  categorySelect: $('category-select'),
  list: $('expense-list'),
  empty: $('empty-state'),
  monthTotal: $('month-total'),
  allTotal: $('all-total'),
  toast: $('toast'),
};

// editingId is the id of the expense open in the dialog, or null when adding a new one.
const state = { users: [], currentUser: null, expenses: [], editingId: null };

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
  const currency = state.currentUser?.currency || defaultCurrency;
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

// The selected value is marked as the default too, so form.reset() goes back to it.
function fillOptions(select, values, selected = values[0]) {
  select.replaceChildren(...values.map((v) => new Option(v, v, v === selected, v === selected)));
}

function renderUsers() {
  els.userSelect.replaceChildren(
    ...state.users.map((u) => new Option(u.name, u.id))
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

    const edit = document.createElement('button');
    edit.className = 'icon-btn edit-btn';
    edit.type = 'button';
    edit.title = 'Edit expense';
    edit.setAttribute('aria-label', `Edit ${e.description}`);
    edit.textContent = '✏️';
    edit.addEventListener('click', () => openExpenseDialog(e));

    const del = document.createElement('button');
    del.className = 'icon-btn delete-btn';
    del.type = 'button';
    del.title = 'Delete expense';
    del.setAttribute('aria-label', `Delete ${e.description}`);
    del.textContent = '🗑️';
    del.addEventListener('click', () => deleteExpense(e));

    const actions = document.createElement('div');
    actions.className = 'expense-actions';
    actions.append(edit, del);

    li.append(icon, main, amount, actions);
    return li;
  });

  els.list.replaceChildren(...items);
  els.empty.hidden = state.expenses.length > 0;
  els.monthTotal.textContent = money(month);
  els.allTotal.textContent = money(all);
}

// Opens the expense dialog empty for adding, or prefilled when given an expense to edit.
function openExpenseDialog(expense = null) {
  const f = els.expenseForm;
  f.reset();
  els.expenseError.hidden = true;
  state.editingId = expense ? expense.id : null;
  els.expenseDialogTitle.textContent = expense ? 'Edit expense' : 'Add an expense ✨';
  els.expenseSubmitBtn.textContent = expense ? 'Save' : 'Add 💸';
  if (expense) {
    f.elements.description.value = expense.description;
    f.elements.amount.value = expense.amount_cents / 100;
    f.elements.category.value = expense.category;
    f.elements.date.value = expense.spent_on;
  } else {
    f.elements.date.value = today();
  }
  els.expenseDialog.showModal();
  f.elements.description.focus();
}

function closeExpenseDialog() {
  els.expenseDialog.close();
}

function showUserForm(show) {
  els.userFormCard.hidden = !show;
  els.tracker.hidden = show || !state.currentUser;
  // With no users yet there is nothing to go back to, so cancelling would leave a blank page.
  els.cancelUserBtn.hidden = !state.currentUser;
  if (show) els.userForm.elements.name.focus();
}

async function selectUser(id) {
  state.currentUser = state.users.find((u) => u.id === Number(id)) || null;
  if (!state.currentUser) return;
  try { localStorage.setItem(STORAGE_KEY, state.currentUser.id); } catch {}
  renderUsers();
  const user = state.currentUser;
  const expenses = await api(`/api/users/${user.id}/expenses`);
  // Ignore a slow response if another user was picked while it loaded.
  if (state.currentUser !== user) return;
  state.expenses = expenses;
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

els.userSelect.addEventListener('change', (e) => selectUser(e.target.value).catch((err) => toast(err.message)));
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
    toast(`Hi ${user.name}! 💖`);
  } catch (err) {
    toast(err.message);
  }
});

els.addExpenseBtn.addEventListener('click', () => openExpenseDialog());
els.cancelExpenseBtn.addEventListener('click', closeExpenseDialog);

// A click on the faded background lands on the dialog element itself, outside .modal-body.
// The press must also start there, so selecting text in an input and releasing outside doesn't close it.
let pressedBackdrop = false;
els.expenseDialog.addEventListener('mousedown', (e) => {
  pressedBackdrop = e.target === els.expenseDialog;
});
els.expenseDialog.addEventListener('click', (e) => {
  if (pressedBackdrop && e.target === els.expenseDialog) closeExpenseDialog();
});

function sortExpenses(list) {
  return list.sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.id - a.id);
}

els.expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(els.expenseForm));
  const editing = state.editingId !== null;
  els.expenseSubmitBtn.disabled = true;
  try {
    if (editing) {
      const updated = await api(`/api/expenses/${state.editingId}`, { method: 'PUT', body });
      state.expenses = sortExpenses(state.expenses.map((x) => (x.id === updated.id ? updated : x)));
    } else {
      const created = await api(`/api/users/${state.currentUser.id}/expenses`, { method: 'POST', body });
      state.expenses = sortExpenses([created, ...state.expenses]);
    }
    renderExpenses();
    closeExpenseDialog();
    toast(editing ? 'Saved 💖' : 'Added 💖');
  } catch (err) {
    // The toast would sit behind the faded background, so show the error inside the dialog.
    els.expenseError.textContent = err.message;
    els.expenseError.hidden = false;
  } finally {
    els.expenseSubmitBtn.disabled = false;
  }
});

async function init() {
  const { users, categories, currencies, default_currency } = await api('/api/users');
  state.users = users;
  defaultCurrency = default_currency;
  fillOptions(els.categorySelect, categories);
  fillOptions(els.currencySelect, currencies, default_currency);
  renderUsers();

  if (users.length === 0) return showUserForm(true);

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  const initial = users.find((u) => String(u.id) === saved) || users[0];
  await selectUser(initial.id);
}

init().catch((err) => toast(err.message));
