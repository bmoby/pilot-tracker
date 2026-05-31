"use server";

import { redirect } from "next/navigation";
import { getAdminSessionFromUser } from "@/auth/admin";
import { createLoginPath, normalizeNextPath } from "@/auth/routes";
import { createSupabaseAuthServerClient } from "@/auth/server";

export async function loginAction(formData: FormData): Promise<never> {
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");
  const nextPath = normalizeNextPath(getFormString(formData, "next"));

  if (email === "" || password === "") {
    redirect(createLoginPath("required", nextPath));
  }

  let supabase;

  try {
    supabase = await createSupabaseAuthServerClient();
  } catch {
    redirect(createLoginPath("configuration", nextPath));
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error !== null || getAdminSessionFromUser(data.user) === null) {
    await supabase.auth.signOut();
    redirect(createLoginPath("invalid", nextPath));
  }

  redirect(nextPath);
}

export async function logoutAction(): Promise<never> {
  const supabase = await createSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
