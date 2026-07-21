import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { PreviewServer } from "./types.ts";

export interface StartPreviewServerOptions {
  cwd?: string;
  host?: string;
  port?: number;
  build?: boolean;
  timeoutMs?: number;
  command?: string;
}

function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${code ?? signal}`
          )
        );
    });
  });
}

async function findFreePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a preview port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForServer(
  url: string,
  process: ChildProcess,
  timeoutMs: number,
  logs: () => string
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) {
      throw new Error(
        `Preview server exited early (${process.exitCode}).\n${logs()}`
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
    } catch {
      // Server is not accepting connections yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for preview server at ${url}.\n${logs()}`);
}

function terminate(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }, 5_000);
    timeout.unref();
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

export async function startPreviewServer(
  options: StartPreviewServerOptions = {}
): Promise<PreviewServer> {
  const cwd = options.cwd ?? process.cwd();
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? (await findFreePort(host));
  const command =
    options.command ?? (process.versions.bun ? process.execPath : "bun");

  if (options.build ?? true) await runCommand(command, ["run", "build"], cwd);

  const child = spawn(
    command,
    ["x", "astro", "preview", "--host", host, "--port", String(port)],
    { cwd, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  const record = (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-20_000);
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);

  const url = `http://${host}:${port}`;
  try {
    await waitForServer(url, child, options.timeoutMs ?? 30_000, () => output);
  } catch (error) {
    await terminate(child);
    throw error;
  }

  let stopped = false;
  return {
    url,
    async stop() {
      if (stopped) return;
      stopped = true;
      await terminate(child);
    },
  };
}
