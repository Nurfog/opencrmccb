"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Check, X, ExternalLink, RotateCw } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { webhooksApi, type Webhook as WebhookType, type WebhookDelivery } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

const WEBHOOK_EVENTS = [
  "contact_created", "contact_updated", "contact_deleted",
  "deal_created", "deal_updated", "deal_deleted",
]

export function WebhooksSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [whModal, setWhModal] = useState(false)
  const [whUrl, setWhUrl] = useState("")
  const [whEvent, setWhEvent] = useState("contact_created")
  const [whSecret, setWhSecret] = useState("")
  const [deliveriesModal, setDeliveriesModal] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<WebhookType | null>(null)

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await webhooksApi.list()
      setWebhooks(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchWebhooks() }, [fetchWebhooks])

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await webhooksApi.create({ url: whUrl, event: whEvent, secret: whSecret || undefined })
      success(t("admin.webhookCreated"))
      setWhModal(false)
      setWhUrl("")
      setWhSecret("")
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleToggleWebhook = async (wh: WebhookType) => {
    try {
      await webhooksApi.update(wh.id, { active: !wh.active })
      success(wh.active ? t("admin.webhookDisabled") : t("admin.webhookEnabled"))
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    try {
      await webhooksApi.delete(id)
      success(t("admin.webhookDeleted"))
      fetchWebhooks()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const openDeliveries = async (wh: WebhookType) => {
    setDeliveriesWebhook(wh)
    try {
      const res = await webhooksApi.listDeliveries(wh.id)
      setDeliveries(res)
    } catch { setDeliveries([]) }
    setDeliveriesModal(true)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{t("admin.manageWebhooks")}</p>
          <button type="button" onClick={() => setWhModal(true)} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t("admin.newWebhook")}
          </button>
        </div>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noWebhooks")}</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map(wh => (
              <div key={wh.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                      wh.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    )}>
                      {wh.active ? t("common.active") : t("common.inactive")}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                      {wh.event}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => handleToggleWebhook(wh)} className="slds-btn slds-btn--icon" title={wh.active ? t("common.disable") : t("common.enable")}>
                      {wh.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => openDeliveries(wh)} className="slds-btn slds-btn--icon" title={t("admin.viewDeliveries")}>
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDeleteWebhook(wh.id)} className="slds-btn slds-btn--icon text-red-500" title={t("common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <code className="truncate max-w-md">{wh.url}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={whModal} onClose={() => setWhModal(false)} title={t("admin.newWebhook")}>
        <form onSubmit={handleCreateWebhook} className="space-y-4">
          <div>
            <label className="slds-label">{t("admin.webhookUrl")}</label>
            <input className="slds-input font-mono" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://example.com/webhook" required />
          </div>
          <div>
            <label className="slds-label">{t("admin.webhookEvent")}</label>
            <select className="slds-input" value={whEvent} onChange={(e) => setWhEvent(e.target.value)}>
              {WEBHOOK_EVENTS.map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="slds-label">{t("admin.webhookSecret")} <span className="text-muted-foreground">({t("common.optional")})</span></label>
            <input className="slds-input font-mono" value={whSecret} onChange={(e) => setWhSecret(e.target.value)} placeholder="HMAC-SHA256 secret" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setWhModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" className="slds-btn slds-btn--brand">{t("common.create")}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={deliveriesModal} onClose={() => setDeliveriesModal(false)} title={`${t("admin.deliveries")} — ${deliveriesWebhook?.event ?? ""}`} size="lg">
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.noDeliveries")}</p>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.status")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.attempts")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("admin.responseCode")}</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                        d.status === "success" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                        d.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                        d.status === "processing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">{d.attempts}</td>
                    <td className="py-2 px-3 font-mono">{d.response_status ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  )
}
