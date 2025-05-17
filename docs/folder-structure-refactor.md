# Google Drive Folder Structure Refactoring

## Problem Statement

The current implementation in `lib/googleDrive.ts` has several critical issues:

1. Multiple folder structures are being created for the same journey
2. Images and videos that belong to the same journey are being split across different folder trees
3. Race conditions during folder creation lead to duplicate structures
4. Lack of proper synchronization between file uploads and folder structure creation
5. Caching mechanism is not preventing duplicate folder creation

## Current State

When uploading multiple files for a journey:
- Each file upload triggers a new folder structure check
- Multiple '04' month folders are created under the year folder
- Journey folders are duplicated under different month folders
- Images and videos end up in different folder trees
- No guaranteed single source of truth for folder structure

## Target State

1. Single Folder Structure:
   - One folder structure per journey: `year/month/journey_id/`
   - One `images` subfolder containing ALL images for the journey
   - One `videos` subfolder containing ALL videos for the journey

2. Synchronized Upload Process:
   - Folder structure must be validated/created before any uploads begin
   - All uploads use the same folder structure
   - No duplicate folders created

## Files to Modify

1. `lib/googleDrive.ts`:
   - Remove current caching mechanism
   - Implement new folder structure validation
   - Modify upload orchestration

## Implementation Steps

### 1. Folder Structure Validation & Creation

Create a new function in `lib/googleDrive.ts` that will:
- Take year, month, and journey ID as input
- Search for existing complete folder structure
- Create full structure if not found
- Return folder IDs and existence status
- Use a boolean flag to track structure readiness

### 2. Upload Orchestration

Modify the upload process in `lib/googleDrive.ts` to:
- Wait for folder structure validation before proceeding
- Group files by type (images/videos)
- Upload to correct subfolder based on type
- Support concurrent uploads within validated structure

### 3. Error Handling & Recovery

Add to `lib/googleDrive.ts`:
- Specific error types for different failure scenarios
- Comprehensive logging of structure validation and creation
- Upload progress tracking
- Failure recovery mechanisms

### 4. Testing Requirements

Create tests in `__tests__/googleDrive.test.ts` to verify:
- New journey folder structure creation
- Existing structure reuse
- Mixed media type handling
- Concurrent upload handling
- Error recovery scenarios

## Success Criteria

1. Folder Structure:
   - Only one folder path exists for each journey
   - All images for a journey are in one images folder
   - All videos for a journey are in one videos folder

2. Process:
   - Folder structure is validated/created before uploads begin
   - No duplicate folders are created
   - All files upload successfully to correct locations

3. Performance:
   - Multiple file uploads complete successfully
   - No race conditions occur
   - Process handles concurrent uploads properly

## Risks and Mitigations

1. Performance Impact:
   - Initial folder check adds latency
   - Mitigate by optimizing queries and using proper indexes

2. API Quotas:
   - Monitor Google Drive API usage
   - Implement rate limiting if needed

3. Concurrent Access:
   - Handle multiple users uploading to same journey
   - Implement proper locking mechanisms

4. Migration:
   - Consider existing data migration needs
   - Plan for handling existing duplicate structures

## Next Steps

1. Review and approve approach
2. Implement folder structure validation
3. Modify upload process
4. Add error handling
5. Create test cases
6. Test with multiple concurrent uploads
7. Monitor performance and API usage
8. Document changes and update API documentation 