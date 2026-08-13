import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import yfinance as yf


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "public, max-age=300, s-maxage=300")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            raw = qs.get("symbols", [""])[0]
            symbols = [s.strip().upper() for s in raw.split(",") if s.strip()]
            symbols = list(dict.fromkeys(symbols))[:50]

            if not symbols:
                return self._send_json(400, {"error": "Provide ?symbols=ACN,0700.HK,000660.KS"})

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
                        "source": "Yahoo Finance / yfinance"
                    }
                except Exception as exc:
                    result[symbol] = {"symbol": symbol, "price": None, "error": str(exc)}

            return self._send_json(200, {"quotes": result})
        except Exception as exc:
            return self._send_json(500, {"error": str(exc)})
