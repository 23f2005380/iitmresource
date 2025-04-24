"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, X } from "lucide-react"
import confetti from "canvas-confetti"

interface ThankYouAnimationProps {
  show: boolean
  onClose: () => void
  message?: string
}

export function ThankYouAnimation({
  show,
  onClose,
  message = "Thank you! Your resource has been added successfully.",
}: ThankYouAnimationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })

      // Auto close after 4 seconds
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300) // Allow exit animation to complete
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [show, onClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-green-200 dark:border-green-900 p-4 flex items-center gap-3 max-w-md">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-gray-100">{message}</p>
            </div>
            <button
              onClick={() => {
                setIsVisible(false)
                setTimeout(onClose, 300)
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
