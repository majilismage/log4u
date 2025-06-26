# Environment Variables Setup

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### NextAuth.js Configuration
```bash
# NextAuth.js URL (use your actual domain in production)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret-key-here
```

### Google OAuth Configuration
```bash
# Google OAuth Client Credentials
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### Database Configuration
```bash
# Neon Postgres Database URL (automatically provided by Neon)
DATABASE_URL=your-neon-database-url
```

## Production Environment Variables (Vercel)

For production deployment on Vercel, set these environment variables:

```bash
NEXTAUTH_URL=https://wandernote.vercel.app
NEXTAUTH_SECRET=your-generated-secret-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
DATABASE_URL=automatically-provided-by-neon
```

## Generating NEXTAUTH_SECRET

You can generate a secure secret key using:

```bash
openssl rand -base64 32
```

Or use this online generator: https://generate-secret.vercel.app/32

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://wandernote.vercel.app/api/auth/callback/google`
6. Configure OAuth consent screen for external users
7. Add required scope: `drive.file` (allows creating and accessing app-created files)

## OAuth Scope Details

The application uses the `drive.file` scope which provides:
- Permission to create new Google Sheets and Drive files
- Access to files created by the application
- Access to files explicitly shared with the application by users
- Enhanced security through per-file access control

This scope is non-sensitive and does not require Google's app verification process. 