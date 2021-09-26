import Toucan from "toucan-js";

addEventListener("fetch", (event: FetchEvent): void => {
  const sentry = initSentry(event);
  event.respondWith(
    handleRequest(event.request).catch((err) => {
      sentry.captureException(err);
      return new Response(err.stack, { status: 500 });
    })
  );
});

async function handleRequest(request: Request): Promise<Response> {
  if (!request.url.endsWith(WEBHOOK_SECRET)) {
    throw new Error("Invalid request webhook secret");
  }

  const formData = await request.formData();
  const body = Object.fromEntries(formData.entries());
  console.log("fields: " + Object.keys(body).join(", "));
  Object.entries(body).forEach(([key, value]) =>
    console.log(`${key}: ${value.slice(0, 300)}`)
  );

  await forwardEmail(SENDGRID_API_KEY, FORWARD_TO_EMAIL_ADDRESS, body);

  return new Response();
}

export const forwardEmail = (
  apiKey: string,
  forwardTo: string,
  originalEmailData: { [key: string]: FormDataEntryValue }
): Promise<void> =>
  fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: forwardTo }] }],
      from: {
        name: `${originalEmailData.from}`,
        email: `forward@${EMAIL_DOMAIN}`,
      },
      subject: originalEmailData.subject,
      content: [
        {
          type: "text/plain",
          value: originalEmailData.text,
        },
        {
          type: "text/html",
          value: originalEmailData.html,
        },
      ],
    }),
  }).then(async (it) => {
    if (!it.ok) {
      console.error(await it.json());
      throw new Error("Error forwarding email");
    }
  });

// from https://github.com/cloudflare/worker-sentry/blob/1b0f10005114cf41987043c928507f1adca4f25b/index.js
function initSentry(event: FetchEvent): Toucan {
  const request = event.request;

  const sentry = new Toucan({
    dsn: SENTRY_DSN,
    event: event,
    allowedHeaders: [
      "user-agent",
      "cf-challenge",
      "accept-encoding",
      "accept-language",
      "cf-ray",
      "content-length",
      "content-type",
      "x-real-ip",
      "host",
    ],
    allowedSearchParams: /(.*)/,
    rewriteFrames: { root: "/" },
  });

  const colo = request?.cf.colo || "UNKNOWN";
  sentry.setTag("colo", colo);
  sentry.setUser({
    ip: request.headers.get("cf-connecting-ip"),
    userAgent: request.headers.get("user-agent") || "",
    colo,
  });

  return sentry;
}
