# Portfolio Tracker PWA Prototype v1.3

A lightweight StockerX-style personal portfolio tracker prototype.

## Included
- Multiple accounts
- Stock and option assets
- Option multiplier support
- Buy / Sell / Deposit / Withdrawal / Dividend / Fee / Tax / Interest / Margin interest
- Cash balances that can go negative for margin
- HKD / USD / KRW balances
- FX conversion transactions
- Consolidated net assets
- Realized / unrealized P&L
- Holding % based on net assets
- LocalStorage persistence
- Installable PWA shell

## Notes
- Stock prices are currently manual demo values in this prototype.
- The next build should connect a market-data provider for US/HK/KR stocks and an FX-rate provider.
- Options remain manually priced by design.

## v1.3 critical fix
- Fixed the runtime error: `mult is not defined`.
- Save Transaction now completes and the portfolio recalculates correctly.
- Save Asset and Save FX use direct click handlers.
- Existing localStorage data is migrated automatically.
- Browser cache-busting updated to `app.js?v=1.3`.
