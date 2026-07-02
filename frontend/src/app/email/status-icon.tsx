"use client"

import { CheckCircle, Clock, Mail, XCircle } from "lucide-react"

interface StatusIconProps {
  status: string
}

export function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case "sent":
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "draft":
      return <Clock className="h-4 w-4 text-yellow-500" />
    default:
      return <Mail className="h-4 w-4 text-muted-foreground" />
  }
}

