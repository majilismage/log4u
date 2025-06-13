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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Selected Files</h4>
        <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((file, index) => (
          <div key={index} className="relative group">
            <div className="aspect-square rounded-lg border border-border bg-muted overflow-hidden">
              {isImageType(file.type) ? (
                <div className="relative w-full h-full">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : isVideoType(file.type) ? (
                <div className="relative w-full h-full">
                  <video
                    src={URL.createObjectURL(file)}
                    className="w-full h-full object-cover"
                    controls={false}
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                    <div className="w-8 h-8 rounded-full bg-white bg-opacity-80 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-2">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center mb-2">
                    <span className="text-xs font-mono text-primary">FILE</span>
                  </div>
                  <span className="text-xs text-muted-foreground text-center truncate w-full">{file.name}</span>
                </div>
              )}
            </div>
            
            {/* Remove button - always visible on mobile for better touch accessibility */}
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-7 w-7 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* File size info */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="truncate">{(file.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 