"use client"

import { useState, useEffect } from "react"
import { useAuthState } from "react-firebase-hooks/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { StudyTimer } from "@/components/study-timer"
import { TaskManager } from "@/components/task-manager"
import { WaterTracker } from "@/components/water-tracker"
import { StudyVisualizer } from "@/components/study-visualizer"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { Navbar } from "@/components/navbar"
import Image from 'next/image'

export default function StudyTrackerPage() {
  const [user] = useAuthState(auth)
  const [loading, setLoading] = useState(true)
  const [studyData, setStudyData] = useState<any>([])
  const [waterData, setWaterData] = useState<any>(null)
  const [taskData, setTaskData] = useState<any>([])
  const { toast } = useToast()

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      if (user) {
        try {
          // Load study sessions
          const studySessionsRef = collection(db, "studySessions")
          const q = query(studySessionsRef, where("userId", "==", user.email), orderBy("date", "desc"), limit(100))
          const querySnapshot = await getDocs(q)
          const sessions = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setStudyData(sessions)

          // Load water tracking data
          const waterRef = doc(db, "waterTracking", user.email || "anonymous")
          const waterDoc = await getDoc(waterRef)
          if (waterDoc.exists()) {
            setWaterData(waterDoc.data())
          } else {
            setWaterData({ glasses: 0, goal: 8, history: [] })
          }

          // Load tasks
          const tasksRef = collection(db, "tasks")
          const tasksQuery = query(tasksRef, where("userId", "==", user.email), orderBy("createdAt", "desc"))
          const tasksSnapshot = await getDocs(tasksQuery)
          const tasks = tasksSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setTaskData(tasks)
        } catch (error) {
          console.error("Error loading data:", error)
          toast({
            title: "Error loading data",
            description: "There was a problem loading your study data.",
            variant: "destructive",
          })
        }
      } else {
        // Set default data for guest users
        const localStudyData = localStorage.getItem("guestStudyData")
        const localWaterData = localStorage.getItem("guestWaterData")
        const localTaskData = localStorage.getItem("guestTaskData")

        setStudyData(localStudyData ? JSON.parse(localStudyData) : [])
        setWaterData(localWaterData ? JSON.parse(localWaterData) : { glasses: 0, goal: 8, history: [] })
        setTaskData(localTaskData ? JSON.parse(localTaskData) : [])
      }

      setLoading(false)
    }

    loadData()
  }, [user, toast])

  const saveStudySession = async (duration: number, isComplete = false) => {
    const session = {
      userId: user?.email || "anonymous",
      duration,
      date: new Date().toISOString(),
      isComplete,
    }

    if (user) {
      try {
        const sessionsRef = collection(db, "studySessions")
        await setDoc(doc(sessionsRef), session)

        // Refresh data
        const updatedData = studyData ? [session, ...studyData] : [session]
        setStudyData(updatedData)

        if (isComplete) {
          toast({
            title: "Study session saved",
            description: `You studied for ${Math.floor(duration / 60)} minutes.`,
          })
        }
      } catch (error) {
        console.error("Error saving study session:", error)
        if (isComplete) {
          toast({
            title: "Error saving session",
            description: "There was a problem saving your study session.",
            variant: "destructive",
          })
        }
      }
    } else {
      // Save to localStorage for guest users
      const updatedData = studyData ? [session, ...studyData] : [session]
      setStudyData(updatedData)
      localStorage.setItem("guestStudyData", JSON.stringify(updatedData))

      if (isComplete) {
        toast({
          title: "Study session saved locally",
          description: `You studied for ${Math.floor(duration / 60)} minutes. Sign in to sync your data.`,
        })
      }
    }
  }

  const updateWaterData = async (newData: any) => {
    if (user) {
      try {
        const waterRef = doc(db, "waterTracking", user.email || "anonymous")
        await setDoc(waterRef, newData, { merge: true })
        setWaterData(newData)
      } catch (error) {
        console.error("Error updating water data:", error)
        toast({
          title: "Error updating water data",
          description: "There was a problem updating your water tracking data.",
          variant: "destructive",
        })
      }
    } else {
      // Save to localStorage for guest users
      setWaterData(newData)
      localStorage.setItem("guestWaterData", JSON.stringify(newData))
    }
  }

  const updateTaskData = async (newTasks: any) => {
    setTaskData(newTasks)

    if (!user) {
      // Save to localStorage for guest users
      localStorage.setItem("guestTaskData", JSON.stringify(newTasks))
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your study data...</span>
      </div>
    )
  }
const imageLoader = () => {
  return 
}
  return (
  <div className="h-full">
  <div
  style={{
      backgroundImage: `url(https://cdn.pixabay.com/photo/2018/07/26/12/21/sunset-3563482_1280.jpg)`,
      width: '100%',
      height: '100%',
      objectFit : 'contain',
      backgroundSize : 'cover',
      position : 'fixed',
      zIndex : '-1'
    }}>
</div>
    <div className=" ">
      <Navbar />
     <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-indigo-800 dark:text-indigo-300">Study Tracker</h1>
          {!user && (
            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700/50 p-2 rounded-lg">
              <span className="text-amber-800 dark:text-amber-300 text-sm">
                Guest mode.{" "}
                <a href="/login" className="underline font-medium">
                  Sign in
                </a>{" "}
                to sync data.
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(95vh-120px)]">
          {/* Left column - Timer and Tasks */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-[calc(50%-12px)]">
              <div className="bg-cyan-600 dark:bg-cyan-700 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Study Timer</h2>
              </div>
              <div className="p-4 h-[calc(100%-52px)] overflow-hidden">
                <StudyTimer onSessionComplete={saveStudySession} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-[calc(50%-12px)]">
              <div className="bg-cyan-600 dark:bg-cyan-700 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Task Manager</h2>
              </div>
              <div className="p-4 h-[calc(100%-52px)] overflow-hidden">
                <TaskManager initialTasks={taskData} onTasksUpdate={updateTaskData} isAuthenticated={!!user} />
              </div>
            </div>
          </div>

          {/* Right column - Visualizer and Water */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-[calc(50%-12px)]">
              <div className="bg-cyan-600 dark:bg-cyan-700 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Study Activity</h2>
              </div>
              <div className="p-4 h-[calc(100%-52px)] overflow-hidden">
                <StudyVisualizer studyData={studyData} />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-[calc(50%-12px)]">
              <div className="bg-cyan-600 dark:bg-cyan-700 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Water Consumption</h2>
              </div>
              <div className="p-4 h-[calc(100%-52px)] overflow-hidden">
                <WaterTracker initialData={waterData} onDataUpdate={updateWaterData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
