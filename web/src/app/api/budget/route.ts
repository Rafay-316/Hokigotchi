import { BudgetInputError, calculateBudget } from "@/lib/budget";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  return json({
    success: true,
    source: "demo",
    simulated: true,
    ...calculateBudget({
      monthlyIncome: 1450,
      fixedExpenses: 730,
      foodExpenses: 310,
      otherExpenses: 0,
      goalTarget: 700,
      goalSaved: 0,
    }),
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return json({ success: false, error: "Send valid JSON." }, 400);
  }

  try {
    return json({
      success: true,
      source: "user-input",
      simulated: true,
      ...calculateBudget(input),
    });
  } catch (error: unknown) {
    if (error instanceof BudgetInputError) {
      return json({ success: false, error: error.message }, 400);
    }

    return json({ success: false, error: "Budget calculation failed." }, 500);
  }
}