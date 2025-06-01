"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Coffee, Brain } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"

interface PomodoroTimerProps {
  onSessionComplete: (duration: number, type: "work" | "break") => void
}

export function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(25 * 60) // 25 minutes default
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const workDuration = 25 * 60 // 25 minutes
  const shortBreakDuration = 5 * 60 // 5 minutes
  const longBreakDuration = 15 * 60 // 15 minutes

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
    setShowNotification(true)

    if (isWorkSession) {
      const newSessionCount = sessionCount + 1
      setSessionCount(newSessionCount)
      onSessionComplete(workDuration, "work")

      // Determine break type
      const isLongBreak = newSessionCount % 4 === 0
      const breakDuration = isLongBreak ? longBreakDuration : shortBreakDuration

      toast({
        title: "Work session complete! 🎉",
        description: `Time for a ${isLongBreak ? "long" : "short"} break!`,
      })

      setSeconds(breakDuration)
      setIsWorkSession(false)
    } else {
      onSessionComplete(isWorkSession ? workDuration : shortBreakDuration, "break")

      toast({
        title: "Break time over! 💪",
        description: "Ready for another work session?",
      })

      setSeconds(workDuration)
      setIsWorkSession(true)
    }

    setTimeout(() => setShowNotification(false), 3000)
  }

  const toggleTimer = () => {
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setSeconds(workDuration)
    setIsWorkSession(true)
    setSessionCount(0)
  }

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const progress = isWorkSession
    ? (workDuration - seconds) / workDuration
    : ((sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration) - seconds) /
      (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration)

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <AnimatePresence>
        {showNotification && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div className="bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
              {isWorkSession ? "Break Time! ☕" : "Work Time! 💼"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          {isWorkSession ? <Brain className="h-5 w-5 text-blue-600" /> : <Coffee className="h-5 w-5 text-green-600" />}
          <span className="text-sm font-medium">{isWorkSession ? "Work Session" : "Break Time"}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Session {sessionCount + 1} • {sessionCount % 4 === 3 && !isWorkSession ? "Long Break" : ""}
        </div>
      </div>

      <div className="relative w-32 h-32 mb-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeOpacity="0.1" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isWorkSession ? "#3b82f6" : "#10b981"}
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="text-2xl font-bold font-mono"
            animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
            transition={{ repeat: isRunning ? Number.POSITIVE_INFINITY : 0, duration: 2 }}
          >
            {formatTime(seconds)}
          </motion.div>
        </div>
      </div>

      <div className="flex space-x-2 mb-4">
        <Button
          onClick={toggleTimer}
          size="sm"
          className={`${
            isRunning
              ? "bg-amber-500 hover:bg-amber-600"
              : isWorkSession
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-green-500 hover:bg-green-600"
          } text-white`}
        >
          {isRunning ? (
            <>
              <Pause className="mr-1 h-4 w-4" /> Pause
            </>
          ) : (
            <>
              <Play className="mr-1 h-4 w-4" /> Start
            </>
          )}
        </Button>

        <Button onClick={resetTimer} variant="outline" size="sm">
          <RotateCcw className="mr-1 h-4 w-4" /> Reset
        </Button>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <span>Work: 25min</span>
          <span>Short Break: 5min</span>
          <span>Long Break: 15min</span>
        </div>
      </div>
    </div>
  )
}
