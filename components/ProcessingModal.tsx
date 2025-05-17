"use client"

import { useLoading } from "@/lib/LoadingContext"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

export function ProcessingModal() {
  const { loadingState } = useLoading()

  return (
    <Dialog open={loadingState.isLoading} modal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Processing Request</DialogTitle>
        <DialogDescription>Please wait while we process your request.</DialogDescription>
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          {loadingState.progress !== undefined ? (
            <Progress value={loadingState.progress} className="w-full" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin" />
          )}
          <p className="text-center text-sm text-muted-foreground">
            {loadingState.message || 'Processing...'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
} 