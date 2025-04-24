import { collection, addDoc, getDocs, query, serverTimestamp } from "firebase/firestore"
import { db } from "./firebase"

export async function seedDatabase() {
  try {
    // Check if subjects already exist
    const subjectsQuery = query(collection(db, "subjects"))
    const subjectsSnapshot = await getDocs(subjectsQuery)

    if (subjectsSnapshot.empty) {
      // Seed subjects
      const subjects = [
        {
          name: "Mathematics for Data Science I",
          level: "foundation",
          description:
            "Introduction to mathematical concepts essential for data science including calculus, linear algebra, and probability.",
          weeks: 12,
          slug: "math-for-ds-1",
          createdAt: serverTimestamp(),
        },
        {
          name: "Statistics for Data Science I",
          level: "foundation",
          description:
            "Fundamentals of statistics including descriptive statistics, probability distributions, and hypothesis testing.",
          weeks: 12,
          slug: "stats-for-ds-1",
          createdAt: serverTimestamp(),
        },
        {
          name: "Python for Data Science",
          level: "foundation",
          description:
            "Introduction to Python programming language with focus on data science libraries like NumPy, Pandas, and Matplotlib.",
          weeks: 12,
          slug: "python-for-ds",
          createdAt: serverTimestamp(),
        },
        {
          name: "Machine Learning Techniques",
          level: "diploma",
          description: "Core machine learning algorithms including supervised and unsupervised learning methods.",
          weeks: 12,
          slug: "ml-techniques",
          createdAt: serverTimestamp(),
        },
        {
          name: "Data Visualization",
          level: "diploma",
          description: "Techniques and tools for effective data visualization and communication of insights.",
          weeks: 8,
          slug: "data-viz",
          createdAt: serverTimestamp(),
        },
        {
          name: "Deep Learning",
          level: "degree",
          description: "Advanced neural network architectures and deep learning techniques for complex data analysis.",
          weeks: 12,
          slug: "deep-learning",
          createdAt: serverTimestamp(),
        },
      ]

      const subjectIds = {}

      for (const subject of subjects) {
        const docRef = await addDoc(collection(db, "subjects"), subject)
        subjectIds[subject.slug] = docRef.id
        console.log(`Added subject: ${subject.name} with ID: ${docRef.id}`)
      }

      console.log("Database seeded with sample subjects")

      // Seed resources for Python for Data Science
      if (subjectIds["python-for-ds"]) {
        const subjectId = subjectIds["python-for-ds"]

        // Seed resources
        const resources = [
          {
            title: "Introduction to Python Variables and Data Types",
            description: "A comprehensive tutorial on Python variables, data types, and basic operations",
            type: "youtube",
            url: "https://www.youtube.com/watch?v=kqtD5dpn9C8",
            createdBy: "admin",
            creatorName: "Admin",
            createdAt: serverTimestamp(),
            likes: 5,
            likedBy: [],
            subjectId: subjectId,
            subjectSlug: "python-for-ds",
            week: 1,
          },
          {
            title: "NumPy Arrays Tutorial",
            description: "Learn how to work with NumPy arrays for efficient numerical computations",
            type: "website",
            url: "https://numpy.org/doc/stable/user/quickstart.html",
            createdBy: "admin",
            creatorName: "Admin",
            createdAt: serverTimestamp(),
            likes: 3,
            likedBy: [],
            subjectId: subjectId,
            subjectSlug: "python-for-ds",
            week: 2,
          },
          {
            title: "Pandas DataFrame Cheat Sheet",
            description: "A quick reference guide for working with Pandas DataFrames",
            type: "text",
            content:
              "# Pandas DataFrame Cheat Sheet\n\n## Creating a DataFrame\n```python\nimport pandas as pd\n\n# From a dictionary\ndf = pd.DataFrame({\n    'Name': ['John', 'Anna', 'Peter', 'Linda'],\n    'Age': [28, 34, 29, 42],\n    'City': ['New York', 'Paris', 'Berlin', 'London']\n})\n\n# From a CSV file\ndf = pd.read_csv('data.csv')\n```\n\n## Basic Operations\n```python\n# View first/last rows\ndf.head()\ndf.tail()\n\n# Get info about DataFrame\ndf.info()\ndf.describe()\n\n# Select columns\ndf['Name']\ndf[['Name', 'Age']]\n\n# Filtering\ndf[df['Age'] > 30]\n```",
            createdBy: "admin",
            creatorName: "Admin",
            createdAt: serverTimestamp(),
            likes: 7,
            likedBy: [],
            subjectId: subjectId,
            subjectSlug: "python-for-ds",
            week: 3,
          },
        ]

        for (const resource of resources) {
          const resourceRef = await addDoc(collection(db, "resources"), resource)
          console.log(`Added resource: ${resource.title} with ID: ${resourceRef.id}`)

          // Add a comment to the first resource
          if (resource.title === "Introduction to Python Variables and Data Types") {
            await addDoc(collection(db, "comments"), {
              resourceId: resourceRef.id,
              content: "This video was really helpful for understanding Python basics. Thanks for sharing!",
              createdBy: "student@example.com",
              createdAt: serverTimestamp(),
            })
          }
        }

        console.log("Database seeded with sample resources and comments")
      }

      // Create admin user
      await addDoc(collection(db, "users"), {
        displayName: "Admin",
        email: "admin@iitm.ac.in",
        role: "admin",
        uid: "adminUID123",
        createdAt: serverTimestamp(),
        photoURL: null,
      })

      console.log("Admin user created")
    } else {
      console.log("Database already contains subjects, skipping seed")
    }

    return { success: true }
  } catch (error) {
    console.error("Error seeding database:", error)
    return { success: false, error }
  }
}
