import { useState, useCallback, useRef } from 'react'
import type { JourneyEntry } from '@/types/journey'

interface UseEditableJourneyOptions {
  onUpdate?: (updates: Partial<JourneyEntry>) => void
  onError?: (error: string) => void
}

export function useEditableJourney(
  journey: JourneyEntry,
  options: UseEditableJourneyOptions = {}
) {
  const [isEditing, setIsEditing] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState<Partial<JourneyEntry>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const originalValues = useRef<JourneyEntry>(journey)

  // Update field locally
  const updateField = useCallback((
    field: keyof JourneyEntry,
    value: any
  ) => {
    setPendingUpdates(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  // Save all pending updates
  const save = useCallback(async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      setIsEditing(false)
      return { success: true }
    }

    setIsSaving(true)
    setErrors({})

    try {
      const response = await fetch(`/api/journey/${journey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingUpdates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save changes')
      }

      // Update original values
      originalValues.current = {
        ...originalValues.current,
        ...pendingUpdates
      }

      // Notify parent component
      options.onUpdate?.(pendingUpdates)

      // Clear pending updates
      setPendingUpdates({})
      setIsEditing(false)

      return { success: true, data }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed'
      setErrors({ _form: errorMessage })
      options.onError?.(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsSaving(false)
    }
  }, [journey.id, pendingUpdates, options])

  // Cancel edits and revert
  const cancel = useCallback(() => {
    setPendingUpdates({})
    setErrors({})
    setIsEditing(false)
  }, [])

  // Get current value (with pending updates)
  const getValue = useCallback((field: keyof JourneyEntry) => {
    return pendingUpdates[field] ?? journey[field]
  }, [journey, pendingUpdates])

  // Check if field has changes
  const hasChanges = useCallback((field?: keyof JourneyEntry) => {
    if (field) {
      return pendingUpdates[field] !== undefined && 
             pendingUpdates[field] !== originalValues.current[field]
    }
    return Object.keys(pendingUpdates).length > 0
  }, [pendingUpdates])

  return {
    isEditing,
    setIsEditing,
    isSaving,
    errors,
    updateField,
    save,
    cancel,
    getValue,
    hasChanges,
    pendingUpdates
  }
}