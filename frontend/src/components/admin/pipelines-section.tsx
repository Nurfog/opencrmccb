"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { adminApi, type PipelineWithStages, type PipelineStage } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

export function PipelinesSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([])
  const [pipeModal, setPipeModal] = useState(false)
  const [editingPipe, setEditingPipe] = useState<PipelineWithStages | null>(null)
  const [pipeName, setPipeName] = useState("")
  const [pipeSlug, setPipeSlug] = useState("")
  const [pipeDesc, setPipeDesc] = useState("")
  const [pipeType, setPipeType] = useState("person")
  const [newStageNames, setNewStageNames] = useState<Record<string, string>>({})

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await adminApi.listPipelines()
      setPipelines(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchPipelines() }, [fetchPipelines])

  const openPipeForm = (p?: PipelineWithStages) => {
    setEditingPipe(p ?? null)
    setPipeName(p?.pipeline.name ?? "")
    setPipeSlug(p?.pipeline.slug ?? "")
    setPipeDesc(p?.pipeline.description ?? "")
    setPipeType(p?.pipeline.entity_type ?? "person")
    setPipeModal(true)
  }

  const handleSavePipe = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingPipe) {
        await adminApi.updatePipeline(editingPipe.pipeline.id, { name: pipeName, slug: pipeSlug, description: pipeDesc || undefined, entity_type: pipeType })
        success(t("admin.pipelineUpdated"))
      } else {
        await adminApi.createPipeline({ name: pipeName, slug: pipeSlug, description: pipeDesc || undefined, entity_type: pipeType })
        success(t("admin.pipelineCreated"))
      }
      setPipeModal(false)
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeletePipe = async (id: string) => {
    try {
      await adminApi.deletePipeline(id)
      success(t("admin.pipelineDeleted"))
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleAddStage = async (pipelineId: string, stages: PipelineStage[]) => {
    const name = newStageNames[pipelineId] ?? ""
    if (!name.trim()) return
    try {
      await adminApi.createStage(pipelineId, { name, position: stages.length })
      setNewStageNames(prev => ({ ...prev, [pipelineId]: "" }))
      fetchPipelines()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{t("admin.managePipelines")}</p>
          <button type="button" onClick={() => openPipeForm()} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t("admin.newPipeline")}
          </button>
        </div>
        <div className="space-y-4">
          {pipelines.map(pw => (
            <div key={pw.pipeline.id} className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-[13.5px] font-semibold tracking-tight">{pw.pipeline.name}</h3>
                    <span className={cn("slds-tag",
                      pw.pipeline.entity_type === "person" ? "slds-tag--info" : "slds-tag--violet"
                    )}>
                      {pw.pipeline.entity_type === "person" ? t("admin.person") : t("admin.company")}
                    </span>
                    {pw.pipeline.is_default && <span className="slds-tag slds-tag--success">{t("admin.default")}</span>}
                  </div>
                  {pw.pipeline.description && <p className="text-xs text-muted-foreground mt-0.5">{pw.pipeline.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => openPipeForm(pw)} className="slds-btn slds-btn--icon"><Edit className="h-4 w-4" /></button>
                  {!pw.pipeline.is_default && (
                    <button type="button" onClick={() => handleDeletePipe(pw.pipeline.id)} className="slds-btn slds-btn--icon text-red-500"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {pw.stages.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{ borderColor: s.color ?? '#6B7280', color: s.color ?? '#6B7280' }}>
                    <span>{s.name}</span>
                    {s.probability != null && <span className="opacity-60">({s.probability}%)</span>}
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <input className="w-28 px-3 py-1.5 rounded-full border border-border bg-card text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    value={newStageNames[pw.pipeline.id] ?? ""} onChange={(e) => setNewStageNames(prev => ({ ...prev, [pw.pipeline.id]: e.target.value }))}
                    placeholder={t("admin.addStage")} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddStage(pw.pipeline.id, pw.stages) } }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={pipeModal} onClose={() => setPipeModal(false)} title={editingPipe ? t("admin.editPipeline") : t("admin.newPipeline")}>
        <form onSubmit={handleSavePipe} className="space-y-4">
          <div>
            <label className="slds-label">{t("admin.pipelineName")}</label>
            <input className="slds-input" value={pipeName} onChange={(e) => setPipeName(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label">{t("admin.pipelineSlug")}</label>
            <input className="slds-input font-mono" value={pipeSlug} onChange={(e) => setPipeSlug(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label">{t("admin.pipelineDescription")}</label>
            <textarea className="slds-input min-h-[60px]" value={pipeDesc} onChange={(e) => setPipeDesc(e.target.value)} />
          </div>
          <div>
            <label className="slds-label">{t("admin.entityType")}</label>
            <select className="slds-input" value={pipeType} onChange={(e) => setPipeType(e.target.value)}>
              <option value="person">{t("admin.person")}</option>
              <option value="company">{t("admin.company")}</option>
            </select>
          </div>
          <div className="slds-modal__footer">
            <button type="button" onClick={() => setPipeModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" className="slds-btn slds-btn--brand">{t("common.save")}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
