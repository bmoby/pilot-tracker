import Link from "next/link";
import { Database, Settings, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

type AppShellProps = {
  activeSection: "students" | "settings";
  children: ReactNode;
};

export function AppShell({ activeSection, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Database size={20} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Pilot Tracker</span>
              <span className="block text-sm text-slate-500">Локальная когорта</span>
            </span>
          </Link>

          <nav className="flex gap-2">
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

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-8">{children}</div>
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
        "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
        active
          ? "bg-teal-700 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
