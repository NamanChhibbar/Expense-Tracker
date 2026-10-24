'''App configuration. Values can be overridden with environment variables.'''

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = Path(os.environ.get('PUBLIC_DIR', PROJECT_ROOT / 'public'))
DB_PATH = Path(os.environ.get('DB_PATH', PROJECT_ROOT / 'data' / 'expenses.db'))

APP_TITLE = 'Expense Tracker'

CATEGORIES = ['Food', 'Shopping', 'Travel', 'Health', 'Other']
DEFAULT_CATEGORY = 'Other'

CURRENCIES = ['INR', 'USD']
DEFAULT_CURRENCY = 'INR'
