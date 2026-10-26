// Deliberate, non-data response for previously distributed clients.
export function retiredNativeResponse() {
  return Response.json(
    {
      error: "client_retired",
      message:
        "Native apps are retired. Open Wuff Empire in your browser or install the web app.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
