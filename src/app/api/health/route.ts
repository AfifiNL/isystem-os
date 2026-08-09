const healthHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
} as const;

export function GET() {
  return Response.json(
    { status: "ok" },
    {
      status: 200,
      headers: healthHeaders,
    },
  );
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: healthHeaders,
  });
}
