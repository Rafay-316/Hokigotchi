"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { CATEGORIES, CHECKPOINTS, OUTFITS, emptyDay, petStatus, streak, weekCount, weekStart } from "@/lib/fork-game";
import type { Category, Game } from "@/lib/fork-game";
import { dispatchGame, useAdventure } from "./fork-game-store";
import { HokiSprite, Landscape, Pixel, Scout } from "./fork-pixels";
import HokiNest from "./hoki-nest";
import CloudAccount, { CloudStatus, SharedLeague } from "./cloud-account";
import MoneyQuests, { RewardCatalog } from "./money-quests";
import { api, post, isResult, isSummary, isComparison, readAmount, message, money,
  months, toDraft, FIELDS, CHANGE_FIELDS, INITIAL, comparisonTitle } from "./fork-api";
import type { Budget, Draft, Result, Summary, Comparison, ChangeField } from "./fork-api";
import styles from "./fork-quest.module.css";

type View = "nest" | "money" | "world" | "quests" | "budget" | "rewards" | "league" | "account";
type Snapshot = NonNullable<ReturnType<typeof useAdventure>>;
const VIEWS: { id: View; title: string; icon: string }[] = [
  { id: "nest", title: "My Hoki", icon: "00" },
  { id: "money", title: "Money quests", icon: "★" },
  { id: "world", title: "World map", icon: "01" },
  { id: "quests", title: "Quest log", icon: "02" },
  { id: "budget", title: "Budget lab", icon: "03" },
  { id: "rewards", title: "Rewards", icon: "04" },
  { id: "league", title: "Leaderboard", icon: "05" },
  { id: "account", title: "Player account", icon: "06" },
];

export default function ForkQuest() {
  const snapshot = useAdventure();
  if (!snapshot) return <main className={styles.loading}><Scout size={90} /><h1>Hokigotchi</h1><p>Loading your adventure…</p></main>;
  return <Adventure key={`${snapshot.mode}-${snapshot.account?.id ?? "guest"}-${snapshot.status === "ready" ? "ready" : "unavailable"}`} snapshot={snapshot} />;
}

