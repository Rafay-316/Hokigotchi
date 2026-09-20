"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { calculateBudget } from "@/lib/budget";
import type { compareBudgets } from "@/lib/compare-budgets";
import styles from "./fork-dashboard.module.css";

type Budget = {
  monthlyIncome: number;
  fixedExpenses: number;
  foodExpenses: number;
  otherExpenses: number;
  goalTarget: number;
  goalSaved: number;
};
type Draft = Record<keyof Budget, string>;
type Result = ReturnType<typeof calculateBudget>;
type Comparison = ReturnType<typeof compareBudgets>;
type Summary = {
  checkingBalance: number;
  savingsBalance: number;
  totalCashBalance: number;
};
type ChangeField = "monthlyIncome" | "fixedExpenses" | "foodExpenses" | "otherExpenses";

const INITIAL: Budget = {
  monthlyIncome: 1450, fixedExpenses: 730, foodExpenses: 310,
  otherExpenses: 200, goalTarget: 700, goalSaved: 0,
};
const FIELDS: { key: keyof Budget; label: string; hint: string }[] = [
  { key: "monthlyIncome", label: "Monthly income", hint: "Take-home pay and regular income" },
  { key: "fixedExpenses", label: "Fixed expenses", hint: "Rent, utilities, and subscriptions" },
  { key: "foodExpenses", label: "Food & groceries", hint: "Your total monthly food budget" },
  { key: "otherExpenses", label: "Other expenses", hint: "Transport, shopping, and everything else" },
  { key: "goalTarget", label: "Savings goal", hint: "The total you want to set aside" },
  { key: "goalSaved", label: "Already saved for this goal", hint: "Only money assigned to this goal" },
];
const CHANGE_FIELDS = FIELDS.slice(0, 4);
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (amount: number) => dollars.format(amount);
const months = (value: number | null) => value === null
  ? "No monthly surplus" : value === 0 ? "Already funded" : `${value} month${value === 1 ? "" : "s"}`;
const toDraft = (budget: Budget): Draft => ({
  monthlyIncome: String(budget.monthlyIncome), fixedExpenses: String(budget.fixedExpenses),
  foodExpenses: String(budget.foodExpenses), otherExpenses: String(budget.otherExpenses),
  goalTarget: String(budget.goalTarget), goalSaved: String(budget.goalSaved),
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isMonth = (value: unknown) => value === null || (isNumber(value) && Number.isSafeInteger(value) && value >= 0);

function isResult(value: unknown): value is Result {
  if (!isRecord(value) || !isRecord(value.goal)) return false;
  return value.currency === "USD" && isNumber(value.monthlyIncome) &&
    isNumber(value.monthlyExpenses) && isNumber(value.monthlySurplus) &&
    ["surplus", "balanced", "deficit"].includes(String(value.budgetStatus)) &&
    isNumber(value.goal.target) && isNumber(value.goal.saved) &&
    isNumber(value.goal.remaining) && isMonth(value.goal.monthsToGoal) &&
    typeof value.assumption === "string";
}

function isSummary(value: unknown): value is Summary {
  return isRecord(value) && isNumber(value.checkingBalance) &&
    isNumber(value.savingsBalance) && isNumber(value.totalCashBalance);
}

function isComparison(value: unknown): value is Comparison {
  if (!isRecord(value) || !isRecord(value.comparison)) return false;
  const change = value.comparison;
  return isResult(value.baseline) && isResult(value.scenario) &&
    isNumber(change.monthlySurplusChange) &&
    (change.monthsSaved === null || (isNumber(change.monthsSaved) && Number.isSafeInteger(change.monthsSaved))) &&
    ["faster", "slower", "unchanged", "still_unreachable", "became_reachable", "became_unreachable"]
      .includes(String(change.timelineChange));
}

async function api(path: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(path, {
    ...options, cache: "no-store",
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });
  const data: unknown = await response.json();
  if (!response.ok || !isRecord(data) || data.success !== true) {
    throw new Error(isRecord(data) && typeof data.error === "string"
      ? data.error : "We couldn't complete that request. Please try again.");
  }
  return data;
}

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal,
});

function readAmount(value: string, label: string) {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000 ||
    Math.round(amount * 100) / 100 !== amount) {
    throw new Error(`${label}: enter a nonnegative amount with up to two decimal places.`);
  }
  return amount;
}

