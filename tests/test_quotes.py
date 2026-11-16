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
    def __init__(self, rows, metadata=None):
        self.rows = rows
        self.metadata = metadata or {"currency": "USD"}
        self.history_args = None

    @property
    def fast_info(self):
        raise AssertionError("Do not mix regular prices with extended-hours previous_close")

    def history(self, **kwargs):
        self.history_args = kwargs
        return History(self.rows)

    def get_history_metadata(self):
        return self.metadata


class SessionQuoteTests(unittest.TestCase):
    def quote(self, rows, metadata=None):
        ticker = Ticker(rows, metadata)
        with patch.object(yf, "Ticker", return_value=ticker, create=True):
            result = quotes.handler._session_quote("AAA")
        self.assertEqual(ticker.history_args, {
            "period": "5d", "interval": "1d", "auto_adjust": False, "prepost": False, "keepna": True,
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

    def test_latest_null_daily_close_uses_dated_regular_quote_and_prior_session(self):
        # Seoul has crossed midnight, but the quote belongs to Monday's session.
        stamp = datetime.fromisoformat("2026-11-16T06:30:00+00:00").timestamp()
        q = self.quote([("2026-11-13", 100), ("2026-11-16", float("nan"))], {
            "currency": "KRW", "regularMarketPrice": 92, "regularMarketTime": stamp,
            "exchangeTimezoneName": "Asia/Seoul", "chartPreviousClose": 999,
        })
        self.assertEqual((q["price"], q["previousClose"]), (92, 100))
        self.assertEqual((q["priceDate"], q["previousCloseDate"]), ("2026-11-16", "2026-11-13"))
        self.assertEqual(q["quoteStatus"], "regular-market")

    def test_intraday_metadata_overrides_same_day_bar_and_never_compares_with_itself(self):
        stamp = datetime.fromisoformat("2026-11-16T16:00:00+00:00").timestamp()
        q = self.quote([("2026-11-13", 100), ("2026-11-16", 96)], {
            "regularMarketPrice": 94, "regularMarketTime": stamp,
            "exchangeTimezoneName": "America/New_York", "postMarketPrice": 85,
        })
        self.assertEqual((q["price"], q["previousClose"]), (94, 100))

    def test_old_metadata_does_not_regress_a_newer_daily_bar(self):
        stamp = datetime.fromisoformat("2026-11-13T06:30:00+00:00").timestamp()
        q = self.quote([("2026-11-13", 100), ("2026-11-16", 92)], {
            "regularMarketPrice": 100, "regularMarketTime": stamp, "exchangeTimezoneName": "Asia/Seoul",
        })
        self.assertEqual((q["price"], q["previousClose"]), (92, 100))

    def test_null_latest_bar_without_a_usable_quote_is_marked_stale(self):
        q = self.quote([("2026-11-13", 100), ("2026-11-16", float("nan"))])
        self.assertEqual(q["quoteStatus"], "stale")
        self.assertEqual(q["latestSessionDate"], "2026-11-16")


if __name__ == "__main__":
    unittest.main()
