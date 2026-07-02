"use client"

import { useState, useEffect } from "react"
import { X, ArrowRight, Building2, User, Briefcase } from "lucide-react"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("leads.convertLead")}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="font-medium text-gray-900 dark:text-white">
              {lead.first_name} {lead.last_name}
            </div>
            {lead.company_name && (
              <div className="text-sm text-gray-500 dark:text-gray-400">{lead.company_name}</div>
            )}
            {lead.email && (
              <div className="text-sm text-gray-500 dark:text-gray-400">{lead.email}</div>
            )}
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t("leads.convertDescription")}
          </div>

          {/* Pipeline selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      active
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {isPerson ? (
                      <User className={`w-8 h-8 ${active ? "text-purple-600" : "text-gray-400"}`} />
                    ) : (
                      <Building2 className={`w-8 h-8 ${active ? "text-purple-600" : "text-gray-400"}`} />
                    )}
                    <span className={`text-sm font-medium ${active ? "text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"}`}>
                      {p.pipeline.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {isPerson ? t("leads.personPipeline") : t("leads.companyPipeline")}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* What will be created */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t("leads.willCreate")}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <User className="w-4 h-4 text-gray-400" />
              {t("leads.createContact")}: {lead.first_name} {lead.last_name}
            </div>
            {isCompany && (
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Building2 className="w-4 h-4 text-gray-400" />
                {t("leads.createCompany")}: {lead.company_name || "Unknown"}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Briefcase className="w-4 h-4 text-gray-400" />
              {t("leads.createDeal")}: {dealTitle || `${lead.first_name} ${lead.last_name} - ${lead.company_name || t("leads.createDeal")}`}
            </div>
          </div>

          {/* Deal fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("leads.dealTitle")}
              </label>
              <input
                type="text"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value)}
                placeholder={`${lead.first_name} ${lead.last_name} - ${lead.company_name || t("leads.createDeal")}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("leads.dealValue")}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConvert}
            disabled={loading || !selectedPipelineId}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
      </div>
    </div>
  )
}
