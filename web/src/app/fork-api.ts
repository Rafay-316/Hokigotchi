import type { calculateBudget } from "@/lib/budget";
import type { compareBudgets } from "@/lib/compare-budgets";

export type Budget = {
  monthlyIncome: number;
  fixedExpenses: number;
  foodExpenses: number;
  otherExpenses: number;
  goalTarget: number;
  goalSaved: number;
};
export type Draft = Record<keyof Budget, string>;
export type Result = ReturnType<typeof calculateBudget>;
export type Comparison = ReturnType<typeof compareBudgets>;
export type Summary = {
  checkingBalance: number;
  savingsBalance: number;
  totalCashBalance: number;
};
export type ChangeField = "monthlyIncome" | "fixedExpenses" | "foodExpenses" | "otherExpenses";

export const INITIAL: Budget = {
  monthlyIncome: 1450, fixedExpenses: 730, foodExpenses: 310,
  otherExpenses: 200, goalTarget: 700, goalSaved: 0,
};
export const FIELDS: { key: keyof Budget; label: string; hint: string }[] = [
  { key: "monthlyIncome", label: "Monthly income", hint: "Take-home pay and regular income" },
  { key: "fixedExpenses", label: "Fixed expenses", hint: "Rent, utilities, and subscriptions" },
  { key: "foodExpenses", label: "Food & groceries", hint: "Your total monthly food budget" },
  { key: "otherExpenses", label: "Other expenses", hint: "Transport, shopping, and everything else" },
  { key: "goalTarget", label: "Savings goal", hint: "The total you want to set aside" },
  { key: "goalSaved", label: "Already saved for this goal", hint: "Only money assigned to this goal" },
];
export const CHANGE_FIELDS = FIELDS.slice(0, 4);
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (amount: number) => dollars.format(amount);
export const months = (value: number | null) => value === null
  ? "No monthly surplus" : value === 0 ? "Already funded" : `${value} month${value === 1 ? "" : "s"}`;
export const toDraft = (budget: Budget): Draft => ({
  monthlyIncome: String(budget.monthlyIncome), fixedExpenses: String(budget.fixedExpenses),
  foodExpenses: String(budget.foodExpenses), otherExpenses: String(budget.otherExpenses),
  goalTarget: String(budget.goalTarget), goalSaved: String(budget.goalSaved),
});
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isMonth = (value: unknown) => value === null || (isNumber(value) && Number.isSafeInteger(value) && value >= 0);

export function isResult(value: unknown): value is Result {
  if (!isRecord(value) || !isRecord(value.goal)) return false;
  return value.currency === "USD" && isNumber(value.monthlyIncome) &&
    isNumber(value.monthlyExpenses) && isNumber(value.monthlySurplus) &&
    ["surplus", "balanced", "deficit"].includes(String(value.budgetStatus)) &&
    isNumber(value.goal.target) && isNumber(value.goal.saved) &&
    isNumber(value.goal.remaining) && isMonth(value.goal.monthsToGoal) &&
    typeof value.assumption === "string";
}

export function isSummary(value: unknown): value is Summary {
  return isRecord(value) && isNumber(value.checkingBalance) &&
    isNumber(value.savingsBalance) && isNumber(value.totalCashBalance);
}

export function isComparison(value: unknown): value is Comparison {
  if (!isRecord(value) || !isRecord(value.comparison)) return false;
  const change = value.comparison;
  return isResult(value.baseline) && isResult(value.scenario) &&
    isNumber(change.monthlySurplusChange) &&
    (change.monthsSaved === null || (isNumber(change.monthsSaved) && Number.isSafeInteger(change.monthsSaved))) &&
    ["faster", "slower", "unchanged", "still_unreachable", "became_reachable", "became_unreachable"]
      .includes(String(change.timelineChange));
}

export async function api(path: string, options: RequestInit = {}) {
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

export const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal,
});

export function readAmount(value: string, label: string) {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000 ||
    Math.round(amount * 100) / 100 !== amount) {
    throw new Error(`${label}: enter a nonnegative amount with up to two decimal places.`);
  }
  return amount;
}

export function message(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "That took too long. Please try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function comparisonTitle(result: Comparison) {
  const { monthsSaved, timelineChange } = result.comparison;
  if (timelineChange === "became_reachable") return "Your goal has a path forward.";
  if (timelineChange === "became_unreachable") return "This path pauses your goal.";
  if (timelineChange === "still_unreachable") return "Your goal needs a monthly surplus.";
  if (monthsSaved === 0) return "Same goal timeline. A different budget.";
  return `${Math.abs(monthsSaved ?? 0)} month${Math.abs(monthsSaved ?? 0) === 1 ? "" : "s"} ${
    (monthsSaved ?? 0) > 0 ? "closer to your goal." : "longer to reach your goal."}`;
}

