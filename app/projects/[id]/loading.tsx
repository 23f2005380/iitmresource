import { Navbar } from "@/components/navbar"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function ProjectLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white dark:from-gray-900 dark:to-gray-950">
      <Navbar />

      <main className="flex-1 container py-8">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <Skeleton className="h-[400px] w-full" />

              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />

                <div className="flex flex-wrap gap-2 mt-6">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>

                <div className="flex gap-3 mt-6">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </CardContent>

              <CardFooter className="flex justify-between">
                <div className="flex gap-4">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-32" />
                </div>
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>

            <div className="mt-8">
              <Skeleton className="h-8 w-32 mb-4" />

              <Skeleton className="h-32 w-full mb-6" />

              <div className="space-y-4">
                {Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-2">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div>
                            <Skeleton className="h-5 w-32 mb-1" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full mt-2" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>

                <Skeleton className="h-px w-full my-4" />

                <Skeleton className="h-5 w-24 mb-2" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-28" />
                </div>

                <Skeleton className="h-px w-full my-4" />

                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
