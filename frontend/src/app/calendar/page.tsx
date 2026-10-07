"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, ChevronLeft, ChevronRight, Trash2, RefreshCw, Link2 } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { calendarApi, type CalendarEvent } from "@/lib/api"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type ViewMode = "month" | "week"

const DAY_NAMES_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const MONTH_NAMES_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

export default function CalendarPage() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState({ google: false, microsoft: false })

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formLocation, setFormLocation] = useState("")
  const [formStartDate, setFormStartDate] = useState("")
  const [formStartTime, setFormStartTime] = useState("")
  const [formEndDate, setFormEndDate] = useState("")
  const [formEndTime, setFormEndTime] = useState("")
  const [formAllDay, setFormAllDay] = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const start = new Date(currentDate)
      start.setDate(1)
      start.setMonth(start.getMonth() - 1)
      const end = new Date(currentDate)
      end.setDate(1)
      end.setMonth(end.getMonth() + 2)

      const res = await calendarApi.listEvents({
        start: start.toISOString(),
        end: end.toISOString(),
      })
      setEvents(res)
    } catch {} finally {
      setLoading(false)
    }
  }, [currentDate])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await calendarApi.status()
      setConnectionStatus(res)
    } catch {}
  }, [])

  useEffect(() => {
    fetchEvents()
    fetchStatus()
  }, [fetchEvents, fetchStatus])

  const navigatePrev = () => {
    const d = new Date(currentDate)
    if (viewMode === "month") d.setMonth(d.getMonth() - 1)
    else d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  const navigateNext = () => {
    const d = new Date(currentDate)
    if (viewMode === "month") d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  // Helpers: <input type="date/time"> values are LOCAL wall-clock time.
  // Never append "Z" to them (that reinterprets local time as UTC and shifts
  // events by the UTC offset). Build a local Date and serialize with toISOString.
  const toLocalInputParts = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0")
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    }
  }

  const combineLocalToISO = (date: string, time: string) => {
    const [y, m, day] = date.split("-").map(Number)
    const [h, mi] = time.split(":").map(Number)
    return new Date(y, m - 1, day, h, mi, 0).toISOString()
  }

  const navigateToday = () => setCurrentDate(new Date())

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const days: (Date | null)[] = []

    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }

  const getWeekDays = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((e) => {
      const eventDate = new Date(e.start_time)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

  const handleCreateEvent = () => {
    setFormTitle("")
    setFormDescription("")
    setFormLocation("")
    const now = new Date()
    const startParts = toLocalInputParts(now)
    const endParts = toLocalInputParts(new Date(now.getTime() + 60 * 60 * 1000))
    setFormStartDate(startParts.date)
    setFormStartTime(startParts.time)
    setFormEndDate(endParts.date)
    setFormEndTime(endParts.time)
    setFormAllDay(false)
    setSelectedEvent(null)
    setFormOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setFormTitle(event.title)
    setFormDescription(event.description || "")
    setFormLocation(event.location || "")
    const start = new Date(event.start_time)
    const end = new Date(event.end_time)
    const startParts = toLocalInputParts(start)
    const endParts = toLocalInputParts(end)
    setFormStartDate(startParts.date)
    setFormStartTime(startParts.time)
    setFormEndDate(endParts.date)
    setFormEndTime(endParts.time)
    setFormAllDay(event.all_day)
    setFormOpen(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const startTime = formAllDay
        ? combineLocalToISO(formStartDate, "00:00")
        : combineLocalToISO(formStartDate, formStartTime)
      const endTime = formAllDay
        ? combineLocalToISO(formEndDate, "23:59")
        : combineLocalToISO(formEndDate, formEndTime)

      if (new Date(endTime) <= new Date(startTime)) {
        error(t("calendar.endBeforeStart"))
        return
      }

      const data = {
        title: formTitle,
        description: formDescription || undefined,
        location: formLocation || undefined,
        start_time: startTime,
        end_time: endTime,
        all_day: formAllDay,
      }

      if (selectedEvent) {
        await calendarApi.updateEvent(selectedEvent.id, data)
        success(t("calendar.eventUpdated"))
      } else {
        await calendarApi.createEvent(data)
        success(t("calendar.eventCreated"))
      }
      setFormOpen(false)
      fetchEvents()
    } catch (err) {
      error(err instanceof Error ? err.message : t("calendar.eventSaveError"))
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    try {
      await calendarApi.deleteEvent(selectedEvent.id)
      success(t("calendar.eventDeleted"))
      setDeleteOpen(false)
      setSelectedEvent(null)
      fetchEvents()
    } catch {
      error(t("calendar.eventDeleteError"))
    }
  }

  const handleSync = async () => {
    try {
      const res = await calendarApi.syncGoogle()
      success(t("calendar.syncedCount", { count: res.synced }))
      fetchEvents()
    } catch {
      error(t("calendar.syncError"))
    }
  }

  const handleConnectGoogle = async () => {
    try {
      const res = await calendarApi.getAuthUrl("google")
      window.open(res.url, "_blank")
    } catch {
      error(t("calendar.authError"))
    }
  }

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate)
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {DAY_NAMES_KEYS.map((key) => (
          <div key={key} className="bg-muted/60 text-muted-foreground px-2 py-2 text-center text-xs font-medium">
            {t(`calendar.dayNames.${key}`)}
          </div>
        ))}
        {days.map((date, i) => (
          <div
            key={i}
            className={cn(
              "bg-card min-h-[100px] p-1.5 cursor-pointer hover:bg-muted/50",
              !date && "bg-muted/40",
              date && isToday(date) && "ring-2 ring-primary ring-inset"
            )}
            onClick={() => date && handleCreateEvent()}
          >
            {date && (
              <>
                <div className={cn("text-sm font-medium mb-1", isToday(date) ? "text-primary" : "text-foreground")}>
                  {date.getDate()}
                </div>
                {getEventsForDate(date).slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); handleEditEvent(event) }}
                    className="text-xs px-1.5 py-0.5 mb-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                  >
                    {event.title}
                  </div>
                ))}
                {getEventsForDate(date).length > 3 && (
                  <div className="text-xs text-muted-foreground">+{getEventsForDate(date).length - 3} more</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderWeekView = () => {
    const days = getWeekDays(currentDate)
    const hours = Array.from({ length: 24 }, (_, i) => i)

    return (
      <div className="overflow-auto max-h-[600px]">
        <div className="grid grid-cols-8 gap-px bg-border min-w-[700px]">
          <div className="bg-muted/60" />
          {days.map((d, i) => (
            <div key={i} className={cn("bg-muted/60 px-2 py-2 text-center text-xs font-medium", isToday(d) ? "text-primary" : "text-muted-foreground")}>
              <div>{t(`calendar.dayNames.${DAY_NAMES_KEYS[d.getDay()]}`)}</div>
              <div className={cn("text-lg", isToday(d) && "bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto")}>
                {d.getDate()}
              </div>
            </div>
          ))}
          {hours.map((hour) => (
            <div key={hour} className="contents">
              <div className="bg-muted/60 px-2 py-1 text-xs text-muted-foreground text-right">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {days.map((d, di) => {
                const hourEvents = events.filter((e) => {
                  const start = new Date(e.start_time)
                  return start.toDateString() === d.toDateString() && start.getHours() === hour
                })
                return (
                  <div key={di} className="bg-card min-h-[40px] border-b border-border/50 relative">
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEditEvent(event)}
                        className="absolute inset-x-0.5 bg-primary/10 text-primary text-xs px-1 py-0.5 rounded truncate cursor-pointer z-10"
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="slds-header">
          <div>
            <h1 className="slds-header__title">{t("calendar.title")}</h1>
            <p className="slds-header__description">
              {t("calendar.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!connectionStatus.google && (
              <button onClick={handleConnectGoogle} className="slds-btn slds-btn--neutral text-sm">
                <Link2 className="w-4 h-4" />
                {t("calendar.connectGoogle")}
              </button>
            )}
            {connectionStatus.google && (
              <button onClick={handleSync} className="slds-btn slds-btn--neutral text-sm">
                <RefreshCw className="w-4 h-4" />
                {t("calendar.syncGoogle")}
              </button>
            )}
            <button onClick={handleCreateEvent} className="slds-btn slds-btn--brand">
              <Plus className="w-4 h-4" />
              {t("calendar.newEvent")}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={navigatePrev} className="slds-btn slds-btn--icon">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={navigateToday} className="slds-btn slds-btn--neutral text-sm">
              {t("calendar.today")}
            </button>
            <button onClick={navigateNext} className="slds-btn slds-btn--icon">
              <ChevronRight className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground ml-2">
              {t(`calendar.monthNames.${MONTH_NAMES_KEYS[currentDate.getMonth()]}`)} {currentDate.getFullYear()}
            </h2>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("month")}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", viewMode === "month" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
            >
              {t("calendar.month")}
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", viewMode === "week" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
            >
              {t("calendar.week")}
            </button>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">{t("calendar.loading")}</div>
        ) : viewMode === "month" ? (
          renderMonthView()
        ) : (
          renderWeekView()
        )}
      </div>

      {/* Event Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={selectedEvent ? t("calendar.editEvent") : t("calendar.newEvent")}
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label className="slds-label">{t("calendar.eventTitle")} *</label>
            <input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
              className="slds-input" />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">{t("calendar.allDay")}</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="slds-label">{t("calendar.startLabel")} *</label>
              <input type="date" required value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)}
                className="slds-input" />
              {!formAllDay && (
                <input type="time" required value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}
                  className="slds-input mt-1" />
              )}
            </div>
            <div>
              <label className="slds-label">{t("calendar.endLabel")} *</label>
              <input type="date" required value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)}
                className="slds-input" />
              {!formAllDay && (
                <input type="time" required value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}
                  className="slds-input mt-1" />
              )}
            </div>
          </div>
          <div>
            <label className="slds-label">{t("calendar.location")}</label>
            <input type="text" value={formLocation} onChange={(e) => setFormLocation(e.target.value)}
              className="slds-input" />
          </div>
          <div>
            <label className="slds-label">{t("calendar.eventDescription")}</label>
            <textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
              className="slds-input resize-none" />
          </div>
          <div className="slds-modal__footer justify-between">
            {selectedEvent && (
              <button type="button" onClick={() => { setDeleteOpen(true) }} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                <Trash2 className="w-4 h-4" />
                {t("common.delete")}
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => setFormOpen(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
              <button type="submit" className="slds-btn slds-btn--brand">
                {selectedEvent ? t("common.update") : t("common.create")}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteEvent}
        title={t("calendar.deleteEvent")}
        message={t("calendar.deleteEventMessage", { title: selectedEvent?.title ?? "" })}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </AppLayout>
  )
}
