import { AlertCircle, KeyRound, LockKeyhole, LogIn, Mail } from "lucide-react";
import { loginAction } from "./auth-actions";

type LoginPageProps = {
  error: string | null;
  nextPath: string;
};

const errorMessages: Record<string, string> = {
  required: "Введите email и пароль администратора.",
  invalid: "Вход не выполнен. Проверьте email и пароль администратора.",
  session: "Войдите как администратор, чтобы продолжить.",
  configuration: "Вход администратора не настроен.",
  access: "Доступ разрешен только администратору.",
};

export function LoginPage({ error, nextPath }: LoginPageProps) {
  const message =
    error === null ? null : (errorMessages[error] ?? errorMessages.invalid);

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-neutral-950 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="grid gap-5">
          <div className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full bg-[#f5f5f3] px-3 text-sm font-medium text-neutral-500">
            <LockKeyhole size={16} aria-hidden="true" />
            Закрытый доступ
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-400">
              Pilot Tracker
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal md:text-5xl">
              Вход администратора
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-500">
              Доступ к студентам, комментариям, статусам и ИИ-рапортам открыт
              только администратору-преподавателю.
            </p>
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-[0_12px_34px_rgba(0,0,0,0.06)] md:p-6">
          <div>
            <h2 className="text-2xl font-semibold">Pilot Tracker</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Введите данные администратора.
            </p>
          </div>

          <form action={loginAction} className="mt-6 grid gap-5">
            <input type="hidden" name="next" value={nextPath} />
            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              Email администратора
              <span className="flex min-h-11 items-center gap-3 rounded-lg bg-[#f7f7f5] px-3 ring-1 ring-[#ebeae7] focus-within:ring-[#4fa75b]">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="text-neutral-400"
                />
                <input
                  className="min-h-11 flex-1 bg-transparent text-neutral-950 outline-none"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-medium text-neutral-700">
              Пароль
              <span className="flex min-h-11 items-center gap-3 rounded-lg bg-[#f7f7f5] px-3 ring-1 ring-[#ebeae7] focus-within:ring-[#4fa75b]">
                <KeyRound
                  size={16}
                  aria-hidden="true"
                  className="text-neutral-400"
                />
                <input
                  className="min-h-11 flex-1 bg-transparent text-neutral-950 outline-none"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </span>
            </label>

            <button
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-neutral-950 px-4 text-sm font-medium text-white"
              type="submit"
            >
              Войти
              <LogIn size={15} aria-hidden="true" />
            </button>

            {message !== null ? (
              <div className="flex items-start gap-3 rounded-lg bg-[#fff1ed] px-4 py-3 text-sm text-[#d45b51]">
                <AlertCircle
                  className="mt-0.5 shrink-0"
                  size={18}
                  aria-hidden="true"
                />
                <p>{message}</p>
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </main>
  );
}
