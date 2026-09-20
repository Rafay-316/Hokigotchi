"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO, RESPONSES, readBalances, simulate } from "./engine";
import type { Projection, ResponseId, Setup } from "./engine";
import s from "./chaos.module.css";

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const eta = (n: number | null) => n === null ? "Beyond 12 months" : `Month ${n}`;
const goHome = () => window.location.assign(window.location.protocol === "file:" ? "http://localhost:3000" : "/");

function Hoki({ happy, worried }: { happy: boolean; worried: boolean }) {
  return <svg viewBox="0 0 32 32" shapeRendering="crispEdges" role="img" aria-label={happy ? "Hoki celebrating your decision" : worried ? "Hoki facing a surprise" : "Hoki ready for an adventure"}>
    <path fill="#381722" d="M6 5h4v2h3V3h5v4h4V5h4v5h3v5h2v6h-3v4H5v-3H2v-6H1v-5h3V7h2z"/>
    <path fill="#e5751f" d="M6 7h3v3h3v7H8v-4H5V9h1zM14 5h3v9h-3zM23 7h2v5h2v5h-4zM3 13h3v4h4v4H5v-3H3zM26 18h3v3h-4v3h-4v-4h5z"/>
    <path fill="#ffd58c" d="M6 7h3v2H6zM14 5h3v2h-3zM23 7h2v2h-2z"/>
    <path fill="#381722" d="M13 6h8v2h3v9h2v8h-3v3H10v-3H8v-7h3v-8h2z"/>
    <path fill="#b67a52" d="M13 8h8v2h2v8H12v-7h1zM10 18h14v7H10z"/>
    <path fill="#861f41" d="M13 5h3V3h3v2h2v3h-8zM11 19h9v5h3v2H11z"/>
    <path fill="#fff8e9" d="M14 10h4v6h-4zM20 10h3v6h-3z"/>
    {happy ? <path fill="#381722" d="M14 13h1v-1h2v1h1v2h-1v-1h-2v1h-1zM20 13h1v-1h1v1h1v2h-1v-1h-1v1h-1z"/> : <path fill="#381722" d="M16 12h2v3h-2zM21 12h2v3h-2z"/>}
    <path fill="#e5751f" d="M21 16h7v2h-2v2h-5zM12 28h3v2h2v1H9v-2h3zM21 28h3v2h3v1h-8v-2h2z"/>
    <path fill="#f7c77d" d="M11 18h10v2H11zM16 21h2v3h-2zM18 22h2v2h-2z"/>
    <path fill="#74452f" d="M9 19h3v2h2v3h-4v-2H9z"/>
    {worried && <path fill="#96d4df" d="M27 5h2v3h2v3h-4z"/>}
  </svg>;
}

function Timeline({ baseline, shock, chosen, target }: { baseline: Projection; shock: Projection | null; chosen: Projection | null; target: number }) {
  const x = (month: number) => 54 + month * 48;
  const y = (goal: number) => 211 - goal / target * 161;
  const path = (p: Projection) => p.points.map((point) => `${x(point.month)},${y(point.goal)}`).join(" ");
  return <svg className={s.chart} viewBox="0 0 660 254" role="img" aria-label={`Twelve-month savings comparison. Original goal: ${eta(baseline.goalMonth)}.${shock ? ` Buying new: ${eta(shock.goalMonth)}.` : ""}${chosen ? ` Selected response: ${eta(chosen.goalMonth)}.` : ""}`}>
    {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="54" x2="631" y1={y(target * fraction)} y2={y(target * fraction)} stroke="#dfd1ca" strokeDasharray="4 5"/><text x="43" y={y(target * fraction) + 4} textAnchor="end">{usd(target * fraction)}</text></g>)}
    {[0, 3, 6, 9, 12].map((month) => <text key={month} x={x(month)} y="239" textAnchor="middle">{month === 0 ? "Today" : `M${month}`}</text>)}
    <polyline points={path(baseline)} fill="none" stroke="#487968" strokeWidth="3" strokeDasharray="7 5"/>
    {shock && <polyline points={path(shock)} fill="none" stroke="#be535f" strokeWidth="3"/>}
    {chosen && <polyline points={path(chosen)} fill="none" stroke="#861f41" strokeWidth="5"/>}
    {chosen?.goalMonth !== null && chosen?.goalMonth !== undefined && <g><circle cx={x(chosen.goalMonth)} cy={y(target)} r="7" fill="#e5751f" stroke="#fffdf8" strokeWidth="3"/><text x={x(chosen.goalMonth)} y="30" textAnchor="middle" className={s.chartLabel}>GOAL · M{chosen.goalMonth}</text></g>}
  </svg>;
}

