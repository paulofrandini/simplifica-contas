import { FinanceDashboard } from "./finance-dashboard";
import { redirect } from "next/navigation";

import { getSimplificaUser } from "@/lib/auth-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSimplificaUser();
  if (!user) redirect("/auth");

  const firstName = user.displayName.split(/\s|@/)[0] || "você";
  return <FinanceDashboard userName={firstName} />;
}
