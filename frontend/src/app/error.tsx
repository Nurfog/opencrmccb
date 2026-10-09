"use client";

import { useEffect } from "react";
import { useI18n } from "@/contexts/i18n-context";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Logged for diagnostics, never rendered: backend messages may leak
    // paths or stack details.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{t("common.error", "Something went wrong")}</h2>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t("common.tryAgain", "Try again")}
        </button>
      </div>
    </div>
  );
}
