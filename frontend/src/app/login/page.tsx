"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/contexts/i18n-context";
import { useAuthStore } from "@/stores/auth-store";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    clearError();
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      // error is set in the store
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="bg-card rounded-2xl shadow-card border border-border p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="h-11 w-11 rounded-[12px] bg-primary flex items-center justify-center mb-4 shadow-sm">
              <span className="text-white text-lg font-bold">O</span>
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
              {t("auth.login.title", "Iniciar sesión")}
            </h1>
            <p className="text-[13.5px] text-muted-foreground mt-1">
              {t("auth.login.subtitle", "Accede a tu cuenta de OpenCRM")}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-[10px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[13px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="slds-label"
              >
                {t("auth.email", "Correo electrónico")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ejemplo.cl"
                autoComplete="email"
                required
                className="slds-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="slds-label"
              >
                {t("auth.password", "Contraseña")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
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

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-primary hover:brightness-90"
              >
                {t("auth.forgotPassword", "¿Olvidaste tu contraseña?")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="slds-btn slds-btn--brand w-full !min-h-[2.5rem]"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <LogIn size={16} />
              )}
              {t("auth.login.button", "Iniciar sesión")}
            </button>
          </form>

          <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
            {t("auth.login.noAccount", "¿No tienes una cuenta?")}{" "}
            <Link
              href="/register"
              className="text-primary font-medium hover:brightness-90"
            >
              {t("auth.login.registerLink", "Regístrate aquí")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
