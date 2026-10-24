'''App configuration.'''

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / 'public'
DB_PATH = PROJECT_ROOT / 'data' / 'expenses.db'

APP_TITLE = 'Expense Tracker'

CATEGORIES = ['Food', 'Shopping', 'Travel', 'Health', 'Gifts', 'Other']
DEFAULT_CATEGORY = 'Other'

CURRENCIES = ['INR', 'USD']
DEFAULT_CURRENCY = 'INR'
