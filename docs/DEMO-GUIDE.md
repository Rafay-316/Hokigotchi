# Live demo guide

## Before the pitch

1. Open the PDF or PowerPoint at slide 1.
2. Open the main app in a browser tab. Sign in before presenting if you intend to show cloud progress.
3. Open `http://localhost:3000/chaos` in another tab. Keep its default sample setup for reproducible numbers.
4. Download and open `docs/demo/Hokigotchi-Chaos-Offline.html` as a backup. It needs no internet or installation.
5. Turn off desktop notifications. Close environment-variable files and account settings before screen sharing.
6. Capture a short screen recording of one successful run if the event accepts a backup video.

Do not show email delivery live unless it is the focus of a judge's question. It consumes time and depends on an external service.

## Main game: a 20-second interaction

Open the expense log and add a new, positive expense with a description and category. Use a demo entry you have not already logged that day. Show the XP or limit notice and Hoki progress.

The first three eligible expense entries per day earn XP. Repeating a prior expense or exceeding that allowance will not award again. Rehearsal counts toward these limits, so verify your intended action before the pitch. You can demonstrate updating the record without claiming a new reward if its daily allowance is already used.

An alternative is the first weekly allocation for a week not yet planned. That award is once per week.

## Chaos Arena: a 90-second interaction

1. Show the original plan: $2,560 total cash, $920 reserve, month 4 goal.
2. Click **UNLEASH CHAOS**. Buying new is the initial shock comparison: $850 cost, month 7 goal.
3. Ask a judge to choose a path.
4. Select their response and point to the changed goal month and reserve.
5. Compare one other response.
6. Scroll to the future chart and council explanations.

| Response | Cash after the expense | Reserve | Goal month | Learning score |
| --- | ---: | ---: | ---: | ---: |
| Buy new | $1,710 | $70 | 7 | 38 |
| Refurbished | $2,130 | $490 | 5 | 64 |
| Successful repair | $2,380 | $740 | 4 | 80 |

The default setup assumes $210 monthly surplus, an $800 reserve floor, and a $700 goal. Buying refurbished costs $420 less upfront than buying new. Do not describe this as earned cashback.

## Show Nessie only when it is ready

Before starting the encounter, **Use Nessie balances** reads the existing `/api/nessie/accounts` route. **View data sources** distinguishes the loaded sandbox snapshot from preset income and spending assumptions.

Different loaded balances can change the demo outcome. Restore the original sample through the rules disclosure if you want the exact numbers above. A failed request keeps the labeled sample or last loaded snapshot. The offline HTML never loads Nessie.

## Recovery plan

| Problem | Immediate response |
| --- | --- |
| Email code is slow | Continue in device practice or your already signed-in tab |
| Nessie is unavailable | Say “This is the sample banking world” and continue |
| Development server stops | Open the offline Chaos HTML |
| An XP action has reached its limit | Show the record and explain the cap; do not promise another award |
| A projection differs from the deck | Restore the original sample setup |
| The deck fonts differ on the presentation computer | Use the PDF |
| Internet drops | Continue with the offline encounter and PDF |

## Accurate demo language

Say “Nessie sandbox balances,” “sample projection,” “practice XP,” and “rule-based council.” Partner rewards and live AI are the roadmap. The interface does not initiate purchases, move bank funds, or issue real coupons.