function message(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "That took too long. Please try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function Icon({ name }: { name: "fork" | "grid" | "sliders" | "arrow" | "wallet" | "refresh" }) {
  const paths = {
    fork: "M6 20V12Q6 8 10 8H18M14 4L18 8L14 12M6 12Q6 16 10 16H18M14 12L18 16L14 20",
    grid: "M4 4H10V10H4ZM14 4H20V10H14ZM4 14H10V20H4ZM14 14H20V20H14Z",
    sliders: "M4 7H9M13 7H20M4 17H13M17 17H20M9 4V10M13 14V20",
    arrow: "M5 12H19M13 6L19 12L13 18",
    wallet: "M20 8V5H5Q3 5 3 7V18Q3 20 5 20H20V8H5Q3 8 3 6M20 12H15V16H20",
    refresh: "M20 7V3M20 7H16M20 7A8 8 0 1 0 20 16",
  };
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function comparisonTitle(result: Comparison) {
  const { monthsSaved, timelineChange } = result.comparison;
  if (timelineChange === "became_reachable") return "Your goal has a path forward.";
  if (timelineChange === "became_unreachable") return "This path pauses your goal.";
  if (timelineChange === "still_unreachable") return "Your goal needs a monthly surplus.";
  if (monthsSaved === 0) return "Same goal timeline. A different budget.";
  return `${Math.abs(monthsSaved ?? 0)} month${Math.abs(monthsSaved ?? 0) === 1 ? "" : "s"} ${
    (monthsSaved ?? 0) > 0 ? "closer to your goal." : "longer to reach your goal."}`;
}

export default function ForkDashboard() {
  const [active, setActive] = useState("overview");
  const [accounts, setAccounts] = useState<Summary | null>(null);
  const [accountError, setAccountError] = useState("");
  const [accountLoading, setAccountLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => toDraft(INITIAL));
  const [applied, setApplied] = useState<Budget>(INITIAL);
  const [budget, setBudget] = useState<Result | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [budgetError, setBudgetError] = useState("");
  const [changeField, setChangeField] = useState<ChangeField>("otherExpenses");
  const [changeAmount, setChangeAmount] = useState("0");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const budgetRequest = useRef<AbortController | null>(null);
  const comparisonRequest = useRef<AbortController | null>(null);
  const dirty = FIELDS.some(({ key }) => draft[key].trim() === "" || Number(draft[key]) !== applied[key]);
  const goalPercent = budget && budget.goal.target > 0
    ? Math.min(100, Math.round((budget.goal.saved / budget.goal.target) * 100)) : 0;

  useEffect(() => {
    const controller = new AbortController();
    api("/api/nessie/accounts", { signal: controller.signal }).then((data) => {
      if (!isSummary(data.summary)) throw new Error("Unexpected account response.");
      if (!controller.signal.aborted) setAccounts(data.summary);
    }).catch(() => {
      if (!controller.signal.aborted) setAccountError("Balances are unavailable. Refresh to try again.");
    }).finally(() => {
      if (!controller.signal.aborted) setAccountLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    budgetRequest.current = controller;
    api("/api/budget", post(INITIAL, controller.signal)).then((data) => {
      if (!isResult(data)) throw new Error("Unexpected budget response.");
      if (!controller.signal.aborted) setBudget(data);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setBudgetError(message(error));
    }).finally(() => {
      if (!controller.signal.aborted) setBudgetLoading(false);
    });
    return () => {
      controller.abort();
      budgetRequest.current?.abort();
      comparisonRequest.current?.abort();
    };
  }, []);

  function clearComparison() {
    comparisonRequest.current?.abort();
    setComparison(null);
    setComparisonError("");
    setComparisonLoading(false);
  }

  async function updateBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearComparison();
    setBudgetError("");
    const controller = new AbortController();
    budgetRequest.current?.abort();
    budgetRequest.current = controller;
    try {
      const next = Object.fromEntries(FIELDS.map(({ key, label }) =>
        [key, readAmount(draft[key], label)])) as Budget;
      setBudgetLoading(true);
      const data = await api("/api/budget", post(next, controller.signal));
      if (!isResult(data)) throw new Error("Unexpected budget response.");
      if (!controller.signal.aborted) {
        setBudget(data);
        setApplied(next);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) setBudgetError(message(error));
    } finally {
      if (!controller.signal.aborted) setBudgetLoading(false);
    }
  }

  async function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty || !budget || budgetLoading) return;
    clearComparison();
    const controller = new AbortController();
    comparisonRequest.current = controller;
    try {
      const amount = readAmount(changeAmount, "New monthly amount");
      setComparisonLoading(true);
      const data = await api("/api/budget/compare", post({
        baseline: applied, changes: { [changeField]: amount },
      }, controller.signal));
      if (!isComparison(data)) throw new Error("Unexpected comparison response.");
      if (!controller.signal.aborted) setComparison(data);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setComparisonError(message(error));
    } finally {
      if (!controller.signal.aborted) setComparisonLoading(false);
    }
  }

  return (
    <div className={styles.app}>
      <a className={styles.skip} href="#main">Skip to dashboard</a>
      <aside className={styles.sidebar}>
        <a href="#overview" className={styles.brand} aria-label="FORK overview"><span><Icon name="fork" /></span>FORK<span className={styles.brandDot}>.</span></a>
        <div className={styles.navLabel}>YOUR PLAYGROUND</div>
        <nav aria-label="Dashboard sections">
          {([
            ["overview", "Overview", "grid"],
            ["budget-plan", "Your budget", "wallet"],
            ["what-if", "What-if lab", "sliders"],
          ] as const).map(([id, label, icon]) => (
            <a key={id} href={`#${id}`} onClick={() => setActive(id)} className={active === id ? styles.activeNav : ""}>
              <Icon name={icon} />{label}{id === "what-if" && <span className={styles.newTag}>TRY IT</span>}
            </a>
          ))}
        </nav>
        <div className={styles.sidebarNote}><Icon name="fork" /><h2>One choice.<br />A new direction.</h2><p>Explore the possibilities before you make your next move.</p><a href="#what-if" onClick={() => setActive("what-if")}>Try a what-if <Icon name="arrow" /></a></div>
        <div className={styles.profile}><span>F</span><div><strong>Your workspace</strong><small>Practice mode</small></div><i aria-hidden="true" /></div>
      </aside>

      <main id="main" className={styles.main}>
        <header className={styles.topbar}><span>YOUR WORKSPACE <b>/</b> OVERVIEW</span><span className={styles.sandbox}><i aria-hidden="true" />Nessie sandbox · USD</span></header>
        <section id="overview" className={styles.hero}>
          <div><p className={styles.eyebrow}>YOUR MONEY. YOUR NEXT MOVE.</p><h1>Small choices.<br /><span>Different futures.</span></h1><p>A little clarity today. More possibilities tomorrow.</p></div>
          <a className={styles.heroLink} href="#what-if" onClick={() => setActive("what-if")}><span>WHERE COULD YOU GO?</span><strong>Explore a different path</strong><Icon name="arrow" /></a>
        </section>

        <section aria-label="Simulated account balances" className={styles.balances} aria-busy={accountLoading}>
          <article className={styles.totalCard}><div><span>TOTAL CASH BALANCE</span><Icon name="wallet" /></div><strong>{accounts ? money(accounts.totalCashBalance) : "—"}</strong><small>{accountLoading ? "Loading your accounts…" : accounts ? "Checking + savings · simulated funds" : "Balance unavailable"}</small></article>
          {([
            ["Checking", "Day-to-day funds", accounts?.checkingBalance],
            ["Savings", "Room for tomorrow", accounts?.savingsBalance],
          ] as const).map(([label, subtitle, amount]) => <article className={styles.accountCard} key={label}><span className={styles.accountLabel}><i aria-hidden="true" />{label}</span><strong>{amount === undefined ? "—" : money(amount)}</strong><small>{subtitle}</small></article>)}
        </section>
        <div className={styles.balanceFooter}><span>{accountError ? <span role="alert" className={styles.errorText}>{accountError}</span> : "Simulated balances supplied by Capital One Nessie."}</span><button type="button" disabled={accountLoading} onClick={() => { setAccounts(null); setAccountError(""); setAccountLoading(true); setRefresh((value) => value + 1); }}><Icon name="refresh" />{accountLoading ? "Loading…" : "Refresh balances"}</button></div>

        <div className={styles.workspace}>
          <section id="budget-plan" className={styles.panel}>
            <div className={styles.panelHeader}><div><p className={styles.eyebrow}>01 / THE STARTING POINT</p><h2>Your monthly plan</h2></div><span className={styles.pill}>USD / month</span></div>
            <p className={styles.description}>Start with the example amounts, then make them yours.</p>
            <form onSubmit={updateBudget}>
              <fieldset disabled={budgetLoading} className={styles.fields}>
                <legend className={styles.srOnly}>Monthly budget and savings goal</legend>
                {FIELDS.map(({ key, label, hint }) => <label key={key}><span>{label}</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input name={key} type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" required value={draft[key]} aria-describedby={`${key}-hint`} onChange={(event) => { setDraft((current) => ({ ...current, [key]: event.target.value })); clearComparison(); setBudgetError(""); }} /></div><small id={`${key}-hint`}>{hint}</small></label>)}
              </fieldset>
              <div className={styles.formFooter}><span aria-live="polite">{dirty ? "Changes ready to calculate" : "Scenario amounts · reset on reload"}</span><button className={styles.primaryButton} disabled={budgetLoading}>{budgetLoading ? "Calculating…" : "Calculate plan"}<Icon name="arrow" /></button></div>
              {budgetError && <p className={styles.error} role="alert">{budgetError}</p>}
            </form>
            <div className={styles.budgetResult} aria-live="polite" aria-busy={budgetLoading}>
              <div><span>{budget && budget.monthlySurplus < 0 ? "MONTHLY SHORTFALL" : "LEFT EACH MONTH"}</span><strong className={budget && budget.monthlySurplus < 0 ? styles.negative : ""}>{budget ? money(Math.abs(budget.monthlySurplus)) : "—"}</strong></div>
              <div><span>MONTHLY EXPENSES</span><strong>{budget ? money(budget.monthlyExpenses) : "—"}</strong></div>
              <p>{budgetLoading ? "Updating your plan…" : dirty ? "Showing your last calculated plan. Calculate again to apply changes." : !budget ? "Enter your amounts and calculate a plan." : budget.budgetStatus === "deficit" ? "Expenses exceed income. Adjust your plan to make room for saving." : budget?.budgetStatus === "balanced" ? "Income covers expenses, with nothing left for this goal." : "Your positive surplus can go toward your savings goal."}</p>
            </div>
          </section>

          <div className={styles.rightColumn}>
            <section className={styles.goalCard} aria-label="Savings goal progress">
              <div className={styles.goalHeader}><span className={styles.eyebrow}>SOMETHING TO WORK TOWARD</span><span className={styles.goalSymbol} aria-hidden="true">↗</span></div>
              <div className={styles.goalHeading}><h2>Your savings goal</h2><strong>{budget ? money(budget.goal.target) : "—"}</strong></div>
              <div className={styles.goalAmounts}><span>{budget ? `${money(budget.goal.saved)} already assigned` : "Calculate a plan to begin"}</span><span>{goalPercent}%</span></div>
              <progress max="100" value={goalPercent} aria-label="Savings goal funded" />
              <div className={styles.goalTimeline}><span>Estimated time to goal</span><strong>{budget ? months(budget.goal.monthsToGoal) : "—"}</strong></div>
              <p>{dirty ? "Based on your last calculated plan. " : ""}Goal savings are entered separately from your Nessie balances.</p>
            </section>

            <section id="what-if" className={styles.panel}>
              <div className={styles.panelHeader}><div><p className={styles.eyebrow}>02 / TAKE ANOTHER PATH</p><h2>What if…</h2></div><span className={styles.labIcon}><Icon name="sliders" /></span></div>
              <p className={styles.description}>Change one amount. See what it means for your goal.</p>
              <form onSubmit={runComparison}>
                <fieldset disabled={dirty || budgetLoading || !budget || comparisonLoading} className={styles.scenarioFields}>
                  <legend className={styles.srOnly}>What-if scenario</legend>
                  <label><span>I change</span><select value={changeField} onChange={(event) => { setChangeField(event.target.value as ChangeField); clearComparison(); }}>{CHANGE_FIELDS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label><span>To this monthly amount</span><div className={styles.moneyInput}><span aria-hidden="true">$</span><input name="scenarioAmount" type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" required value={changeAmount} onChange={(event) => { setChangeAmount(event.target.value); clearComparison(); }} /></div></label>
                </fieldset>
                <p className={styles.currentAmount}>{dirty ? "Calculate your updated plan before comparing." : `Currently ${money(applied[changeField])} per month. The savings goal stays the same.`}</p>
                <button className={styles.compareButton} disabled={dirty || budgetLoading || !budget || comparisonLoading}>{comparisonLoading ? "Comparing paths…" : "Compare paths"}<Icon name="fork" /></button>
                {comparisonError && <p className={styles.error} role="alert">{comparisonError}</p>}
              </form>
              <div className={styles.comparison} aria-live="polite" aria-busy={comparisonLoading}>
                {comparison ? <>
                  <div className={styles.comparisonHeading}><span className={styles.eyebrow}>YOUR ALTERNATE FUTURE</span><h3>{comparisonTitle(comparison)}</h3></div>
                  <div className={styles.paths}>
                    {([["Current path", comparison.baseline], ["What-if path", comparison.scenario]] as const).map(([label, result]) => <div key={label}><span>{label}</span><strong className={result.monthlySurplus < 0 ? styles.negative : ""}>{money(result.monthlySurplus)}</strong><small>left / month</small><b>{months(result.goal.monthsToGoal)}</b></div>)}
                  </div>
                  <p className={styles.changeNote}>{money(Math.abs(comparison.comparison.monthlySurplusChange))} {comparison.comparison.monthlySurplusChange >= 0 ? "more" : "less"} left per month in this scenario.</p>
                </> : <div className={styles.emptyComparison}><Icon name="fork" /><div><strong>Your next move starts here.</strong><p>Try changing other expenses from $200 to $0 in the example plan.</p></div></div>}
              </div>
            </section>
          </div>
        </div>
        <footer className={styles.footer}><span className={styles.footerBrand}>FORK.</span><p>Projections assume constant income and expenses, with all positive surplus saved at month end. No interest or withdrawals. Plans are not saved between reloads.</p><span>EXPLORE. LEARN. REPEAT.</span></footer>
      </main>
    </div>
  );
}
