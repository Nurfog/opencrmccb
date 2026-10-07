"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/contexts/i18n-context";
import { useAuthStore } from "@/stores/auth-store";
import { Eye, EyeOff, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, clearError } = useAuthStore();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const validate = (): boolean => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setValidationError(t("auth.register.requiredFields", "Todos los campos son obligatorios"));
      return false;
    }
    if (password.length < 6) {
      setValidationError(t("auth.register.passwordLength", "La contraseña debe tener al menos 6 caracteres"));
      return false;
    }
    if (password !== confirmPassword) {
      setValidationError(t("auth.register.passwordsDoNotMatch", "Las contraseñas no coinciden"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    clearError();
    if (!validate()) return;
    try {
      await register({ email, password, first_name: firstName, last_name: lastName });
      router.push("/dashboard");
    } catch {
      // error is set in the store
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="bg-card rounded-2xl shadow-card border border-border p-8">
          <div className="flex flex-col items-center mb-7">
            <div className="h-11 w-11 rounded-[12px] bg-primary flex items-center justify-center mb-4 shadow-sm">
              <span className="text-white text-lg font-bold">O</span>
            </div>
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
              {t("auth.register.title", "Crear cuenta")}
            </h1>
            <p className="text-[13.5px] text-muted-foreground mt-1">
              {t("auth.register.subtitle", "Regístrate en OpenCRM")}
            </p>
          </div>

          {displayError && (
            <div className="mb-4 p-3 rounded-[10px] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[13px] text-red-700 dark:text-red-300">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="slds-label"
                >
                  {t("auth.firstName", "Nombre")}
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan"
                  autoComplete="given-name"
                  required
                  className="slds-input"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="slds-label"
                >
                  {t("auth.lastName", "Apellido")}
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Pérez"
                  autoComplete="family-name"
                  required
                  className="slds-input"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="slds-label"
              >
                {t("auth.confirmPassword", "Confirmar contraseña")}
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="slds-input"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="slds-btn slds-btn--brand w-full !min-h-[2.5rem] disabled:opacity-50"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <UserPlus size={16} />
              )}
              {t("auth.register.button", "Crear cuenta")}
            </button>
          </form>

          <p className="mt-6 text-center text-[13.5px] text-muted-foreground">
            {t("auth.register.hasAccount", "¿Ya tienes una cuenta?")}{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:brightness-90"
            >
              {t("auth.register.loginLink", "Inicia sesión")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
