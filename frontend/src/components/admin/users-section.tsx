"use client"

import { useState, useEffect, useCallback } from "react"
import { Edit, Trash2 } from "lucide-react"
import { useI18n } from "@/contexts/i18n-context"
import { useToast } from "@/contexts/toast-context"
import { adminApi, usersApi, type Profile, type User } from "@/lib/api"
import { Modal } from "@/components/ui/modal"

export function UsersSection() {
  const { t } = useI18n()
  const { success, error } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [userProfiles, setUserProfiles] = useState<Profile[]>([])
  const [assignModal, setAssignModal] = useState(false)
  const [assigningUser, setAssigningUser] = useState<User | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState("")

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.list()
      setUsers(res)
    } catch { /* ignore */ }
  }, [])

  const fetchUserProfiles = useCallback(async () => {
    try {
      const res = await adminApi.listProfiles()
      setUserProfiles(res)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchUsers(); fetchUserProfiles() }, [fetchUsers, fetchUserProfiles])

  const openAssignModal = (user: User) => {
    setAssigningUser(user)
    setSelectedProfileId(user.profile_id ?? "")
    setAssignModal(true)
  }

  const handleAssignProfile = async () => {
    if (!assigningUser || !selectedProfileId) return
    try {
      await usersApi.updateProfile(assigningUser.id, selectedProfileId)
      success(t("admin.profileAssigned"))
      setAssignModal(false)
      fetchUsers()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  const handleDeleteUser = async (id: string) => {
    try {
      await usersApi.delete(id)
      success(t("admin.userDeleted"))
      fetchUsers()
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Error")
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{t("admin.manageUsers")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userName")}</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userEmail")}</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userProfile")}</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("admin.userPermissions")}</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="py-3 px-4">
                    <div className="font-medium">{u.first_name} {u.last_name}</div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                  <td className="py-3 px-4">
                    {userProfiles.find(p => p.id === u.profile_id)?.name ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.permissions ?? []).slice(0, 3).map(perm => (
                        <span key={perm} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">{perm}</span>
                      ))}
                      {(u.permissions ?? []).length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground">+{(u.permissions ?? []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openAssignModal(u)} className="slds-btn slds-btn--icon" title={t("admin.assignProfile")}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDeleteUser(u.id)} className="slds-btn slds-btn--icon text-red-500" title={t("common.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title={t("admin.assignProfile")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("admin.assignProfileTo")} <strong>{assigningUser?.first_name} {assigningUser?.last_name}</strong>
          </p>
          <select
            className="slds-input"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            <option value="">{t("admin.selectProfile")}</option>
            {userProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAssignModal(false)} className="slds-btn slds-btn--neutral">{t("common.cancel")}</button>
            <button type="button" onClick={handleAssignProfile} disabled={!selectedProfileId} className="slds-btn slds-btn--brand">{t("common.save")}</button>
          </div>
        </div>
      </Modal>
    </>
  )
}
