"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Clock, TrendingUp, BarChart3 } from "lucide-react"
import { motion } from "framer-motion"

interface StudySession {
  id: string
  userId: string
  duration: number
  date: string
}

interface StudyVisualizerProps {
  studyData: StudySession[]
}

export function StudyVisualizer({ studyData = [] }: StudyVisualizerProps) {
  const [viewMode, setViewMode] = useState<"week" | "month" | "chart">("week")
  const [stats, setStats] = useState({
    totalHours: 0,
    averagePerDay: 0,
    longestSession: 0,
    daysStudied: 0,
    streak: 0,
  })
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({})
  const [chartData, setChartData] = useState<{ labels: string[]; data: number[] }>({
    labels: [],
    data: [],
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!studyData || studyData.length === 0) {
      setHeatmapData({})
      setChartData({ labels: [], data: [] })
      setStats({
        totalHours: 0,
        averagePerDay: 0,
        longestSession: 0,
        daysStudied: 0,
        streak: 0,
      })
      return
    }

    // Process study data
    const now = new Date()
    const startDate =
      viewMode === "week"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        : new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())

    startDate.setHours(0, 0, 0, 0)

    // Filter data for the selected time period
    const filteredData = studyData.filter((session) => {
      const sessionDate = new Date(session.date)
      return sessionDate >= startDate && sessionDate <= now
    })

    // Calculate stats
    let totalSeconds = 0
    let longestSession = 0
    const dayMap: Record<string, number> = {}

    filteredData.forEach((session) => {
      totalSeconds += session.duration
      longestSession = Math.max(longestSession, session.duration)

      // Format date as YYYY-MM-DD for grouping
      const dateStr = new Date(session.date).toISOString().split("T")[0]
      dayMap[dateStr] = (dayMap[dateStr] || 0) + session.duration
    })

    // Create heatmap data
    const heatmap: Record<string, number> = {}
    const chartLabels: string[] = []
    const chartValues: number[] = []

    const currentDate = new Date(startDate)

    // Calculate streak
    let streak = 0
    let currentStreak = 0

    // Sort dates for streak calculation
    const studyDates = Object.keys(dayMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    // Calculate current streak
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    for (let i = 0; i < studyDates.length; i++) {
      const currentDate = new Date(studyDates[i])
      currentDate.setHours(0, 0, 0, 0)

      if (i === 0) {
        // First day in streak
        const isToday = currentDate.toDateString() === now.toDateString()
        const isYesterday = currentDate.toDateString() === yesterday.toDateString()

        if (isToday || isYesterday) {
          currentStreak = 1
        } else {
          break
        }
      } else {
        const prevDate = new Date(studyDates[i - 1])
        prevDate.setHours(0, 0, 0, 0)

        const diffDays = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays === 1) {
          currentStreak++
        } else {
          break
        }
      }
    }

    streak = currentStreak

    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split("T")[0]
      const dateValue = dayMap[dateStr] || 0
      heatmap[dateStr] = dateValue

      // Format date for chart
      const formattedDate = currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })

      chartLabels.push(formattedDate)
      chartValues.push(Math.round(dateValue / 60)) // Convert to minutes

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Update stats
    const totalHours = totalSeconds / 3600
    const daysStudied = Object.keys(dayMap).length
    const dayCount = viewMode === "week" ? 7 : 30

    setHeatmapData(heatmap)
    setChartData({
      labels: chartLabels,
      data: chartValues,
    })

    setStats({
      totalHours: Number.parseFloat(totalHours.toFixed(1)),
      averagePerDay: Number.parseFloat((totalHours / dayCount).toFixed(1)),
      longestSession: Math.floor(longestSession / 60),
      daysStudied,
      streak,
    })
  }, [studyData, viewMode])

  // Draw chart when chart data changes
  useEffect(() => {
    if (viewMode === "chart" && canvasRef.current && chartData.labels.length > 0) {
      const ctx = canvasRef.current.getContext("2d")
      if (!ctx) return

      const width = canvasRef.current.width
      const height = canvasRef.current.height
      const padding = 20
      const labelPadding = 30

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Calculate max value for scaling
      const maxValue = Math.max(...chartData.data, 60) // At least 60 minutes

      // Draw axes
      ctx.beginPath()
      ctx.strokeStyle = "#94a3b8" // slate-400
      ctx.lineWidth = 1

      // Y-axis
      ctx.moveTo(padding, padding)
      ctx.lineTo(padding, height - labelPadding)

      // X-axis
      ctx.moveTo(padding, height - labelPadding)
      ctx.lineTo(width - padding, height - labelPadding)
      ctx.stroke()

      // Draw grid lines
      ctx.beginPath()
      ctx.strokeStyle = "#e2e8f0" // slate-200
      ctx.setLineDash([2, 2])

      // Draw horizontal grid lines
      const gridLines = 5
      for (let i = 0; i < gridLines; i++) {
        const y = padding + ((height - labelPadding - padding) / gridLines) * i
        ctx.moveTo(padding, y)
        ctx.lineTo(width - padding, y)
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw line chart
      ctx.beginPath()
      ctx.strokeStyle = "#3b82f6" // blue-500
      ctx.lineWidth = 2

      // Create gradient for area under the line
      const gradient = ctx.createLinearGradient(0, padding, 0, height - labelPadding)
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.3)") // blue-500 with opacity
      gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)")

      // Draw points and line
      chartData.data.forEach((value, index) => {
        const x = padding + ((width - padding * 2) / (chartData.data.length - 1)) * index
        const y = height - labelPadding - (value / maxValue) * (height - labelPadding - padding)

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      // Stroke the line
      ctx.stroke()

      // Fill area under the line
      ctx.lineTo(width - padding, height - labelPadding)
      ctx.lineTo(padding, height - labelPadding)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // Draw points and labels
      chartData.data.forEach((value, index) => {
        const x = padding + ((width - padding * 2) / (chartData.data.length - 1)) * index
        const y = height - labelPadding - (value / maxValue) * (height - labelPadding - padding)

        // Draw point
        ctx.fillStyle = "#3b82f6" // blue-500
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()

        // Draw label
        if (index % Math.ceil(chartData.data.length / 7) === 0 || index === chartData.data.length - 1) {
          ctx.fillStyle = "#64748b" // slate-500
          ctx.font = "10px sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(chartData.labels[index], x, height - 10)
        }

        // Draw value
        if (value > 0) {
          ctx.fillStyle = "#3b82f6" // blue-500
          ctx.font = "10px sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(`${value}m`, x, y - 10)
        }
      })

      // Draw Y-axis labels
      ctx.fillStyle = "#64748b" // slate-500
      ctx.font = "10px sans-serif"
      ctx.textAlign = "right"

      for (let i = 0; i <= gridLines; i++) {
        const value = Math.round((maxValue / gridLines) * (gridLines - i))
        const y = padding + ((height - labelPadding - padding) / gridLines) * i
        ctx.fillText(`${value}m`, padding - 5, y + 3)
      }
    }
  }, [chartData, viewMode])

  // Function to determine color intensity based on study duration
  const getColorIntensity = (minutes: number) => {
    if (minutes === 0) return "bg-slate-100 dark:bg-slate-800"
    if (minutes < 30) return "bg-blue-100 dark:bg-blue-900/30"
    if (minutes < 60) return "bg-blue-200 dark:bg-blue-800/40"
    if (minutes < 120) return "bg-blue-300 dark:bg-blue-700/60"
    return "bg-blue-400 dark:bg-blue-600/80"
  }

  // Generate days of the week
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Generate dates for the heatmap
  const dates = Object.keys(heatmapData).sort()

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {viewMode === "week" ? "Last 7 days" : viewMode === "month" ? "Last 30 days" : "Study Trends"}
        </div>
        <div className="flex space-x-1">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("week")}
            className={
              viewMode === "week" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-200 dark:border-blue-800"
            }
          >
            Week
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
            className={
              viewMode === "month" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-200 dark:border-blue-800"
            }
          >
            Month
          </Button>
          <Button
            variant={viewMode === "chart" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("chart")}
            className={
              viewMode === "chart" ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-200 dark:border-blue-800"
            }
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-blue-600 dark:text-blue-400">Total Hours</div>
          <div className="text-xl font-bold flex items-center text-blue-700 dark:text-blue-300">
            <Clock className="h-4 w-4 mr-1 text-blue-500" />
            {stats.totalHours}
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-amber-600 dark:text-amber-400">Streak</div>
          <div className="text-xl font-bold flex items-center text-amber-700 dark:text-amber-300">
            <TrendingUp className="h-4 w-4 mr-1 text-amber-500" />
            {stats.streak} days
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === "chart" ? (
          <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg p-2 shadow-inner">
            <canvas ref={canvasRef} width="300" height="150" className="w-full h-full" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 gap-1">
              {daysOfWeek.map((day, i) => (
                <div key={i} className="text-xs text-center text-blue-600 dark:text-blue-400">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-1 flex-1">
              {dates.map((date, i) => {
                const minutes = Math.floor(heatmapData[date] / 60)
                return (
                  <motion.div
                    key={i}
                    className={`aspect-square rounded-md ${getColorIntensity(minutes)} shadow-sm`}
                    title={`${date}: ${minutes} minutes`}
                    whileHover={{ scale: 1.1, zIndex: 10 }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                  >
                    {minutes > 0 && (
                      <div className="w-full h-full flex items-center justify-center text-[8px] font-medium text-blue-800 dark:text-blue-200">
                        {minutes}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              <div className="text-xs text-blue-600 dark:text-blue-400">Less</div>
              <div className="flex space-x-1">
                <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
                <div className="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30" />
                <div className="w-3 h-3 rounded-sm bg-blue-200 dark:bg-blue-800/40" />
                <div className="w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-700/60" />
                <div className="w-3 h-3 rounded-sm bg-blue-400 dark:bg-blue-600/80" />
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">More</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