function Adventure({ snapshot }: { snapshot: Snapshot }) {
  const { game, day } = snapshot;
  const cloudMode = snapshot.mode === "cloud";
  const locked = cloudMode && (snapshot.busy || snapshot.pending || snapshot.status !== "ready");
  const [view, setView] = useState<View>(snapshot.status === "ready" ? "nest" : "account");
  const [accounts, setAccounts] = useState<Summary | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [initialPlan] = useState<Budget>(() => game.plan ?? INITIAL);
  const [draft, setDraft] = useState<Draft>(() => toDraft(initialPlan));
  const [applied, setApplied] = useState<Budget>(initialPlan);
  const [budget, setBudget] = useState<Result | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState("");
  const [changeField, setChangeField] = useState<ChangeField>("otherExpenses");
  const [changeAmount, setChangeAmount] = useState("0");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const accountRequest = useRef<AbortController | null>(null);
  const budgetRequest = useRef<AbortController | null>(null);
  const comparisonRequest = useRef<AbortController | null>(null);
  const dirty = FIELDS.some(({ key }) => draft[key].trim() === "" || Number(draft[key]) !== applied[key]);
  const daily = game.days[day] ?? emptyDay();
  const outfit = OUTFITS.find((o) => o.id === game.outfit)!;
  const pet = petStatus(game, day);
  const nextCheckpoint = CHECKPOINTS.find((c) => c.xp > game.xp);
  const level = Math.floor(game.xp / 100) + 1;
  const questCount = Number(daily.checkin) + Number(daily.plan) + Number(daily.compare) + Number(daily.expenses >= 3) + Number(daily.buffer) + Number(!!daily.review);

  const refreshAccounts = useCallback(async (scoreBuffer = false) => {
    const controller = new AbortController();
    accountRequest.current?.abort();
    accountRequest.current = controller;
    setAccountLoading(true); setAccountError(""); setAccounts(null);
    try {
      const data = await api("/api/nessie/accounts", { signal: controller.signal });
      if (!isSummary(data.summary)) throw new Error("Unexpected account response.");
      if (!controller.signal.aborted) {
        setAccounts(data.summary);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        if (scoreBuffer) dispatchGame({ type: "buffer", checking: data.summary.checkingBalance });
      }
    } catch {
      if (!controller.signal.aborted) setAccountError("Nessie couldn't be reached. No balance points were changed. Try again.");
    } finally {
      if (!controller.signal.aborted) setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cloudMode) void refreshAccounts();
    else setAccountLoading(false);
    const controller = new AbortController();
    budgetRequest.current = controller;
    api("/api/budget", post(initialPlan, controller.signal)).then((data) => {
      if (!isResult(data)) throw new Error("Unexpected budget response.");
      if (!controller.signal.aborted) setBudget(data);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setBudgetError(message(error));
    }).finally(() => {
      if (!controller.signal.aborted) setBudgetLoading(false);
    });
    return () => {
      accountRequest.current?.abort(); controller.abort();
      budgetRequest.current?.abort(); comparisonRequest.current?.abort();
    };
  }, [initialPlan, refreshAccounts, cloudMode]);

  function clearComparison() {
    comparisonRequest.current?.abort(); setComparison(null);
    setComparisonError(""); setComparisonLoading(false);
  }
  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); clearComparison(); setBudgetError("");
    const controller = new AbortController();
    budgetRequest.current?.abort(); budgetRequest.current = controller;
    try {
      const next = Object.fromEntries(FIELDS.map(({ key, label }) => [key, readAmount(draft[key], label)])) as Budget;
      setBudgetLoading(true);
      const data = await api("/api/budget", post(next, controller.signal));
      if (!isResult(data)) throw new Error("Unexpected budget response.");
      if (!controller.signal.aborted) {
        const saved = await dispatchGame({ type: "plan", plan: next });
        if (saved) { setBudget(data); setApplied(next); }
      }
    } catch (error) { if (!controller.signal.aborted) setBudgetError(message(error)); }
    finally { if (!controller.signal.aborted) setBudgetLoading(false); }
  }
  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty || !budget || budgetLoading) return;
    clearComparison();
    const controller = new AbortController(); comparisonRequest.current = controller;
    try {
      const amount = readAmount(changeAmount, "New amount");
      if (amount === applied[changeField]) throw new Error("Choose a different amount to explore a new path.");
      setComparisonLoading(true);
      const data = await api("/api/budget/compare", post({ baseline: applied, changes: { [changeField]: amount } }, controller.signal));
      if (!isComparison(data)) throw new Error("Unexpected comparison response.");
      if (!controller.signal.aborted) {
        const saved = await dispatchGame({ type: "compare", field: changeField, amount });
        if (saved) setComparison(data);
      }
    } catch (error) { if (!controller.signal.aborted) setComparisonError(message(error)); }
    finally { if (!controller.signal.aborted) setComparisonLoading(false); }
  }
  function go(next: View) { setView(next); }

  return <div className={styles.app}>
    <a className={styles.skip} href="#game-main">Skip to adventure</a>
    <header className={styles.topbar}>
      <button className={styles.logo} onClick={() => go("nest")} aria-label="Hokigotchi home"><span className={styles.logoIcon}><Scout size={42} /></span>Hokigotchi<span className={styles.logoDot}>.</span><small>RAISE YOUR HABITS. GROW YOUR HOKI.</small></button>
      <button className={styles.accountBadge} onClick={() => go("account")}>{cloudMode ? "CLOUD ADVENTURE" : "DEVICE PRACTICE"} · {snapshot.account ? "MY ACCOUNT" : "SIGN IN"}</button>
    </header>
    <nav className={styles.navigation} aria-label="Game sections">
      {VIEWS.map((item) => <button key={item.id} onClick={() => go(item.id)} aria-current={view === item.id ? "page" : undefined} className={view === item.id ? styles.navActive : ""}><span>{item.icon}</span>{item.title}{item.id === "quests" && <b>{questCount}/{cloudMode ? 5 : 6}</b>}</button>)}
    </nav>
    <main id="game-main" className={styles.main}>
      <section className={styles.hud} aria-label="Your game progress">
        <div className={styles.player}><HokiSprite stage={pet.stage.id} mood={pet.mood} color={outfit.color} size={60} /><div><small>HEY, {game.name.toUpperCase()}</small><strong>Level {level} <span>{pet.stage.name}</span></strong></div></div>
        <div className={styles.xp}><div><span>ADVENTURE XP</span><b>{game.xp % 100} / 100</b></div><progress value={game.xp % 100} max="100" aria-label="XP toward your next level" /><small>{game.xp} lifetime XP</small></div>
        <div className={styles.hudStat}><Pixel kind="coin" size={30} /><div><strong>{game.tokens}</strong><small>TOKENS</small></div></div>
        <div className={styles.hudStat}><Pixel kind="bolt" size={30} /><div><strong>{streak(game, day)} <span>days</span></strong><small>CHECK-IN STREAK</small></div></div>
        <div className={styles.hudStat}><Pixel kind="star" size={30} /><div><strong>{game.weekly.score}</strong><small>WEEKLY POINTS</small></div></div>
      </section>
      <div className={styles.notice} role="status" aria-live="polite"><Pixel kind="star" size={18} /><span>{snapshot.notice}</span><small>{cloudMode ? snapshot.busy || snapshot.pending ? "SAVE PENDING" : snapshot.status === "ready" ? "CLOUD SAVE CONFIRMED" : "CLOUD UNAVAILABLE" : "PROGRESS SAVES ON THIS DEVICE"}</small></div>
      {snapshot.warning && <p className={styles.error} role="alert">{snapshot.warning}</p>}
      <CloudStatus/>
      {view === "account" && <CloudAccount/>}
      <div inert={locked}>

      {view === "nest" && <>
        <HokiNest game={game} day={day} openQuests={() => go("money")} openRewards={() => go("rewards")} />
        <div className={styles.twoColumns}>
          <QuestBoard game={game} day={day} go={go} checkBuffer={() => { go("world"); void refreshAccounts(true); }} loading={accountLoading} />
          <section className={styles.panel}><Pixel kind="flag" size={32}/><h2>Your next adventure is waiting.</h2><p className={styles.muted}>Quests grow Hoki and move you through Hokie Hollow. Claim checkpoint treasure, then choose a new outfit for your companion.</p><button className={styles.primaryButton} onClick={() => go("world")}>Explore the world map <span>→</span></button></section>
        </div>
      </>}

      {view === "money" && <MoneyQuests key={day} game={game} day={day} openExpenses={() => go("quests")}/>}

      {view === "world" && <>
        <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR LITTLE HOKIE. YOUR NEXT CHAPTER.</p><h1>Little Hokie.<br /><span>Big future.</span></h1><p>Check in. Build good habits. Help Hoki reach the next checkpoint.</p></div><div className={styles.headingBadge}><Pixel kind="flag" size={36} /><span>WORLD 01<strong>Hokie Hollow</strong></span></div></div>
        <div className={styles.worldGrid}>
          <section className={styles.worldPanel} aria-label="Hokie Hollow checkpoint map">
            <div className={styles.worldHeader}><span><i /> ADVENTURE IN PROGRESS</span><b>{nextCheckpoint ? `${nextCheckpoint.xp - game.xp} XP to ${nextCheckpoint.name}` : "WORLD COMPLETE!"}</b></div>
            <div className={styles.map}>
              <div className={styles.landscape}><Landscape /></div>
              <span className={styles.mapCaption}>HOKIE HOLLOW<span>Every habit is a step forward.</span></span>
              {CHECKPOINTS.map((point, index) => {
                const reached = game.xp >= point.xp;
                const collected = game.claimed.includes(index);
                const current = reached && (!CHECKPOINTS[index + 1] || game.xp < CHECKPOINTS[index + 1].xp);
                return <div key={point.name} className={styles.mapStop} style={{ "--x": `${[8, 25, 43, 59, 76, 91][index]}%`, "--y": `${[82, 77, 71, 63, 51, 44][index]}%` } as CSSProperties}>
                  {current && <span className={styles.mapScout}><HokiSprite stage={pet.stage.id} mood={pet.mood} color={outfit.color} size={68} /></span>}
                  <button onClick={() => dispatchGame({ type: "claim", checkpoint: index })} className={collected ? styles.collectedStop : reached ? styles.readyStop : styles.lockedStop} aria-label={`${point.name}: ${collected ? "treasure collected" : reached ? `claim ${point.tokens} tokens` : `unlocks at ${point.xp} XP`}`}><Pixel kind={collected ? "flag" : reached ? "chest" : "lock"} size={24} /></button>
                  <span className={styles.stopLabel}>{index + 1}<small>{point.xp} XP</small></span>
                </div>;
              })}
            </div>
            <div className={styles.worldFooter}><span><Pixel kind="chest" size={24} /><b>{game.claimed.length - 1} / 5 treasures collected</b></span><button className={styles.textButton} onClick={() => go("rewards")}>View rewards <span>→</span></button></div>
          </section>
          <QuestBoard game={game} day={day} go={go} checkBuffer={() => void refreshAccounts(true)} loading={accountLoading} compact />
        </div>
        {!cloudMode && <section className={styles.accountStrip} aria-label="Nessie simulated balances">
          <div><span><Pixel kind="coin" size={22} /> YOUR ADVENTURE FUNDS</span><small>Simulated USD · Capital One Nessie{checkedAt && ` · updated ${checkedAt}`}</small></div>
          <div><small>CHECKING</small><strong>{accounts ? money(accounts.checkingBalance) : "—"}</strong></div>
          <div><small>SAVINGS</small><strong>{accounts ? money(accounts.savingsBalance) : "—"}</strong></div>
          <div><small>TOTAL CASH</small><strong>{accounts ? money(accounts.totalCashBalance) : "—"}</strong></div>
          <button className={styles.smallButton} disabled={accountLoading} onClick={() => void refreshAccounts()}>{accountLoading ? "Loading…" : "↻ Refresh"}</button>
        </section>}
        {accountError && <p role="alert" className={styles.error}>{accountError}</p>}
        <div className={styles.twoColumns}>
          <GoalCard budget={budget} dirty={dirty} open={() => go("budget")} />
          {!cloudMode && <BufferCard key={`${game.challenge.enabled}-${game.challenge.floorCents}`} game={game} dailyPenalty={daily.bufferPenalty} accounts={accounts} loading={accountLoading} check={() => void refreshAccounts(true)} />}
        </div>
        {budgetError && <p role="alert" className={styles.error}>{budgetError} <button className={styles.textButton} onClick={() => go("budget")}>Open budget lab</button></p>}
      </>}

      {view === "quests" && <>
        <SectionHeading eyebrow="SHOW UP. LEVEL UP." title="Your daily quest log." text="Useful actions earn XP. Quests reset each day; earned XP stays yours." />
        <div className={styles.questGrid}>
          <div><QuestBoard game={game} day={day} go={go} checkBuffer={() => { go("world"); void refreshAccounts(true); }} loading={accountLoading} /><div className={styles.rulesCard}><Pixel kind="star" size={30} /><h3>Habits beat high balances.</h3><p>Daily actions offer up to {cloudMode ? 90 : 105} XP, with separate weekly and savings milestones. Repeated saves and refreshes earn no extra XP.</p><button className={styles.textButton} onClick={() => go("money")}>Open weekly budgets & savings quests →</button></div></div>
          <ExpenseLog game={game} day={day} />
        </div>
      </>}

      {view === "budget" && <>
        <SectionHeading eyebrow="THE STRATEGY ROOM" title="Plan your next move." text="Your budget is the map. A what-if is a chance to try a different route." />
        <div className={styles.budgetGrid}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><h2>Your monthly plan</h2><span className={styles.xpTag}>{daily.plan ? "✓ XP earned today" : "+25 XP"}</span></div>
            <p className={styles.muted}>USD / month · {game.plan ? "Your saved plan" : "Example amounts — make them yours"}</p>
            <form onSubmit={savePlan}>
              <fieldset className={styles.fields} disabled={budgetLoading}><legend className={styles.srOnly}>Monthly budget and savings goal</legend>
                {FIELDS.map(({ key, label, hint }) => <label key={key}><span>{label}</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input type="number" name={key} min="0" max="1000000000" step="0.01" inputMode="decimal" required value={draft[key]} aria-describedby={`${key}-hint`} onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); clearComparison(); setBudgetError(""); }} /></div><small id={`${key}-hint`}>{hint}</small></label>)}
              </fieldset>
              <button className={styles.primaryButton} disabled={budgetLoading}>{budgetLoading ? "Calculating…" : "Save & calculate plan"} <span>→</span></button>
              {budgetError && <p className={styles.error} role="alert">{budgetError}</p>}
            </form>
            <div className={styles.planResults} aria-live="polite"><div><small>LEFT EACH MONTH</small><strong>{budget ? money(budget.monthlySurplus) : "—"}</strong></div><div><small>MONTHLY EXPENSES</small><strong>{budget ? money(budget.monthlyExpenses) : "—"}</strong></div></div>
            <p className={styles.muted}>{dirty ? "Showing your last calculated plan. Save to apply your changes." : `Saving this plan keeps it ${cloudMode ? "in your cloud adventure" : "on this device"}. Expense logs are tracked separately.`}</p>
          </section>
          <div className={styles.stack}>
            <GoalCard budget={budget} dirty={dirty} />
            <section className={styles.panel}>
              <div className={styles.panelTitle}><h2>The what-if portal</h2><span className={styles.xpTag}>{daily.compare ? "✓ XP earned today" : "+20 XP"}</span></div><p className={styles.muted}>Explore a change. Your savings goal stays the same.</p>
              <form onSubmit={compare}><fieldset className={styles.fields} disabled={dirty || budgetLoading || !budget || comparisonLoading}><legend className={styles.srOnly}>What-if scenario</legend><label><span>I change</span><select value={changeField} onChange={(event) => { setChangeField(event.target.value as ChangeField); clearComparison(); }}>{CHANGE_FIELDS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>To this monthly amount</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input type="number" min="0" max="1000000000" step="0.01" required value={changeAmount} onChange={(event) => { setChangeAmount(event.target.value); clearComparison(); }} /></div></label></fieldset><p className={styles.muted}>{dirty ? "Save your plan before comparing paths." : `Currently ${money(applied[changeField])} per month.`}</p><button className={styles.yellowButton} disabled={dirty || budgetLoading || !budget || comparisonLoading}>{comparisonLoading ? "Opening portal…" : "Explore this path"} <span>↗</span></button>{comparisonError && <p role="alert" className={styles.error}>{comparisonError}</p>}</form>
              <div aria-live="polite">{comparison ? <div className={styles.comparison}><h3>{comparisonTitle(comparison)}</h3><div className={styles.paths}>{([["CURRENT PATH", comparison.baseline], ["WHAT-IF PATH", comparison.scenario]] as const).map(([label, result]) => <div key={label}><small>{label}</small><strong>{money(result.monthlySurplus)}</strong><span>left / month</span><b>{months(result.goal.monthsToGoal)}</b></div>)}</div><p>{money(Math.abs(comparison.comparison.monthlySurplusChange))} {comparison.comparison.monthlySurplusChange >= 0 ? "more" : "less"} left each month. Exploring doesn't change your saved plan.</p></div> : <div className={styles.portalEmpty}><Pixel kind="star" size={40} /><p>What if your next choice changed your next month?</p></div>}</div>
            </section>
          </div>
        </div>
      </>}

      {view === "rewards" && <Rewards game={game} />}
      {view === "league" && (cloudMode ? <SharedLeague openAccount={() => go("account")}/> : <League game={game} day={day} />)}
      </div>
      <footer className={styles.footer}><b>Hokigotchi<span>.</span></b><p>Grow good habits with Hoki. Simulated money.<br />Projections assume constant income and expenses, all positive surplus saved at month end, and no interest or withdrawals.</p><span>LITTLE HOKIE. BIG FUTURE.</span></footer>
    </main>
  </div>;
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className={styles.sectionHeading}><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>;
}

