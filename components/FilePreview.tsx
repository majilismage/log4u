"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { isImageType, isVideoType } from "@/lib/mediaUtils"

interface FilePreviewProps {
  files: File[]
  onRemove: (index: number) => void
}

export function FilePreview({ files, onRemove }: FilePreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file, index) => (
        <div key={index} className="relative group">
          <div className="aspect-square rounded-lg border bg-muted">
            {isImageType(file.type) ? (
              <div className="relative w-full h-full">
                <Image
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ) : isVideoType(file.type) ? (
              <div className="relative w-full h-full">
                <video
                  src={URL.createObjectURL(file)}
                  className="w-full h-full object-cover rounded-lg"
                  controls={false}
                  muted
                  loop
                  playsInline
                  onMouseEnter={(e) => e.currentTarget.play()}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-muted-foreground">{file.name}</span>
              </div>
            )}
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  )
} 