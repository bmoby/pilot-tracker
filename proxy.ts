import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/auth/proxy";

export async function proxy(request: NextRequest) {
  return updateAdminSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