function QuestBoard({ game, day, go, checkBuffer, loading, compact = false }: { game: Game; day: string; go: (view: View) => void; checkBuffer: () => void; loading: boolean; compact?: boolean }) {
  const cloudMode = useAdventure()?.mode === "cloud";
  const d = game.days[day] ?? emptyDay();
  const quests = [
    { title: "Show up for yourself", hint: "Make today's check-in.", xp: 10, done: d.checkin, action: () => dispatchGame({ type: "checkin" }) },
    { title: "Plan your path", hint: "Save a monthly budget.", xp: 25, done: d.plan, action: () => go("budget") },
    { title: "Follow the money", hint: `Log 3 expenses. ${d.expenses}/3 XP rewards earned.`, xp: 30, done: d.expenses >= 3, action: () => go("quests") },
    { title: "Open a what-if portal", hint: "Compare a different monthly amount.", xp: 20, done: d.compare, action: () => go("budget") },
    { title: "Review your money left", hint: "Review today’s weekly-budget totals.", xp: 5, done: !!d.review, action: () => go("money") },
    { title: "Protect your buffer", hint: game.challenge.enabled ? "Check that checking meets your floor." : "Join the optional buffer challenge.", xp: 15, done: d.buffer, action: () => game.challenge.enabled ? checkBuffer() : go("world") },
  ];
  return <section className={`${styles.questBoard} ${compact ? styles.compact : ""}`}><div className={styles.panelTitle}><h2>Daily quests</h2><span className={styles.dailyTag}>{cloudMode ? 90 : 105} DAILY XP + BONUSES</span></div><p className={styles.muted}>Little wins. A whole new level.</p><div className={styles.questList}>{quests.filter((q) => !cloudMode || q.title !== "Protect your buffer").map((q, i) => <button key={q.title} className={q.done ? styles.questDone : styles.quest} disabled={q.done || (i === 5 && loading)} onClick={q.action}><span className={styles.questMarker}>{q.done ? <Pixel kind="check" size={16} /> : String(i + 1).padStart(2, "0")}</span><span><strong>{q.title}</strong><small>{q.hint}</small></span><b>{q.done ? "DONE" : `+${q.xp}`}</b></button>)}</div><div className={styles.questFoot}><Pixel kind="coin" size={19} /><span>XP grows Hoki. Tokens unlock rewards.</span></div></section>;
}

