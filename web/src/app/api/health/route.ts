export function GET() {
  return Response.json({
    status: "ok",
    app: "FORK",
    message: "Backend is running",
  });
}