import { BudgetInputError, calculateBudget } from "./budget";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function compareBudgets(input: unknown) {
  if (
    !isObject(input) ||
    !isObject(input.baseline) ||
    !isObject(input.changes)
  ) {
    throw new BudgetInputError("Send an object with baseline and changes objects.");
  }

  const allowedChanges = [
    "monthlyIncome",
    "fixedExpenses",
    "foodExpenses",
    "otherExpenses",
  ];

  if (Object.keys(input.changes).some((key) => !allowedChanges.includes(key))) {
    throw new BudgetInputError(
      "Changes may contain only monthlyIncome, fixedExpenses, " +
      "foodExpenses, or otherExpenses."
    );
  }

  // Both scenarios use the same goal and money already assigned to it.
  const baseline = calculateBudget(input.baseline);
  const scenario = calculateBudget({ ...input.baseline, ...input.changes });

  const monthlySurplusChange =
    (Math.round(scenario.monthlySurplus * 100) -
      Math.round(baseline.monthlySurplus * 100)) / 100;

  const before = baseline.goal.monthsToGoal;
  const after = scenario.goal.monthsToGoal;
  let monthsSaved: number | null = null;
  let timelineChange: string;

  if (before === null && after === null) {
    timelineChange = "still_unreachable";
  } else if (before === null) {
    timelineChange = "became_reachable";
  } else if (after === null) {
    timelineChange = "became_unreachable";
  } else {
    monthsSaved = before - after;
    timelineChange =
      monthsSaved > 0 ? "faster" : monthsSaved < 0 ? "slower" : "unchanged";
  }

  return {
    baseline,
    scenario,
    comparison: {
      monthlySurplusChange,
      monthsSaved,
      timelineChange,
    },
  };
}