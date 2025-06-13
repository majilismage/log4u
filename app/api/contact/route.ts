import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

interface ContactFormData {
  name: string
  email: string
  message: string
  securityMeta?: {
    sessionId: string
    timestamp: string
    timeOnPage: number
    formInteractions: number
    keystrokes: number
    mouseMovements: number
    userAgent: string
    timezone: string
    language: string
    screen: string
    referrer: string
  }
}

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>()

// Suspicious activity tracking
const suspiciousActivity = new Map<string, { attempts: number; lastAttempt: number }>()

// Advanced rate limiting function
function isRateLimited(clientId: string): boolean {
  const now = Date.now()
  const windowSize = 15 * 60 * 1000 // 15 minutes
  const maxRequests = 3 // Maximum 3 submissions per 15-minute window

  const record = rateLimitStore.get(clientId)
  
  if (!record || now - record.windowStart > windowSize) {
    // New window or first request
    rateLimitStore.set(clientId, { count: 1, windowStart: now })
    return false
  }
  
  if (record.count >= maxRequests) {
    console.log(`🚨 Rate limit exceeded for ${clientId}`)
    return true
  }
  
  // Increment count
  record.count++
  rateLimitStore.set(clientId, record)
  return false
}

// Advanced security validation
function validateSecurityMeta(securityMeta: any, clientIp: string): { isValid: boolean; reason?: string; riskScore: number } {
  if (!securityMeta) {
    return { isValid: false, reason: 'Missing security metadata', riskScore: 100 }
  }

  let riskScore = 0
  const reasons: string[] = []

  // 1. Time-based validation
  const submissionTime = parseInt(securityMeta.timestamp)
  const timeOnPage = securityMeta.timeOnPage
  const now = Date.now()
  
  if (now - submissionTime > 1800000) { // 30 minutes
    riskScore += 30
    reasons.push('Form session expired')
  }
  
  if (timeOnPage < 10000) { // Less than 10 seconds
    riskScore += 50
    reasons.push('Suspiciously fast completion')
  }

  // 2. Interaction pattern analysis
  if (securityMeta.formInteractions < 3) {
    riskScore += 40
    reasons.push('Insufficient form interactions')
  }
  
  if (securityMeta.mouseMovements === 0) {
    riskScore += 35
    reasons.push('No mouse movement detected')
  }
  
  if (securityMeta.keystrokes < 10) {
    riskScore += 30
    reasons.push('Insufficient keystrokes')
  }

  // 3. Browser fingerprint analysis
  const userAgent = securityMeta.userAgent || ''
  
  // Check for common bot user agents
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i, /curl/i, /wget/i, /python/i, /java/i,
    /phantom/i, /headless/i, /selenium/i, /puppeteer/i, /playwright/i
  ]
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    riskScore += 60
    reasons.push('Bot-like user agent detected')
  }
  
  // Check for missing or suspicious browser features
  if (!securityMeta.timezone || !securityMeta.language || !securityMeta.screen) {
    riskScore += 25
    reasons.push('Missing browser fingerprint data')
  }
  
  // 4. Geographic and temporal anomalies
  try {
    const timezone = securityMeta.timezone
    const now = new Date()
    const userTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
    const hourOfDay = userTime.getHours()
    
    // Flag submissions during unusual hours (2 AM to 5 AM in user's timezone)
    if (hourOfDay >= 2 && hourOfDay <= 5) {
      riskScore += 15
      reasons.push('Unusual submission time')
    }
  } catch (e) {
    riskScore += 20
    reasons.push('Invalid timezone data')
  }

  // 5. Screen resolution analysis
  const screen = securityMeta.screen
  if (screen) {
    const [width, height] = screen.split('x').map(Number)
    // Flag unrealistic or bot-like screen resolutions
    if (width < 800 || height < 600 || width > 3840 || height > 2160) {
      riskScore += 20
      reasons.push('Unusual screen resolution')
    }
  }

  console.log(`🔍 Security analysis for ${clientIp}:`, {
    riskScore,
    reasons,
    securityMeta: {
      timeOnPage,
      interactions: securityMeta.formInteractions,
      mouseMovements: securityMeta.mouseMovements,
      keystrokes: securityMeta.keystrokes,
      userAgent: userAgent.substring(0, 50) + '...',
      timezone: securityMeta.timezone,
      screen: securityMeta.screen
    }
  })

  // Risk score thresholds
  if (riskScore >= 80) {
    return { isValid: false, reason: reasons.join(', '), riskScore }
  } else if (riskScore >= 50) {
    // Medium risk - log but allow with additional monitoring
    console.log(`⚠️ Medium risk submission from ${clientIp}: ${reasons.join(', ')}`)
  }

  return { isValid: true, riskScore }
}

