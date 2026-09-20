# Submission copy

## Project name

Hokigotchi

## Short tagline

Little Hokie. Big future. A financial practice game for student life.

## GitHub About description

A pixel-art budgeting companion: weekly plans, savings quests, cloud leaderboards, and playable financial surprises with Nessie sandbox data.

## Short project description

Hokigotchi turns budgeting into a companion game. Students earn progress by tracking expenses, planning each week, and reaching new savings milestones. Their little Hoki grows as they build useful habits. In Chaos Arena, a surprise laptop breakdown becomes a choice: buy new, go refurbished, or repair. Each response changes a calculated savings timeline and reserve balance, making the tradeoff visible before a real purchase. The prototype combines Capital One Nessie sandbox balances with Supabase accounts, private cloud saves, and opt-in habit rankings.

## Inspiration

We wanted to make financial habits feel approachable for students. A budget can show a plan, but an unexpected expense raises another question: what does this choice do to my future? A small companion creates a reason to return, while playable scenarios give students room to explore those consequences.

## What it does

Players allocate weekly budgets, log categorized expenses, track savings goals, and earn limited rewards for useful actions. XP grows Hoki through four stages, while in-game tokens unlock checkpoints and cosmetics. Email-code accounts preserve cloud adventures, and players can choose to join a weekly league without publishing their financial entries.

Chaos Arena adds a replayable decision demo. It calculates how three responses to a laptop breakdown affect cash, an emergency reserve, and a $700 savings goal. A rule-based council explains the tradeoffs. Sample data and sandbox balances remain explicitly labeled.

## How we built it

The application uses Next.js, React, and TypeScript. Pure calculation functions handle budgeting and scenario projections, including cents arithmetic in the Chaos engine. Capital One Nessie supplies simulated account balances. Supabase provides authentication and Postgres storage. Cloud actions use server-calculated game rules, request IDs, and revision checks to handle repeated and racing saves. The visual style uses maroon, orange, and original pixel-art Hoki assets.

## Challenges

The project needed to reward useful habits without awarding the same action repeatedly. We added daily limits, one-time milestones, and server-side cloud scoring. Cloud saving also needed to recover from duplicate requests and lost acknowledgements. Email-code authentication required matching the email templates and delivery configuration to the application's code-entry flow.

## What we learned

The game and financial calculations need clear boundaries. A playful response can encourage exploration, but a projected balance still needs explicit assumptions. We also learned to separate self-reported practice activity from claims that would require actual transaction verification or funded rewards.

## What is next

Test the experience with students, expand the banking activity feeds, and add more practice scenarios. Explore personalized scenario generation and campus reward partnerships after validating the core habit loop.

## Prototype disclosure

Nessie balances are simulated. Financial entries are self-reported. The decision council is rule-based, and Chaos XP is isolated practice feedback. Coupons, cashback, and cash rewards are previews with no actual payouts. No user-study results, production certification, or partner agreements are claimed.

## Submission fields to complete yourself

- Team member names and event-specific eligibility information.
- The repository URL that judges can access.
- A public demo URL only if you actually deploy one.
- Your recorded demo URL, if the event requests it.

Do not submit `localhost:3000` as a public demo link.
