"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Mail, MapPin, Building2, Send, Loader2, Shield, Home } from "lucide-react"

interface ContactFormData {
  name: string
  email: string
  message: string
  // Security fields
  honeypot: string
  honeypot2: string
  website: string
  phone: string
  company: string
  timestamp: string
  sessionId: string
  formInteractions: number
  timeOnPage: number
  keystrokes: number
  mouseMovements: number
}

// Email obfuscation component
const ObfuscatedEmail = ({ email, className }: { email: string, className?: string }) => {
  const [decodedEmail, setDecodedEmail] = useState('')
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    // Simple email obfuscation - decode on mount
    const parts = email.split('@')
    if (parts.length === 2) {
      const localPart = atob(btoa(parts[0])) // Double encoding for obfuscation
      const domain = atob(btoa(parts[1]))
      setDecodedEmail(`${localPart}@${domain}`)
    }
  }, [email])

  const handleReveal = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsRevealed(true)
    // Add delay to prevent automated clicking
    setTimeout(() => {
      window.location.href = `mailto:${decodedEmail}`
    }, 300)
  }

  if (!isRevealed) {
    return (
      <button 
        onClick={handleReveal}
        className={`text-primary hover:underline cursor-pointer bg-transparent border-none p-0 ${className}`}
        title="Click to reveal email"
      >
        mail@[click to reveal]
      </button>
    )
  }

  return (
    <a 
      href={`mailto:${decodedEmail}`}
      className={`text-primary hover:underline ${className}`}
    >
      {decodedEmail}
    </a>
  )
}

