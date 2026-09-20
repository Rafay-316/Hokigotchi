"use client";
import { useEffect, useState } from "react";
import { cloudClient, cloudRequest } from "./cloud-client";
import { dispatchCloud, dispatchGame, playCloud, playPractice, practiceGame, refreshCloud, restorePracticeBackup, retryCloudAction, savePracticeBackup, useAdventure } from "./fork-game-store";
import { Pixel } from "./fork-pixels";
import styles from "./fork-quest.module.css";

export function CloudStatus() {
  const state = useAdventure();
  if (!state || state.mode !== "cloud") return null;
  return <div className={styles.cloudStatus} role="status"><span>{state.busy ? "Saving your move…" : state.pending ? "A save needs confirmation." : state.status === "loading" ? "Loading your cloud adventure…" : state.status === "error" ? "Cloud connection needs attention." : "Cloud adventure · Eastern Time · self-reported money habits"}</span><div>
    {state.pending && <button className={styles.smallButton} disabled={state.busy} onClick={() => void retryCloudAction()}>Retry pending save</button>}
    <button className={styles.smallButton} disabled={state.busy} onClick={() => void refreshCloud()}>Refresh cloud</button>
    <button className={styles.textButton} disabled={state.busy} onClick={playPractice}>Play practice</button>
  </div></div>;
}

export default function CloudAccount() {
  const state = useAdventure();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  useEffect(() => { if (cooldown) { const timer = setTimeout(() => setCooldown(false), 60000); return () => clearTimeout(timer); } }, [cooldown]);
  if (!state) return null;
  const disabled = busy || state.busy;
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await task(); setMessage(success); } catch (e) { setError(e instanceof Error ? e.message : "Try again."); }
    finally { setBusy(false); }
  }
  return <>
    <div className={styles.sectionHeading}><p className={styles.eyebrow}>ONE HOKI. MORE PLACES TO GROW.</p><h1>Your player account.</h1><p>Save a cloud adventure and join a friendly weekly league.</p></div>
    <div className={styles.twoColumns}>
      <section className={styles.panel}>
        {!state.account ? <>
          <Pixel kind="flag" size={34}/><h2>Bring Hoki along.</h2>
          <p className={styles.muted}>Sign in or create an account with an email code. Your existing practice Hoki stays on this device. Cloud play starts a fresh adventure with server-scored quests.</p>
          {!state.configured && <p className={styles.error}>Cloud setup is not complete. Follow CLOUD-SETUP.md, then restart the app. You can keep playing in practice mode.</p>}
          <form onSubmit={(event) => { event.preventDefault(); void run(async () => {
            const client = cloudClient(); if (!client) throw new Error("Cloud play is not configured.");
            const address = email.trim();
            const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
            if (error) throw error;
            setSentTo(address); setCode(""); setCooldown(true);
          }, "Check your email for your sign-in code."); }}>
            <label><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} disabled={disabled} onChange={(e) => setEmail(e.target.value)}/></label>
            <button className={styles.primaryButton} disabled={disabled || cooldown || !state.configured}>{cooldown ? "Wait a minute to resend" : sentTo ? "Send another code" : "Send sign-in code"}</button>
          </form>
          {sentTo && <form onSubmit={(event) => { event.preventDefault(); void run(async () => {
            const client = cloudClient(); if (!client) throw new Error("Cloud play is not configured.");
            const { error } = await client.auth.verifyOtp({ email: sentTo, token: code.trim(), type: "email" });
            if (error) throw error;
            setCode("");
          }, "Signed in. Loading your cloud adventure."); }}><label><span>Code sent to {sentTo}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} disabled={disabled} onChange={(e) => setCode(e.target.value)}/></label><button className={styles.yellowButton} disabled={disabled}>Verify & enter</button></form>}
        </> : <>
          <h2>You’re signed in.</h2><p className={styles.muted}>{state.account.email}</p>
          <p>Active adventure: <strong>{state.mode === "cloud" ? "Cloud Hoki" : "Device practice Hoki"}</strong></p>
          <div className={styles.cloudButtons}><button className={styles.primaryButton} disabled={disabled || state.mode === "cloud"} onClick={playCloud}>Play cloud adventure</button><button className={styles.smallButton} disabled={disabled || state.mode === "practice"} onClick={playPractice}>Play device adventure</button></div>
          <p className={styles.muted}>Cloud play needs a connection. Only confirmed actions change your score. Practice progress never replaces your cloud game.</p>
          <button className={styles.textButton} disabled={disabled} onClick={() => void run(async () => { const result = await cloudClient()!.auth.signOut({ scope: "local" }); if (result.error) throw result.error; }, "Signed out on this device.")}>Sign out on this device</button>
        </>}
        {message && <p role="status" className={styles.cloudMessage}>{message}</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </section>
      <div className={styles.stack}>
        <section className={styles.panel}><h2>A league you choose to join.</h2><p className={styles.muted}>Rank by weekly points, days logging expenses, or daily check-ins. Other signed-in players see your chosen name and those scores. Your email, expenses, goals, and balances stay private.</p>
          {state.account && state.mode === "cloud" ? <>
            <PlayerName key={`${state.account.id}-${state.game.name}`} name={state.game.name} disabled={disabled || state.pending || state.status !== "ready"}/>
            <button className={styles.yellowButton} disabled={disabled || state.pending || state.status !== "ready"} onClick={() => dispatchCloud({ type: "visibility", listed: !state.listed })}>{state.listed ? "Leave the shared leaderboard" : "Join the shared leaderboard"}</button>
            <p className={styles.muted}>{state.listed ? "Your player card is visible in the league." : "Your cloud adventure is private."} You can change this at any time.</p>
          </> : <p>Enter your cloud adventure to choose a name and join.</p>}
        </section>
        {state.account && <section className={styles.panel}><h2>Keep your practice Hoki, too.</h2><p className={styles.muted}>Save a private copy of this device’s practice adventure. Backups include its budget and expense log. They cannot earn shared leaderboard points.</p>
          <button className={styles.smallButton} disabled={disabled} onClick={() => void run(savePracticeBackup, "Practice backup saved to your account. Your cloud game was unchanged.")}>Back up device adventure</button>
          {state.mode === "cloud" && <button className={styles.textButton} disabled={disabled || state.pending || state.status !== "ready"} onClick={() => {
            try { const plan = practiceGame().plan; if (!plan) throw new Error("Save a monthly plan in practice mode first."); dispatchGame({ type: "plan", plan }); }
            catch (e) { setError(e instanceof Error ? e.message : "Plan unavailable."); }
          }}>Copy my practice monthly plan to cloud</button>}
          <label className={styles.checkbox}><input type="checkbox" checked={confirmRestore} disabled={disabled} onChange={(e) => setConfirmRestore(e.target.checked)}/><span>Replace this device’s practice adventure with my saved backup.</span></label>
          <button className={styles.smallButton} disabled={disabled || !confirmRestore} onClick={() => void run(restorePracticeBackup, "Practice adventure restored. Its previous device save was kept as a recovery copy.")}>Restore practice backup</button>
        </section>}
      </div>
    </div>
  </>;
}
function PlayerName({ name: initial, disabled }: { name: string; disabled: boolean }) {
  const [name, setName] = useState(initial);
  return <form onSubmit={(e) => { e.preventDefault(); dispatchGame({ type: "name", name }); }}><label><span>Player name · choose a nickname</span><input required minLength={2} maxLength={24} value={name} disabled={disabled} onChange={(e) => setName(e.target.value)}/></label><button className={styles.smallButton} disabled={disabled}>Save player name</button></form>;
}