// Content analysis for spam detection
function analyzeMessageContent(message: string, name: string, email: string): { isSpam: boolean; confidence: number } {
  let spamScore = 0
  const reasons: string[] = []

  // 1. Common spam keywords (weighted)
  const spamKeywords = {
    high: ['seo', 'ranking', 'bitcoin', 'cryptocurrency', 'viagra', 'casino', 'pills', 'loan', 'debt'],
    medium: ['make money', 'click here', 'limited time', 'act now', 'free', 'guarantee', 'income'],
    low: ['website', 'marketing', 'business', 'service', 'company']
  }
  
  const lowerMessage = message.toLowerCase()
  const lowerName = name.toLowerCase()
  
  // High-risk keywords
  spamKeywords.high.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      spamScore += 30
      reasons.push(`High-risk keyword: ${keyword}`)
    }
  })
  
  // Medium-risk keywords
  spamKeywords.medium.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      spamScore += 15
      reasons.push(`Medium-risk keyword: ${keyword}`)
    }
  })
  
  // Low-risk keywords
  spamKeywords.low.forEach(keyword => {
    if (lowerMessage.includes(keyword)) {
      spamScore += 5
    }
  })

  // 2. URL detection
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b)/gi
  const urls = message.match(urlPattern)
  if (urls && urls.length > 0) {
    spamScore += urls.length * 25
    reasons.push(`Contains ${urls.length} URL(s)`)
  }

  // 3. Email pattern analysis
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emailsInMessage = message.match(emailPattern)
  if (emailsInMessage && emailsInMessage.length > 0) {
    spamScore += 20
    reasons.push('Contains email addresses')
  }

  // 4. Excessive capitalization
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length
  if (capsRatio > 0.3) {
    spamScore += 25
    reasons.push('Excessive capitalization')
  }

  // 5. Repetitive content
  const words = lowerMessage.split(/\s+/)
  const wordCount = new Map<string, number>()
  words.forEach(word => {
    if (word.length > 3) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    }
  })
  
  const maxRepetition = Math.max(...Array.from(wordCount.values()))
  if (maxRepetition > 3) {
    spamScore += 15
    reasons.push('Repetitive content detected')
  }

  // 6. Name/email inconsistency checks
  if (lowerName.includes('seo') || lowerName.includes('marketing') || lowerName.includes('admin')) {
    spamScore += 20
    reasons.push('Suspicious name pattern')
  }

  // 7. Message length analysis
  if (message.length < 20) {
    spamScore += 15
    reasons.push('Message too short')
  } else if (message.length > 2000) {
    spamScore += 10
    reasons.push('Message unusually long')
  }

  // 8. Language pattern analysis
  const nonLatinChars = (message.match(/[^\x00-\x7F]/g) || []).length
  const nonLatinRatio = nonLatinChars / message.length
  if (nonLatinRatio > 0.5) {
    spamScore += 10
    reasons.push('High non-Latin character ratio')
  }

  console.log(`📝 Message analysis:`, {
    spamScore,
    reasons,
    messageLength: message.length,
    urls: urls?.length || 0,
    capsRatio: Math.round(capsRatio * 100) + '%'
  })

  return {
    isSpam: spamScore >= 60,
    confidence: Math.min(spamScore, 100)
  }
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (for proxy/CDN setups)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  const clientIp = cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown'
  
  // Also include User-Agent hash for additional fingerprinting
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const fingerprint = `${clientIp}-${userAgent.substring(0, 50)}`
  
  return fingerprint
}

