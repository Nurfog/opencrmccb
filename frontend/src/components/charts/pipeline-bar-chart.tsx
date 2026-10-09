"use client"

import { useSyncExternalStore } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface PipelineBarChartProps {
  stages: Array<{ stage: string; count: number; total_value: number }>
}

export function PipelineBarChart({ stages }: PipelineBarChartProps) {
  // Subscribe to the theme class on <html> without setState-in-effect.
  const isDark = useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  )

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={stages} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
        <XAxis
          dataKey="stage"
          tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }}
          axisLine={{ stroke: isDark ? "#374151" : "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: isDark ? "#9ca3af" : "#6b7280" }}
          axisLine={{ stroke: isDark ? "#374151" : "#e5e7eb" }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#fff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            color: isDark ? "#f3f4f6" : "#111827",
            fontSize: "13px",
          }}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
        />
        <Bar
          dataKey="count"
          fill="#0176D3"
          radius={[4, 4, 0, 0]}
          fillOpacity={isDark ? 0.8 : 1}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
