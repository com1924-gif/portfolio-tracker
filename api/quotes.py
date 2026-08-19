import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import yfinance as yf


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload, cache="public, max-age=300, s-maxage=300"):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    @staticmethod
    def _last_price(symbol):
        ticker = yf.Ticker(symbol)
        price = getattr(ticker.fast_info, "last_price", None)
        if price is None:
            hist = ticker.history(period="5d", interval="1d", auto_adjust=False)
            if not hist.empty:
                closes = hist["Close"].dropna()
                if not closes.empty:
                    price = float(closes.iloc[-1])
        return float(price) if price is not None else None

    @staticmethod
    def _append_live_benchmark_point(symbol, points):
        if symbol not in {"VOO", "QQQ"} or not points:
            return points
        try:
            live_price = handler._last_price(symbol)
            if not live_price or live_price <= 0:
                return points
            last = points[-1]
            last_close = float(last.get("close") or 0)
            last_adj = float(last.get("adjClose") or last_close or 0)
            factor = (last_adj / last_close) if last_close > 0 and last_adj > 0 else 1.0
            market_date = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
            live_point = {
                "date": market_date,
                "close": float(live_price),
                "adjClose": float(live_price * factor),
                "live": True,
            }
            if last.get("date") == market_date:
                points[-1] = live_point
            else:
                points.append(live_point)
        except Exception:
            pass
        return points

    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            mode = qs.get("mode", ["quote"])[0].lower()

            if mode == "search":
                query = qs.get("q", [""])[0].strip()
                if not query:
                    return self._send_json(400, {"error": "Provide ?mode=search&q=ACN"})
                try:
                    search = yf.Search(
                        query,
                        max_results=8,
                        news_count=0,
                        lists_count=0,
                        include_cb=False,
                        include_nav_links=False,
                        include_research=False,
                        include_cultural_assets=False,
                        enable_fuzzy_query=True,
                        timeout=10,
                        raise_errors=False,
                    )
                    results = []
                    for quote in search.quotes or []:
                        symbol = quote.get("symbol")
                        name = quote.get("longname") or quote.get("shortname") or quote.get("name")
                        if not symbol:
                            continue
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "shortName": quote.get("shortname"),
                            "longName": quote.get("longname"),
                            "quoteType": quote.get("quoteType"),
                            "exchange": quote.get("exchDisp") or quote.get("exchange"),
                        })
                    return self._send_json(
                        200,
                        {"query": query, "results": results},
                        "public, max-age=86400, s-maxage=86400",
                    )
                except Exception as exc:
                    return self._send_json(200, {"query": query, "results": [], "error": str(exc)})

            if mode == "fx":
                try:
                    usd_hkd = self._last_price("HKD=X")
                    usd_krw = self._last_price("KRW=X")
                    if not usd_hkd or not usd_krw or usd_hkd <= 0 or usd_krw <= 0:
                        raise ValueError("FX quote unavailable")
                    rates_to_hkd = {
                        "HKD": 1.0,
                        "USD": float(usd_hkd),
                        "KRW": float(usd_hkd / usd_krw),
                    }
                    return self._send_json(
                        200,
                        {
                            "ratesToHKD": rates_to_hkd,
                            "pairs": {"USDHKD": float(usd_hkd), "USDKRW": float(usd_krw)},
                            "updatedAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
                            "source": "Yahoo Finance / yfinance",
                        },
                        "public, max-age=300, s-maxage=300",
                    )
                except Exception as exc:
                    return self._send_json(503, {"error": str(exc)})

            raw = qs.get("symbols", [""])[0]
            symbols = [s.strip().upper() for s in raw.split(",") if s.strip()]
            symbols = list(dict.fromkeys(symbols))[:50]

            if not symbols:
                return self._send_json(400, {"error": "Provide ?symbols=ACN,0700.HK,000660.KS"})

            if mode == "history":
                start = qs.get("start", [""])[0]
                if not start:
                    start = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
                try:
                    datetime.strptime(start, "%Y-%m-%d")
                except ValueError:
                    return self._send_json(400, {"error": "start must be YYYY-MM-DD"})

                result = {}
                for symbol in symbols:
                    try:
                        hist = yf.Ticker(symbol).history(start=start, interval="1d", auto_adjust=False)
                        points = []
                        if not hist.empty:
                            for idx, row in hist.iterrows():
                                close = row.get("Close")
                                adj_close = row.get("Adj Close")
                                if close is not None and close == close:
                                    point = {
                                        "date": idx.strftime("%Y-%m-%d"),
                                        "close": float(close),
                                    }
                                    if adj_close is not None and adj_close == adj_close:
                                        point["adjClose"] = float(adj_close)
                                    points.append(point)
                        result[symbol] = self._append_live_benchmark_point(symbol, points)
                    except Exception as exc:
                        result[symbol] = {"error": str(exc), "points": []}

                benchmark_only = bool(symbols) and all(s in {"VOO", "QQQ"} for s in symbols)
                history_cache = "public, max-age=60, s-maxage=60" if benchmark_only else "public, max-age=900, s-maxage=900"
                return self._send_json(
                    200,
                    {"history": result, "start": start},
                    history_cache,
                )

            result = {}
            for symbol in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    fi = ticker.fast_info
                    price = getattr(fi, "last_price", None)
                    previous_close = getattr(fi, "previous_close", None)
                    currency = getattr(fi, "currency", None)

                    if price is None:
                        hist = ticker.history(period="5d", interval="1d", auto_adjust=False)
                        if not hist.empty:
                            price = float(hist["Close"].dropna().iloc[-1])

                    result[symbol] = {
                        "symbol": symbol,
                        "price": float(price) if price is not None else None,
                        "previousClose": float(previous_close) if previous_close is not None else None,
                        "currency": currency,
                        "source": "Yahoo Finance / yfinance",
                    }
                except Exception as exc:
                    result[symbol] = {"symbol": symbol, "price": None, "error": str(exc)}

            return self._send_json(200, {"quotes": result})
        except Exception as exc:
            return self._send_json(500, {"error": str(exc)})
