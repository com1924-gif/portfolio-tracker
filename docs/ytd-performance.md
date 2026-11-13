# Optional portfolio YTD performance

Existing portfolios retain the recorded-transaction calculation until a user explicitly enables a profile for that portfolio and year. Open a portfolio, select **Performance**, then choose **YTD settings**. No settings or personal amounts are bundled with the application, and no migration writes a default profile.

Profiles live at `state.accounts[].performanceProfiles[year]`. Version 1 stores `enabled`, `method: "modified-dietz"`, reporting `currency`, prior year-end `openingAsOf`, `openingNav`, `externalFlows`, `flowsCompleteThrough` and an optional source note. Each flow has a unique ID, date, signed amount in the reporting currency, note and optional `counterpartyId`/`transferId`. Zero opening NAV is supported.

The profile is part of the existing encrypted state and JSON/cloud backups. The backend and its schema are unchanged. Sync documents are selected by `SHA256("portfolio-sync-id:" + Sync Key)`; the read-only fingerprint shown in Cloud Sync lets users compare document identity without sharing their keys. The application does not infer who owns a document.

## Calculation

Investment P/L = current NAV - opening NAV - net external flows.

Modified Dietz return = investment P/L / (opening NAV + sum of day-weighted signed flows). The weight is `(valuation day - flow day) / (valuation day - prior year-end day)`, using calendar days and end-of-day flows. This is a non-annualized estimate, not exact TWR. A nonpositive denominator produces an unavailable percentage rather than a fabricated zero return.

Current NAV comes from the existing accounting functions and is converted to the profile currency with the app's current FX. Opening NAV and flows must already be expressed in that currency at their respective dates; current FX is not retroactively applied to them. Brokerage-accurate NAV and complete external flows are prerequisites. Retained dividends, fees, taxes, interest, stock trades and FX exchanges are not external flows. No transaction is created, edited, reconciled or imported by this feature. Existing lifetime capital, cash, holdings and average-cost behavior is unchanged.

The explicit flow list replaces transaction-derived flows only for that enabled YTD profile. It is never added to Deposit/Withdrawal transactions. Users must maintain it for later flows; a last-reviewed date is displayed, with a warning when it predates the valuation. Missing detailed trades do not produce an invented daily performance curve. VOO/QQQ comparisons use prior year-end adjusted close and latest quotes in USD and are labeled separately from the portfolio's reporting currency and return methodology.

## Aggregation

An optional `navSource: "snapshot"` and `navSnapshot: {date, amount}` use a dated brokerage NAV as the endpoint instead of the app NAV. The snapshot is performance-only and remains fixed until updated. Its date is displayed prominently, flows are cut off at that date, and benchmark prices are aligned to that date. This allows a verified brokerage NAV without correcting cash transactions or average cost. All enabled portfolios must have the same valuation date before their anchored returns can be aggregated.

The anchored homepage YTD subtotal includes enabled active portfolios only and displays coverage and names. Portfolios with no profile retain their individual calculations. With no enabled profiles, the homepage follows its original path. Other periods and the Value view retain their original paths.

All included profiles must use one reporting currency. Opening/ending NAVs and flows are combined before applying the formula; portfolio percentages are not averaged. A transfer is removed only if both included portfolios have reciprocal counterparties, a shared reference, matching dates and equal opposite amounts. A transfer outside the included group remains external. Unmatched, cross-date or unequal transfers block the aggregate instead of assuming cash-in-transit values.

## Validation and rollback

Run `node --test tests/ytd-anchor.test.cjs` and syntax-check changed scripts. Browser verification must cover legacy output/state equality, explicit enable/disable, zero opening NAV, unchanged accounting, coverage, profile round trips through Cloud Sync/JSON backup, and mobile settings layout.

The `YTD regression tests` workflow runs these checks in an isolated GitHub runner with synthetic portfolios and mocked quote/sync services. Browser tests compare against the immutable v2.25.17 rollback commit. They never connect to real Cloud Sync documents. To run locally, install `playwright@1.62.1`, run `npx playwright install chromium`, then `node tests/ytd-browser.mjs` from the repository root.

Deploying the code does not enable or populate any profile. Code rollback and user-state rollback are separate. A previous profile is saved locally under `portfolioTrackerYtdProfileSafetyV1` before an explicit settings save; normal cloud backups apply on sync. Restore the code with the pre-change rollback branch when needed; disabling a profile restores that portfolio's original performance path without editing any transactions.

Method reference: [GIPS Standards Handbook for Firms, calculation methodology](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/). This application does not claim GIPS compliance.


## Brokerage YTD anchor with automatic continuation

The optional calculation mode `broker-linked-estimate` uses the same portfolio/year-owned profile. No migration or default calculation changes. Add `anchor: {date, returnPct, nav, appNav}`: brokerage YTD through that closing date, brokerage NAV at that close, and the app NAV at the same close. Leaving the app-NAV field blank saves the brokerage NAV as the assumed matching app NAV. A current-NAV capture button works only for a current-date anchor; it never labels today's valuation as a past closing valuation.

The historical manual external-flow list ends at the anchor (inclusive). All later `Deposit` / `Withdrawal` transactions for this portfolio are read automatically through the valuation date. Anchor-day and earlier transaction flows are not added again. Trades, retained dividends, fees, interest and FX exchanges are not external flows. Newly recorded transactions are included without editing the profile. Foreign-currency automatic flows use current saved/live FX and are estimates; an unavailable rate produces an explicit error. No transaction is imported or changed.

A fixed performance-only NAV alignment is `anchor.nav - anchor.appNav`. Performance NAV is current app NAV plus this alignment; accounting NAV is untouched. The alignment prevents a known starting discrepancy being mistaken for a subsequent gain, but cannot correct missing later transactions, stale prices, fees, interest or FX timing differences.

After-anchor P/L = performance NAV - brokerage anchor NAV - later net external flows.

After-anchor return = after-anchor P/L / (brokerage anchor NAV + day-weighted later external flows), with weights `(valuation day - flow day) / (valuation day - anchor day)` and end-of-day cash flows. On the anchor date the brokerage NAV and return are shown without a continuation period. A nonpositive after-anchor denominator suppresses the percentage.

Linked YTD = `(1 + brokerage YTD / 100) * (1 + after-anchor return) - 1`. This is a brokerage return linked to a Modified Dietz estimate, not exact daily TWR. It requires no pre-anchor detailed trades, daily option-price reconstruction, recurring statements or screenshots. Current option prices still follow the app's existing manual-price behavior. Long periods with large flows and volatile returns can increase approximation error.

YTD investment P/L continues to use the prior year-end NAV, full-year net flows and performance NAV. Combined portfolio return remains a whole-year Modified Dietz estimate from the sum of NAVs and flows; individual brokerage/linked percentages are never averaged or presented as a combined brokerage TWR. Every participating portfolio needs a common reporting currency and valuation date. Reciprocal internal transfers are matched as before. For automatic transaction-derived flows, optional `autoFlowTransfers[transactionId]: {counterpartyId, transferId}` annotations are stored in the performance profile; dates and amounts remain read-only and transaction state is unchanged.

All settings use the existing encrypted Cloud Sync and JSON backup state. Distinct Sync Keys derive distinct documents; identical keys share state. The fingerprint can verify the actual document mapping without disclosing keys. Source inspection and synthetic isolation tests do not establish which document belongs to a named real user. Deploying code does not enable or populate any real user profile.
