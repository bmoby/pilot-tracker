import { describe, expect, it } from "vitest";
import { VsCodeCliClient, VsCodeCommandError } from "./vscode";

describe("открытие VS Code", () => {
  it("использует команду code, если она доступна", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const client = new VsCodeCliClient("code", async (command, args) => {
      calls.push({ command, args });
    });

    await client.openPath("/tmp/review-copy");

    expect(calls).toEqual([{ command: "code", args: ["/tmp/review-copy"] }]);
  });

  it("на macOS пробует открыть VS Code через open, если команда code недоступна", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const client = new VsCodeCliClient("code", async (command, args) => {
      calls.push({ command, args });

      if (command === "code") {
        throw new VsCodeCommandError({
          command,
          args,
          stdout: "",
          stderr: "",
          exitCode: null,
          message: "Команда не найдена.",
        });
      }
    });

    await client.openPath("/tmp/review-copy");

    expect(calls).toEqual([
      { command: "code", args: ["/tmp/review-copy"] },
      { command: "open", args: ["-a", "Visual Studio Code", "/tmp/review-copy"] },
    ]);
  });

  it("не подменяет явно настроенную команду", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const client = new VsCodeCliClient("/custom/code", async (command, args) => {
      calls.push({ command, args });
      throw new VsCodeCommandError({
        command,
        args,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Команда не найдена.",
      });
    });

    await expect(client.openPath("/tmp/review-copy")).rejects.toBeInstanceOf(VsCodeCommandError);
    expect(calls).toEqual([{ command: "/custom/code", args: ["/tmp/review-copy"] }]);
  });
});
