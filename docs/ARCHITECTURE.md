# Architecture

Hokigotchi separates the financial calculations, game rules, cloud storage, and presentation demo.

## Main components

| Location | Purpose |
| --- | --- |
| `web/src/app/fork-quest.tsx` | Main game views and navigation |
| `web/src/app/hoki-nest.tsx` | Pet care and evolution interface |
| `web/src/app/money-quests.tsx` | Weekly allocations, savings goals, and reward catalog |
| `web/src/app/fork-pixels.tsx` | Original pixel artwork and game scenery |
| `web/src/lib/fork-game.ts` | Game state, rewards, limits, and progression |
| `web/src/lib/budget.ts` | Monthly budget calculations |
| `web/src/lib/compare-budgets.ts` | Baseline/scenario comparison |
| `web/src/app/api/nessie/accounts/route.ts` | Server-side Nessie account balance request |
| `web/src/app/cloud-client.ts` | Supabase session and authenticated requests |
| `web/src/app/api/cloud/[resource]/route.ts` | Cloud state, action, league, and backup endpoints |
| `web/src/lib/cloud-server.ts` | Server credentials, identity verification, and database access |
| `web/src/lib/cloud-service.ts` | Atomic action workflow, revision checks, and replay handling |
| `web/src/lib/cloud-rules.ts` | Allowed cloud actions and campus calendar rules |
| `web/supabase/migrations/202609200001_hokigotchi.sql` | Tables and restricted database functions |
| `web/src/app/chaos/engine.ts` | Pure simulation, cents arithmetic, and response validation |
| `web/src/app/chaos/chaos-demo.tsx` | Isolated encounter and optional account snapshot loading |

The earlier FORK naming remains in internal filenames and the practice storage key for compatibility. The product is Hokigotchi.

## Cloud action flow

1. The player signs in with an email code and obtains a Supabase session.
2. The client sends an allowed action with a request ID and expected state revision.
3. The server verifies the session and derives the player identity.
4. The server reads the player's state and calculates the action's result using the game rules.
5. The database commits the updated state and request receipt atomically.
6. The client shows the confirmed saved result. A retry with the same request identity can recover a lost acknowledgement without awarding twice.

Opt-in rankings expose nickname and habit-score fields. User-entered expenses, goals, and balances are not part of the public ranking response. Database tables deny direct browser-role access; the trusted backend applies authenticated operations.

## Practice and cloud remain separate

Device practice uses local storage and can retain an older Hoki. Cloud play starts a separate game with server-calculated rewards. A private device backup does not import editable local scores into the shared league.

Nessie supplies simulated account balances to the existing practice experience. There is no per-user real bank connection for cloud players in this prototype.

## Chaos model

The default setup uses checking $1,640, savings $920, income $1,450/month, expenses $1,240/month, an $800 reserve floor, and a $700 goal with $0 initially allocated.

An event cost draws from savings first, then checking. At each of twelve month ends, available surplus first clears any checking shortfall, then restores the reserve, then funds the goal. Additional surplus returns to the reserve. Goal money remains part of total cash.

Negative cash flow draws checking, reserve, and goal funds in that order before creating a checking shortfall. A goal that does not reach its target within the modeled horizon displays “Beyond 12 months.”

The learning resilience score assigns up to 50 points for reserve coverage and up to 50 for monthly surplus relative to 25% of monthly expenses. A checking shortfall immediately after the event sets the score to zero. This transparent demonstration score is not a credit score or a bank risk assessment.

The scene uses fixed scenario assumptions unless the player explicitly loads a valid Nessie account snapshot. Income and spending assumptions remain presets even when balances load successfully. The route never writes to bank accounts or cloud game state.

## Production boundaries

Self-reported financial entries are not proof of real transactions. Real reward payouts would require funding, eligibility checks, fraud controls, and a redemption process. A public deployment also needs an end-to-end review of the pre-existing banking routes and the hosting configuration. This prototype does not claim such a review is complete.
