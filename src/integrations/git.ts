import { spawn } from "node:child_process";

export type GitCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class GitCommandError extends Error {
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
    this.name = "GitCommandError";
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export type GitProjectClient = {
  cloneRepository(repositoryUrl: string, targetPath: string): Promise<void>;
  readHead(repositoryPath: string): Promise<string>;
  isRepository(repositoryPath: string): Promise<boolean>;
  readStatus(repositoryPath: string): Promise<string>;
  fetchMain(repositoryPath: string): Promise<void>;
  readOriginMain(repositoryPath: string): Promise<string>;
  countCommits(repositoryPath: string, previousCommit: string): Promise<number>;
  resetToOriginMain(repositoryPath: string): Promise<void>;
};

export type GitReviewCopyClient = {
  readHead(repositoryPath: string): Promise<string>;
  readStatus(repositoryPath: string): Promise<string>;
  isRepository(repositoryPath: string): Promise<boolean>;
  readCurrentBranch(repositoryPath: string): Promise<string>;
  verifyCommit(repositoryPath: string, commit: string): Promise<void>;
  createDetachedWorktree(repositoryPath: string, reviewPath: string, commit: string): Promise<void>;
  removeWorktree(repositoryPath: string, reviewPath: string): Promise<void>;
};

export class GitCliClient implements GitProjectClient {
  constructor(private readonly command = "git") {}

  async cloneRepository(repositoryUrl: string, targetPath: string): Promise<void> {
    await runGit(this.command, ["clone", "--branch", "main", "--single-branch", repositoryUrl, targetPath]);
  }

  async readHead(repositoryPath: string): Promise<string> {
    const result = await runGit(this.command, ["rev-parse", "HEAD"], repositoryPath);
    return result.stdout.trim();
  }

  async isRepository(repositoryPath: string): Promise<boolean> {
    try {
      const result = await runGit(
        this.command,
        ["rev-parse", "--is-inside-work-tree"],
        repositoryPath,
      );

      return result.stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  async readStatus(repositoryPath: string): Promise<string> {
    const result = await runGit(this.command, ["status", "--porcelain"], repositoryPath);
    return result.stdout;
  }

  async fetchMain(repositoryPath: string): Promise<void> {
    await runGit(this.command, ["fetch", "origin", "main", "--prune"], repositoryPath);
  }

  async readOriginMain(repositoryPath: string): Promise<string> {
    const result = await runGit(
      this.command,
      ["rev-parse", "--verify", "origin/main^{commit}"],
      repositoryPath,
    );
    return result.stdout.trim();
  }

  async countCommits(repositoryPath: string, previousCommit: string): Promise<number> {
    const result = await runGit(
      this.command,
      ["rev-list", "--count", `${previousCommit}..origin/main`],
      repositoryPath,
    );
    const count = Number.parseInt(result.stdout.trim(), 10);

    if (Number.isNaN(count)) {
      throw new GitCommandError({
        command: this.command,
        args: ["rev-list", "--count", `${previousCommit}..origin/main`],
        cwd: repositoryPath,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        message: "Git вернул некорректное количество коммитов.",
      });
    }

    return count;
  }

  async resetToOriginMain(repositoryPath: string): Promise<void> {
    await runGit(this.command, ["reset", "--hard", "origin/main"], repositoryPath);
  }

  async readCurrentBranch(repositoryPath: string): Promise<string> {
    const result = await runGit(this.command, ["branch", "--show-current"], repositoryPath);
    return result.stdout.trim();
  }

  async verifyCommit(repositoryPath: string, commit: string): Promise<void> {
    await runGit(this.command, ["rev-parse", "--verify", `${commit}^{commit}`], repositoryPath);
  }

  async createDetachedWorktree(
    repositoryPath: string,
    reviewPath: string,
    commit: string,
  ): Promise<void> {
    await runGit(this.command, ["worktree", "add", "--detach", reviewPath, commit], repositoryPath);
  }

  async removeWorktree(repositoryPath: string, reviewPath: string): Promise<void> {
    await runGit(this.command, ["worktree", "remove", reviewPath], repositoryPath);
  }
}

async function runGit(command: string, args: string[], cwd?: string): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
        new GitCommandError({
          command,
          args,
          cwd: cwd ?? null,
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
        new GitCommandError({
          command,
          args,
          cwd: cwd ?? null,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          message: result.stderr.trim() || result.stdout.trim() || "Git-команда завершилась ошибкой.",
        }),
      );
    });
  });
}