function GoalCard({ budget, dirty, open }: { budget: Result | null; dirty: boolean; open?: () => void }) {
  const percent = budget ? budget.goal.target === 0 ? 100 : Math.min(100, Math.floor(budget.goal.saved / budget.goal.target * 100)) : 0;
  return <section className={styles.goalCard}><div className={styles.panelTitle}><span className={styles.eyebrow}>THE BIG QUEST</span><Pixel kind="flag" size={30} /></div><h2>Your savings summit</h2><div className={styles.goalNumbers}><strong>{budget ? money(budget.goal.saved) : "—"}<small> / {budget ? money(budget.goal.target) : "—"}</small></strong><b>{percent}%</b></div><progress max="100" value={percent} aria-label="Savings goal funded"/><div className={styles.goalMeta}><span>Estimated arrival</span><b>{budget ? months(budget.goal.monthsToGoal) : "Calculating…"}</b></div><p>{dirty ? "Based on your last calculated plan. " : ""}Goal savings are entered separately from your Nessie balances.</p>{open && <button className={styles.textButton} onClick={open}>Make a plan for this goal <span>→</span></button>}</section>;
}

function BufferCard({ game, dailyPenalty, accounts, loading, check }: { game: Game; dailyPenalty: boolean; accounts: Summary | null; loading: boolean; check: () => void }) {
  const [floor, setFloor] = useState(String(game.challenge.floorCents / 100));
  const [enabled, setEnabled] = useState(game.challenge.enabled);
  const [error, setError] = useState("");
  const changed = enabled !== game.challenge.enabled || Number(floor) !== game.challenge.floorCents / 100;
  return <section className={styles.bufferCard}><div className={styles.panelTitle}><span className={styles.eyebrow}>OPTIONAL SIDE QUEST</span><Pixel kind="heart" size={30} /></div><h2>Guard your safety buffer.</h2><p>Pick a minimum checking balance that feels right for you.</p><form onSubmit={(event) => { event.preventDefault(); try { const amount = readAmount(floor, "Balance floor"); if (amount <= 0) throw new Error("Choose a floor greater than zero."); dispatchGame({ type: "challenge", enabled, floor: amount }); setError(""); } catch (e) { setError(message(e)); } }}><div className={styles.bufferControls}><label><span>MY CHECKING FLOOR</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input type="number" min="0.01" step="0.01" max="1000000000" required value={floor} disabled={loading} onChange={(event) => setFloor(event.target.value)} /></div></label><button className={styles.smallButton} disabled={loading}>Save challenge</button></div><label className={styles.checkbox}><input type="checkbox" checked={enabled} disabled={loading} onChange={(event) => setEnabled(event.target.checked)} /><span>Join weekly buffer and check-in scoring</span></label>{error && <p className={styles.error} role="alert">{error}</p>}</form><div className={styles.bufferStatus}><span>{!game.challenge.enabled ? "Challenge paused" : !accounts ? "Check your balance to see your buffer" : accounts.checkingBalance * 100 >= game.challenge.floorCents ? "Your latest checking balance meets your floor." : "Below your floor. A recovery quest is waiting."}</span><button className={styles.smallButton} disabled={!game.challenge.enabled || loading || changed} onClick={check}>{loading ? "Checking…" : "Check my buffer"}</button></div><details className={styles.details}><summary>How weekly points work</summary><p>A healthy balance check earns 15 XP and 5 tokens once a day. A check below your floor deducts up to 15 weekly points once a day. Miss a daily check-in while enrolled: −10 weekly points, capped at three missed days per week. Scores stop at zero. Lifetime XP and rewards stay yours.</p><p>Balances are checked only when you press the button. We do not monitor your account continuously or penalize unavailable data. Weeks reset on Monday; days follow this device's calendar.</p>{dailyPenalty && <p>Today's below-floor deduction has already been applied. If your balance recovers, you can still earn today's healthy-buffer bonus.</p>}</details></section>;
}

