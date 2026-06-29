"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Input, Field } from "@/components/ui";

export default function LoginPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name || email } },
        });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-brand-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">
            ₪
          </div>
          <h1 className="text-2xl font-bold text-slate-800">نظام المحاسبة</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login" ? "تسجيل الدخول إلى حسابك" : "إنشاء حساب جديد"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Field label="الاسم">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" />
            </Field>
          )}
          <Field label="البريد الإلكتروني">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="ltr"
            />
          </Field>
          <Field label="كلمة المرور">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
            />
          </Field>
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "جارٍ…" : mode === "login" ? "دخول" : "إنشاء حساب"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
          <button
            className="font-semibold text-brand-600 hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setErr(null);
            }}
          >
            {mode === "login" ? "أنشئ حساباً" : "سجّل الدخول"}
          </button>
        </p>
      </div>
    </div>
  );
}
