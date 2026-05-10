export type AppError = {
  code: string;
  message: string;
  details?: string;
  path?: string;
};

export type AppResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: AppError;
    };

export function success<T>(value: T): AppResult<T> {
  return { ok: true, value };
}

export function failure<T = never>(error: AppError): AppResult<T> {
  return { ok: false, error };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as { code: unknown }).code === "string" &&
    typeof (value as { message: unknown }).message === "string"
  );
}

export function normalizeUnknownError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "unexpected_error",
      message: "Действие не выполнено из-за непредвиденной ошибки.",
      details: error.message,
    };
  }

  return {
    code: "unexpected_error",
    message: "Действие не выполнено из-за непредвиденной ошибки.",
    details: String(error),
  };
}
