# Overview accuracy and navigation

Value displays the existing accounting Net Assets immediately, using the same summary and display currency as the header. Its latest chart point is the same value. A history-service failure does not hide current Net Assets. NAV change explicitly includes funding and is not presented as investment profit.

The chart is limited to recorded history. An enabled annual profile with a positive opening NAV and later first transaction indicates missing opening-period trade history. Combined charts begin no earlier than the latest such portfolio start. Missing dates are not filled with zero or interpolated from an opening NAV. This coverage check is a conservative guard, not proof that all later transactions are complete. Options and historical FX retain their existing approximation limits.

Portfolios with no enabled annual profile keep the original default performance path. When a profile is explicitly enabled, a fresh overview defaults to YTD so its existing opening-NAV calculation is used. A requested non-YTD period crossing missing opening history displays an unavailable result rather than a fabricated full-period return. Complete later periods retain the recorded-transaction proxy.

Combined YTD sums opening NAV, performance NAV and actual external flows before calculating Modified Dietz. Individual percentages are never averaged. Where saved performance alignment differs from accounting NAV, the overview shows the amount before alignment and the adjustment. Value and account cash remain unchanged.

The overview adds per-portfolio Net Assets, YTD profit, reporting currency and calculation method, with buttons to open each portfolio. Refresh overview uses the existing quote/FX refresh functions and reloads history. Option marks remain manual. The last stock-check time is shown; it is not a guarantee of live exchange quotes.

Value/Performance and period preferences are stored locally under `portfolioOverviewViewV1`, independently of encrypted financial state. The Net Assets visibility button masks the duplicate Value amount and restores the latest amount after updates. Portfolio history rejects asynchronous results from a previous portfolio or currency.

Validation includes the legacy v2.25.17 regressions, calculation/encryption tests, future-history filtering, no funding-created profit, Value/header equality, missing-history guards, alignment disclosure, delayed/outage responses, fast portfolio switching, currency changes, local preference round trips and mobile layouts. No cloud state migration or personal values are deployed.
