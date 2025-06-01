"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Maximize2 } from "lucide-react"

interface SimplePomodoroTimerProps {
  onSessionComplete: (duration: number, type: "work" | "break") => void
  onExpand: () => void
}

export function SimplePomodoroTimer({ onSessionComplete, onExpand }: SimplePomodoroTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(25 * 60)
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isRunning && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev - 1)
      }, 1000)
    } else if (seconds === 0) {
      handleSessionComplete()
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRunning, seconds])

  const handleSessionComplete = () => {
    setIsRunning(false)

    if (isWorkSession) {
      const newSessionCount = sessionCount + 1
      setSessionCount(newSessionCount)
      onSessionComplete(25 * 60, "work")

      // Switch to break
      const isLongBreak = newSessionCount % 4 === 0
      setSeconds(isLongBreak ? 15 * 60 : 5 * 60)
      setIsWorkSession(false)
    } else {
      onSessionComplete(isWorkSession ? 25 * 60 : 5 * 60, "break")

      // Switch to work
      setSeconds(25 * 60)
      setIsWorkSession(true)
    }
  }

  const toggleTimer = () => {
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setSeconds(25 * 60)
    setIsWorkSession(true)
    setSessionCount(0)
  }

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const progress = isWorkSession
    ? (25 * 60 - seconds) / (25 * 60)
    : ((sessionCount % 4 === 0 ? 15 * 60 : 5 * 60) - seconds) / (sessionCount % 4 === 0 ? 15 * 60 : 5 * 60)

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.1" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isWorkSession ? "#3b82f6" : "#10b981"}
            strokeWidth="6"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-mono font-bold">{formatTime(seconds)}</span>
        </div>
      </div>

      <div className="text-center">
        <div className="text-sm font-medium">{isWorkSession ? "Work" : "Break"}</div>
        <div className="text-xs text-muted-foreground">Session {sessionCount + 1}</div>
      </div>

      <div className="flex items-center space-x-2">
        <Button onClick={toggleTimer} size="sm" variant="outline">
          {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <Button onClick={resetTimer} size="sm" variant="ghost">
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button onClick={onExpand} size="sm" variant="ghost">
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
