export async function GET() {
  // This connection-check endpoint is available during development.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const apiKey = process.env.NESSIE_API_KEY?.trim();
  const baseUrl = process.env.NESSIE_BASE_URL?.trim();

  if (!apiKey || !baseUrl) {
    return Response.json(
      {
        success: false,
        error: "Add NESSIE_API_KEY and NESSIE_BASE_URL to web/.env.local.",
      },
      { status: 500 }
    );
  }

  try {
    const url = new URL("/customers", baseUrl);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: "Nessie rejected the request.",
          upstreamStatus: response.status,
        },
        { status: 502 }
      );
    }

    const customers: unknown = await response.json();

    if (!Array.isArray(customers)) {
      return Response.json(
        {
          success: false,
          error: "Nessie returned an unexpected response format.",
        },
        { status: 502 }
      );
    }

    return Response.json(
      {
        success: true,
        source: "nessie",
        count: customers.length,
        customers,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
    } catch (error: unknown) {
    const cause = error instanceof Error ? error.cause : undefined;

    const networkCode =
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause
        ? String(cause.code)
        : null;

    return Response.json(
      {
        success: false,
        error: "Nessie request failed.",
        errorType: error instanceof Error ? error.name : "UnknownError",
        networkCode,
        configuredOrigin: new URL(baseUrl).origin,
      },
      { status: 502 }
    );
  }
}
