import { spawn } from "node:child_process";
import type { AiPullRequestContext } from "@/domain/schemas";

export type PullRequestContextInput = {
  repositoryUrl: string | null;
  newCommit: string;
};

export type PullRequestContextClient = {
  findPullRequestContext(
    input: PullRequestContextInput,
  ): Promise<AiPullRequestContext>;
};

type GitHubCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class GitHubCliCommandError extends Error {
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
    this.name = "GitHubCliCommandError";
    this.command = command;
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class GitHubCliClient implements PullRequestContextClient {
  constructor(private readonly command = "gh") {}

  async findPullRequestContext(
    input: PullRequestContextInput,
  ): Promise<AiPullRequestContext> {
    const repository = parseGithubRepository(input.repositoryUrl);

    if (repository === null) {
      return createPullRequestContext(
        "not_requested",
        "GitHub-ссылка не сохранена.",
      );
    }

    try {
      const result = await runGitHub(this.command, [
        "pr",
        "list",
        "--repo",
        repository,
        "--state",
        "all",
        "--search",
        input.newCommit,
        "--limit",
        "1",
        "--json",
        "number,title,url,state",
      ]);
      const parsed = parsePullRequestList(result.stdout);
      const first = parsed[0];

      if (first === undefined) {
        return createPullRequestContext("not_found", null);
      }

      return {
        status: "found",
        number: first.number,
        title: first.title,
        url: first.url,
        state: first.state,
        error: null,
      };
    } catch (error) {
      return createPullRequestContext(
        "unavailable",
        error instanceof Error
          ? cleanDetails(error.message)
          : cleanDetails(String(error)),
      );
    }
  }
}

function parseGithubRepository(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  const httpsMatch = normalized.match(
    /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  );
  const sshMatch = normalized.match(
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i,
  );
  const match = httpsMatch ?? sshMatch;

  if (match === null) {
    return null;
  }

  return `${match[1]}/${match[2]}`;
}

function parsePullRequestList(stdout: string): Array<{
  number: number;
  title: string | null;
  url: string | null;
  state: string | null;
}> {
  const parsed = JSON.parse(stdout) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const number = typeof record.number === "number" ? record.number : null;

    if (number === null) {
      return [];
    }

    return [
      {
        number,
        title: typeof record.title === "string" ? record.title : null,
        url: typeof record.url === "string" ? record.url : null,
        state: typeof record.state === "string" ? record.state : null,
      },
    ];
  });
}

function createPullRequestContext(
  status: AiPullRequestContext["status"],
  error: string | null,
): AiPullRequestContext {
  return {
    status,
    number: null,
    title: null,
    url: null,
    state: null,
    error,
  };
}

async function runGitHub(
  command: string,
  args: string[],
): Promise<GitHubCommandResult> {
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
        new GitHubCliCommandError({
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
        new GitHubCliCommandError({
          command,
          args,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          message:
            result.stderr.trim() ||
            result.stdout.trim() ||
            "GitHub CLI завершил команду с ошибкой.",
        }),
      );
    });
  });
}

function cleanDetails(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 1000);
}
