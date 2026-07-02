"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Calendar, Phone, Mail, FileText, X, Edit, Trash2, CheckCircle } from "lucide-react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { activitiesApi, calendarApi, type Activity, type CalendarEvent } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate, formatDateTime } from "@/lib/utils"
import type { DateSelectArg, EventClickArg, EventInput } from "@fullcalendar/core"

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: FileText,
}

const typeColors: Record<string, string> = {
  call: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700",
  email: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700",
  meeting: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700",
  task: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
}

export default function ActivitiesPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [activities, setActivities] = useState<Activity[]>([])
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)

  const [formSubject, setFormSubject] = useState("")
  const [formType, setFormType] = useState("task")
  const [formDescription, setFormDescription] = useState("")
  const [formDate, setFormDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    try {
      const [acts, cals] = await Promise.all([
        activitiesApi.list(),
        calendarApi.listEvents({
          start: new Date(Date.now() - 30 * 86400000).toISOString(),
          end: new Date(Date.now() + 60 * 86400000).toISOString(),
        }),
      ])
      setActivities(acts)
      setCalEvents(cals)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("common.noResults")
      setErrorState(msg)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Check for overlapping events
  const checkOverlap = (start: string, end: string, excludeId?: string): string | null => {
    if (!start) return null
    const newStart = new Date(start).getTime()
    const newEnd = end ? new Date(end).getTime() : newStart + 3600000

    for (const ev of calEvents) {
      if (excludeId && `cal-${ev.id}` === excludeId) continue
      const evStart = new Date(ev.start_time).getTime()
      const evEnd = new Date(ev.end_time).getTime()
      if (newStart < evEnd && newEnd > evStart) {
        return `Se superpone con: "${ev.title}" (${new Date(ev.start_time).toLocaleTimeString()} - ${new Date(ev.end_time).toLocaleTimeString()})`
      }
    }
    for (const act of activities) {
      if (excludeId && `act-${act.id}` === excludeId) continue
      if (!act.due_date) continue
      const actStart = new Date(act.due_date).getTime()
      const actEnd = actStart + 3600000
      if (newStart < actEnd && newEnd > actStart) {
        return `Se superpone con: "${act.subject}"`
      }
    }
    return null
  }

  useEffect(() => {
    if (formDate) {
      const endMs = new Date(formDate).getTime() + 3600000
      setOverlapWarning(checkOverlap(formDate, new Date(endMs).toISOString()))
    } else {
      setOverlapWarning(null)
    }
  }, [formDate, activities, calEvents])

  const allCalendarEvents: EventInput[] = [
    ...activities.map((a) => ({
      id: `act-${a.id}`,
      title: a.subject,
      start: a.due_date || a.created_at,
      allDay: !a.due_date,
      extendedProps: { kind: "activity", activityType: a.activity_type, description: a.description, completed: a.completed },
      classNames: a.completed ? "fc-event-completed" : "",
    })),
    ...calEvents.map((e) => ({
      id: `cal-${e.id}`,
      title: `📅 ${e.title}`,
      start: e.start_time,
      end: e.end_time,
      allDay: e.all_day,
      extendedProps: { kind: "calendar", description: e.description, location: e.location },
      classNames: "fc-event-calendar",
    })),
  ]

  const handleDateSelect = (info: DateSelectArg) => {
    setFormDate(info.startStr.slice(0, 16))
    setCreateOpen(true)
  }

  const handleEventClick = (info: EventClickArg) => {
    const id = info.event.id
    if (id.startsWith("act-")) {
      const act = activities.find((a) => `act-${a.id}` === id)
      if (act) {
        setSelectedActivity(act)
        setDetailOpen(true)
      }
    }
    // Calendar events: could add detail modal later
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formSubject.trim()) return
    setSubmitting(true)
    try {
      await activitiesApi.create({
        activity_type: formType,
        subject: formSubject,
        description: formDescription || undefined,
        due_date: formDate || undefined,
      })
      success(t("toast.created", { entity: t("activities.title") }))
      setCreateOpen(false)
      resetForm()
      fetchActivities()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "create", entity: t("activities.title") })
      error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedActivity || !formSubject.trim()) return
    setSubmitting(true)
    try {
      await activitiesApi.update(selectedActivity.id, {
        subject: formSubject,
        activity_type: formType,
        description: formDescription || undefined,
        due_date: formDate || undefined,
      })
      success(t("toast.updated", { entity: t("activities.title") }))
      setEditOpen(false)
      setDetailOpen(false)
      setSelectedActivity(null)
      resetForm()
      fetchActivities()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "update", entity: t("activities.title") })
      error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedActivity) return
    try {
      await activitiesApi.delete(selectedActivity.id)
      success(t("toast.deleted", { entity: t("activities.title") }))
      setDetailOpen(false)
      setSelectedActivity(null)
      fetchActivities()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "delete", entity: t("activities.title") })
      error(msg)
    }
  }

  const handleComplete = async () => {
    if (!selectedActivity) return
    try {
      await activitiesApi.complete(selectedActivity.id)
      success(t("toast.updated", { entity: t("activities.title") }))
      setDetailOpen(false)
      setSelectedActivity(null)
      fetchActivities()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("toast.error", { action: "update", entity: t("activities.title") })
      error(msg)
    }
  }

  const openEdit = (act: Activity) => {
    setSelectedActivity(act)
    setFormSubject(act.subject)
    setFormType(act.activity_type)
    setFormDescription(act.description ?? "")
    setFormDate(act.due_date ? act.due_date.slice(0, 16) : "")
    setEditOpen(true)
  }

  const resetForm = () => {
    setFormSubject("")
    setFormType("task")
    setFormDescription("")
    setFormDate("")
  }

  return (
    <AppLayout>
      <div className="animate-fade-in space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("activities.title")}</h1>
            <p className="slds-header__description">{t("activities.description")}</p>
          </div>
          <button type="button" onClick={() => { resetForm(); setCreateOpen(true) }} className="slds-btn slds-btn--brand flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("activities.newActivity")}
          </button>
        </div>

        {loading ? (
          <div className="slds-card p-6">
            <div className="h-[500px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
              </div>
            </div>
          </div>
        ) : errorState ? (
          <EmptyState
            icon={Calendar}
            title={errorState}
            action={{ label: t("common.new"), onClick: fetchActivities }}
          />
        ) : (
          <div className="slds-card p-4">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              initialView="dayGridMonth"
              editable={false}
              selectable={true}
              selectMirror={false}
              dayMaxEvents={3}
              weekends={true}
              events={allCalendarEvents}
              select={handleDateSelect}
              eventClick={handleEventClick}
              height="auto"
            />
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t("activities.newActivity")}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="slds-label" htmlFor="act-subject">{t("activities.subject")}</label>
            <input id="act-subject" className="slds-input" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label" htmlFor="act-type">{t("activities.type")}</label>
            <select id="act-type" className="slds-input" value={formType} onChange={(e) => setFormType(e.target.value)}>
              <option value="task">Task</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className="slds-label" htmlFor="act-date">{t("activities.date")}</label>
            <input id="act-date" type="datetime-local" className="slds-input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          <div>
            <label className="slds-label" htmlFor="act-desc">{t("activities.description")}</label>
            <textarea id="act-desc" className="slds-input min-h-[80px]" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          </div>
          {overlapWarning && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ {overlapWarning}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" disabled={submitting} className="slds-btn slds-btn--brand">
              {submitting ? t("app.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={t("activities.editActivity")}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="slds-label" htmlFor="act-edit-subject">{t("activities.subject")}</label>
            <input id="act-edit-subject" className="slds-input" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} required />
          </div>
          <div>
            <label className="slds-label" htmlFor="act-edit-type">{t("activities.type")}</label>
            <select id="act-edit-type" className="slds-input" value={formType} onChange={(e) => setFormType(e.target.value)}>
              <option value="task">Task</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className="slds-label" htmlFor="act-edit-date">{t("activities.date")}</label>
            <input id="act-edit-date" type="datetime-local" className="slds-input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          <div>
            <label className="slds-label" htmlFor="act-edit-desc">{t("activities.description")}</label>
            <textarea id="act-edit-desc" className="slds-input min-h-[80px]" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
          </div>
          {overlapWarning && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ {overlapWarning}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="submit" disabled={submitting} className="slds-btn slds-btn--brand">
              {submitting ? t("app.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={t("activities.activityDetails")} size="sm">
        {selectedActivity && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[selectedActivity.activity_type] ?? typeColors.task}`}>
                {(typeIcons[selectedActivity.activity_type] ?? FileText)({ className: "h-5 w-5" })}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">{selectedActivity.subject}</h3>
                <p className="text-xs text-muted-foreground capitalize">{selectedActivity.activity_type}</p>
                {selectedActivity.completed && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">{t("activities.completed")}</span>
                )}
              </div>
            </div>
            {selectedActivity.description && (
              <p className="text-sm text-muted-foreground">{selectedActivity.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedActivity.due_date && (
                <>
                  <span className="text-muted-foreground">{t("activities.date")}</span>
                  <span className="font-medium">{formatDateTime(selectedActivity.due_date)}</span>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {!selectedActivity.completed && (
                <button type="button" onClick={handleComplete} className="slds-btn slds-btn--success flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t("activities.markComplete")}
                </button>
              )}
              <button type="button" onClick={() => openEdit(selectedActivity)} className="slds-btn slds-btn--neutral flex items-center gap-2">
                <Edit className="h-4 w-4" />
                {t("common.edit")}
              </button>
              <button type="button" onClick={handleDelete} className="slds-btn slds-btn--neutral text-red-500 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
