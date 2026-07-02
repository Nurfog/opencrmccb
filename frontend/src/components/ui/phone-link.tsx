"use client"

import { useState, useRef, useEffect, type ReactNode } from "react"
import { Phone, Copy, Check, PhoneCall, Video, ExternalLink, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"

const PHONE_REGEX = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?:[\s-]?(?:ext|x|extensión|interno)\s?\d{1,5})?/g

interface PhoneLinkProps {
  phone: string
  children?: ReactNode
  className?: string
}

export function PhoneLink({ phone, children, className }: PhoneLinkProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLDivElement>(null)

  const cleanNumber = phone.replace(/[\s.-]/g, "").replace(/^00/, "+")
  const telHref = `tel:${cleanNumber}`

  const integrations = getIntegrations()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
      if (videoRef.current && !videoRef.current.contains(e.target as Node)) {
        setVideoOpen(false)
      }
    }
    if (open || videoOpen) {
      document.addEventListener("mousedown", handleClick)
    }
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, videoOpen])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanNumber)
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1000)
    } catch { /* fallback */ }
  }

  const handle3CXCall = () => {
    const cfg = integrations["3cx"]
    if (cfg?.serverUrl) {
      const url = `${cfg.serverUrl}/click2call?phone=${encodeURIComponent(cleanNumber)}`
      window.open(url, "_blank")
    } else {
      window.location.href = telHref
    }
    setOpen(false)
  }

  const handleVideoCall = (provider: string) => {
    setOpen(false)
    setVideoOpen(false)
    switch (provider) {
      case "google":
        window.open("https://meet.google.com/new", "_blank")
        break
      case "microsoft":
        window.open("https://teams.microsoft.com/meeting/new", "_blank")
        break
      case "3cx":
        const cfg = integrations["3cx"]
        if (cfg?.serverUrl) {
          window.open(`${cfg.serverUrl}/videocall?phone=${encodeURIComponent(cleanNumber)}`, "_blank")
        }
        break
      default:
        window.open(`https://meet.google.com/new`, "_blank")
    }
  }

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="inline-flex items-center gap-1.5 text-brand hover:text-brand/80 font-medium text-sm transition-colors cursor-pointer"
        title={phone}
      >
        <Phone className="h-3.5 w-3.5" />
        {children ?? phone}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 text-sm">
          <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Llamada
          </div>
          <a
            href={telHref}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setOpen(false)}
          >
            <PhoneCall className="h-4 w-4 text-green-500" />
            <div>
              <span className="block">Teléfono</span>
              <span className="text-xs text-muted-foreground">{cleanNumber}</span>
            </div>
          </a>
          <button
            type="button"
            onClick={handle3CXCall}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
          >
            <Phone className="h-4 w-4 text-blue-500" />
            <div>
              <span className="block">3CX</span>
              <span className="text-xs text-muted-foreground">Llamada VoIP</span>
            </div>
          </button>

          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Videollamada
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); setVideoOpen(true) }}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
          >
            <Video className="h-4 w-4 text-purple-500" />
            <div>
              <span className="block">Nueva videollamada</span>
              <span className="text-xs text-muted-foreground">Google Meet / Teams / 3CX</span>
            </div>
          </button>

          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{copied ? "Copiado" : "Copiar número"}</span>
          </button>
        </div>
      )}

      {videoOpen && (
        <div
          ref={videoRef}
          className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1 text-sm"
        >
          <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Proveedor de videollamada
          </div>
          {integrations.google && (
            <button
              type="button"
              onClick={() => handleVideoCall("google")}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <Video className="h-4 w-4 text-red-500" />
              <div>
                <span className="block">Google Meet</span>
                <span className="text-xs text-muted-foreground">Crear reunión</span>
              </div>
            </button>
          )}
          {integrations.microsoft && (
            <button
              type="button"
              onClick={() => handleVideoCall("microsoft")}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <Monitor className="h-4 w-4 text-blue-500" />
              <div>
                <span className="block">Microsoft Teams</span>
                <span className="text-xs text-muted-foreground">Crear reunión</span>
              </div>
            </button>
          )}
          {integrations["3cx"] && (
            <button
              type="button"
              onClick={() => handleVideoCall("3cx")}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <Phone className="h-4 w-4 text-blue-500" />
              <div>
                <span className="block">3CX Video</span>
                <span className="text-xs text-muted-foreground">Videollamada VoIP</span>
              </div>
            </button>
          )}
          {(integrations.google || integrations.microsoft || integrations["3cx"]) ? null : (
            <button
              type="button"
              onClick={() => handleVideoCall("generic")}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="block">Google Meet</span>
                <span className="text-xs text-muted-foreground">Sin conexión — abrir Meet</span>
              </div>
            </button>
          )}
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button
            type="button"
            onClick={() => setVideoOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full text-left text-muted-foreground"
          >
            <span>Volver</span>
          </button>
        </div>
      )}
    </div>
  )
}

interface IntegrationConfig {
  serverUrl?: string
}

function getIntegrations(): Record<string, IntegrationConfig> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("integration_3cx")
    const result: Record<string, IntegrationConfig> = {}
    if (raw) result["3cx"] = JSON.parse(raw)
    const listRaw = localStorage.getItem("integrations_list")
    if (listRaw) {
      const list = JSON.parse(listRaw) as { provider: string }[]
      for (const item of list) {
        result[item.provider] = {}
      }
    }
    return result
  } catch {
    return {}
  }
}

/**
 * Reemplaza números telefónicos en un texto con componentes PhoneLink.
 */
export function detectPhones(text: string): ReactNode[] {
  if (!text) return [text]
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const regex = new RegExp(PHONE_REGEX.source, "g")
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const phone = match[0].trim()
    parts.push(<PhoneLink key={match.index} phone={phone}>{phone}</PhoneLink>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}