function trackSuspiciousActivity(clientId: string, reason: string): boolean {
  const now = Date.now()
  const record = suspiciousActivity.get(clientId)
  
  if (!record) {
    suspiciousActivity.set(clientId, { attempts: 1, lastAttempt: now })
    return false
  }
  
  // Reset counter if last attempt was more than 1 hour ago
  if (now - record.lastAttempt > 3600000) {
    suspiciousActivity.set(clientId, { attempts: 1, lastAttempt: now })
    return false
  }
  
  record.attempts++
  record.lastAttempt = now
  suspiciousActivity.set(clientId, record)
  
  console.log(`🚨 Suspicious activity tracked for ${clientId}: ${reason} (attempt ${record.attempts})`)
  
  // Block after 3 suspicious attempts within an hour
  return record.attempts >= 3
}

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  // Check if SMTP is configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables.')
  }

  const port = parseInt(process.env.SMTP_PORT || '587')
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function POST(request: NextRequest) {
  console.log('='.repeat(60))
  console.log('🚀 SECURE CONTACT API ENDPOINT CALLED')
  console.log('Timestamp:', new Date().toISOString())
  console.log('='.repeat(60))
  
  const clientId = getClientIdentifier(request)
  console.log('👤 Client identifier:', clientId.substring(0, 30) + '...')
  
  try {
    // 1. Rate limiting check
    if (isRateLimited(clientId)) {
      console.log('🚫 Rate limit exceeded for:', clientId)
      trackSuspiciousActivity(clientId, 'Rate limit exceeded')
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // 2. Check if client is already flagged for suspicious activity
    const suspiciousRecord = suspiciousActivity.get(clientId)
    if (suspiciousRecord && suspiciousRecord.attempts >= 3) {
      console.log('🚫 Blocked due to suspicious activity:', clientId)
      return NextResponse.json(
        { error: 'Request blocked due to suspicious activity.' },
        { status: 403 }
      )
    }

    const requestBody = await request.json()
    const { name, email, message, securityMeta }: ContactFormData = requestBody

    console.log('📝 Processing form submission:', {
      name: name.substring(0, 20) + '...',
      email: email.substring(0, 20) + '...',
      messageLength: message.length,
      hasSecurityMeta: !!securityMeta
    })

    // 3. Basic validation
    if (!name || !email || !message) {
      console.log('❌ Validation failed: Missing required fields')
      trackSuspiciousActivity(clientId, 'Missing required fields')
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Enhanced field validation
    if (name.length > 100 || email.length > 254 || message.length > 2000 || message.length < 10) {
      console.log('❌ Validation failed: Field length constraints')
      trackSuspiciousActivity(clientId, 'Field length violation')
      return NextResponse.json(
        { error: 'Field length constraints violated' },
        { status: 400 }
      )
    }

    // 4. Email validation (enhanced)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(email)) {
      console.log('❌ Validation failed: Invalid email format')
      trackSuspiciousActivity(clientId, 'Invalid email format')
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // 5. Security metadata validation
    const securityValidation = validateSecurityMeta(securityMeta, clientId)
    if (!securityValidation.isValid) {
      console.log('🚨 Security validation failed:', securityValidation.reason)
      trackSuspiciousActivity(clientId, `Security validation failed: ${securityValidation.reason}`)
      
      // Don't reveal the real reason to potential attackers
      return NextResponse.json(
        { error: 'Submission validation failed. Please try again.' },
        { status: 400 }
      )
    }

    // 6. Content analysis for spam
    const contentAnalysis = analyzeMessageContent(message, name, email)
    if (contentAnalysis.isSpam) {
      console.log('🚨 Spam detected with confidence:', contentAnalysis.confidence)
      trackSuspiciousActivity(clientId, `Spam detected (${contentAnalysis.confidence}% confidence)`)
      
      // Log to help you identify false positives
      console.log('📋 Potential spam submission:', {
        name,
        email,
        message: message.substring(0, 100) + '...',
        confidence: contentAnalysis.confidence
      })
      
      return NextResponse.json(
        { error: 'Message flagged as potential spam. Please contact us directly if this is an error.' },
        { status: 400 }
      )
    }

    console.log('✅ All security validations passed')

    // 7. Send email notification
    try {
      const transporter = createTransporter()
      
      // Test the connection
      await transporter.verify()
      
      // Enhanced email content with security information
      const securityInfo = securityMeta ? `
Security Analysis:
- Risk Score: ${securityValidation.riskScore}/100
- Time on Page: ${Math.round(securityMeta.timeOnPage / 1000)}s
- Form Interactions: ${securityMeta.formInteractions}
- Mouse Movements: ${securityMeta.mouseMovements}
- Keystrokes: ${securityMeta.keystrokes}
- Browser: ${securityMeta.userAgent.substring(0, 100)}
- Timezone: ${securityMeta.timezone}
- Screen: ${securityMeta.screen}
- Language: ${securityMeta.language}
- Referrer: ${securityMeta.referrer}
- Spam Confidence: ${contentAnalysis.confidence}%
- Client ID: ${clientId}
      ` : 'Security metadata not available'

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: 'mail@3g-international.com',
        subject: `WanderNote Contact Form - Message from ${name} [Risk: ${securityValidation.riskScore}]`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              New Contact Form Submission
            </h2>
            
            <div style="background-color: ${securityValidation.riskScore > 30 ? '#fff3cd' : '#d1ecf1'}; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Security Status</h3>
              <p><strong>Risk Score:</strong> ${securityValidation.riskScore}/100 ${securityValidation.riskScore > 30 ? '⚠️' : '✅'}</p>
              <p><strong>Spam Confidence:</strong> ${contentAnalysis.confidence}%</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #495057; margin-top: 0;">Contact Details</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
              <h3 style="color: #495057; margin-top: 0;">Message</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background-color: #e9ecef; border-radius: 5px; font-size: 12px; color: #6c757d;">
              <h4>Security Information</h4>
              <pre style="white-space: pre-wrap; font-size: 11px;">${securityInfo}</pre>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px; font-size: 12px; color: #6c757d;">
              <p>This message was sent via the WanderNote secure contact form at ${new Date().toISOString()}</p>
              <p>To reply, simply respond to this email or contact ${email} directly.</p>
            </div>
          </div>
        `,
        text: `
Contact Form Submission - WanderNote

Security Status: Risk Score ${securityValidation.riskScore}/100, Spam Confidence ${contentAnalysis.confidence}%

From: ${name}
Email: ${email}
Submitted: ${new Date().toLocaleString()}

Message:
${message}

${securityInfo}

---
This message was sent via the WanderNote secure contact form.
To reply, contact ${email} directly.
        `
      }

      const emailResult = await transporter.sendMail(mailOptions)
      console.log('✅ Email notification sent successfully!', {
        messageId: emailResult.messageId,
        riskScore: securityValidation.riskScore,
        spamConfidence: contentAnalysis.confidence
      })

    } catch (emailError) {
      console.error('💥 Email sending failed:', emailError)
      // Continue to return success to user to prevent revealing email issues
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Message sent successfully' 
    }, { status: 200 })

  } catch (error) {
    console.error('💥 Contact form error:', error)
    trackSuspiciousActivity(clientId, 'Server error occurred')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 