"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { db, auth } from "@/lib/firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { Plus, Trash2, CheckCircle2, ListTodo } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/components/ui/use-toast"

interface Task {
  id: string
  text: string
  completed: boolean
  userId: string
  createdAt: any
}

interface TaskManagerProps {
  initialTasks: Task[]
  onTasksUpdate: (tasks: Task[]) => void
  isAuthenticated: boolean
}

export function TaskManager({ initialTasks = [], onTasksUpdate, isAuthenticated }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [newTaskText, setNewTaskText] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const addTask = async () => {
    if (!newTaskText.trim()) return

    const newTask = {
      id: `temp-${Date.now()}`,
      text: newTaskText,
      completed: false,
      userId: auth.currentUser?.email || "anonymous",
      createdAt: new Date().toISOString(),
    }

    // Optimistically update UI
    const updatedTasks = [...tasks, newTask]
    setTasks(updatedTasks)
    onTasksUpdate(updatedTasks)
    setNewTaskText("")

    if (isAuthenticated) {
      try {
        const docRef = await addDoc(collection(db, "tasks"), {
          text: newTaskText,
          completed: false,
          userId: auth.currentUser?.email,
          createdAt: serverTimestamp(),
        })

        // Update the temporary ID with the real one
        const taskWithRealId = { ...newTask, id: docRef.id }
        const finalTasks = updatedTasks.map((t) => (t.id === newTask.id ? taskWithRealId : t))
        setTasks(finalTasks)
        onTasksUpdate(finalTasks)
      } catch (error) {
        console.error("Error adding task:", error)
        toast({
          title: "Error adding task",
          description: "There was a problem adding your task.",
          variant: "destructive",
        })
      }
    }
  }

  const toggleTaskCompletion = async (taskId: string) => {
    const taskIndex = tasks.findIndex((t) => t.id === taskId)
    if (taskIndex === -1) return

    const updatedTasks = [...tasks]
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      completed: !updatedTasks[taskIndex].completed,
    }

    setTasks(updatedTasks)
    onTasksUpdate(updatedTasks)

    if (isAuthenticated && !taskId.startsWith("temp-")) {
      try {
        await updateDoc(doc(db, "tasks", taskId), {
          completed: updatedTasks[taskIndex].completed,
        })
      } catch (error) {
        console.error("Error updating task:", error)
        toast({
          title: "Error updating task",
          description: "There was a problem updating your task.",
          variant: "destructive",
        })
      }
    }
  }

  const deleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId)
    setTasks(updatedTasks)
    onTasksUpdate(updatedTasks)

    if (isAuthenticated && !taskId.startsWith("temp-")) {
      try {
        await deleteDoc(doc(db, "tasks", taskId))
      } catch (error) {
        console.error("Error deleting task:", error)
        toast({
          title: "Error deleting task",
          description: "There was a problem deleting your task.",
          variant: "destructive",
        })
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addTask()
    }
  }

  const completedTasks = tasks.filter((task) => task.completed)
  const pendingTasks = tasks.filter((task) => !task.completed)

  return (
    <div className="flex flex-col h-full">
      <div className="flex mb-4">
        <Input
          placeholder="Add a new task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyPress={handleKeyPress}
          className="mr-2 border-purple-200 dark:border-purple-800 focus:ring-purple-500 focus:border-purple-500"
        />
        <Button
          onClick={addTask}
          disabled={!newTaskText.trim()}
          className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white shadow-md"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <ListTodo className="h-12 w-12 mb-2 opacity-20" />
            <p>No tasks yet. Add one to get started!</p>
          </div>
        ) : (
          <>
            {pendingTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center">
                  <ListTodo className="h-4 w-4 mr-1" /> Pending Tasks
                </h3>
                <ul className="space-y-2">
                  <AnimatePresence>
                    {pendingTasks.map((task) => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between p-3 rounded-md bg-white dark:bg-gray-700 shadow-sm hover:shadow-md transition-shadow border border-purple-100 dark:border-purple-900"
                      >
                        <div className="flex items-center">
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => toggleTaskCompletion(task.id)}
                            className="mr-3 border-purple-400 text-purple-600"
                          />
                          <span className={task.completed ? "line-through text-muted-foreground" : ""}>
                            {task.text}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Completed Tasks
                </h3>
                <ul className="space-y-2">
                  <AnimatePresence>
                    {completedTasks.map((task) => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-800 shadow-sm border border-green-50 dark:border-green-900"
                      >
                        <div className="flex items-center">
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => toggleTaskCompletion(task.id)}
                            className="mr-3 border-green-400 text-green-600"
                          />
                          <span className="line-through text-muted-foreground">{task.text}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="opacity-50 hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
