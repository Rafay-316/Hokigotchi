# Feature status and reward rules

This document describes the supplied prototype code and the new Chaos route. Deployment and external services require configuration.

| Area | What the prototype does | Boundary |
| --- | --- | --- |
| Weekly planning | Stores separate category allocations for each week | Supports planning this week and next week; completed reviews lock entries |
| Expenses | Records positive, categorized entries and updates weekly totals | Self-reported; no automatic purchase import |
| Savings | Stores a named goal and rewards newly crossed milestones | One active goal; one new goal per week; fixed target for that quest |
| Monthly budget | Calculates expenses, surplus, and goal timing | Constant monthly assumptions; no interest or withdrawals in the original calculator |
| What-if comparison | Compares an adjusted monthly assumption with the saved plan | An exploration, not a forecast guarantee |
| Hoki | Four stages, snacks, feeding, mood, and cosmetic outfits | In-game progress only |
| Map | Six checkpoints from The Nest to Maroon Summit | Unlocks through XP |
| Buffer challenge | Optional balance floor, recovery reward, and weekly point deductions | Device practice uses Nessie; cloud balance challenges await individual connections |
| Accounts | Email-code sign-in and a separate cloud adventure | Requires Supabase and working email delivery |
| Cloud saves | Server rules, revision checks, request receipts, and retry recovery | Self-reported financial amounts are not externally verified |
| League | Opted-in player names and weekly habit rankings | Does not rank users by bank balance or net worth |
| Backup | Private backup and explicit restore of device practice | Does not import local XP into the competitive cloud league |
| Chaos Arena | Three laptop responses, twelve-month projection, source disclosure | Preset encounter; optional read of configured Nessie balances |
| Decision council | Guardian, Builder, Life, and Bills explanations | Rule-based text, no live AI |
| Partner rewards | Displays future coupon, cashback, and cash concepts | No real partners, redemption, or payouts are implied |

## Reward rules

| Action | XP | Limit or condition |
| --- | ---: | --- |
| Explicit daily check-in | 10 | Once per day; login alone earns nothing |
| Save monthly plan | 25 | First planning award each day |
| Explore a different monthly path | 20 | Once per day |
| Log an eligible expense | 10 | Up to three rewarded entries per day; not proportional to dollars spent |
| Create weekly allocation | 25 | Once for that week; edits cannot re-earn it |
| Review current spending | 5 | Once per day after saving that week's plan |
| Track on three distinct days | 20 | Once per week milestone |
| Track on five distinct days | 35 | Once per week milestone |
| Close a completed weekly review | 15 | Once, after confirming the log is complete |
| Finish a week within budget | Additional 40 | At least three logging days, within both initial and final allocation |
| Reach 25% of a savings goal | 25 | New crossing only |
| Reach 50% of a savings goal | 35 | New crossing only |
| Reach 75% of a savings goal | 50 | New crossing only |
| Reach 90% of a savings goal | 75 | New crossing only |
| Complete a savings goal | 100 | New crossing only |
| Protect the practice balance floor | 15 | Once per day, with a successful eligible balance check |

Starting savings count toward the goal but do not retroactively award milestones. Repeated, deleted, or edited entries do not reset daily reward allowances. Goal milestones cannot be repeatedly re-earned by lowering and raising the saved amount.

The optional practice buffer challenge deducts up to 15 weekly points for a below-floor check once per day. Missed check-ins can deduct 10 weekly points per missed day, capped at three per week. These deductions do not remove lifetime XP or owned outfits. A failed bank request changes no balance points.

Chaos Arena's +100 **practice XP** is separate display feedback. It resets on replay and does not update cloud XP, tokens, rewards, or leaderboards.

Source: `web/src/lib/fork-game.ts`, `web/src/lib/cloud-rules.ts`, and `web/src/app/chaos/engine.ts`.
