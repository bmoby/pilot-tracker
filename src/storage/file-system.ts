import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { z } from "zod";
import { createStorageError } from "./storage-error";

export async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    throw createStorageError(
      "storage_directory_unavailable",
      "Папку данных не удалось создать или открыть.",
      path,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let text: string;

  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw createStorageError(
      "json_file_missing",
      "Файл данных не удалось прочитать.",
      path,
      error instanceof Error ? error.message : String(error),
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw createStorageError(
      "json_parse_error",
      "Файл данных поврежден и не является корректным JSON.",
      path,
      error instanceof Error ? error.message : String(error),
    );
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw createStorageError(
      "json_schema_error",
      "Файл данных не соответствует ожидаемой структуре.",
      path,
      result.error.message,
    );
  }

  return result.data;
}

export async function safeWriteJsonFile<T>(
  path: string,
  data: T,
  schema: z.ZodType<T>,
): Promise<void> {
  const validation = schema.safeParse(data);

  if (!validation.success) {
    throw createStorageError(
      "json_schema_error",
      "Новые данные не соответствуют ожидаемой структуре.",
      path,
      validation.error.message,
    );
  }

  const directory = dirname(path);
  const tempPath = `${directory}/.${basename(path)}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  const text = `${JSON.stringify(validation.data, null, 2)}\n`;
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    JSON.parse(text);
    await ensureDirectory(directory);
    fileHandle = await open(tempPath, "w");
    await fileHandle.writeFile(text, "utf8");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    await rename(tempPath, path);
    await syncDirectory(directory);
    await readJsonFile(path, schema);
  } catch (error) {
    if (fileHandle !== null) {
      await fileHandle.close().catch(() => undefined);
    }

    await rm(tempPath, { force: true }).catch(() => undefined);

    if (error instanceof Error && error.name === "StorageError") {
      throw error;
    }

    throw createStorageError(
      "json_write_error",
      "Файл данных не удалось надежно записать.",
      path,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function syncDirectory(path: string): Promise<void> {
  let directoryHandle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    directoryHandle = await open(path, "r");
    await directoryHandle.sync();
  } catch {
    return;
  } finally {
    await directoryHandle?.close().catch(() => undefined);
  }
}
