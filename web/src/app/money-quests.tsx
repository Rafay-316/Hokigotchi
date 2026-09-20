"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CATEGORIES, SAVINGS_MILESTONES, nextWeek, trackingDays, weeklyTotals, weekStart } from "@/lib/fork-game";
import type { Allocations, Game } from "@/lib/fork-game";
import { dispatchGame } from "./fork-game-store";
import { readAmount, message, money } from "./fork-api";
import { Pixel } from "./fork-pixels";
import styles from "./fork-quest.module.css";

export default function MoneyQuests({ game, day, openExpenses }: { game: Game; day: string; openExpenses: () => void }) {
  const current = weekStart(day);
  const [week, setWeek] = useState(current);
  const weeks = [...new Set([current, nextWeek(day), ...Object.keys(game.money.weeks)])].sort().reverse();
  return <>
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>SMALL HABITS. MEANINGFUL MILESTONES.</p><h1>Your money moves Hoki.</h1><p>Plan a different budget each week, keep track of spending, and celebrate progress toward a savings goal.</p></div>
    <div className={styles.moneyIntro}><Pixel kind="star" size={28}/><p><strong>More than showing up.</strong> Expense logs, weekly reviews, consistent tracking, and savings milestones all grow your XP, snack bag, and token balance.</p></div>
    <div className={styles.budgetGrid}>
      <div className={styles.stack}>
        <label className={styles.weekPicker}><span>CHOOSE YOUR WEEK</span><select value={week} onChange={(event) => setWeek(event.target.value)}>{weeks.map((value) => <option key={value} value={value}>Week of {value}{value === current ? " · this week" : value === nextWeek(day) ? " · next week" : ""}</option>)}</select></label>
        <WeeklyPlanner key={week} game={game} day={day} week={week} openExpenses={openExpenses}/>
      </div>
      <SavingsQuest game={game} day={day}/>
    </div>
  </>;
}

function WeeklyPlanner({ game, day, week, openExpenses }: { game: Game; day: string; week: string; openExpenses: () => void }) {
  const budget = game.money.weeks[week];
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(CATEGORIES.map((category) => [category, String((budget?.allocations[category] ?? 0) / 100)])));
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const totals = weeklyTotals(game, week);
  const days = trackingDays(game, week);
  const isPast = week < weekStart(day);
  const isCurrent = week === weekStart(day);
  const claims = [3, 5].filter((count) => days >= count && !budget?.trackingClaims.includes(count));
  const dirty = budget && CATEGORIES.some((category) => Number(draft[category]) * 100 !== budget.allocations[category]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const allocations = Object.fromEntries(CATEGORIES.map((category) => [category, readAmount(draft[category], category)])) as Allocations;
      if (Object.values(allocations).every((value) => value === 0)) throw new Error("Allocate an amount to at least one category.");
      dispatchGame({ type: "weekPlan", week, allocations });
    } catch (e) { setError(message(e)); }
  }
  return <section className={styles.panel} aria-label="Weekly budget">
    <div className={styles.panelTitle}><h2>Your week, your plan.</h2><span className={styles.xpTag}>{budget ? "PLANNING BONUS EARNED" : "+25 XP · +10 TOKENS"}</span></div>
    <p className={styles.muted}>Allocate what you expect to spend. Each week has its own plan; editing one won't change another.</p>
    <form onSubmit={save}>
      <fieldset className={styles.fields} disabled={isPast || !!budget?.closed}><legend className={styles.srOnly}>Weekly category allocations</legend>{CATEGORIES.map((category) => <AmountInput key={category} label={category} value={draft[category]} onChange={(value) => setDraft({ ...draft, [category]: value })}/>)}</fieldset>
      {!isPast && <button className={styles.primaryButton}>{budget ? "Update this week's budget" : "Save weekly budget & earn XP"}<span>→</span></button>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </form>
    {budget ? <>
      <div className={styles.weekStats}><div><small>ALLOCATED</small><strong>{money(totals.budgetCents / 100)}</strong></div><div><small>LOGGED SPENDING</small><strong>{money(totals.spentCents / 100)}</strong></div><div><small>{totals.remainingCents < 0 ? "OVER PLAN" : "LEFT TO SPEND"}</small><strong>{money(Math.abs(totals.remainingCents) / 100)}</strong></div></div>
      {dirty && !isPast && <p className={styles.muted}>These totals use your saved allocation. Save to apply edits.</p>}
      <div className={styles.tableScroll}><table className={styles.weekTable}><caption>Spending by category · based on your expense log</caption><thead><tr><th>Category</th><th>Planned</th><th>Spent</th><th>Left</th></tr></thead><tbody>{CATEGORIES.map((category) => <tr key={category}><th scope="row">{category}</th><td>{money(totals.allocated[category] / 100)}</td><td>{money(totals.spent[category] / 100)}</td><td>{money((totals.allocated[category] - totals.spent[category]) / 100)}</td></tr>)}</tbody></table></div>
      <p className={styles.muted}>Logging an expense updates this week's spending and money left. These totals are separate from Nessie balances and the monthly calculator.</p>
      {isCurrent && <div className={styles.moneyButtons}><button className={styles.smallButton} onClick={openExpenses}>Log an expense</button><button className={styles.smallButton} disabled={!!game.days[day]?.review || !!dirty} onClick={() => dispatchGame({ type: "weekReview" })}>{game.days[day]?.review ? "Reviewed today" : "Review today's totals · +5 XP"}</button></div>}
      <div className={styles.moneyBonus}><h3>{days} / 5 days of expense tracking</h3><p>Three different logging days: +20 XP. Five days: another +35 XP. Each bonus is available once per week.</p><button className={styles.smallButton} disabled={!claims.length || week > weekStart(day)} onClick={() => dispatchGame({ type: "trackingReward", week })}>{claims.length ? `Collect tracking bonus · +${claims.reduce((sum, count) => sum + (count === 3 ? 20 : 35), 0)} XP` : "Next bonus needs more tracking days"}</button></div>
      {budget.closed ? <div className={styles.moneyBonus}><h3>Week reviewed ✓</h3><p>{budget.closed.bonus ? "You earned the review reward and the +40 XP within-budget bonus." : "You earned +15 XP for reflecting on your week."} Closed {budget.closed.day}.</p></div> : isPast ? <form className={styles.moneyBonus} onSubmit={(event) => { event.preventDefault(); dispatchGame({ type: "closeWeek", week, confirmed }); }}><h3>Reflect, collect, start fresh.</h3><p>Review the completed week for +15 XP. Stay within your original allocation and log on at least three days for another +40 XP.</p><label className={styles.checkbox}><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/><span>My spending log for this week is complete. Close the review and lock its entries.</span></label><button className={styles.primaryButton} disabled={!confirmed}>Close week & collect rewards</button></form> : <p className={styles.petCareNote}>After Sunday, review this week for +15 XP. The extra +40 XP bonus requires three logging days and spending within both your first saved total ({money(budget.firstLimitCents / 100)}) and your final allocation. Increasing the budget does not increase that reward benchmark.</p>}
    </> : <p className={styles.petCareNote}>Save a weekly plan to see logged spending, money left, and weekly bonuses.</p>}
  </section>;
}