export default function ContactPage() {
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    message: "",
    // Security fields (hidden from user)
    honeypot: "",
    honeypot2: "",
    website: "",
    phone: "",
    company: "",
    timestamp: "",
    sessionId: "",
    formInteractions: 0,
    timeOnPage: 0,
    keystrokes: 0,
    mouseMovements: 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formStartTime, setFormStartTime] = useState<number>(0)
  const [pageLoadTime, setPageLoadTime] = useState<number>(0)
  const [interactionCount, setInteractionCount] = useState(0)
  const [keystrokeCount, setKeystrokeCount] = useState(0)
  const [mouseMovementCount, setMouseMovementCount] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const { toast } = useToast()

  // Generate session ID
  const generateSessionId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  useEffect(() => {
    // Scroll to top when page loads
    window.scrollTo(0, 0)
    
    setMounted(true)
    const now = Date.now()
    setPageLoadTime(now)
    setFormStartTime(now)
    
    // Set initial security data
    setFormData(prev => ({
      ...prev,
      sessionId: generateSessionId(),
      timestamp: now.toString()
    }))

    // Track mouse movements (throttled)
    let mouseTimer: NodeJS.Timeout
    const handleMouseMove = () => {
      clearTimeout(mouseTimer)
      mouseTimer = setTimeout(() => {
        setMouseMovementCount(prev => prev + 1)
      }, 100)
    }

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tabs - could be automated behavior
        console.log('⚠️ Page visibility changed - user may have switched tabs')
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(mouseTimer)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Track interactions and keystrokes
    setInteractionCount(prev => prev + 1)
    setKeystrokeCount(prev => prev + 1)
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
      formInteractions: interactionCount + 1,
      keystrokes: keystrokeCount + 1,
      mouseMovements: mouseMovementCount,
      timeOnPage: Date.now() - pageLoadTime
    }))

    // Additional security: Detect rapid automated input
    const inputSpeed = value.length / ((Date.now() - formStartTime) / 1000)
    if (inputSpeed > 20) { // 20 characters per second threshold
      console.log('⚠️ Suspiciously fast input detected')
    }
  }

  // Additional input handler for honeypot fields
  const handleHoneypotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Log honeypot interaction (likely bot)
    if (value) {
      console.log('🚨 Honeypot field filled - likely bot detected')
    }
  }

  const validateFormSecurity = (): { isValid: boolean; reason?: string } => {
    const now = Date.now()
    const timeOnForm = now - formStartTime
    
    // 1. Check honeypot fields
    if (formData.honeypot || formData.honeypot2 || formData.website || formData.phone || formData.company) {
      return { isValid: false, reason: 'Honeypot fields filled' }
    }
    
    // 2. Check minimum time on form (humans need at least 10 seconds)
    if (timeOnForm < 10000) {
      return { isValid: false, reason: 'Form filled too quickly' }
    }
    
    // 3. Check maximum time (prevent form sitting open for days)
    if (timeOnForm > 1800000) { // 30 minutes
      return { isValid: false, reason: 'Form session expired' }
    }
    
    // 4. Check interaction patterns
    if (formData.formInteractions < 3) {
      return { isValid: false, reason: 'Insufficient form interactions' }
    }
    
    // 5. Check keystroke count vs content length
    const totalContentLength = formData.name.length + formData.email.length + formData.message.length
    if (formData.keystrokes < totalContentLength * 0.8) {
      return { isValid: false, reason: 'Keystroke pattern anomalous' }
    }
    
    // 6. Check mouse movements (humans move mouse while filling forms)
    if (mouseMovementCount === 0) {
      return { isValid: false, reason: 'No mouse movement detected' }
    }
    
    // 7. Check message quality (basic spam detection)
    const message = formData.message.toLowerCase()
    const spamKeywords = ['seo', 'ranking', 'bitcoin', 'cryptocurrency', 'loan', 'viagra', 'casino', 'pills', 'weight loss', 'make money', 'click here', 'limited time']
    const spamCount = spamKeywords.filter(keyword => message.includes(keyword)).length
    if (spamCount >= 3) {
      return { isValid: false, reason: 'Message contains spam keywords' }
    }
    
    // 8. Check for common bot patterns in text
    if (message.includes('http://') || message.includes('https://')) {
      return { isValid: false, reason: 'Message contains URLs' }
    }
    
    return { isValid: true }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    console.log('🔒 Security validation started')
    
    // Security validation
    const securityCheck = validateFormSecurity()
    if (!securityCheck.isValid) {
      console.log('🚨 Security validation failed:', securityCheck.reason)
      
      // Don't show the real reason to potential bots
      toast({
        title: "Submission failed",
        description: "Please ensure all fields are filled correctly and try again.",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    console.log('✅ Security validation passed')

    try {
      console.log('🔥 CLIENT: Form submission started')
      
      // Only send necessary data to API (exclude security fields for cleaner logs)
      const submitData = {
        name: formData.name,
        email: formData.email,
        message: formData.message,
        // Include security metadata for server-side validation
        securityMeta: {
          sessionId: formData.sessionId,
          timestamp: formData.timestamp,
          timeOnPage: Date.now() - pageLoadTime,
          formInteractions: formData.formInteractions,
          keystrokes: formData.keystrokes,
          mouseMovements: mouseMovementCount,
          userAgent: navigator.userAgent.substring(0, 100), // Truncated for privacy
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          screen: `${screen.width}x${screen.height}`,
          referrer: document.referrer || 'direct'
        }
      }
      
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Form submitted successfully')
        
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' })
        
        toast({
          title: "Message sent successfully!",
          description: "We'll get back to you within 24 hours.",
        })
        
        // Reset form
        setFormData({
          name: "",
          email: "",
          message: "",
          honeypot: "",
          honeypot2: "",
          website: "",
          phone: "",
          company: "",
          timestamp: Date.now().toString(),
          sessionId: generateSessionId(),
          formInteractions: 0,
          timeOnPage: 0,
          keystrokes: 0,
          mouseMovements: 0
        })
        
        // Reset counters
        setInteractionCount(0)
        setKeystrokeCount(0)
        setMouseMovementCount(0)
        setFormStartTime(Date.now())
        
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('🔥 CLIENT: Form submission error:', error)
      
      toast({
        title: "Failed to send message",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <main className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex w-full flex-col items-center">
        <div className="w-full max-w-4xl">
          {/* Home Navigation */}
          <div className="mb-8">
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <Home className="h-5 w-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">Back to WanderNote</span>
            </Link>
          </div>
          
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Contact Us</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We'd love to hear from you. Get in touch with the WanderNote team for support, 
              feedback, or general inquiries.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Contact Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  Reach out to us through any of the channels below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email */}
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">Email</h3>
                    <ObfuscatedEmail 
                      email="mail@3g-international.com"
                      className="text-primary hover:underline"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-sm">Address</h3>
                    <address className="not-italic text-muted-foreground">
                      <div className="font-medium text-foreground">WanderNote by 3GIS™</div>
                      10105 E Via Linda Ste 103-123<br />
                      Scottsdale, AZ 85258<br />
                      USA
                    </address>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Send us a Message
                  <div title="Protected by advanced security">
                    <Shield className="h-4 w-4 text-green-600" />
                  </div>
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you as soon as possible
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                  {/* Honeypot Fields - Hidden from users but visible to bots */}
                  <div style={{ display: 'none' }} aria-hidden="true">
                    <input
                      type="text"
                      name="honeypot"
                      value={formData.honeypot}
                      onChange={handleHoneypotChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      name="honeypot2"
                      value={formData.honeypot2}
                      onChange={handleHoneypotChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    <input
                      type="url"
                      name="website"
                      placeholder="Your website"
                      value={formData.website}
                      onChange={handleHoneypotChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Your phone"
                      value={formData.phone}
                      onChange={handleHoneypotChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      name="company"
                      placeholder="Your company"
                      value={formData.company}
                      onChange={handleHoneypotChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {/* Legitimate Fields */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      required
                      maxLength={100}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Tell us how we can help you..."
                      rows={6}
                      value={formData.message}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      required
                      maxLength={2000}
                      minLength={10}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      * Required fields. We'll respond within 24 hours.
                    </p>
                    <div className="flex items-center justify-center gap-1 text-xs text-green-600">
                      <Shield className="h-3 w-3" />
                      <span>Protected against spam and bots</span>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Additional Information */}
          <div className="mt-12 text-center">
            <div className="bg-muted/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3">Need Support?</h2>
              <p className="text-muted-foreground mb-4">
                For technical support, account issues, or questions about WanderNote features, 
                please don't hesitate to reach out. We typically respond within 24 hours.
              </p>
              <p className="text-sm text-muted-foreground">
                For urgent matters, please mark your email subject line with "[URGENT]"
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 