function ExpenseLog({ game, day }: { game: Game; day: string }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Food");
  const [error, setError] = useState("");
  const todayTotal = game.expenses.filter((e) => e.day === day).reduce((sum, e) => sum + e.cents, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const value = readAmount(amount, "Expense");
      if (value <= 0 || label.trim().length < 2) throw new Error("Add a description and an expense greater than zero.");
      const saved = await dispatchGame({ type: "expense", id: crypto.randomUUID(), label, amount: value, category });
      if (saved) { setLabel(""); setAmount(""); }
    } catch (e) { setError(message(e)); }
  }
  return <section className={styles.panel}><div className={styles.panelTitle}><h2>Follow the money</h2><span className={styles.xpTag}>+10 XP / ENTRY</span></div><p className={styles.muted}>The first three entries each day earn XP. Keep logging after that, too.</p><form onSubmit={submit} className={styles.expenseForm}><label><span>What was it?</span><input required minLength={2} maxLength={48} placeholder="e.g. Lunch on campus" value={label} onChange={(event) => setLabel(event.target.value)} /></label><div className={styles.fields}><label><span>Amount (USD)</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input type="number" min="0.01" max="1000000000" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label></div><button className={styles.primaryButton}>Log expense <span>+</span></button>{error && <p role="alert" className={styles.error}>{error}</p>}</form><div className={styles.ledgerHeading}><h3>Your expense trail</h3><span>{money(todayTotal / 100)} today</span></div><p className={styles.muted}>Every expense updates spending and money left in Money quests. Your monthly plan and Nessie balances are separate.</p>{game.expenses.length === 0 ? <div className={styles.empty}><Pixel kind="coin" size={44} /><p>Your trail starts with your first expense.</p></div> : <ul className={styles.expenseList}>{game.expenses.slice(0, 30).map((e) => <li key={e.id}><span><strong>{e.label}</strong><small>{e.category} · {e.day === day ? "Today" : e.day}</small></span><b>{money(e.cents / 100)}</b><button disabled={!!game.money.weeks[weekStart(e.day)]?.closed} title={game.money.weeks[weekStart(e.day)]?.closed ? "This week’s reviewed entries are locked" : undefined} onClick={() => dispatchGame({ type: "deleteExpense", id: e.id })} aria-label={`Remove ${e.label} expense`}>×</button></li>)}</ul>}{game.expenses.length > 30 && <p className={styles.muted}>Showing the 30 most recent entries. {game.expenses.length} stored in this adventure.</p>}</section>;
}

