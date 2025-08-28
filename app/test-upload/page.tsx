'use client'

import { useState } from 'react'

export default function TestUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'test-journey-123')

      // Test the simple endpoint
      const response = await fetch('/api/upload-media-simple', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setResult(data)
      console.log('Upload successful:', data)
    } catch (err: any) {
      setError(err.message)
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Upload</h1>
      
      <div className="space-y-4">
        <input
          type="file"
          onChange={handleFileSelect}
          accept="image/*,video/*"
          disabled={uploading}
          className="block"
        />
        
        {uploading && (
          <div className="text-blue-600">Uploading...</div>
        )}
        
        {error && (
          <div className="text-red-600">
            Error: {error}
          </div>
        )}
        
        {result && (
          <div className="bg-green-100 p-4 rounded">
            <h2 className="font-semibold">Upload Successful!</h2>
            <pre className="text-xs mt-2">
              {JSON.stringify(result, null, 2)}
            </pre>
            {result.webViewLink && (
              <a 
                href={result.webViewLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 underline mt-2 block"
              >
                View in Google Drive
              </a>
            )}
            {result.thumbnailLink && (
              <div className="mt-2">
                <p>Thumbnail:</p>
                <img 
                  src={result.thumbnailLink} 
                  alt="Thumbnail" 
                  className="mt-1 border"
                  onError={(e) => {
                    console.error('Thumbnail load error')
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle"%3ENo thumbnail%3C/text%3E%3C/svg%3E'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}