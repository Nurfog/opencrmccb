"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react"
import { notificationsApi, type Notification } from "@/lib/api"
import { formatDate, cn } from "@/lib/utils"
import { useI18n } from "@/contexts/i18n-context"

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifs, count] = await Promise.all([
          notificationsApi.list(),
          notificationsApi.getUnreadCount(),
        ])
        setNotifications(notifs)
        setUnreadCount(count.count)
      } catch {
        // Ignore errors
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Handle error
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications(notifications.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // Handle error
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.delete(id)
      const notif = notifications.find(n => n.id === id)
      setNotifications(notifications.filter(n => n.id !== id))
      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch {
      // Handle error
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white/80 hover:text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t("settings.notifications")}</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-brand hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  {t("settings.notifications")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                {t("common.noResults")}
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "p-3 border-b border-gray-100 dark:border-gray-800 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800",
                    !notif.read && "bg-brand/5"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    notif.read ? "bg-gray-100 dark:bg-gray-800" : "bg-brand/10"
                  )}>
                    <Bell className={cn("h-4 w-4", notif.read ? "text-gray-400" : "text-brand")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", !notif.read && "font-medium")}>{notif.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatDate(notif.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
