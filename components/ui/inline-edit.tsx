'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface InlineEditProps {
  value: string
  onChange: (value: string) => void | Promise<void>
  onCancel?: () => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  validation?: (value: string) => string | null
  className?: string
  'aria-label'?: string
}

export default function InlineEdit({
  value,
  onChange,
  onCancel,
  type = 'text',
  placeholder = 'Click to edit',
  disabled = false,
  multiline = false,
  validation,
  className,
  'aria-label': ariaLabel
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleEdit = () => {
    if (!disabled && !isEditing) {
      setIsEditing(true)
      setEditValue(value)
      setError(null)
    }
  }

  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (editValue === value) {
      setIsEditing(false)
      return
    }

    // Validate if validator provided
    if (validation) {
      const validationError = validation(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      await onChange(editValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setError(null)
    setIsEditing(false)
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (!isEditing) {
    return (
      <div
        onClick={handleEdit}
        className={cn(
          'inline-flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        <span className={cn(!value && 'text-muted-foreground')}>
          {value || placeholder}
        </span>
      </div>
    )
  }

  const InputComponent = multiline ? 'textarea' : 'input'
  const inputProps = {
    ref: inputRef as any,
    value: editValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
      setEditValue(e.target.value),
    onBlur: handleSave,
    onKeyDown: handleKeyDown,
    type: multiline ? undefined : type,
    disabled: isLoading,
    className: cn(
      'border rounded px-2 py-1 w-full',
      error && 'border-destructive',
      className
    ),
    'aria-label': ariaLabel || `Edit ${type} field`,
    role: type === 'number' ? 'spinbutton' : 'textbox'
  }

  return (
    <div className="inline-flex flex-col gap-1 w-full">
      <div className="relative">
        <InputComponent {...inputProps} />
        {isLoading && (
          <div 
            className="absolute right-2 top-1/2 -translate-y-1/2"
            data-testid="inline-edit-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      {error && (
        <span className="text-sm text-destructive">{error}</span>
      )}
    </div>
  )
}