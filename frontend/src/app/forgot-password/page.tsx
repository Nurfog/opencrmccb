"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      // Always show success to prevent email enumeration
      // But if there's a network error, show it
      if (err && typeof err === "object" && "status" in err) {
        // API error - still show success (backend always returns 200)
        setSent(true);
      } else {
        setError(t("auth.resetFailed", "Error al enviar el enlace. Intenta novamente."));
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="bg-card rounded-2xl shadow-card border border-border p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground mb-2">{t("auth.checkEmail")}</h1>
            <p className="text-[13.5px] text-muted-foreground mb-6">
              {t("auth.resetSent", { email })}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-[13px] font-medium text-primary hover:brightness-90"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="bg-card rounded-2xl shadow-card border border-border p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="h-11 w-11 rounded-[12px] bg-primary flex items-center justify-center mb-4 shadow-sm">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{t("auth.resetPassword")}</h1>
            <p className="text-[13.5px] text-muted-foreground mt-1 text-center">
              {t("auth.resetInstructions")}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-[10px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[13px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="slds-label">
                {t("auth.email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
                className="slds-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="slds-btn slds-btn--brand w-full !min-h-[2.5rem] disabled:opacity-50"
            >
              {loading ? t("app.loading") : t("auth.sendResetLink")}
            </button>
          </form>

          <p className="mt-6 text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:brightness-90">
              <ArrowLeft className="h-4 w-4" />
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
