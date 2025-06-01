"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"

interface EnhancedPomodoroTimerProps {
  onSessionComplete: (duration: number, type: "work" | "break") => void
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export function EnhancedPomodoroTimer({
  onSessionComplete,
  isExpanded = false,
  onToggleExpand,
}: EnhancedPomodoroTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(25 * 60)
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)

  // Settings
  const [workDuration, setWorkDuration] = useState(25)
  const [shortBreakDuration, setShortBreakDuration] = useState(5)
  const [longBreakDuration, setLongBreakDuration] = useState(15)
  const [autoStart, setAutoStart] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Initialize audio
    if (typeof window !== "undefined") {
      audioRef.current = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
      )
    }
  }, [])

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

  const playSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignore audio play errors
      })
    }
  }

  const handleSessionComplete = () => {
    setIsRunning(false)
    setShowNotification(true)
    playSound()

    if (isWorkSession) {
      const newSessionCount = sessionCount + 1
      setSessionCount(newSessionCount)
      onSessionComplete(workDuration * 60, "work")

      // Determine break type
      const isLongBreak = newSessionCount % 4 === 0
      const breakDuration = isLongBreak ? longBreakDuration : shortBreakDuration

      toast({
        title: "Work session complete! 🎉",
        description: `Time for a ${isLongBreak ? "long" : "short"} break!`,
      })

      setSeconds(breakDuration * 60)
      setIsWorkSession(false)

      if (autoStart) {
        setTimeout(() => setIsRunning(true), 2000)
      }
    } else {
      onSessionComplete(isWorkSession ? workDuration * 60 : shortBreakDuration * 60, "break")

      toast({
        title: "Break time over! 💪",
        description: "Ready for another work session?",
      })

      setSeconds(workDuration * 60)
      setIsWorkSession(true)

      if (autoStart) {
        setTimeout(() => setIsRunning(true), 2000)
      }
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
    setSeconds(workDuration * 60)
    setIsWorkSession(true)
    setSessionCount(0)
  }

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const getCurrentDuration = () => {
    if (isWorkSession) return workDuration * 60
    return (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration) * 60
  }

  const progress = (getCurrentDuration() - seconds) / getCurrentDuration()

  const CompactView = () => (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center space-x-3">
        <div className="relative w-12 h-12">
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
            <span className="text-xs font-mono font-bold">{formatTime(seconds)}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            {isWorkSession ? (
              <Brain className="h-3 w-3 text-blue-600" />
            ) : (
              <Coffee className="h-3 w-3 text-green-600" />
            )}
            <span className="text-sm font-medium">{isWorkSession ? "Work" : "Break"}</span>
          </div>
          <div className="text-xs text-muted-foreground">Session {sessionCount + 1}</div>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button onClick={toggleTimer} size="sm" variant="outline">
          {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>
        <Button onClick={onToggleExpand} size="sm" variant="ghost">
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )

  const ExpandedView = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {isWorkSession ? (
              <Brain className="h-5 w-5 text-blue-600" />
            ) : (
              <Coffee className="h-5 w-5 text-green-600" />
            )}
            Pomodoro Timer
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button onClick={() => setShowSettings(!showSettings)} size="sm" variant="ghost">
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={onToggleExpand} size="sm" variant="ghost">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-lg font-medium">{isWorkSession ? "Work Session" : "Break Time"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Session {sessionCount + 1} • {sessionCount % 4 === 3 && !isWorkSession ? "Long Break" : ""}
          </div>
        </div>

        <div className="relative w-48 h-48 mx-auto">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="0.1" />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={isWorkSession ? "#3b82f6" : "#10b981"}
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
              className="transition-all duration-1000"
              animate={{
                strokeDashoffset: 2 * Math.PI * 45 * (1 - progress),
                stroke: isWorkSession ? "#3b82f6" : "#10b981",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="text-4xl font-bold font-mono"
              animate={{ scale: isRunning ? [1, 1.02, 1] : 1 }}
              transition={{ repeat: isRunning ? Number.POSITIVE_INFINITY : 0, duration: 2 }}
            >
              {formatTime(seconds)}
            </motion.div>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <Button
            onClick={toggleTimer}
            size="lg"
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
                <Pause className="mr-2 h-5 w-5" /> Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" /> Start
              </>
            )}
          </Button>

          <Button onClick={resetTimer} variant="outline" size="lg">
            <RotateCcw className="mr-2 h-5 w-5" /> Reset
          </Button>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 border-t pt-4"
            >
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Work Duration: {workDuration} min</Label>
                  <Slider
                    value={[workDuration]}
                    onValueChange={(value) => {
                      setWorkDuration(value[0])
                      if (isWorkSession && !isRunning) {
                        setSeconds(value[0] * 60)
                      }
                    }}
                    max={60}
                    min={5}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Short Break: {shortBreakDuration} min</Label>
                  <Slider
                    value={[shortBreakDuration]}
                    onValueChange={(value) => setShortBreakDuration(value[0])}
                    max={30}
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Long Break: {longBreakDuration} min</Label>
                  <Slider
                    value={[longBreakDuration]}
                    onValueChange={(value) => setLongBreakDuration(value[0])}
                    max={60}
                    min={5}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-start" className="text-sm font-medium">
                    Auto-start sessions
                  </Label>
                  <Switch id="auto-start" checked={autoStart} onCheckedChange={setAutoStart} />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sound" className="text-sm font-medium flex items-center gap-2">
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    Sound notifications
                  </Label>
                  <Switch id="sound" checked={soundEnabled} onCheckedChange={setSoundEnabled} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center text-xs text-muted-foreground">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>Work: {workDuration}m</div>
            <div>Short: {shortBreakDuration}m</div>
            <div>Long: {longBreakDuration}m</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return isExpanded ? <ExpandedView /> : <CompactView />
}
