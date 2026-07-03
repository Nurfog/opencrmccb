"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { MessageCircle, Send, Search, Phone, Video, MoreVertical, Check, CheckCheck, Clock, User, RefreshCw, UserPlus } from "lucide-react"
import { AppLayout } from "@/components/layout/app-layout"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { whatsAppApi, aiApi, contactsApi, type WhatsAppConversation, type WhatsAppMessage, type LeadExtraction } from "@/lib/api"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { formatDate, cn, formatDateTime } from "@/lib/utils"

export default function WhatsAppPage() {
  const { t } = useI18n()
  const { success, error } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [sendText, setSendText] = useState("")
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState<LeadExtraction | null>(null)
  const [extractionOpen, setExtractionOpen] = useState(false)
  const [editableData, setEditableData] = useState<Record<string, unknown>>({})

  const handleExtractLead = async () => {
    if (!selectedPhone) return
    setExtracting(true)
    try {
      const result = await aiApi.extractLead(selectedPhone)
      setEditableData(result.extracted_data)
      setExtractionResult(result)
      setExtractionOpen(true)
      success(t("whatsapp.extractedLead"))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("whatsapp.extractError")
      error(msg)
    } finally {
      setExtracting(false)
    }
  }

  const handleSaveExtractedContact = async () => {
    if (!extractionResult) return
    try {
      const d = editableData as Record<string, string>
      await contactsApi.create({
        first_name: d.first_name ?? "",
        last_name: d.last_name ?? "",
        email: d.email || undefined,
        phone: d.phone || extractionResult.phone_number,
        company_id: undefined,
        position: d.position || undefined,
        notes: d.notes || undefined,
      })
      success(t("whatsapp.saveLeadSuccess"))
      setExtractionOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("whatsapp.saveLeadError")
      error(msg)
    }
  }

  const fetchConversations = useCallback(async () => {
    try {
      const res = await whatsAppApi.getConversations()
      setConversations(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const fetchMessages = useCallback(async (phone?: string) => {
    if (!phone) return
    try {
      const res = await whatsAppApi.getMessages()
      setMessages(res.filter(m => m.from_number === phone || m.to_number === phone))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (selectedPhone) fetchMessages(selectedPhone)
  }, [selectedPhone, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sendText.trim() || !selectedPhone) return
    setSending(true)
    try {
      await whatsAppApi.sendMessage({ to: selectedPhone, content: sendText })
      setSendText("")
      fetchMessages(selectedPhone)
      fetchConversations()
    } catch {
      error(t("whatsapp.sendError"))
    } finally {
      setSending(false)
    }
  }

  const selectedConv = conversations.find(c => c.phone === selectedPhone)
  const filteredConversations = conversations.filter(c =>
    !searchQuery || c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)
  )

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    if (diff < 172800000) return t("whatsapp.yesterday")
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
  }

  const formatMsgTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <AppLayout>
      <div className="animate-fade-in h-[calc(100vh-8rem)] flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        {/* ─── Left panel: conversation list ─── */}
        <div className="w-80 lg:w-96 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{t("whatsapp.title")}</h2>
                <p className="text-xs text-green-600 dark:text-green-400">{t("whatsapp.connected")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchConversations() }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors"
              title={t("whatsapp.refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("whatsapp.searchConversations")}
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">{t("whatsapp.noConversations")}</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedPhone === conv.phone
                return (
                  <button
                    key={conv.phone}
                    type="button"
                    onClick={() => setSelectedPhone(conv.phone)}
                    className={cn(
                      "w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors border-b border-gray-100 dark:border-gray-800/50",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/30 border-l-2 border-l-transparent"
                    )}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-white text-sm font-semibold">
                        {(conv.contact_name ?? conv.phone).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{conv.contact_name ?? conv.phone}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        {conv.last_direction === "outbound" && <Check className="h-3 w-3 flex-shrink-0" />}
                        {conv.last_message}
                      </p>
                      {conv.contact_name && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{conv.phone}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ─── Right panel: chat ─── */}
        <div className="flex-1 flex flex-col">
          {selectedPhone ? (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPhone(null)}
                    className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-sm">
                    <span className="text-white text-sm font-semibold">
                      {(selectedConv?.contact_name ?? selectedPhone).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedConv?.contact_name ?? selectedPhone}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedConv?.contact_name ? selectedPhone : "WhatsApp"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleExtractLead}
                    disabled={extracting}
                    className="p-2.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors disabled:opacity-50"
                    title={t("whatsapp.convertToLead")}
                  >
                    {extracting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </button>
                  <button type="button" className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors" title={t("whatsapp.voiceCall")}>
                    <Phone className="h-4 w-4" />
                  </button>
                  <button type="button" className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors" title={t("whatsapp.videoCall")}>
                    <Video className="h-4 w-4" />
                  </button>
                  <button type="button" className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors" title={t("whatsapp.moreOptions")}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2 bg-gray-50/50 dark:bg-gray-950/50">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">{t("whatsapp.noMessages")}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{t("whatsapp.sendFirstMessage")}</p>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const reversed = [...messages].reverse()
                    return reversed.map((msg, i) => {
                      const isOut = msg.direction === "outbound"
                      const showDate = i === 0 || formatMsgTime(reversed[i - 1]?.created_at ?? "") !== formatMsgTime(msg.created_at)
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex justify-center my-3">
                              <span className="text-[11px] text-muted-foreground bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                                isOut
                                  ? "bg-blue-600 text-white rounded-br-md"
                                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              <div className={cn("flex items-center justify-end gap-1 mt-1", isOut ? "text-blue-200" : "text-muted-foreground")}>
                                <span className="text-[11px]">{formatMsgTime(msg.created_at)}</span>
                                {isOut && (
                                  msg.status === "sent"
                                    ? <CheckCheck className="h-3.5 w-3.5" />
                                    : <Clock className="h-3 w-3" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      className="w-full pl-4 pr-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                      value={sendText}
                      onChange={(e) => setSendText(e.target.value)}
                      placeholder={t("whatsapp.typeMessage")}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent) } }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!sendText.trim() || sending}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                      sendText.trim()
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {sending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50/30 dark:bg-gray-950/30">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center mx-auto mb-5 shadow-lg">
                  <MessageCircle className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("whatsapp.whatsappBusiness")}</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  {t("whatsapp.selectConversation")}
                </p>
                <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>{t("whatsapp.incomingOutgoing")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span>{t("whatsapp.realTimeNotifications")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lead extraction modal */}
      <Modal isOpen={extractionOpen} onClose={() => setExtractionOpen(false)} title={t("whatsapp.extractedLead")} size="lg">
        {extractionResult && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("whatsapp.extractedLeadDescription")}
            </p>
            {["first_name", "last_name", "email", "phone", "company", "position", "interest", "notes"].map((field) => (
              <div key={field}>
                <label className="slds-label capitalize">{field.replace("_", " ")}</label>
                <input
                  className="slds-input"
                  value={(editableData[field] as string) ?? ""}
                  onChange={(e) => setEditableData({ ...editableData, [field]: e.target.value })}
                  placeholder={field === "notes" ? "Notas del lead..." : field}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setExtractionOpen(false)} className="slds-btn slds-btn--neutral">
                {t("common.close")}
              </button>
              <button type="button" onClick={handleSaveExtractedContact} className="slds-btn slds-btn--brand flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {t("whatsapp.saveAsContact")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
