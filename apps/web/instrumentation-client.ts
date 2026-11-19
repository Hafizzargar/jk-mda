// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

if (0) {
  Sentry.init({
    dsn: "https://9dc74a10c8c4165e926b171fdd4321bb@o4512232572387328.ingest.us.sentry.io/4512232604041216",

    // Disable in development so localhost is fast and does not send continuous monitoring requests
    enabled: true,

    // Lightweight error monitoring without heavy session replays that choke 2G/3G mobile networks
    integrations: [],

    // Low trace sample rate to conserve mobile bandwidth
    tracesSampleRate: 0.02,

    // Disable network-heavy DOM session replays
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Turns off collection of data that could identify users. Adjust per category:
    // https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection
    dataCollection: {
      userInfo: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      httpBodies: [],
      httpHeaders: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      cookies: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
  });
}

export const onRouterTransitionStart = isProduction ? Sentry.captureRouterTransitionStart : undefined;

