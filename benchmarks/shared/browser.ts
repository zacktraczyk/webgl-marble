import { constants } from "node:fs";
import { access } from "node:fs/promises";
import puppeteer, { type LaunchOptions } from "puppeteer-core";
import type { LaunchedBrowser } from "./types.ts";

export interface LaunchBenchmarkBrowserOptions {
  executablePath?: string;
  headless?: boolean;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
  args?: string[];
}

function browserCandidates(): string[] {
  const fromEnvironment = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
  ].filter((value): value is string => Boolean(value));

  if (process.platform === "darwin") {
    return [
      ...fromEnvironment,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter((value): value is string => Boolean(value));
    return [
      ...fromEnvironment,
      ...roots.flatMap((root) => [
        `${root}\\Google\\Chrome\\Application\\chrome.exe`,
        `${root}\\Chromium\\Application\\chrome.exe`,
      ]),
    ];
  }
  return [
    ...fromEnvironment,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

export async function discoverBrowserExecutable(
  explicitPath?: string
): Promise<string> {
  const candidates = explicitPath ? [explicitPath] : browserCandidates();
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next conventional browser location.
    }
  }

  throw new Error(
    explicitPath
      ? `Browser executable is not accessible: ${explicitPath}`
      : "Could not find Chrome or Chromium. Pass --browser or set PUPPETEER_EXECUTABLE_PATH."
  );
}

export async function launchBrowser(
  options: LaunchBenchmarkBrowserOptions = {}
): Promise<LaunchedBrowser> {
  const executablePath = await discoverBrowserExecutable(
    options.executablePath
  );
  const defaultArgs = [
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
    "--no-first-run",
  ];
  const viewport = options.viewport ?? {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  };

  const launchOptions: LaunchOptions = {
    executablePath,
    headless: options.headless ?? true,
    args: [...defaultArgs, ...(options.args ?? [])],
    defaultViewport: viewport,
  };

  const browser = await puppeteer.launch(launchOptions);
  return { browser, executablePath };
}
