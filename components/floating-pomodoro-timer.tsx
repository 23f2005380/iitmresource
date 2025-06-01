"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Pause, RotateCcw, Coffee, Brain, Volume2, VolumeX, X, BarChart3 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"
import { auth, db } from "@/app/firebase"
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from "firebase/firestore"

interface FloatingPomodoroTimerProps {
  onClose: () => void
  onSessionComplete: (duration: number, type: "work" | "break") => void
}

interface PomodoroSession {
  id?: string
  userId: string
  type: "work" | "break"
  duration: number
  completedAt: any
  date: string
}

export function FloatingPomodoroTimer({ onClose, onSessionComplete }: FloatingPomodoroTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(25 * 60)
  const [isWorkSession, setIsWorkSession] = useState(true)
  const [sessionCount, setSessionCount] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const [analytics, setAnalytics] = useState<PomodoroSession[]>([])

  // Settings
  const [workDuration, setWorkDuration] = useState(25)
  const [shortBreakDuration, setShortBreakDuration] = useState(5)
  const [longBreakDuration, setLongBreakDuration] = useState(15)
  const [autoStart, setAutoStart] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState("timer")

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

    // Load analytics
    loadAnalytics()
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

  const loadAnalytics = async () => {
    if (!auth.currentUser) return

    try {
      const sessionsRef = collection(db, "pomodoroSessions")
      const q = query(
        sessionsRef,
        where("userId", "==", auth.currentUser.email),
        orderBy("completedAt", "desc"),
        limit(50),
      )
      const querySnapshot = await getDocs(q)
      const sessions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PomodoroSession[]

      setAnalytics(sessions)
    } catch (error) {
      console.error("Error loading analytics:", error)
    }
  }

  const saveSession = async (type: "work" | "break", duration: number) => {
    if (!auth.currentUser) return

    try {
      const sessionData: PomodoroSession = {
        userId: auth.currentUser.email!,
        type,
        duration,
        completedAt: serverTimestamp(),
        date: new Date().toISOString().split("T")[0],
      }

      await addDoc(collection(db, "pomodoroSessions"), sessionData)
      loadAnalytics() // Refresh analytics
    } catch (error) {
      console.error("Error saving session:", error)
    }
  }

  const playSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignore audio play errors
      })
    }
  }

  const handleSessionComplete = async () => {
    setIsRunning(false)
    setShowNotification(true)
    playSound()

    if (isWorkSession) {
      const newSessionCount = sessionCount + 1
      setSessionCount(newSessionCount)
      await saveSession("work", workDuration * 60)
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
      const breakDuration = sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration
      await saveSession("break", breakDuration * 60)
      onSessionComplete(breakDuration * 60, "break")

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

  // Analytics calculations
  const todaysSessions = analytics.filter((session) => session.date === new Date().toISOString().split("T")[0])
  const workSessionsToday = todaysSessions.filter((session) => session.type === "work").length
  const totalWorkTimeToday = todaysSessions
    .filter((session) => session.type === "work")
    .reduce((total, session) => total + session.duration, 0)

  const weeklyStats = analytics.filter((session) => {
    const sessionDate = new Date(session.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return sessionDate >= weekAgo
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="overflow-hidden shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              {isWorkSession ? (
                <Brain className="h-5 w-5 text-blue-600" />
              ) : (
                <Coffee className="h-5 w-5 text-green-600" />
              )}
              Advanced Pomodoro Timer
            </CardTitle>
            <Button onClick={onClose} size="sm" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="timer">Timer</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="timer" className="space-y-6 mt-6">
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

                <div className="relative w-64 h-64 mx-auto">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeOpacity="0.1"
                    />
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
                      className="text-5xl font-bold font-mono"
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
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-6">
                <div className="space-y-4">
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
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{workSessionsToday}</div>
                      <p className="text-xs text-muted-foreground">Work sessions today</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{Math.round(totalWorkTimeToday / 60)}m</div>
                      <p className="text-xs text-muted-foreground">Focus time today</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{weeklyStats.filter((s) => s.type === "work").length}</div>
                      <p className="text-xs text-muted-foreground">Sessions this week</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {Math.round(
                          weeklyStats
                            .filter((s) => s.type === "work")
                            .reduce((total, session) => total + session.duration, 0) / 60,
                        )}
                        m
                      </div>
                      <p className="text-xs text-muted-foreground">Weekly focus time</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Recent Sessions
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {analytics.slice(0, 10).map((session, index) => (
                      <div key={session.id || index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {session.type === "work" ? (
                            <Brain className="h-3 w-3 text-blue-600" />
                          ) : (
                            <Coffee className="h-3 w-3 text-green-600" />
                          )}
                          <span className="capitalize">{session.type}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {Math.round(session.duration / 60)}m • {session.date}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
