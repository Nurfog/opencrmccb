"use client"

import { useState, useEffect } from "react"
import { ArrowRight, Building2, User, Briefcase } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { leadsApi, adminApi, type Lead, type PipelineWithStages } from "@/lib/api"
import { useToast } from "@/contexts/toast-context"
import { useI18n } from "@/contexts/i18n-context"

interface ConvertLeadDialogProps {
  open: boolean
  lead: Lead | null
  onClose: () => void
  onSuccess: () => void
}

export function ConvertLeadDialog({ open, lead, onClose, onSuccess }: ConvertLeadDialogProps) {
  const { success, error } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState("")
  const [dealTitle, setDealTitle] = useState("")
  const [dealValue, setDealValue] = useState("")

  useEffect(() => {
    if (open) {
      adminApi.listPipelines().then(setPipelines).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (lead && pipelines.length > 0 && !selectedPipelineId) {
      // Default to first pipeline
      setSelectedPipelineId(pipelines[0].pipeline.id)
    }
  }, [lead, pipelines, selectedPipelineId])

  const selectedPipeline = pipelines.find(p => p.pipeline.id === selectedPipelineId)
  const isCompany = selectedPipeline?.pipeline.entity_type === "company"

  const handleConvert = async () => {
    if (!lead || !selectedPipelineId) return
    setLoading(true)

    try {
      const result = await leadsApi.convert(lead.id, {
        pipeline_id: selectedPipelineId,
        deal_title: dealTitle || undefined,
        deal_value: dealValue ? parseFloat(dealValue) : undefined,
      })

      const created = []
      if (result.contact_id) created.push(t("leads.createContact"))
      if (result.company_id) created.push(t("leads.createCompany"))
      if (result.deal_id) created.push(t("leads.createDeal"))

      success(`${t("leads.converted")}: ${created.join(", ")}`)
      onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("leads.converted")
      error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!open || !lead) return null

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t("leads.convertLead")}
      size="md"
    >
        <div className="space-y-4">
          <div className="bg-muted/60 border border-border rounded-[10px] p-3">
            <div className="text-[13.5px] font-medium text-foreground">
              {lead.first_name} {lead.last_name}
            </div>
            {lead.company_name && (
              <div className="text-[13px] text-muted-foreground">{lead.company_name}</div>
            )}
            {lead.email && (
              <div className="text-[13px] text-muted-foreground">{lead.email}</div>
            )}
          </div>

          <p className="text-[13px] text-muted-foreground">
            {t("leads.convertDescription")}
          </p>

          {/* Pipeline selector */}
          <div>
            <label className="slds-label mb-2">
              {t("leads.pipeline")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {pipelines.map(p => {
                const active = selectedPipelineId === p.pipeline.id
                const isPerson = p.pipeline.entity_type === "person"
                return (
                  <button
                    key={p.pipeline.id}
                    type="button"
                    onClick={() => setSelectedPipelineId(p.pipeline.id)}
                    className={`flex flex-col items-center gap-1.5 p-4 rounded-[10px] border transition-all ${
                      active
                        ? "border-primary bg-primary/[0.06]"
                        : "border-border hover:border-muted-foreground/30 bg-card"
                    }`}
                  >
                    {isPerson ? (
                      <User className={`w-7 h-7 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    ) : (
                      <Building2 className={`w-7 h-7 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <span className={`text-[13px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {p.pipeline.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isPerson ? t("leads.personPipeline") : t("leads.companyPipeline")}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* What will be created */}
          <div className="bg-muted/60 border border-border rounded-[10px] p-3 space-y-2">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("leads.willCreate")}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-foreground">
              <User className="w-4 h-4 text-muted-foreground" />
              {t("leads.createContact")}: {lead.first_name} {lead.last_name}
            </div>
            {isCompany && (
              <div className="flex items-center gap-2 text-[13px] text-foreground">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                {t("leads.createCompany")}: {lead.company_name || "Unknown"}
              </div>
            )}
            <div className="flex items-center gap-2 text-[13px] text-foreground">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              {t("leads.createDeal")}: {dealTitle || `${lead.first_name} ${lead.last_name} - ${lead.company_name || t("leads.createDeal")}`}
            </div>
          </div>

          {/* Deal fields */}
          <div className="space-y-3">
            <div>
              <label className="slds-label">
                {t("leads.dealTitle")}
              </label>
              <input
                type="text"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder={`${lead.first_name} ${lead.last_name} - ${lead.company_name || t("leads.createDeal")}`}
                className="slds-input"
              />
            </div>
            <div>
              <label className="slds-label">
                {t("leads.dealValue")}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                placeholder="0.00"
                className="slds-input"
              />
            </div>
          </div>
        </div>

        <div className="slds-modal__footer">
          <button
            type="button"
            onClick={onClose}
            className="slds-btn slds-btn--neutral"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={loading || !selectedPipelineId}
            className="slds-btn slds-btn--brand disabled:opacity-50"
          >
            {loading ? (
              t("leads.converted")
            ) : (
              <>
                {t("leads.convert")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
    </Modal>
  )
}
