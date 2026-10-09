import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/contexts/i18n-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/contexts/toast-context";
import { AuthProvider } from "@/components/auth/auth-provider";

export const metadata: Metadata = {
  title: "OpenCRM - Customer Relationship Management",
  description: "Modern CRM system built with Next.js and Rust",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pre-hydration: apply stored locale/theme before first paint to
            avoid lang mismatch + theme flash (keys mirror the contexts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('opencrm-locale');if(l==='es'||l==='en'){document.documentElement.lang=l}else if((navigator.language||'').slice(0,2)==='es'){document.documentElement.lang='es'}var t=localStorage.getItem('opencrm-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
