import { spawn } from "node:child_process";

export class VsCodeCommandError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor({
    command,
    args,
    stdout,
    stderr,
    exitCode,
    message,
  }: {
    command: string;
    args: string[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
    message: string;
  }) {
    super(message);
    this.name = "VsCodeCommandError";
    this.command = command;
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export type CodeOpenClient = {
  openPath(path: string): Promise<void>;
};

type ProcessRunner = (command: string, args: string[]) => Promise<void>;

export class VsCodeCliClient implements CodeOpenClient {
  constructor(
    private readonly command = "code",
    private readonly runner: ProcessRunner = runProcess,
  ) {}

  async openPath(path: string): Promise<void> {
    try {
      await this.runner(this.command, [path]);
    } catch (error) {
      if (this.command === "code" && isMissingCommandError(error)) {
        await this.runner("open", ["-a", "Visual Studio Code", path]);
        return;
      }

      throw error;
    }
  }
}

function isMissingCommandError(error: unknown): boolean {
  return error instanceof VsCodeCommandError && error.exitCode === null;
}

async function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      reject(
        new VsCodeCommandError({
          command,
          args,
          stdout: "",
          stderr: "",
          exitCode: null,
          message: error.message,
        }),
      );
    });

    child.on("close", (exitCode) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if ((exitCode ?? 0) === 0) {
        resolve();
        return;
      }

      reject(
        new VsCodeCommandError({
          command,
          args,
          stdout,
          stderr,
          exitCode: exitCode ?? 0,
          message: stderr.trim() || stdout.trim() || "VS Code завершился с ошибкой.",
        }),
      );
    });
  });
}
