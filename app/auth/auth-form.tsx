"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(searchParams.get("message") ?? "");
  const [error, setError] = useState(searchParams.get("error") ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const supabase = createClient();

    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        });
        if (resetError) throw resetError;
        setNotice("Enviamos as instruções de recuperação para o seu e-mail.");
        return;
      }

      if (mode === "signup") {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
          },
        });
        if (signupError) throw signupError;
        setNotice("Cadastro criado. Confirme seu e-mail para entrar no Simplifica.");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      router.replace("/");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível concluir a operação.";
      setError(
        message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="signin-page">
      <section className="signin-card">
        <div className="signin-logo">S</div>
        <span>SIMPLIFICA CONTAS</span>
        <h1>Dinheiro organizado.<br />Cabeça tranquila.</h1>
        <p>
          {mode === "login" && "Entre para acessar suas contas com segurança em qualquer dispositivo."}
          {mode === "signup" && "Crie sua conta para começar a organizar sua vida financeira."}
          {mode === "forgot" && "Informe seu e-mail para criar uma nova senha."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>Seu nome<input name="fullName" autoComplete="name" required /></label>
          )}
          <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
          {mode !== "forgot" && (
            <label>Senha<input name="password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
          )}

          {error && <div className="auth-message error" role="alert">{error}</div>}
          {notice && <div className="auth-message success" role="status">{notice}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar recuperação"}
          </button>
        </form>

        <div className="auth-links">
          {mode === "login" && <><button onClick={() => changeMode("forgot")}>Esqueci minha senha</button><button onClick={() => changeMode("signup")}>Criar uma conta</button></>}
          {mode !== "login" && <button onClick={() => changeMode("login")}>Voltar para o login</button>}
        </div>
        <small>Seus dados ficam separados e protegidos pela sua conta.</small>
      </section>
    </main>
  );
}