export default function ChaosDemo() {
  const [setup, setSetup] = useState<Setup>({ ...DEMO });
  const [attacked, setAttacked] = useState(false);
  const [choice, setChoice] = useState<ResponseId | null>(null);
  const [source, setSource] = useState("sample");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncedAt, setSyncedAt] = useState("");
  const [drawer, setDrawer] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const original = simulate(setup, 0);
  const shock = simulate(setup, 850);
  const response = RESPONSES.find((item) => item.id === choice);
  const chosen = response ? simulate(setup, response.cost) : null;
  const current = chosen ?? (attacked ? shock : original);
  const savedMonths = chosen?.goalMonth !== null && chosen?.goalMonth !== undefined && shock.goalMonth !== null ? shock.goalMonth - chosen.goalMonth : null;
  async function loadNessie() {
    if (syncing || attacked) return;
    if (window.location.protocol === "file:") {
      setSyncError("This offline copy uses sample balances. Open localhost:3000/chaos inside your app to load Nessie balances.");
      return;
    }
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    setSyncing(true); setSyncError("");
    try {
      const result = await fetch("/api/nessie/accounts", { cache: "no-store", signal: controller.signal });
      if (!result.ok) throw new Error("Could not read the sandbox accounts.");
      const balances = readBalances(await result.json());
      if (!balances) throw new Error("The sandbox balances were not in the expected format.");
      setSetup({ ...DEMO, ...balances }); setSource("nessie");
      setSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSyncError(source === "nessie" ? "Nessie refresh unavailable. Keeping the last loaded sandbox balances." : "Nessie is unavailable. The labeled sample setup is ready to play.");
    } finally { window.clearTimeout(timeout); setSyncing(false); }
  }
  function reset() { setAttacked(false); setChoice(null); }
  return <main className={s.app}>
    <header className={s.header}><button className={s.brand} onClick={goHome} aria-label="Back to Hokigotchi"><span className={s.miniHoki}><Hoki happy={false} worried={false}/></span>Hokigotchi<span className={s.brandDot}>.</span></button><span className={s.headerNote}>LITTLE HOKIE. BIG COMEBACK.</span><button className={s.back} onClick={goHome}>← Your Hoki</button></header>
    <div className={s.shell}>
      <div className={s.breadcrumb}><span>PLAY YOUR FINANCIAL FUTURE</span><span>CHAOS ARENA / ENCOUNTER 01</span></div>
      <section className={`${s.arena} ${attacked && !choice ? s.hit : ""}`}>
        <div className={s.arenaCopy}><span className={s.eyebrow}>{choice ? "A COMEBACK IS A CHOICE" : attacked ? "SURPRISE ENCOUNTER" : "LIFE DOESN’T FOLLOW YOUR BUDGET"}</span><h1>{choice ? <>Different choice.<br/><em>Different future.</em></> : attacked ? <>Your laptop<br/><em>just died.</em></> : <>Practice the plot twist.<br/><em>Protect your future.</em></>}</h1><p>{choice ? "One decision changed the path. Compare the tradeoffs, then try another ending." : attacked ? "An $850 replacement threatens your spring-break plan. The next move is yours." : "Your plan looks good. Then life happens. See how one choice can change the next twelve months."}</p>
          <div className={s.arenaActions}>{!attacked ? <button className={s.chaosButton} disabled={syncing} onClick={() => setAttacked(true)}>⚡ UNLEASH CHAOS <span>→</span></button> : <button className={s.chaosButton} onClick={reset}>↺ REPLAY ENCOUNTER</button>}<span>{choice ? "+100 PRACTICE XP · THIS RUN" : attacked ? "CHOOSE A RESPONSE BELOW ↓" : "1 surprise · 3 choices · your comeback"}</span></div>
        </div>
        <div className={s.scene} aria-hidden="true"><div className={s.sun}/><div className={s.cloudOne}/><div className={s.cloudTwo}/><span className={s.sceneFlag}>{choice ? "COMEBACK!" : attacked ? "UH-OH!" : "READY, HOKI?"}</span><div className={`${s.bigHoki} ${choice ? s.happyHoki : ""}`}><Hoki happy={!!choice} worried={attacked && !choice}/></div><div className={s.platform}/><div className={s.sceneScore}><span>RESILIENCE</span><b>{current.score}<small>/100</small></b></div></div>
      </section>
      <section className={s.sourceStrip} aria-label="Banking data source"><div><span className={source === "nessie" ? s.liveDot : s.demoDot}/><strong>{source === "nessie" ? "Nessie sandbox balances" : "Sample banking world"}</strong><span>{source === "nessie" ? `Loaded ${syncedAt} · simulated funds` : "Fixed demo balances · not a live sync"}</span></div><div><button disabled={syncing || attacked} onClick={() => void loadNessie()}>{syncing ? "Reading Nessie…" : "↻ Use Nessie balances"}</button><button onClick={() => setDrawer(!drawer)} aria-expanded={drawer}>{drawer ? "Hide" : "View"} data sources</button></div></section>
      {syncError && <p className={s.syncMessage} role="status">{syncError}</p>}
      {drawer && <section className={s.drawer}><h2>What powers this encounter?</h2><div><p><b>{source === "nessie" ? "Nessie accounts · loaded" : "Sample accounts · fixed fixture"}</b><br/>Checking {usd(setup.checking)} · savings {usd(setup.savings)}{source === "nessie" && <><br/>GET /api/nessie/accounts · successful at {syncedAt}</>}</p><p><b>Scenario assumptions · preset</b><br/>Income {usd(setup.income)}/month · expenses {usd(setup.expenses)}/month<br/>Reserve floor {usd(setup.floor)} · travel goal {usd(setup.target)}</p><p><b>Projection · calculated in this page</b><br/>12 monthly steps; no AI-generated balances.<br/>No purchases, bills or deposits feed is loaded by this demo.</p></div></section>}
      <section className={s.stats} aria-label="Scenario results" aria-live="polite">
        <div><span>TOTAL CASH · AFTER CHOICE</span><strong>{usd(current.cashNow)}</strong><small>{attacked ? `${usd(original.cashNow)} before the surprise` : "Checking + reserve + goal funds"}</small></div>
        <div><span>EMERGENCY RESERVE</span><strong className={current.reserveNow < setup.floor ? s.danger : undefined}>{usd(current.reserveNow)}</strong><small>{usd(setup.floor)} protected target</small></div>
        <div><span>SPRING-BREAK GOAL</span><strong>{eta(current.goalMonth)}</strong><small>{usd(setup.target)} funded after restoring reserve</small></div>
        <div><span>LEARNING RESILIENCE</span><strong>{current.score}<i>/100</i></strong><small>{attacked ? `${original.score} before the surprise` : "Reserve coverage + monthly surplus"}</small></div>
      </section>
      {attacked && <section className={s.responses}><div className={s.sectionTitle}><div><span className={s.eyebrow}>ASK A JUDGE TO PICK</span><h2>How will you write the comeback?</h2></div><span>Try any path. Your actual game stays untouched.</span></div><div className={s.choiceGrid}>{RESPONSES.map((item, index) => {
        const projection = simulate(setup, item.cost);
        return <button className={`${s.choice} ${choice === item.id ? s.selected : ""}`} key={item.id} aria-pressed={choice === item.id} onClick={() => setChoice(item.id)}><span className={s.choiceTag}>{String.fromCharCode(65 + index)} / {item.tag}</span><div><h3>{item.name}</h3><b>{usd(item.cost)}</b></div><p>{item.detail}</p><span className={s.choiceFooter}>Goal: {eta(projection.goalMonth)} <strong>{choice === item.id ? "SELECTED ✓" : "PLAY THIS PATH ↗"}</strong></span></button>;
      })}</div></section>}
      {chosen && response && <div className={s.comeback} role="status"><span className={s.badge}>★</span><div><strong>{savedMonths !== null && savedMonths > 0 ? `${savedMonths} month${savedMonths === 1 ? "" : "s"} back on your side.` : "You explored the tradeoff."}</strong><p>{response.cost < 850 ? `${usd(850 - response.cost)} less upfront than buying new. ` : "You prioritized an immediate replacement. "}{response.assumption}</p></div><b>+100<br/><small>PRACTICE XP</small></b></div>}
      <div className={s.lowerGrid}>
        <section className={s.panel}><div className={s.sectionTitle}><div><span className={s.eyebrow}>SAME START. DIFFERENT ENDINGS.</span><h2>Your spring-break futures</h2></div><span className={s.pill}>12 MONTHS</span></div><p className={s.subtitle}>Monthly surplus restores your safety reserve first, then builds your travel fund.</p><Timeline baseline={original} shock={attacked ? shock : null} chosen={chosen} target={setup.target}/><div className={s.legend}><span><i className={s.originalLine}/>Original plan · {eta(original.goalMonth)}</span>{attacked && <span><i className={s.shockLine}/>Buy new · {eta(shock.goalMonth)}</span>}{chosen && <span><i className={s.chosenLine}/>Your choice · {eta(chosen.goalMonth)}</span>}</div></section>
        <section className={s.panel}><div className={s.sectionTitle}><div><span className={s.eyebrow}>FOUR WAYS TO THINK</span><h2>Hoki’s decision council</h2></div></div><p className={s.subtitle}>Rule-based preview · explanations follow the calculations.</p><div className={s.council}>
          <div><span><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z"/></svg></span><p><b>Guardian</b>{current.reserveNow >= setup.floor ? `Your ${usd(setup.floor)} reserve target is covered.` : `${usd(setup.floor - current.reserveNow)} is needed to rebuild your reserve.`}</p></div>
          <div><span>↗</span><p><b>Builder</b>{current.goalMonth !== null ? `Your ${usd(setup.target)} goal is projected for month ${current.goalMonth}.` : "This plan does not fund the goal within twelve months."}</p></div>
          <div><span>✦</span><p><b>Life</b>{choice === "repair" ? "Repair could save money, if downtime works for your classes." : choice === "refurb" ? "A lower price helps, if the device meets your course needs." : "Your coursework matters too. Cost is one part of this decision."}</p></div>
          <div><span>▤</span><p><b>Bills</b>{usd(setup.income)} income − {usd(setup.expenses)} expenses = {usd(current.surplus)}/month, under this scenario’s assumptions.</p></div>
        </div></section>
      </div>
      <details className={s.assumptions}><summary>Scenario rules & what is simulated</summary><p>This is a replayable learning demo. Balances are sample data unless you load the configured Nessie sandbox. Income, expenses, goal, reserve floor and response costs are preset assumptions. Surprise costs use savings first, then checking. Monthly surplus clears any checking shortfall, restores the reserve, then funds the goal; remaining surplus goes to reserves. Goal funds stay included in total cash. No interest, inflation, fees or actual payments are modeled.</p><p>Resilience is a demo learning score: 50 points for reserve coverage (capped at your target), plus 50 for a monthly surplus equal to 25% of expenses (also capped). An immediate checking shortfall sets it to zero. It is not a credit score. Practice XP is a one-time display within this encounter, resets on replay, and never changes cloud XP, rewards, rankings or accounts. Council explanations are rule-based, not a live AI service.</p><div><button disabled={syncing} onClick={() => { setSetup({ ...DEMO }); setSource("sample"); setSyncError(""); setSyncedAt(""); reset(); }}>Restore the original sample setup</button></div></details>
      <footer className={s.footer}><b>Hokigotchi.</b><span>Practice the surprise. Find your comeback.</span><span>READ-ONLY LEARNING SIMULATION</span></footer>
    </div>
  </main>;
}
