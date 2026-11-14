# Overview accuracy and navigation

Value displays the existing accounting Net Assets immediately, using the same summary and display currency as the header. Its latest chart point is the same value. A history-service failure does not hide current Net Assets. NAV change explicitly includes funding and is not presented as investment profit.

The chart is limited to recorded history. An enabled annual profile with a positive opening NAV and later first transaction indicates missing opening-period trade history. Combined charts begin no earlier than the latest such portfolio start. Missing dates are not filled with zero or interpolated from an opening NAV. This coverage check is a conservative guard, not proof that all later transactions are complete. Options and historical FX retain their existing approximation limits.

Portfolios with no enabled annual profile keep the original default performance path. When a profile is explicitly enabled, a fresh overview defaults to YTD so its existing opening-NAV calculation is used. A requested non-YTD period crossing missing opening history displays an unavailable result rather than a fabricated full-period return. Complete later periods retain the recorded-transaction proxy.

Combined YTD sums opening NAV, performance NAV and actual external flows before calculating Modified Dietz. Individual percentages are never averaged. Where saved performance alignment differs from accounting NAV, the overview shows the amount before alignment and the adjustment. Value and account cash remain unchanged.

The overview adds per-portfolio Net Assets, YTD profit, reporting currency and calculation method, with buttons to open each portfolio. Refresh overview uses the existing quote/FX refresh functions and reloads history. Option marks remain manual. The last stock-check time is shown; it is not a guarantee of live exchange quotes.

Value/Performance and period preferences are stored locally under `portfolioOverviewViewV1`, independently of encrypted financial state. The Net Assets visibility button masks the duplicate Value amount and restores the latest amount after updates. Portfolio history rejects asynchronous results from a previous portfolio or currency.

Validation includes the legacy v2.25.17 regressions, calculation/encryption tests, future-history filtering, no funding-created profit, Value/header equality, missing-history guards, alignment disclosure, delayed/outage responses, fast portfolio switching, currency changes, local preference round trips and mobile layouts. No cloud state migration or personal values are deployed.


## Summary presentation (v2.25.22)

The dark account summary shows canonical accounting NAV, the price movement of current stock holdings today, and the optional YTD result. Today is not a brokerage daily P/L calculation; it excludes realized intraday trades, fees, FX movements and options. Missing previous-close quotes display an unavailable value. The summary uses the same YTD result API as Performance, including the same selected-portfolio coverage and currency checks. It does not infer a return for accounts without an enabled profile.

Asset trend is explicitly NAV change including funding, not investment return. Its final point matches current accounting NAV. Dates use calendar spacing rather than an evenly spaced observation index. A ten-day history lookback supplies the most recent closing price when the range starts on a non-trading day. Missing opening history is visible above the chart. The portfolio Performance tab and its live refresh both reject ranges that require missing opening trades, while optional YTD continues to use its existing opening-NAV or broker-linked method. Period, portfolio and display-currency checks prevent an older response overwriting a newer selection.

Account details, chart methodology and the YTD calculation bridge are expandable. The bridge retains NAV alignment and external-flow details. Summary layout and navigation do not save financial state or alter deposits, withdrawals, holdings, cost basis, or enabled performance profiles.