function SavingsQuest({ game, day }: { game: Game; day: string }) {
  const goal = game.money.goals[0];
  const [name, setName] = useState("My savings goal");
  const [target, setTarget] = useState(String(game.plan?.goalTarget || 700));
  const [starting, setStarting] = useState(String(game.plan?.goalSaved ?? 0));
  const [error, setError] = useState("");
  const canStart = (!goal || goal.savedCents >= goal.targetCents) && !game.money.goals.some((value) => weekStart(value.createdDay) === weekStart(day));
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const amount = readAmount(target, "Savings target"), saved = readAmount(starting, "Already saved");
      if (amount <= saved) throw new Error("Set a target above what you have already saved.");
      dispatchGame({ type: "goalCreate", id: crypto.randomUUID(), name, target: amount, saved });
    } catch (e) { setError(message(e)); }
  }
  return <div className={styles.stack}>
    {goal && <GoalProgress key={goal.id} game={game}/>}
    {(!goal || goal.savedCents >= goal.targetCents) && <section className={styles.panel}><div className={styles.panelTitle}><h2>{goal ? "Your next savings quest." : "Give your savings a purpose."}</h2><Pixel kind="flag" size={28}/></div><p className={styles.muted}>Earn milestone bonuses for new progress toward your target. Your starting savings count toward the goal, without awarding retroactive bonuses.</p><form onSubmit={create}><fieldset className={styles.fields} disabled={!canStart}><legend className={styles.srOnly}>Create savings quest</legend><label className={styles.fullField}><span>Goal name</span><input required minLength={2} maxLength={40} value={name} onChange={(event) => setName(event.target.value)}/></label><AmountInput label="Target" value={target} onChange={setTarget}/><AmountInput label="Already saved" value={starting} onChange={setStarting}/></fieldset><button className={styles.primaryButton} disabled={!canStart}>{canStart ? "Start savings quest" : "Next new quest available next week"}</button>{error && <p role="alert" className={styles.error}>{error}</p>}</form><p className={styles.petCareNote}>The target stays fixed for this quest. Complete it before starting another; one new quest can be started each week.</p></section>}
    <section className={styles.rulesCard}><Pixel kind="star" size={30}/><h3>Progress beats spending more.</h3><p>Expense rewards are per useful entry, not per dollar. Savings rewards follow the percentage of your own goal. All amounts here are self-reported practice data.</p></section>
    {game.money.goals.length > 1 && <section className={styles.panel}><h2>Your completed quests</h2><ul className={styles.expenseList}>{game.money.goals.slice(1).map((value) => <li key={value.id}><span><strong>{value.name}</strong><small>Goal reached · {money(value.targetCents / 100)}</small></span><Pixel kind="check" size={20}/></li>)}</ul></section>}
  </div>;
}

