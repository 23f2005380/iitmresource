"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface StudyTimerProps {
  onSessionComplete: (duration: number, isComplete?: boolean) => void
}

export function StudyTimer({ onSessionComplete }: StudyTimerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const lastSaveRef = useRef<number>(0)

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = startTimeRef.current || Date.now() - seconds * 1000

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
          setSeconds(elapsedSeconds)

          // Save progress every minute (60 seconds)
          const currentMinute = Math.floor(elapsedSeconds / 60)
          const lastSaveMinute = Math.floor(lastSaveRef.current / 60)

          if (currentMinute > lastSaveMinute) {
            onSessionComplete(elapsedSeconds, false)
            lastSaveRef.current = elapsedSeconds
          }
        }
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRunning, onSessionComplete])

  const toggleTimer = () => {
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    // Only save if there was actual time tracked
    if (seconds > 0) {
      onSessionComplete(seconds, true)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }

    setSeconds(0)
    startTimeRef.current = null
    lastSaveRef.current = 0
  }

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      seconds.toString().padStart(2, "0"),
    ].join(":")
  }

  // Calculate progress for circular timer (0-1)
  const hourProgress = (seconds % 3600) / 3600
  const minuteProgress = (seconds % 60) / 60

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="confetti-container">
              {Array.from({ length: 50 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="confetti"
                  initial={{
                    top: "-10%",
                    left: `${Math.random() * 100}%`,
                    opacity: 1,
                  }}
                  animate={{
                    top: "100%",
                    left: `${Math.random() * 100}%`,
                    rotate: Math.random() * 360,
                    opacity: 0,
                  }}
                  transition={{
                    duration: Math.random() * 2 + 1,
                    ease: "easeOut",
                  }}
                  style={{
                    width: `${Math.random() * 10 + 5}px`,
                    height: `${Math.random() * 10 + 5}px`,
                    backgroundColor: `hsl(${Math.random() * 360}, 80%, 60%)`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-48 h-48 mb-6">
        {/* Hour ring */}
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="hourGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.1" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#hourGradient)"
            strokeWidth="2"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - hourProgress)}
            transform="rotate(-90 50 50)"
          />
        </svg>

        {/* Minute ring */}
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="minuteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="0.1" />
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="none"
            stroke="url(#minuteGradient)"
            strokeWidth="4"
            strokeDasharray={2 * Math.PI * 35}
            strokeDashoffset={2 * Math.PI * 35 * (1 - minuteProgress)}
            transform="rotate(-90 50 50)"
          />
        </svg>

        {/* Time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400"
            animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
            transition={{ repeat: isRunning ? Number.POSITIVE_INFINITY : 0, duration: 2 }}
          >
            {formatTime(seconds)}
          </motion.div>
        </div>
      </div>

      <div className="timer-controls flex space-x-4">
        <Button
          onClick={toggleTimer}
          className={`${
            isRunning
              ? "bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
              : "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
          } text-white shadow-md hover:shadow-lg transition-all`}
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

        <Button
          onClick={resetTimer}
          variant="outline"
          disabled={seconds === 0}
          className="border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all"
        >
          <RotateCcw className="mr-2 h-5 w-5" /> Reset
        </Button>
      </div>

      {seconds > 0 && (
        <div className="mt-4 text-center text-gray-600 dark:text-gray-300">
          <p>You've been studying for {Math.floor(seconds / 60)} minutes</p>
          {Math.floor(seconds / 60) >= 25 && (
            <p className="text-green-600 dark:text-green-400 font-medium mt-1">
              Great job! Consider taking a short break.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
