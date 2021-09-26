import { initSentry } from "@cloudflare/worker-sentry";

addEventListener("fetch", (event) => {
  const sentry = initSentry(event);
  event.respondWith(
    handleRequest(event.request).catch((err) => {
      sentry.captureException(err);
      return new Response(err.stack, { status: 500 });
    })
  );
});

async function handleRequest(request) {
  let requestHeaders = JSON.stringify(
    Object.fromEntries(request.headers),
    null,
    2
  );
  console.log(`Request headers: ${requestHeaders}`);

  const formData = await request.formData();
  const body = Object.fromEntries(formData.entries());
  const { subject, email, to, fromEntries, envelope } = body;
  console.log(JSON.stringify(body, null, 2));

  return new Response();
}
