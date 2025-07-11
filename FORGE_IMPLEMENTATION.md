# Autodesk Forge Implementation

This project now uses Autodesk Forge to handle RVT file viewing and processing. The implementation replaces the previous RVT converter with a cloud-based solution using Autodesk's Forge platform.

## Overview

### What Changed

1. **Removed**: Old RVT converter service and conversion interface
2. **Added**: Forge authentication service and viewer components
3. **Updated**: Project panel and 3D viewer to support Forge workflow

### New Components

#### 1. Forge Service (`app/services/forge-service.ts`)
- Handles authentication with Autodesk Forge
- Manages file uploads to Forge
- Handles file translation and status checking
- Provides token caching for performance

#### 2. Forge Viewer (`app/components/forge-viewer.tsx`)
- React component that loads the Autodesk Forge Viewer
- Includes custom toolbar with common BIM operations
- Handles loading states and error handling
- Supports all Forge viewer features (isolate, explode, wireframe, etc.)

#### 3. RVT Forge Interface (`app/dashboard/components/rvt-forge-interface.tsx`)
- User interface for processing RVT files
- Handles the 3-step process: upload → translate → complete
- Shows progress and status updates
- Provides error handling and user feedback

## How It Works

### RVT File Processing Flow

1. **User selects RVT file** from the project panel
2. **Processing interface opens** showing the 3-step process
3. **File upload** to Autodesk Forge cloud storage
4. **Translation job** starts to convert RVT to web-viewable format
5. **Status monitoring** until translation completes
6. **Forge viewer loads** with the converted model

### Forge Viewer Features

- **3D Navigation**: Orbit, pan, zoom controls
- **BIM Tools**: Isolate selection, show all, fit to view
- **Visualization**: Explode model, toggle wireframe
- **Professional UI**: Custom toolbar with BIM-specific controls

## API Endpoints Required

The implementation expects these API endpoints to be available:

### `/api/forge/token` (POST)
- Returns Forge access token
- Handles OAuth 2.0 authentication

### `/api/forge/upload` (POST)
- Uploads files to Forge
- Returns URN for uploaded file

### `/api/forge/translate` (POST)
- Starts translation job
- Returns job ID for monitoring

### `/api/forge/status/[jobId]` (GET)
- Checks translation status
- Returns completion status and final URN

## Environment Variables

Add these to your `.env.local`:

```env
FORGE_CLIENT_ID=your_forge_client_id
FORGE_CLIENT_SECRET=your_forge_client_secret
FORGE_BUCKET_KEY=your_bucket_key
```

## Usage

### For Users

1. **Upload RVT files** through the project panel
2. **Click on RVT files** to start processing
3. **Wait for processing** (2-5 minutes typically)
4. **View in Forge viewer** with full BIM capabilities

### For Developers

```typescript
// Using the Forge service
import { forgeAuthService } from '@/app/services/forge-service';

// Get access token
const token = await forgeAuthService.getAccessToken();

// Upload file
const result = await forgeAuthService.uploadFile(file);

// Start translation
const translation = await forgeAuthService.translateFile(urn);

// Wait for completion
const final = await forgeAuthService.waitForTranslation(jobId);
```

## Benefits

### For RVT Files
- **Native support**: No conversion needed
- **Full BIM data**: All properties and metadata preserved
- **Professional tools**: Industry-standard viewing capabilities
- **Cloud processing**: No local software required

### For Other Files
- **Fallback viewer**: Basic 3D viewer for non-RVT files
- **Consistent UI**: Same interface for all file types
- **Flexible**: Easy to extend for other formats

## Error Handling

The implementation includes comprehensive error handling:

- **Network errors**: Retry mechanisms and user feedback
- **Authentication failures**: Clear error messages
- **Processing failures**: Detailed error information
- **Viewer errors**: Fallback options and recovery

## Performance

- **Token caching**: Reduces API calls
- **Progress tracking**: Real-time status updates
- **Lazy loading**: Forge SDK loaded only when needed
- **Memory management**: Proper cleanup of viewer instances

## Future Enhancements

- **Batch processing**: Multiple files at once
- **Advanced BIM tools**: More specialized operations
- **Collaboration features**: Shared viewing sessions
- **Mobile support**: Responsive viewer interface 