function Rewards({ game }: { game: Game }) {
  return <><RewardCatalog tokens={game.tokens}/><SectionHeading eyebrow="A LITTLE CAMPUS SPIRIT" title="Fresh feathers. New adventures." text="Spend your quest tokens on a new look for Hoki, your little turkey companion." /><div className={styles.rewardBanner}><Pixel kind="coin" size={38} /><strong>{game.tokens} tokens</strong><span>Spend tokens on outfits now. Partner offers below are previews; tokens currently have no cash value.</span></div><section className={styles.shop} aria-label="Character outfits">{OUTFITS.map((outfit) => {
    const owned = game.owned.includes(outfit.id); const equipped = game.outfit === outfit.id;
    return <article key={outfit.id} className={styles.shopCard}><div className={styles.outfitStage} style={{ "--outfit": outfit.color } as CSSProperties}><Scout color={outfit.color} size={115} /><span>{equipped ? "EQUIPPED" : owned ? "IN YOUR COLLECTION" : "HOKI OUTFIT"}</span></div><h2>{outfit.name}</h2><p>{owned ? "Yours to keep." : `${outfit.cost} quest tokens`}</p><button className={styles.smallButton} disabled={equipped || (!owned && game.tokens < outfit.cost)} onClick={() => dispatchGame({ type: "outfit", id: outfit.id })}>{equipped ? "On your adventure" : owned ? "Equip outfit" : game.tokens < outfit.cost ? `${outfit.cost - game.tokens} more tokens needed` : "Unlock & equip"}</button></article>;
  })}</section><div className={styles.sectionHeading}><p className={styles.eyebrow}>HOKIE HOLLOW TREASURES</p><h2>Every checkpoint has a story.</h2></div><section className={styles.checkpointGrid} aria-label="Checkpoint rewards">{CHECKPOINTS.slice(1).map((point, i) => {
    const id = i + 1; const collected = game.claimed.includes(id); const ready = game.xp >= point.xp;
    return <article className={styles.checkpointCard} key={point.name}><Pixel kind={collected ? "flag" : ready ? "chest" : "lock"} size={42} /><small>CHECKPOINT {id + 1} · {point.xp} XP</small><h3>{point.name}</h3><p>+{point.tokens} tokens</p><button className={styles.smallButton} disabled={collected || !ready} onClick={() => dispatchGame({ type: "claim", checkpoint: id })}>{collected ? "Treasure collected" : ready ? "Open treasure" : `${point.xp - game.xp} XP to unlock`}</button></article>;
  })}</section></>;
}

