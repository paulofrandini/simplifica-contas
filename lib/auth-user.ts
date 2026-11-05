import { createClient } from "@/lib/supabase/server";

export type SimplificaUser = {
  id: string;
  displayName: string;
  email: string;
};

export async function getSimplificaUser(): Promise<SimplificaUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) return null;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  return {
    id: user.id,
    email: user.email,
    displayName: fullName || user.email,
  };
}
