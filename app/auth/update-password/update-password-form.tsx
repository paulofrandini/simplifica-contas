"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (password !== confirmation) {
      setError("As senhas não são iguais.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="signin-page"><section className="signin-card">
      <div className="signin-logo">S</div><span>SIMPLIFICA CONTAS</span>
      <h1>Crie sua nova senha.</h1><p>Use pelo menos oito caracteres.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>Nova senha<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
        <label>Confirmar senha<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></label>
        {error && <div className="auth-message error" role="alert">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
      </form>
    </section></main>
  );
}
