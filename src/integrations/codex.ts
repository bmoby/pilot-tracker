import { spawn } from "node:child_process";

export type CodexAnalysisInput = {
  workingDirectory: string;
  schemaPath: string;
  outputPath: string;
  prompt: string;
};

export type CodexAnalysisResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CodexAnalysisClient = {
  runAnalysis(input: CodexAnalysisInput): Promise<CodexAnalysisResult>;
};

export class CodexCommandError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly cwd: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor({
    command,
    args,
    cwd,
    stdout,
    stderr,
    exitCode,
    message,
  }: {
    command: string;
    args: string[];
    cwd: string | null;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    message: string;
  }) {
    super(message);
    this.name = "CodexCommandError";
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class CodexCliClient implements CodexAnalysisClient {
  constructor(private readonly command = "codex") {}

  async runAnalysis(input: CodexAnalysisInput): Promise<CodexAnalysisResult> {
    const args = [
      "exec",
      "-C",
      input.workingDirectory,
      "-s",
      "read-only",
      "--output-schema",
      input.schemaPath,
      "--output-last-message",
      input.outputPath,
    ];

    return runCodex(this.command, args, input.prompt);
  }
}

async function runCodex(
  command: string,
  args: string[],
  prompt: string,
): Promise<CodexAnalysisResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
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
        new CodexCommandError({
          command,
          args,
          cwd: null,
          stdout: "",
          stderr: "",
          exitCode: null,
          message: error.message,
        }),
      );
    });

    child.on("close", (exitCode) => {
      const result = {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: exitCode ?? 0,
      };

      if (result.exitCode === 0) {
        resolve(result);
        return;
      }

      reject(
        new CodexCommandError({
          command,
          args,
          cwd: null,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          message:
            result.stderr.trim() ||
            result.stdout.trim() ||
            "Codex CLI завершил анализ с ошибкой.",
        }),
      );
    });

    child.stdin.write(prompt, "utf8");
    child.stdin.end();
  });
}