function GoalProgress({ game }: { game: Game }) {
  const goal = game.money.goals[0];
  const [saved, setSaved] = useState(String(goal.savedCents / 100));
  const [error, setError] = useState("");
  const percent = Math.min(100, Math.floor(goal.savedCents / goal.targetCents * 100));
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try { dispatchGame({ type: "goalProgress", id: goal.id, saved: readAmount(saved, "Total saved") }); }
    catch (e) { setError(message(e)); }
  }
  return <section className={styles.goalCard}><div className={styles.panelTitle}><span className={styles.eyebrow}>YOUR SAVINGS QUEST</span><Pixel kind={percent >= 100 ? "chest" : "flag"} size={32}/></div><h2>{goal.name}</h2><div className={styles.goalNumbers}><strong>{money(goal.savedCents / 100)}<small> / {money(goal.targetCents / 100)}</small></strong><b>{percent}%</b></div><progress max="100" value={percent} aria-label="Savings quest funded"/>
    <ul className={styles.milestoneList}>{SAVINGS_MILESTONES.map((milestone) => { const initial = goal.baselineCents * 100 >= goal.targetCents * milestone.percent; const earned = goal.claimed.includes(milestone.percent); return <li key={milestone.percent} data-earned={earned}><span><strong>{milestone.percent === 90 ? "Almost there!" : milestone.percent === 100 ? "Goal reached!" : `${milestone.percent}% saved`}</strong><small>{initial ? "Already reached when you started" : earned ? "Bonus earned" : `At ${money(goal.targetCents * milestone.percent / 10000)}`}</small></span><b>{initial ? "Starting progress" : `+${milestone.xp} XP · ${milestone.tokens} tokens`}</b></li>; })}</ul>
    <form onSubmit={update}><AmountInput label="Total currently saved for this goal" value={saved} onChange={setSaved}/><button className={styles.primaryButton}>Update progress & collect milestones <span>→</span></button>{error && <p role="alert" className={styles.error}>{error}</p>}</form>
    <p className={styles.petCareNote}>Enter your current total, including any withdrawals. Each milestone pays once; reducing and restoring the balance cannot earn it twice. This tracker does not move money or read your bank savings automatically.</p>
  </section>;
}

function AmountInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span>{label}</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" required value={value} onChange={(event) => onChange(event.target.value)}/></div></label>;
}

export function RewardCatalog({ tokens }: { tokens: number }) {
  const examples = [
    { name: "Campus café coupon", value: "10% off", cost: 100, text: "An example of a merchant-funded discount on an eligible purchase." },
    { name: "Study break discount", value: "$5 off", cost: 250, text: "An example coupon a participating retailer could sponsor." },
    { name: "Shopping cashback", value: "$2 back", cost: 350, text: "An example cashback reward after a verified eligible purchase." },
    { name: "Savings boost", value: "$5 reward", cost: 500, text: "An example sponsor-funded cash contribution toward a savings goal." },
  ];
  return <section className={styles.catalog} aria-label="Partner rewards preview"><div className={styles.sectionHeading}><p className={styles.eyebrow}>WHERE YOUR HABITS COULD TAKE YOU</p><h2>Beyond the game: rewards preview.</h2><p>These are example offers. No partners are connected, and no real coupon, cashback, or payment is available yet.</p></div><div className={styles.catalogGrid}>{examples.map((offer) => <article className={styles.catalogCard} key={offer.name}><span className={styles.demoTag}>DEMO OFFER</span><strong>{offer.value}</strong><h3>{offer.name}</h3><p>{offer.cost} tokens · illustrative price</p><progress max={offer.cost} value={Math.min(tokens, offer.cost)} aria-label={`Progress toward the example ${offer.name}`}/><small>{tokens >= offer.cost ? "Example token threshold reached" : `${offer.cost - tokens} more tokens to this example threshold`}</small><details><summary>Preview offer</summary><p>{offer.text}</p><p>A live offer needs a participating sponsor, confirmed terms, verified earning, and a redemption service. Previewing does not spend tokens or issue a redeemable code.</p></details></article>)}</div></section>;
}
