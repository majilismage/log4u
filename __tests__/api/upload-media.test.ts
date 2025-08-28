import { POST } from '@/app/api/upload-media/route'
import { google } from 'googleapis'
import { getAuthenticatedClient } from '@/lib/google-api-client'
import { ensureDriveFolderExists } from '@/lib/ensure-drive-setup'

// Mock dependencies
jest.mock('googleapis')
jest.mock('@/lib/google-api-client')
jest.mock('@/lib/ensure-drive-setup')
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}))

describe('Upload Media API', () => {
  const mockDrive = {
    files: {
      create: jest.fn(),
      get: jest.fn()
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    console.log = jest.fn()
    console.error = jest.fn()
    
    // Mock google.drive
    ;(google.drive as jest.Mock).mockReturnValue(mockDrive)
    
    // Mock successful authentication by default
    ;(getAuthenticatedClient as jest.Mock).mockResolvedValue({
      auth: 'mock-auth',
      userId: 'test-user-id',
      googleDriveFolderId: 'test-folder-id'
    })
    
    // Mock folder verification success
    mockDrive.files.get.mockResolvedValue({
      data: {
        id: 'test-folder-id',
        name: 'Test Folder',
        trashed: false
      }
    })
  })

  describe('Successful upload', () => {
    it('should upload a file successfully', async () => {
      // Mock successful upload
      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'uploaded-file-id',
          webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view',
          webContentLink: 'https://drive.google.com/uc?id=uploaded-file-id',
          thumbnailLink: 'https://drive.google.com/thumbnail?id=uploaded-file-id'
        }
      })

      // Create test file
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      // Create mock request
      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      // Call the API
      const response = await POST(request)
      const data = await response.json()

      // Assertions
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.fileId).toBe('uploaded-file-id')
      expect(data.webViewLink).toBe('https://drive.google.com/file/d/uploaded-file-id/view')
      
      // Verify Drive API was called correctly
      expect(mockDrive.files.create).toHaveBeenCalledWith({
        requestBody: {
          name: 'test.jpg',
          parents: ['test-folder-id'],
          appProperties: {
            journeyId: 'journey-123',
            isLog4uMedia: 'true'
          }
        },
        media: {
          mimeType: 'image/jpeg',
          body: expect.anything()
        },
        fields: 'id, webViewLink, webContentLink, thumbnailLink'
      })
    })

    it('should create folder if it does not exist', async () => {
      // Mock no existing folder
      ;(getAuthenticatedClient as jest.Mock).mockResolvedValue({
        auth: 'mock-auth',
        userId: 'test-user-id',
        googleDriveFolderId: null
      })

      // Mock folder creation
      ;(ensureDriveFolderExists as jest.Mock).mockResolvedValue('new-folder-id')

      // Mock folder verification for new folder
      mockDrive.files.get.mockResolvedValue({
        data: {
          id: 'new-folder-id',
          name: 'New Folder',
          trashed: false
        }
      })

      // Mock successful upload
      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'uploaded-file-id',
          webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view'
        }
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(ensureDriveFolderExists).toHaveBeenCalledWith('mock-auth', 'test-user-id')
    })
  })

  describe('Error handling', () => {
    it('should handle authentication failure', async () => {
      ;(getAuthenticatedClient as jest.Mock).mockRejectedValue(
        new Error('Authentication failed')
      )

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication failed')
    })

    it('should handle missing file', async () => {
      const formData = new FormData()
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
    })

    it('should handle invalid file type', async () => {
      const file = new File(['test'], 'test.exe', { type: 'application/exe' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type.')
    })

    it('should handle Google Drive API errors', async () => {
      mockDrive.files.create.mockRejectedValue({
        message: 'Insufficient permissions',
        response: {
          status: 403,
          data: {
            error: {
              message: 'The user does not have sufficient permissions'
            }
          }
        }
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('The user does not have sufficient permissions')
    })

    it('should handle folder access errors', async () => {
      mockDrive.files.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            error: {
              message: 'File not found'
            }
          }
        }
      })

      ;(ensureDriveFolderExists as jest.Mock).mockResolvedValue('new-folder-id')

      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'uploaded-file-id',
          webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view'
        }
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(ensureDriveFolderExists).toHaveBeenCalled()
    })
  })

  describe('File processing', () => {
    it('should handle large files correctly', async () => {
      // Create a 5MB file
      const largeContent = new Array(5 * 1024 * 1024).fill('a').join('')
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })
      
      mockDrive.files.create.mockResolvedValue({
        data: {
          id: 'uploaded-file-id',
          webViewLink: 'https://drive.google.com/file/d/uploaded-file-id/view'
        }
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(response.status).toBe(200)
      expect(mockDrive.files.create).toHaveBeenCalled()
    })

    it('should reject files that are too large', async () => {
      // Create a 51MB file (over 50MB limit)
      const tooLargeContent = new Array(51 * 1024 * 1024).fill('a').join('')
      const file = new File([tooLargeContent], 'toolarge.jpg', { type: 'image/jpeg' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('journeyId', 'journey-123')

      const request = new Request('http://localhost/api/upload-media', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('File too large.')
    })
  })
})