// Local practice-game rules. A shared league must validate actions on a server.
// Preserve the original key and outfit IDs so existing adventures carry over.
export const STORAGE_KEY = "fork.quest.v1";
export type Plan = {
  monthlyIncome: number; fixedExpenses: number; foodExpenses: number;
  otherExpenses: number; goalTarget: number; goalSaved: number;
};
export const SAMPLE_PLAN: Plan = {
  monthlyIncome: 1450, fixedExpenses: 730, foodExpenses: 310,
  otherExpenses: 200, goalTarget: 700, goalSaved: 0,
};
export const CHECKPOINTS = [
  { name: "The Nest", xp: 0, tokens: 0 },
  { name: "Budget Burrow", xp: 50, tokens: 20 },
  { name: "Orange Grove", xp: 125, tokens: 25 },
  { name: "Buffer Bridge", xp: 225, tokens: 35 },
  { name: "Hokie Heights", xp: 350, tokens: 50 },
  { name: "Maroon Summit", xp: 500, tokens: 75 },
] as const;
export const OUTFITS = [
  { id: "mint", name: "Maroon Hatchling", cost: 0, color: "#861f41" },
  { id: "sunset", name: "Gameday Gobbler", cost: 60, color: "#e5751f" },
  { id: "violet", name: "Stone Scholar", cost: 100, color: "#75787b" },
  { id: "ice", name: "Homecoming Hero", cost: 150, color: "#fffdf6" },
] as const;
export type Outfit = typeof OUTFITS[number]["id"];
export const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Other"] as const;
export type Category = typeof CATEGORIES[number];
export type Daily = {
  checkin: boolean; plan: boolean; compare: boolean; expenses: number;
  buffer: boolean; bufferPenalty: boolean; review?: boolean; money?: boolean;
};
export type Expense = { id: string; day: string; label: string; category: Category; cents: number };
export type Allocations = Record<Category, number>;
export type WeeklyBudget = {
  allocations: Allocations; firstLimitCents: number; createdDay: string;
  trackingClaims: number[]; closed: null | { day: string; spentCents: number; bonus: boolean };
};
export type SavingsGoal = {
  id: string; name: string; targetCents: number; savedCents: number; baselineCents: number;
  createdDay: string; claimed: number[];
};
export type MoneyQuests = { weeks: Record<string, WeeklyBudget>; goals: SavingsGoal[] };
export const SAVINGS_MILESTONES = [
  { percent: 25, xp: 25, tokens: 10 }, { percent: 50, xp: 35, tokens: 15 },
  { percent: 75, xp: 50, tokens: 20 }, { percent: 90, xp: 75, tokens: 30 },
  { percent: 100, xp: 100, tokens: 50 },
] as const;
export const emptyAllocations = (): Allocations => ({ Food: 0, Transport: 0, Shopping: 0, Bills: 0, Other: 0 });
const newMoneyQuests = (): MoneyQuests => ({ weeks: {}, goals: [] });
export type Pet = { snacks: number; started: string; lastFed: string | null; feeds: number };
export const PET_STAGES = [
  { id: "egg", name: "Mystery egg", xp: 0 },
  { id: "hatchling", name: "Hokie hatchling", xp: 10 },
  { id: "fledgling", name: "Trail fledgling", xp: 150 },
  { id: "champion", name: "Campus champion", xp: 350 },
] as const;
export type PetStage = typeof PET_STAGES[number]["id"];
export type PetMood = "Dreaming" | "Sleepy" | "Peckish" | "Happy" | "Curious";
const newPet = (day: string, snacks = 0): Pet => ({ snacks, started: day, lastFed: null, feeds: 0 });
export function petStage(xp: number) {
  return [...PET_STAGES].reverse().find((stage) => xp >= stage.xp)!;
}
export type Game = {
  version: 1; name: string; xp: number; tokens: number; outfit: Outfit;
  owned: Outfit[]; claimed: number[]; days: Record<string, Daily>;
  weekly: { start: string; score: number; missed: number };
  challenge: { enabled: boolean; floorCents: number; joined: string };
  settledThrough: string; expenses: Expense[]; plan: Plan | null; pet: Pet; money: MoneyQuests;
};
export const emptyDay = (): Daily => ({
  checkin: false, plan: false, compare: false, expenses: 0, buffer: false, bufferPenalty: false,
});
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
// Calendar arithmetic in UTC avoids 23/25-hour daylight-saving days.
function dayNumber(day: string) { return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000); }
function dateKey(number: number) { return new Date(number * 86400000).toISOString().slice(0, 10); }
export function weekStart(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return dateKey(dayNumber(day) - (date.getUTCDay() + 6) % 7);
}
export function nextWeek(day: string) { return dateKey(dayNumber(weekStart(day)) + 7); }
export function trackingDays(game: Game, week: string) {
  const end = nextWeek(week);
  return Object.entries(game.days).filter(([day, value]) => day >= week && day < end && value.expenses > 0).length;
}
export function weeklyTotals(game: Game, week: string) {
  const spent = emptyAllocations();
  for (const entry of game.expenses) if (entry.day >= week && entry.day < nextWeek(week)) spent[entry.category] += entry.cents;
  const allocated = game.money.weeks[week]?.allocations ?? emptyAllocations();
  const budgetCents = CATEGORIES.reduce((sum, key) => sum + allocated[key], 0);
  const spentCents = CATEGORIES.reduce((sum, key) => sum + spent[key], 0);
  return { spent, allocated, budgetCents, spentCents, remainingCents: budgetCents - spentCents };
}
export function createGame(day = localDay()): Game {
  return {
    version: 1, name: "Player One", xp: 0, tokens: 0, outfit: "mint", owned: ["mint"],
    claimed: [0], days: {}, weekly: { start: weekStart(day), score: 0, missed: 0 },
    challenge: { enabled: false, floorCents: 100000, joined: day },
    settledThrough: dateKey(dayNumber(day) - 1), expenses: [], plan: null, pet: newPet(day), money: newMoneyQuests(),
  };
}
export function petStatus(game: Game, day = localDay()) {
  const stage = petStage(game.xp);
  const nextStage = PET_STAGES.find((value) => value.xp > game.xp);
  const today = game.days[day] ?? emptyDay();
  const hasQuest = (d: Daily) => d.checkin || d.plan || d.compare || d.expenses > 0 || d.buffer || d.review || d.money;
  const lastQuest = Object.keys(game.days).filter((key) => key <= day && hasQuest(game.days[key])).sort().at(-1);
  const lastVisit = [game.pet.started, game.pet.lastFed ?? game.pet.started, lastQuest ?? game.pet.started].sort().at(-1)!;
  const daysSinceMeal = Math.max(0, dayNumber(day) - dayNumber(game.pet.lastFed ?? game.pet.started));
  const fullness = Math.max(0, (game.pet.lastFed ? 100 : 60) - daysSinceMeal * 25);
  const fedToday = game.pet.lastFed !== null && game.pet.lastFed >= day;
  let mood: PetMood = "Curious";
  let message = "A little quest, a little adventure. What shall we explore?";
  if (stage.id === "egg") { mood = "Dreaming"; message = "Someone is waiting inside. Complete your first quest to hatch Hoki!"; }
  else if (dayNumber(day) - dayNumber(lastVisit) >= 3) { mood = "Sleepy"; message = "Welcome back! A check-in or a snack will wake me up."; }
  else if (fullness <= 25) { mood = "Peckish"; message = "A snack would be lovely. Your quests help fill my snack bag."; }
  else if (fedToday && hasQuest(today)) { mood = "Happy"; message = "A good snack and a small win. We're a pretty great team!"; }
  const feedReason = stage.id === "egg" ? "Hatch Hoki with your first quest." : fedToday ? "All fed for today. Come back tomorrow." : game.pet.snacks === 0 ? "Complete a quest to earn a snack." : "One snack fills Hoki up for today.";
  return { stage, nextStage, fullness, mood, message, fedToday, feedReason,
    canFeed: stage.id !== "egg" && !fedToday && game.pet.snacks > 0,
    progress: nextStage ? game.xp - stage.xp : 1,
    progressMax: nextStage ? nextStage.xp - stage.xp : 1,
  };
}
export function advanceGame(game: Game, day = localDay()): Game {
  let next = game;
  if (game.weekly.start !== weekStart(day)) {
    next = { ...next, weekly: { start: weekStart(day), score: 0, missed: 0 } };
  }
  const yesterday = dayNumber(day) - 1;
  if (dayNumber(next.settledThrough) >= yesterday) return next;
  if (next.challenge.enabled) {
    const start = Math.max(dayNumber(next.settledThrough) + 1,
      dayNumber(next.weekly.start), dayNumber(next.challenge.joined));
    let missed = 0;
    for (let n = start; n <= yesterday; n++) {
      if (!next.days[dateKey(n)]?.checkin) missed++;
    }
    const charged = Math.min(3 - next.weekly.missed, missed);
    next = { ...next, weekly: {
      ...next.weekly, missed: next.weekly.missed + charged,
      score: Math.max(0, next.weekly.score - charged * 10),
    } };
  }
  return { ...next, settledThrough: dateKey(yesterday) };
}
export function streak(game: Game, day = localDay()): number {
  let n = dayNumber(day);
  if (!game.days[day]?.checkin) n--;
  let count = 0;
  while (game.days[dateKey(n)]?.checkin) { count++; n--; }
  return count;
}
export function weekCount(game: Game, field: "checkin" | "buffer", day = localDay()) {
  return Object.entries(game.days).filter(([key, value]) =>
    key >= weekStart(day) && key <= day && value[field]).length;
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const integer = (v: unknown, max = 1_000_000_000): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const validDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(dayNumber(v)) && dateKey(dayNumber(v)) === v;
export function validPlan(v: unknown): v is Plan {
  return isRecord(v) && Object.keys(SAMPLE_PLAN).every((key) =>
    typeof v[key] === "number" && Number.isFinite(v[key]) && v[key] >= 0 && v[key] <= 1_000_000_000 && Math.round(v[key] * 100) / 100 === v[key]);
}
export function restoreGame(raw: string, day = localDay()): Game {
  const g: unknown = JSON.parse(raw);
  if (!isRecord(g) || g.version !== 1 || typeof g.name !== "string" || !g.name.trim() || g.name.length > 24 ||
    !integer(g.xp) || !integer(g.tokens) || !OUTFITS.some((o) => o.id === g.outfit) ||
    !Array.isArray(g.owned) || !g.owned.includes(g.outfit) || !g.owned.every((id) => OUTFITS.some((o) => o.id === id)) ||
    !Array.isArray(g.claimed) || !g.claimed.includes(0) || !g.claimed.every((id) => integer(id, CHECKPOINTS.length - 1)) ||
    !isRecord(g.days) || !Object.entries(g.days).every(([key, d]) => validDay(key) && isRecord(d) &&
      [d.checkin, d.plan, d.compare, d.buffer, d.bufferPenalty].every((v) => typeof v === "boolean") &&
      [d.review, d.money].every((v) => v === undefined || typeof v === "boolean") && integer(d.expenses, 3)) ||
    !isRecord(g.weekly) || !validDay(g.weekly.start) || !integer(g.weekly.score) || !integer(g.weekly.missed, 3) ||
    !isRecord(g.challenge) || typeof g.challenge.enabled !== "boolean" || !integer(g.challenge.floorCents, 100_000_000_000) || !validDay(g.challenge.joined) ||
    !validDay(g.settledThrough) || (g.plan !== null && !validPlan(g.plan)) ||
    !Array.isArray(g.expenses) || g.expenses.length > 500 || !g.expenses.every((e) => isRecord(e) &&
      typeof e.id === "string" && typeof e.label === "string" && e.label.length >= 2 && e.label.length <= 48 &&
      validDay(e.day) && CATEGORIES.includes(e.category as Category) && integer(e.cents, 100_000_000_000) && e.cents > 0)) {
    throw new Error("The saved adventure could not be read.");
  }
  // Add the pet to older saves without resetting any existing game fields.
  const pet = g.pet === undefined ? newPet(day, g.xp > 0 ? 2 : 0) : g.pet;
  if (!isRecord(pet) || !integer(pet.snacks, 99) || !validDay(pet.started) ||
    !integer(pet.feeds) || (pet.lastFed !== null && !validDay(pet.lastFed)) ||
    (pet.lastFed === null) !== (pet.feeds === 0)) {
    throw new Error("The saved pet could not be read.");
  }
  const money = g.money === undefined ? newMoneyQuests() : g.money;
  if (!isRecord(money) || !isRecord(money.weeks) || !Object.entries(money.weeks).every(([week, value]) =>
    validDay(week) && weekStart(week) === week && isRecord(value) && isRecord(value.allocations) &&
    CATEGORIES.every((key) => integer((value.allocations as Record<string, unknown>)[key], 100_000_000_000)) &&
    integer(value.firstLimitCents, 500_000_000_000) && value.firstLimitCents > 0 && validDay(value.createdDay) &&
    Array.isArray(value.trackingClaims) && value.trackingClaims.every((v) => v === 3 || v === 5) &&
    (value.closed === null || (isRecord(value.closed) && validDay(value.closed.day) &&
      integer(value.closed.spentCents, 50_000_000_000_000) && typeof value.closed.bonus === "boolean"))) ||
    !Array.isArray(money.goals) || money.goals.length > 50 || !money.goals.every((goal) =>
      isRecord(goal) && typeof goal.id === "string" && goal.id.length > 0 && typeof goal.name === "string" &&
      goal.name.trim().length >= 2 && goal.name.length <= 40 && integer(goal.targetCents, 100_000_000_000) && goal.targetCents > 0 &&
      integer(goal.savedCents, 100_000_000_000) && integer(goal.baselineCents, 100_000_000_000) && goal.baselineCents < goal.targetCents &&
      validDay(goal.createdDay) && Array.isArray(goal.claimed) && goal.claimed.every((percent) => SAVINGS_MILESTONES.some((m) => m.percent === percent)))) {
    throw new Error("The saved money quests could not be read.");
  }
  return { ...g, pet, money } as unknown as Game;
}
export type Action =
  | { type: "checkin" }
  | { type: "plan"; plan: Plan }
  | { type: "compare"; field?: "monthlyIncome" | "fixedExpenses" | "foodExpenses" | "otherExpenses"; amount?: number }
  | { type: "expense"; id: string; label: string; category: Category; amount: number }
  | { type: "deleteExpense"; id: string }
  | { type: "buffer"; checking: number }
  | { type: "challenge"; enabled: boolean; floor: number }
  | { type: "claim"; checkpoint: number }
  | { type: "outfit"; id: Outfit }
  | { type: "feed" }
  | { type: "weekPlan"; week: string; allocations: Allocations }
  | { type: "weekReview" }
  | { type: "trackingReward"; week: string }
  | { type: "closeWeek"; week: string; confirmed: boolean }
  | { type: "goalCreate"; id: string; name: string; target: number; saved: number }
  | { type: "goalProgress"; id: string; saved: number }
  | { type: "name"; name: string };
export function applyAction(input: Game, action: Action, day = localDay()): { game: Game; notice: string } {
  let g = advanceGame(input, day);
  const daily = { ...(g.days[day] ?? emptyDay()) };
  function result(notice: string) { return { game: g, notice }; }
  function award(xp: number, tokens: number, notice: string) {
    const previousStage = petStage(g.xp);
    const snackEarned = g.pet.snacks < 99;
    g = { ...g, xp: g.xp + xp, tokens: g.tokens + tokens,
      pet: { ...g.pet, snacks: Math.min(99, g.pet.snacks + 1) },
      weekly: { ...g.weekly, score: g.weekly.score + xp }, days: { ...g.days, [day]: daily } };
    const stage = petStage(g.xp);
    const evolution = stage.id !== previousStage.id ? previousStage.id === "egg" ? " Hoki hatched! Meet your little companion." : ` Hoki evolved into a ${stage.name}!` : "";
    return result(`${notice} +${xp} XP · +${tokens} tokens${snackEarned ? " · +1 snack" : ""}${evolution}`);
  }
  function moneyAward(xp: number, tokens: number, notice: string) {
    daily.money = true;
    return award(xp, tokens, notice);
  }
  function amountCents(amount: number) {
    const cents = Math.round(amount * 100);
    if (!integer(cents, 100_000_000_000) || cents / 100 !== amount) throw new Error("Enter a nonnegative amount with at most two decimals.");
    return cents;
  }
  switch (action.type) {
    case "weekPlan": {
      if (![weekStart(day), nextWeek(day)].includes(action.week)) throw new Error("Plan this week or next week.");
      const allocations = Object.fromEntries(CATEGORIES.map((key) => [key, amountCents(action.allocations[key])])) as Allocations;
      const total = CATEGORIES.reduce((sum, key) => sum + allocations[key], 0);
      if (total <= 0) throw new Error("Allocate more than zero across your weekly categories.");
      const previous = g.money.weeks[action.week];
      if (previous?.closed) throw new Error("This week has already been reviewed and closed.");
      const budget: WeeklyBudget = previous ? { ...previous, allocations } : {
        allocations, firstLimitCents: total, createdDay: day, trackingClaims: [], closed: null,
      };
      g = { ...g, money: { ...g.money, weeks: { ...g.money.weeks, [action.week]: budget } } };
      if (previous) return result("Weekly budget updated. Your planning reward was already earned for this week.");
      return moneyAward(25, 10, "A plan for the week ahead!");
    }
    case "weekReview": {
      if (!g.money.weeks[weekStart(day)]) throw new Error("Save this week's budget before reviewing it.");
      if (daily.review) return result("Today's spending review is already complete.");
      daily.review = true;
      return moneyAward(5, 2, "Spending and money left reviewed!");
    }
    case "trackingReward": {
      const budget = g.money.weeks[action.week];
      if (!budget || action.week > weekStart(day)) throw new Error("Choose a saved current or past week.");
      const days = trackingDays(g, action.week);
      const milestones = [3, 5].filter((count) => days >= count && !budget.trackingClaims.includes(count));
      if (!milestones.length) return result("Log expenses on three or five different days to unlock the next tracking bonus.");
      g = { ...g, money: { ...g.money, weeks: { ...g.money.weeks, [action.week]: {
        ...budget, trackingClaims: [...budget.trackingClaims, ...milestones],
      } } } };
      return moneyAward(milestones.reduce((sum, count) => sum + (count === 3 ? 20 : 35), 0),
        milestones.reduce((sum, count) => sum + (count === 3 ? 10 : 15), 0), "Consistent expense tracking pays off!");
    }
    case "closeWeek": {
      const budget = g.money.weeks[action.week];
      if (!budget || action.week >= weekStart(day)) throw new Error("Review a completed week after Sunday ends.");
      if (budget.closed) return result("This week is already closed; its reward cannot be collected twice.");
      if (!action.confirmed) throw new Error("Confirm that your spending log is complete before closing this week.");
      const totals = weeklyTotals(g, action.week);
      const bonus = trackingDays(g, action.week) >= 3 && totals.spentCents <= Math.min(budget.firstLimitCents, totals.budgetCents);
      g = { ...g, money: { ...g.money, weeks: { ...g.money.weeks, [action.week]: {
        ...budget, closed: { day, spentCents: totals.spentCents, bonus },
      } } } };
      return moneyAward(bonus ? 55 : 15, bonus ? 25 : 5, bonus ? "Week reviewed, and you stayed within your starting budget!" : "Week reviewed. Every honest review helps you learn.");
    }
    case "goalCreate": {
      const name = action.name.trim(), targetCents = amountCents(action.target), savedCents = amountCents(action.saved);
      if (name.length < 2 || name.length > 40 || !action.id || g.money.goals.some((goal) => goal.id === action.id)) throw new Error("Choose a new goal with a name between 2 and 40 characters.");
      if (targetCents <= savedCents) throw new Error("Choose a target greater than the amount you have already saved.");
      const current = g.money.goals[0];
      if (current && current.savedCents < current.targetCents) throw new Error("Complete your current savings quest before starting another.");
      if (g.money.goals.some((goal) => weekStart(goal.createdDay) === weekStart(day))) throw new Error("You can start one new savings quest per week.");
      if (g.money.goals.length >= 50) throw new Error("This local prototype supports 50 completed savings quests.");
      const goal: SavingsGoal = { id: action.id, name, targetCents, savedCents, baselineCents: savedCents, createdDay: day,
        claimed: SAVINGS_MILESTONES.filter((m) => savedCents * 100 >= targetCents * m.percent).map((m) => m.percent) };
      g = { ...g, money: { ...g.money, goals: [goal, ...g.money.goals] } };
      return result("Savings quest started. Your starting balance is recorded; new milestones earn bonuses.");
    }
    case "goalProgress": {
      const goal = g.money.goals[0];
      if (!goal || goal.id !== action.id) throw new Error("Update your current savings quest.");
      const savedCents = amountCents(action.saved);
      const crossed = SAVINGS_MILESTONES.filter((m) => savedCents * 100 >= goal.targetCents * m.percent && !goal.claimed.includes(m.percent));
      const updated = { ...goal, savedCents, claimed: [...goal.claimed, ...crossed.map((m) => m.percent)] };
      g = { ...g, money: { ...g.money, goals: [updated, ...g.money.goals.slice(1)] } };
      if (!crossed.length) return result("Savings progress updated. Previously reached milestones cannot award points again.");
      return moneyAward(crossed.reduce((sum, m) => sum + m.xp, 0), crossed.reduce((sum, m) => sum + m.tokens, 0),
        `Savings milestone${crossed.length > 1 ? "s" : ""}: ${crossed.map((m) => `${m.percent}%`).join(", ")}!`);
    }
    case "feed": {
      const status = petStatus(g, day);
      if (!status.canFeed) return result(status.feedReason);
      g = { ...g, pet: { ...g.pet, snacks: g.pet.snacks - 1, lastFed: day, feeds: g.pet.feeds + 1 } };
      return result("Munch, munch! Hoki enjoyed a snack. Fullness restored. See you for another snack tomorrow!");
    }
    case "checkin":
      if (daily.checkin) return result("Today's check-in is already complete. Come back tomorrow!");
      daily.checkin = true;
      return award(10, 5, "You're on the trail!");
    case "plan":
      if (!validPlan(action.plan)) throw new Error("Enter valid amounts before saving your plan.");
      g = { ...g, plan: { ...action.plan } };
      if (daily.plan) return result("Plan saved. You've already earned today's planning XP.");
      daily.plan = true;
      return award(25, 10, "Plan your path: complete!");
    case "compare":
      if (daily.compare) return result("Path explored. Today's exploration XP is already earned.");
      daily.compare = true;
      return award(20, 10, "A different future explored!");
    case "expense": {
      const label = action.label.trim();
      const cents = Math.round(action.amount * 100);
      if (label.length < 2 || label.length > 48 || !CATEGORIES.includes(action.category) ||
        !integer(cents, 100_000_000_000) || cents === 0 || cents / 100 !== action.amount) {
        throw new Error("Add a description and a positive amount with at most two decimals.");
      }
      if (g.expenses.some((e) => e.id === action.id || (e.day === day && e.label.toLowerCase() === label.toLowerCase() && e.cents === cents && e.category === action.category))) {
        return result("That exact expense is already in today's log. It wasn't added twice.");
      }
      if (g.expenses.length >= 500) throw new Error("Your local log is full. Remove an old entry before adding another.");
      g = { ...g, expenses: [{ id: action.id, day, label, cents, category: action.category }, ...g.expenses] };
      if (daily.expenses >= 3) return result("Expense logged. Today's three expense XP rewards are complete.");
      daily.expenses++;
      return award(10, 5, "Expense logged. Every detail counts!");
    }
    case "deleteExpense":
      if (g.expenses.some((entry) => entry.id === action.id && g.money.weeks[weekStart(entry.day)]?.closed)) throw new Error("This expense belongs to a closed weekly review and cannot be removed.");
      g = { ...g, expenses: g.expenses.filter((e) => e.id !== action.id) };
      return result("Expense removed. Your daily XP allowance stays the same.");
    case "challenge": {
      const cents = Math.round(action.floor * 100);
      if (!integer(cents, 100_000_000_000) || cents === 0 || cents / 100 !== action.floor) throw new Error("Choose a balance floor greater than zero, with at most two decimals.");
      g = { ...g, challenge: { enabled: action.enabled, floorCents: cents,
        joined: !g.challenge.enabled && action.enabled ? day : g.challenge.joined } };
      return result(action.enabled ? "Buffer challenge set. Check your balance to play." : "Buffer challenge paused. Missed-day deductions are paused too.");
    }
    case "buffer":
      if (!g.challenge.enabled) return result("Set a balance floor and join the challenge first.");
      if (!Number.isFinite(action.checking)) throw new Error("No current balance is available. Your score is unchanged.");
      if (Math.round(action.checking * 100) < g.challenge.floorCents) {
        if (daily.bufferPenalty) return result("Below your floor. Today's deduction has already been applied.");
        daily.bufferPenalty = true;
        const lost = Math.min(15, g.weekly.score);
        g = { ...g, days: { ...g.days, [day]: daily }, weekly: { ...g.weekly, score: g.weekly.score - lost } };
        return result(`Below your floor: −${lost} weekly points. Your XP and rewards are safe. You can still earn a recovery bonus.`);
      }
      if (daily.buffer) return result("Your buffer is healthy. Today's buffer XP is already earned.");
      daily.buffer = true;
      return award(15, 5, "Buffer protected!");
    case "claim": {
      const checkpoint = CHECKPOINTS[action.checkpoint];
      if (!checkpoint || g.xp < checkpoint.xp) return result("Keep completing quests to reach this checkpoint.");
      if (g.claimed.includes(action.checkpoint)) return result("This checkpoint's treasure is already collected.");
      g = { ...g, claimed: [...g.claimed, action.checkpoint], tokens: g.tokens + checkpoint.tokens };
      return result(`${checkpoint.name} cleared! +${checkpoint.tokens} tokens`);
    }
    case "outfit": {
      const outfit = OUTFITS.find((o) => o.id === action.id);
      if (!outfit) throw new Error("Choose an available outfit.");
      if (g.owned.includes(outfit.id)) {
        g = { ...g, outfit: outfit.id };
        return result(`${outfit.name} equipped!`);
      }
      if (g.tokens < outfit.cost) return result(`Earn ${outfit.cost - g.tokens} more tokens to unlock this outfit.`);
      g = { ...g, tokens: g.tokens - outfit.cost, owned: [...g.owned, outfit.id], outfit: outfit.id };
      return result(`${outfit.name} unlocked and equipped!`);
    }
    case "name": {
      const name = action.name.trim();
      if (name.length < 2 || name.length > 24) throw new Error("Use a player name between 2 and 24 characters.");
      g = { ...g, name };
      return result("Player name saved.");
    }
  }
}
