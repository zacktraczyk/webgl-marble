import os from "node:os";
import type { Browser, Page } from "puppeteer-core";
import type { SystemMetadata } from "./types.ts";

export function collectSystemMetadata(): SystemMetadata {
  const cpus = os.cpus();
  return {
    platform: process.platform,
    release: os.release(),
    architecture: os.arch(),
    cpuModel: cpus[0]?.model ?? null,
    logicalCpuCount: cpus.length,
    totalMemoryBytes: os.totalmem(),
    runtime: process.versions.bun ? "bun" : "node",
    runtimeVersion: process.versions.bun ?? process.versions.node,
    hostname: os.hostname(),
  };
}

export async function collectBrowserMetadata(browser: Browser, page?: Page) {
  const metadata: {
    version: string;
    userAgent: string;
    protocolVersion?: string;
  } = {
    version: await browser.version(),
    userAgent: await browser.userAgent(),
  };

  if (page) {
    const client = await page.createCDPSession();
    try {
      const version = await client.send("Browser.getVersion");
      metadata.protocolVersion = version.protocolVersion;
    } finally {
      await client.detach();
    }
  }

  return metadata;
}