type LeagueRow = { position: number; player_name: string; score: number; logging_days: number; checkins: number; is_you: boolean };
export function SharedLeague({ openAccount }: { openAccount: () => void }) {
  const state = useAdventure();
  const [metric, setMetric] = useState<"score" | "logging" | "checkins">("score");
  const [result, setResult] = useState<{ rows: LeagueRow[]; day: string } | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const user = state?.account?.id;
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    cloudRequest<{ rows: LeagueRow[]; day: string }>(`leaderboard?metric=${metric}`, {}, user)
      .then((data) => { if (!cancelled) { setResult(data); setError(""); } })
      .catch((e) => { if (!cancelled) { setResult(null); setError(e instanceof Error ? e.message : "Leaderboard unavailable."); } });
    const timer = setTimeout(() => setRefresh((r) => r + 1), 60000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user, metric, refresh, state?.listed, state?.revision]);
  return <><div className={styles.sectionHeading}><p className={styles.eyebrow}>BETTER HABITS, TOGETHER</p><h1>The Hokie habit league.</h1><p>Actual opted-in players. A fresh race each Monday, Eastern Time.</p></div>
    <section className={styles.panel}><div className={styles.panelTitle}><h2>This week’s explorers</h2><button className={styles.smallButton} onClick={() => { setResult(null); setRefresh((r) => r + 1); }}>Refresh rankings</button></div>
      <p className={styles.muted}>Self-reported habits, scored by the server. These points do not establish eligibility for cash or partner offers.</p>
      {!state?.listed && <p className={styles.cloudMessage}>You are playing privately. <button className={styles.textButton} onClick={openAccount}>Choose a name and join →</button></p>}
      <div className={styles.leagueTabs} role="group" aria-label="Rank players by">{([["score", "Weekly points"], ["logging", "Expense logging days"], ["checkins", "Check-in days"]] as const).map(([key, label]) => <button key={key} aria-pressed={metric === key} className={metric === key ? styles.filterActive : ""} onClick={() => { setResult(null); setMetric(key); }}>{label}</button>)}</div>
      {error ? <p role="alert" className={styles.error}>{error}</p> : !result ? <p role="status">Loading rankings…</p> : !result.rows.length ? <p className={styles.cloudMessage}>The trail is quiet. Be the first explorer to join this week’s league.</p> : <div className={styles.cloudTable}><table className={styles.leagueTable}><caption className={styles.srOnly}>Shared leaderboard, {metric}, as of {result.day}</caption><thead><tr><th>RANK</th><th>EXPLORER</th><th>{metric === "score" ? "POINTS" : "DAYS"}</th></tr></thead><tbody>{result.rows.map((row, index) => <tr key={index} className={row.is_you ? styles.youRow : ""}><td>{row.position}</td><td><strong>{row.player_name}</strong>{row.is_you && <small> · YOU</small>}</td><td>{metric === "logging" ? row.logging_days : row[metric]}</td></tr>)}</tbody></table></div>}
      <p className={styles.muted}>Top 50 players, plus your position if you’re ranked below them. Ties share a rank. No rankings by bank balance or dollars saved.</p>
    </section>
  </>;
}
