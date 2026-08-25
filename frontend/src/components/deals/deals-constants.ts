export interface AuditEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
}

export const STAGE_CONFIG = [
  { id: "lead", name: "Lead", color: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600" },
  { id: "qualified", name: "Qualified", color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600" },
  { id: "proposal", name: "Proposal", color: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600" },
  { id: "negotiation", name: "Negotiation", color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600" },
  { id: "closed_won", name: "Closed Won", color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600" },
  { id: "closed_lost", name: "Closed Lost", color: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-600" },
]

export const stageColors: Record<string, string> = {
  lead: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  qualified: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  proposal: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  negotiation: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  closed_won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  closed_lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
}

export const stageI18nKey: Record<string, string> = {
  lead: "stages.lead",
  qualified: "stages.qualified",
  proposal: "stages.proposal",
  negotiation: "stages.negotiation",
  closed_won: "stages.closedWon",
  closed_lost: "stages.closedLost",
}
