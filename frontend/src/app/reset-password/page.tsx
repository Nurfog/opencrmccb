"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { authApi } from "@/lib/api";

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t("auth.invalidToken", "Token inválido o faltante."));
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setError(t("auth.passwordTooShort", "La contraseña debe tener al menos 8 caracteres."));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      let message = t("auth.resetFailed", "Error al restablecer la contraseña.");
      if (err && typeof err === "object" && "message" in err) {
        message = (err as { message: string }).message || message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="bg-card rounded-2xl shadow-card border border-border p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground mb-2">{t("auth.passwordChanged")}</h1>
            <p className="text-[13.5px] text-muted-foreground mb-6">
              {t("auth.resetSuccess", "Tu contraseña ha sido restablecida exitosamente.")}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="slds-btn slds-btn--brand w-full !min-h-[2.5rem] disabled:opacity-50"
            >
              {t("auth.backToLogin")}
            </button>
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
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground">{t("auth.resetPassword")}</h1>
            <p className="text-[13.5px] text-muted-foreground mt-1 text-center">
              {t("auth.resetPasswordInstructions", "Ingresa tu nueva contraseña.")}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-[10px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[13px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {!token ? (
            <div className="text-center">
              <p className="text-[13.5px] text-muted-foreground mb-4">
                {t("auth.invalidToken", "Token inválido o faltante.")}
              </p>
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-primary hover:brightness-90"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.forgotPassword")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="slds-label">
                  {t("auth.newPassword")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="slds-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="slds-label">
                  {t("auth.confirmNewPassword")}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="slds-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="slds-btn slds-btn--brand w-full !min-h-[2.5rem] disabled:opacity-50"
              >
                {loading ? t("app.loading") : t("auth.resetPassword")}
              </button>
            </form>
          )}

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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
