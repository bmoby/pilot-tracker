import { redirect } from "next/navigation";
import { getCurrentAdminSession } from "@/auth/server";
import { normalizeNextPath } from "@/auth/routes";
import { LoginPage } from "@/ui/login-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = await searchParams;
  const nextPath = normalizeNextPath(readSearchParam(params.next));
  const session = await getCurrentAdminSession();

  if (session.ok) {
    redirect(nextPath);
  }

  return (
    <LoginPage error={readSearchParam(params.error)} nextPath={nextPath} />
  );
}

function readSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
