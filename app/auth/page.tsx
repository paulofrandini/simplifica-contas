import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSimplificaUser } from "@/lib/auth-user";

import { AuthForm } from "./auth-form";

export default async function AuthPage() {
  const user = await getSimplificaUser();
  if (user) redirect("/");

  return <Suspense fallback={<main className="signin-page" />}><AuthForm /></Suspense>;
}
