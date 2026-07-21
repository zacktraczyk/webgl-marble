import {
  PUBLIC_ANALYTICS_ENVIRONMENT,
  PUBLIC_ANALYTICS_MODE,
  PUBLIC_POSTHOG_HOST,
  PUBLIC_POSTHOG_PROJECT_TOKEN,
} from "astro:env/client";
import posthog from "posthog-js";
import { setAnalyticsProvider, type AnalyticsProvider } from "../analytics";

const consoleProvider: AnalyticsProvider = {
  capture(event, properties) {
    console.info(
      `[analytics:${PUBLIC_ANALYTICS_ENVIRONMENT}]`,
      event,
      properties
    );
  },
  reportException(error, context) {
    console.error(
      `[analytics:${PUBLIC_ANALYTICS_ENVIRONMENT}:exception]`,
      error,
      context
    );
  },
};

const postHogProvider: AnalyticsProvider = {
  capture(event, properties) {
    posthog.capture(event, properties);
  },
  reportException(error, context) {
    posthog.captureException(error, context);
  },
};

let initialized = false;

/** Selects and initializes the browser analytics provider exactly once. */
export const initializeAnalytics = () => {
  if (initialized) return;
  initialized = true;

  if (PUBLIC_ANALYTICS_MODE === "off") {
    setAnalyticsProvider(null);
    return;
  }

  if (PUBLIC_ANALYTICS_MODE === "console") {
    setAnalyticsProvider(consoleProvider);
    return;
  }

  if (!PUBLIC_POSTHOG_PROJECT_TOKEN || !PUBLIC_POSTHOG_HOST) {
    console.warn(
      "PostHog analytics is enabled, but its project token or host is missing."
    );
    setAnalyticsProvider(null);
    return;
  }

  posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: PUBLIC_POSTHOG_HOST,
    // Keep product analytics anonymous and avoid automatic interaction capture.
    cookieless_mode: "always",
    disable_session_recording: true,
    autocapture: false,
    capture_exceptions: true,
    defaults: "2026-05-30",
  });
  posthog.register({ app_environment: PUBLIC_ANALYTICS_ENVIRONMENT });
  setAnalyticsProvider(postHogProvider);
};
