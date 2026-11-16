"""No-network regression for regular-session quotes, including closed markets."""
import importlib.util
from datetime import datetime
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

yf = types.ModuleType("yfinance")
with patch.dict(sys.modules, {"yfinance": yf}):
    spec = importlib.util.spec_from_file_location("quotes", Path(__file__).parents[1] / "api/quotes.py")
    quotes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(quotes)


class History:
    def __init__(self, rows):
        self.rows = rows
        self.empty = not rows

    def iterrows(self):
        return iter((datetime.fromisoformat(date), {"Close": close}) for date, close in self.rows)


class Ticker:
    def __init__(self, rows):
        self.rows = rows
        self.history_args = None

    @property
    def fast_info(self):
        raise AssertionError("Do not mix regular prices with extended-hours previous_close")

    def history(self, **kwargs):
        self.history_args = kwargs
        return History(self.rows)

    def get_history_metadata(self):
        return {"currency": "USD"}


class SessionQuoteTests(unittest.TestCase):
    def quote(self, rows):
        ticker = Ticker(rows)
        with patch.object(yf, "Ticker", return_value=ticker, create=True):
            result = quotes.handler._session_quote("AAA")
        self.assertEqual(ticker.history_args, {
            "period": "5d", "interval": "1d", "auto_adjust": False, "prepost": False,
        })
        return result

    def test_closed_market_uses_friday_and_thursday_regular_closes(self):
        q = self.quote([("2026-11-12", 100), ("2026-11-13", 94)])
        self.assertAlmostEqual((q["price"] / q["previousClose"] - 1) * 100, -6)
        self.assertEqual((q["priceDate"], q["previousCloseDate"]), ("2026-11-13", "2026-11-12"))
        self.assertEqual(q["session"], "regular")

    def test_monday_in_progress_uses_friday_and_skips_invalid_bars(self):
        q = self.quote([("2026-11-13", 94), ("2026-11-14", float("nan")), ("2026-11-15", 0), ("2026-11-16", 96)])
        self.assertEqual(q["price"], 96)
        self.assertEqual(q["previousClose"], 94)
        self.assertEqual(q["previousCloseDate"], "2026-11-13")

    def test_single_session_does_not_invent_a_previous_close(self):
        q = self.quote([("2026-11-13", 94)])
        self.assertIsNone(q["previousClose"])
        self.assertIsNone(q["previousCloseDate"])

    def test_unavailable_history_does_not_fall_back_to_mismatched_fast_info(self):
        with self.assertRaisesRegex(ValueError, "unavailable"):
            self.quote([])


if __name__ == "__main__":
    unittest.main()
