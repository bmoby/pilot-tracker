import type { AppError } from "@/shared/result";

export class StorageError extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "StorageError";
    this.appError = appError;
  }
}

export function createStorageError(
  code: string,
  message: string,
  path?: string,
  details?: string,
): StorageError {
  return new StorageError({
    code,
    message,
    path,
    details,
  });
}
