import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, locale?: string): string {
  return new Date(date).toLocaleDateString(resolveLocale(locale));
}

export function formatDateTime(date: string | Date, locale?: string): string {
  return new Date(date).toLocaleString(resolveLocale(locale));
}

function resolveLocale(locale?: string): string {
  if (locale) return locale === "es" ? "es-CL" : "en-US";
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("opencrm-locale") === "es") return "es-CL";
    } catch {
      // ignore
    }
  }
  return "en-US";
}

export function formatCurrency(value: number, currency = "USD", locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), { style: "currency", currency }).format(
    value
  );
}

export function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale)).format(value);
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Trigger a Blob download compatibly (Firefox needs the anchor in the DOM;
 * revoking synchronously can abort the download, so defer it).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
