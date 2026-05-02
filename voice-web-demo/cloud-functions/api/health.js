export function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "voice-web-demo",
      time: new Date().toISOString()
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}
