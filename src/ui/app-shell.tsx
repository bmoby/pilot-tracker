import Link from "next/link";
import { Database, Settings, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

type AppShellProps = {
  activeSection: "students" | "settings";
  children: ReactNode;
};

export function AppShell({ activeSection, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-950 text-white shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
              <Database size={20} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-normal">
                Pilot Tracker
              </span>
              <span className="block text-sm text-neutral-400">
                Локальная когорта
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-2">
            <NavLink href="/" active={activeSection === "students"}>
              <UsersRound size={17} aria-hidden="true" />
              Студенты
            </NavLink>
            <NavLink href="/settings" active={activeSection === "settings"}>
              <Settings size={17} aria-hidden="true" />
              Настройки
            </NavLink>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 lg:py-10">
        {children}
      </div>
    </main>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
        active
          ? "bg-neutral-950 text-white shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
          : "bg-[#f7f7f5] text-neutral-600 hover:bg-[#f1f1ef] hover:text-neutral-950",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
