"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus, Droplets } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface WaterTrackerProps {
  initialData: {
    glasses: number
    goal: number
    history: any[]
  }
  onDataUpdate: (data: any) => void
}

export function WaterTracker({ initialData, onDataUpdate }: WaterTrackerProps) {
  const [glasses, setGlasses] = useState(initialData?.glasses || 0)
  const [goal, setGoal] = useState(initialData?.goal || 8)
  const [history, setHistory] = useState(initialData?.history || [])
  const [showRipple, setShowRipple] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (initialData) {
      setGlasses(initialData.glasses || 0)
      setGoal(initialData.goal || 8)
      setHistory(initialData.history || [])
    }
  }, [initialData])

  const addGlass = () => {
    if (glasses < 20) {
      const newGlasses = glasses + 1
      setGlasses(newGlasses)
      setShowRipple(true)
      setTimeout(() => setShowRipple(false), 1000)

      // Check if goal reached
      if (newGlasses === goal) {
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 3000)
      }

      // Update data
      const today = new Date().toISOString().split("T")[0]
      const updatedHistory = [...history]
      const todayIndex = updatedHistory.findIndex((day) => day.date === today)

      if (todayIndex >= 0) {
        updatedHistory[todayIndex].glasses = newGlasses
      } else {
        updatedHistory.push({ date: today, glasses: newGlasses })
      }

      setHistory(updatedHistory)
      onDataUpdate({ glasses: newGlasses, goal, history: updatedHistory })
    }
  }

  const removeGlass = () => {
    if (glasses > 0) {
      const newGlasses = glasses - 1
      setGlasses(newGlasses)

      // Update data
      const today = new Date().toISOString().split("T")[0]
      const updatedHistory = [...history]
      const todayIndex = updatedHistory.findIndex((day) => day.date === today)

      if (todayIndex >= 0) {
        updatedHistory[todayIndex].glasses = newGlasses
      }

      setHistory(updatedHistory)
      onDataUpdate({ glasses: newGlasses, goal, history: updatedHistory })
    }
  }

  const updateGoal = (newGoal: number[]) => {
    const goalValue = newGoal[0]
    setGoal(goalValue)
    onDataUpdate({ glasses, goal: goalValue, history })
  }

  const percentage = Math.min(100, Math.round((glasses / goal) * 100))

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">Daily Goal: {goal} glasses</div>
        <div className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
          {glasses}/{goal} glasses
        </div>
      </div>

      <div className="mb-4 px-2">
        <Slider defaultValue={[goal]} min={1} max={20} step={1} onValueChange={updateGoal} className="text-cyan-600" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center">
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-xl font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/50 px-4 py-2 rounded-lg shadow-lg"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                transition={{
                  duration: 0.5,
                  yoyo: Number.POSITIVE_INFINITY,
                  repeatType: "reverse",
                  repeat: 5,
                }}
              >
                Goal Reached! 🎉
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-100 dark:border-cyan-900" />
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500 to-blue-400 dark:from-cyan-600 dark:to-blue-500"
              style={{ height: `${percentage}%` }}
              initial={{ height: 0 }}
              animate={{ height: `${percentage}%` }}
              transition={{ duration: 0.5 }}
            >
              {showRipple && (
                <motion.div
                  className="absolute inset-0"
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1 }}
                >
                  <div className="w-full h-full rounded-full bg-white opacity-30" />
                </motion.div>
              )}
            </motion.div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Droplets className="h-10 w-10 text-cyan-500 dark:text-cyan-400 drop-shadow-md" />
          </div>
        </div>

        <div className="flex space-x-4 mb-4">
          <Button
            onClick={removeGlass}
            variant="outline"
            disabled={glasses === 0}
            className="border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-900 shadow-sm"
          >
            <Minus className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
          </Button>
          <Button
            onClick={addGlass}
            disabled={glasses >= 20}
            className="bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-800 text-white shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Glass
          </Button>
        </div>

        <div className="text-sm text-center text-cyan-700 dark:text-cyan-300">
          {percentage < 50
            ? "Remember to stay hydrated!"
            : percentage < 100
              ? "You're doing great! Keep drinking water."
              : "Excellent! You've reached your water goal."}
        </div>
      </div>
    </div>
  )
}
