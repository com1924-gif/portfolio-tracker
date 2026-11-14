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


## Date cursor and cash-flow markers (v2.25.23)

Value and portfolio Asset trend charts support mouse hover, horizontal touch drag, and keyboard Left/Right/Home/End. The cursor snaps to recorded valuation dates; it does not interpolate NAV or manufacture missing January–July prices. Latest restores the final point. A selected-date readout is separate from the current accounting NAV header. Historical YTD uses that date's NAV and only flows on or before the selected date, through the same configured methodology. A broker-linked profile cannot be backcast before its anchor. A fixed NAV snapshot is usable only on its valuation date. Unconfigured portfolios keep their existing calculations and do not receive a new inferred YTD method.

Combined points retain each portfolio's NAV so selected-date aggregate performance uses the configured portfolio subtotal and paired-transfer rules, rather than averaging percentages. Current endpoint figures remain the existing accounting NAV. Historical FX and options retain the existing approximation limits.

Blue cash-flow dots mark dates on a separate rail of the time axis; they do not assert a NAV reading on that date. Clicking a dot or a dated row shows all flows for that date, including both deposits and withdrawals when they net to zero. The expandable list covers the selected range, including flows before available NAV history; those dates explicitly show NAV/YTD as unavailable. Enabled portfolios use their performance flow list plus configured later automatic flows, excluding earlier initialization deposits. Other portfolios show recorded Deposit/Withdrawal entries. Matched same-date internal transfers remain visible as rows but are excluded from combined In/Out totals. Unmatched transfers and missing FX remain explicit.

All selection and rendering are read-only. No transaction, holding, cash balance, weighted-average cost or Cloud Sync financial setting is changed.
### Optional private historical NAV

`account.performanceHistories[year]` is an optional source-labelled daily NAV dataset. It is used only when that portfolio's YTD profile is enabled and its opening NAV, currency, method, anchor and reviewed cash-flow basis match the import. Existing portfolios without a valid enabled history retain the recorded-ledger calculation.

The JSON import uses `format: "portfolio-performance-history"`, `version: 1` and a `portfolios` array of `{accountId, year, history}` records. History version 1 contains `enabled`, `currency`, `from` (1 January), `through`, `basis` (the output of `PortfolioPerformanceHistory.basis(profile)`), optional `historicalReturnMethod: "modified-dietz"`, a `ledgerBasis` signature from `PortfolioPerformanceHistory.ledgerBasis(state, accountId, through)`, and one ordered point per calendar day: `{date, nav, quality, source}`. Quality is `opening`, `estimated` or `statement`. NAV must be a finite number; missing days, future points, duplicate portfolio-years, mismatched profiles or historical ledger records, and cutovers that do not reach the recorded ledger are rejected. Prices carried over market holidays remain estimates; monthly NAV is not interpolated into invented daily returns.

Imported history replaces chart values only on its covered dates. Later dates and the current endpoint continue to use existing accounting. Source reconstruction may have reference FX, incomplete small charges, bookkeeping dates or approximate option values; statement checkpoints and daily estimates remain distinct. Discrepancies must not be converted into synthetic cash, transactions or fees.

Historical YTD before a broker return anchor can opt into a Modified Dietz estimate from imported NAV and actual dated flows. The saved brokerage return anchor and current calculation are unchanged. Combined YTD uses combined NAV and paired external flows, never an average of portfolio returns. Other period calculations use reviewed funding instead of initialization transactions only when private reconstructed history is explicitly enabled.

Cloud Sync → Import Historical NAV previews the coverage before applying it, stores a local safety backup, and updates only the selected accounts' `performanceHistories`. A sync conflict blocks import. Export Current Cloud Copy retrieves/decrypts a read-only copy so both versions can be compared before choosing a resolution. Neither exporting nor code deployment uploads or applies user history. The existing encrypted sync document stores these optional account fields; no database or authentication changes are required.