function League({ game, day }: { game: Game; day: string }) {
  const [metric, setMetric] = useState<"score" | "checkins" | "buffers">("score");
  const [name, setName] = useState(game.name);
  const rivals = [
    { name: "Maroon Maven", score: 210, checkins: 6, buffers: 5, color: "#861f41", you: false },
    { name: "Orange Orbit", score: 160, checkins: 5, buffers: 3, color: "#e5751f", you: false },
    { name: "Campus Climber", score: 95, checkins: 3, buffers: 2, color: "#75787b", you: false },
    { name: "Stone Sprout", score: 40, checkins: 2, buffers: 1, color: "#fffdf6", you: false },
    { name: game.name, score: game.weekly.score, checkins: weekCount(game, "checkin", day), buffers: weekCount(game, "buffer", day), color: OUTFITS.find((o) => o.id === game.outfit)!.color, you: true },
  ].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name));
  return <><SectionHeading eyebrow="A FRIENDLY RACE TO BETTER HABITS" title="The Hokie habit league." text="Climb through consistency, curiosity, and protecting your own buffer." /><div className={styles.leagueGrid}><section className={styles.panel}><div className={styles.panelTitle}><h2>Practice league</h2><span className={styles.demoTag}>SAMPLE RIVALS</span></div><p className={styles.muted}>Your score is live on this device. The other four players are examples, not connected users.</p><div className={styles.leagueTabs} role="group" aria-label="Rank players by">{([['score', 'Weekly points'], ['checkins', 'Check-ins'], ['buffers', 'Buffer wins']] as const).map(([id, title]) => <button key={id} aria-pressed={metric === id} className={metric === id ? styles.filterActive : ""} onClick={() => setMetric(id)}>{title}</button>)}</div><table className={styles.leagueTable}><caption className={styles.srOnly}>Practice leaderboard with four fictional rivals, sorted by {metric}</caption><thead><tr><th>RANK</th><th>EXPLORER</th><th>{metric === "score" ? "POINTS" : "DAYS"}</th></tr></thead><tbody>{rivals.map((player) => <tr className={player.you ? styles.youRow : ""} key={player.you ? "you" : player.name}><td>{rivals.findIndex((r) => r[metric] === player[metric]) + 1}</td><td><div><Scout color={player.color} size={40} /><span><strong>{player.name}</strong><small>{player.you ? "YOU · LOCAL PLAYER" : "DEMO RIVAL"}</small></span></div></td><td>{player[metric]}</td></tr>)}</tbody></table><p className={styles.muted}>Week starting {game.weekly.start} · weekly scores reset on Monday. Tied scores share a rank.</p></section><div className={styles.stack}><section className={styles.panel}><Pixel kind="star" size={36} /><h2>Play for the habits.</h2><p>No rankings by income, bank balance, or dollars spent. Daily actions offer up to 105 XP. Weekly tracking and savings milestones add one-time bonuses.</p><ul className={styles.ruleList}><li>Useful actions <b>+10 to +25</b></li><li>Daily spending review <b>+5</b></li><li>Weekly budget <b>+25 / week</b></li><li>Tracking 3 / 5 days <b>+20 / +35</b></li><li>Savings milestones <b>+25 to +100</b></li><li>Healthy buffer check <b>+15</b></li><li>Below-floor check <b>−15 max / day</b></li><li>Missed check-in, if enrolled <b>−10 / day*</b></li></ul><p className={styles.muted}>*At most three missed-day deductions per week. Score never goes below zero. XP, tokens and checkpoint unlocks are permanent.</p><p className={styles.muted}>Open Player account to enter the shared cloud league. These practice scores stay on your device.</p></section><section className={styles.panel}><h2>Your player card</h2><form onSubmit={(event) => { event.preventDefault(); dispatchGame({ type: "name", name }); }}><label><span>Player name</span><input value={name} minLength={2} maxLength={24} required onChange={(event) => setName(event.target.value)} /></label><button className={styles.smallButton}>Save name</button></form></section></div></div></>;
}
