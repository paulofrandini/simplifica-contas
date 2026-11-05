import { redirect } from "next/navigation";

import { getSimplificaUser } from "@/lib/auth-user";

import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  const user = await getSimplificaUser();
  if (!user) redirect("/auth?error=Solicite novamente a recuperação de senha.");
  return <UpdatePasswordForm />;
}
