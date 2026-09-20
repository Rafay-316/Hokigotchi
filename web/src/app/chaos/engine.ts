// Presentation sandbox: deterministic cents arithmetic, no banking mutations.
export type Setup = { checking: number; savings: number; income: number; expenses: number; floor: number; target: number };
export const DEMO: Setup = { checking: 1640, savings: 920, income: 1450, expenses: 1240, floor: 800, target: 700 };
export const RESPONSES = [
  { id: "new", name: "Buy new", cost: 850, tag: "THE QUICK FIX", detail: "Replace it today. Higher upfront cost, with a new-device warranty.", assumption: "A suitable replacement is available for $850." },
  { id: "refurb", name: "Go refurbished", cost: 430, tag: "A DIFFERENT PATH", detail: "Keep working for less. Check condition, battery health and warranty.", assumption: "A suitable refurbished laptop is available for $430." },
  { id: "repair", name: "Try a repair", cost: 180, tag: "THE COMEBACK", detail: "Keep your current laptop. Lower cost, but repair may take time.", assumption: "A diagnosis confirms that a $180 repair will fix the laptop." },
] as const;
export type ResponseId = typeof RESPONSES[number]["id"];
const cents = (n: number) => Math.round(n * 100);
export function simulate(setup: Setup, cost: number) {
  if (!Object.values(setup).every((n) => Number.isFinite(n) && n >= 0 && n <= 1e9) || !Number.isFinite(cost) || cost < 0 || cost > 1e9 || setup.expenses <= 0 || setup.floor <= 0 || setup.target <= 0) throw new Error("Invalid scenario amounts.");
  let checking = cents(setup.checking), reserve = cents(setup.savings), goal = 0;
  const target = cents(setup.target), floor = cents(setup.floor), surplus = cents(setup.income) - cents(setup.expenses);
  const reserveSpent = Math.min(reserve, cents(cost));
  reserve -= reserveSpent;
  checking -= cents(cost) - reserveSpent;
  const cashNow = (checking + reserve) / 100;
  const reserveNow = reserve / 100;
  // A transparent learning score, not a credit score or a bank's risk assessment.
  const reservePart = 50 * Math.min(1, reserve / floor);
  const surplusPart = 50 * Math.max(0, Math.min(1, surplus / (cents(setup.expenses) * .25)));
  const score = checking < 0 ? 0 : Math.round(reservePart + surplusPart);
  let goalMonth: number | null = null;
  const points = [{ month: 0, cash: cashNow, reserve: reserveNow, goal: 0 }];
  for (let month = 1; month <= 12; month++) {
    if (surplus >= 0) {
      let available = surplus;
      const overdraftRepair = Math.min(available, Math.max(0, -checking));
      checking += overdraftRepair; available -= overdraftRepair;
      const reserveRepair = Math.min(available, Math.max(0, floor - reserve));
      reserve += reserveRepair; available -= reserveRepair;
      const contribution = Math.min(available, target - goal);
      goal += contribution; available -= contribution;
      reserve += available;
    } else {
      let shortfall = -surplus;
      const cashUsed = Math.min(shortfall, Math.max(0, checking));
      checking -= cashUsed; shortfall -= cashUsed;
      const reserveUsed = Math.min(shortfall, reserve);
      reserve -= reserveUsed; shortfall -= reserveUsed;
      const goalUsed = Math.min(shortfall, goal);
      goal -= goalUsed; shortfall -= goalUsed;
      checking -= shortfall;
    }
    if (goalMonth === null && goal >= target && reserve >= floor && checking >= 0) goalMonth = month;
    points.push({ month, cash: (checking + reserve + goal) / 100, reserve: reserve / 100, goal: goal / 100 });
  }
  return { cashNow, reserveNow, score, goalMonth, surplus: surplus / 100, reserveDays: Math.floor(reserveNow / (setup.expenses / 30)), points };
}
export type Projection = ReturnType<typeof simulate>;
export function readBalances(value: unknown): { checking: number; savings: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const result = value as Record<string, unknown>;
  if (result.success !== true || result.source !== "nessie" || typeof result.summary !== "object" || result.summary === null) return null;
  const summary = result.summary as Record<string, unknown>;
  const checking = summary.checkingBalance, savings = summary.savingsBalance;
  if (typeof checking !== "number" || typeof savings !== "number" || ![checking, savings].every((n) => Number.isFinite(n) && n >= 0 && n <= 1e9)) return null;
  return { checking, savings };
}
