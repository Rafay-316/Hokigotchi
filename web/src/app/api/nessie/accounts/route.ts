export const runtime = "nodejs";

type NessieAccount = {
  _id: string;
  customer_id: string;
  type: string;
  nickname: string;
  balance: number;
};

function isAccount(value: unknown): value is NessieAccount {
  if (typeof value !== "object" || value === null) return false;

  const account = value as Record<string, unknown>;

  return (
    typeof account._id === "string" &&
    typeof account.customer_id === "string" &&
    typeof account.type === "string" &&
    typeof account.nickname === "string" &&
    typeof account.balance === "number" &&
    Number.isFinite(account.balance) &&
    Number.isSafeInteger(Math.round(account.balance * 100))
  );
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  // Local development only, until we add user authentication.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const apiKey = process.env.NESSIE_API_KEY?.trim();
  const baseUrl = process.env.NESSIE_BASE_URL?.trim();
  const customerId = process.env.NESSIE_CUSTOMER_ID?.trim();

  if (!apiKey || !baseUrl || !customerId) {
    return json(
      {
        success: false,
        error:
          "Check NESSIE_API_KEY, NESSIE_BASE_URL, and NESSIE_CUSTOMER_ID in web/.env.local.",
      },
      500
    );
  }

  try {
    const url = new URL(
      `/customers/${encodeURIComponent(customerId)}/accounts`,
      baseUrl
    );
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return json(
        {
          success: false,
          error: "Nessie rejected the accounts request.",
          upstreamStatus: response.status,
        },
        502
      );
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || !data.every(isAccount)) {
      return json(
        { success: false, error: "Nessie returned unexpected account data." },
        502
      );
    }

    if (data.some((account) => account.customer_id !== customerId)) {
      return json(
        { success: false, error: "An account belongs to a different customer." },
        502
      );
    }

    // Add money as whole cents to avoid decimal addition errors.
    const sumCents = (type: string) =>
      data
        .filter((account) => account.type === type)
        .reduce(
          (total, account) => total + Math.round(account.balance * 100),
          0
        );

    const checkingCents = sumCents("Checking");
    const savingsCents = sumCents("Savings");
    const totalCents = checkingCents + savingsCents;

    if (
      ![checkingCents, savingsCents, totalCents].every(Number.isSafeInteger)
    ) {
      return json(
        { success: false, error: "Account totals exceed the supported range." },
        502
      );
    }

    return json({
      success: true,
      source: "nessie",
      simulated: true,
      currency: "USD",
      customerId,
      count: data.length,
      summary: {
        checkingBalance: checkingCents / 100,
        savingsBalance: savingsCents / 100,
        totalCashBalance: totalCents / 100,
      },
      accounts: data.map((account) => ({
        id: account._id,
        type: account.type,
        nickname: account.nickname,
        balance: account.balance,
      })),
    });
  } catch {
    return json(
      {
        success: false,
        error: "Could not load Nessie accounts. Check the connection and retry.",
      },
      502
    );
  }
}