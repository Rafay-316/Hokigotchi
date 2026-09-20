export class BudgetInputError extends Error {}

function moneyToCents(input: Record<string, unknown>, field: string) {
  const value = input[field];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000_000
  ) {
    throw new BudgetInputError(
      `${field} must be a number between 0 and 1,000,000,000.`
    );
  }

  const cents = Math.round(value * 100);

  if (cents / 100 !== value) {
    throw new BudgetInputError(`${field} must have at most two decimal places.`);
  }

  return cents;
}

export function calculateBudget(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BudgetInputError("Send a JSON object with the budget amounts.");
  }

  const input = value as Record<string, unknown>;
  const income = moneyToCents(input, "monthlyIncome");
  const fixed = moneyToCents(input, "fixedExpenses");
  const food = moneyToCents(input, "foodExpenses");
  const other = moneyToCents(input, "otherExpenses");
  const target = moneyToCents(input, "goalTarget");
  const saved = moneyToCents(input, "goalSaved");

  const expenses = fixed + food + other;
  const surplus = income - expenses;
  const remaining = Math.max(0, target - saved);

  let monthsToGoal: number | null = null;

  if (remaining === 0) {
    monthsToGoal = 0;
  } else if (surplus > 0) {
    monthsToGoal = Math.ceil(remaining / surplus);
  }

  return {
    currency: "USD",
    monthlyIncome: income / 100,
    monthlyExpenses: expenses / 100,
    monthlySurplus: surplus / 100,
    budgetStatus:
      surplus > 0 ? "surplus" : surplus < 0 ? "deficit" : "balanced",
    goal: {
      target: target / 100,
      saved: saved / 100,
      remaining: remaining / 100,
      monthsToGoal,
    },
    assumption:
      "Income and expenses stay constant. All positive monthly surplus goes " +
      "to this one goal at month end. No interest or withdrawals are modeled.",
  };
}