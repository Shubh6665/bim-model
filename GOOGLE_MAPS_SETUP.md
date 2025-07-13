# Google Maps Integration Setup

This document explains how to set up Google Maps integration for the BIM Project Dashboard.

## Features Added

### 🌍 Google Earth View
- Interactive satellite/earth-style map view
- Zoomable and pannable interface
- Support for multiple map types (Satellite, Hybrid, Terrain, Roadmap)

### 📍 Project Location Markers
- Visual markers for each BIM project location
- Custom orange construction-themed markers
- Info windows with project details and action buttons

### 🔄 Two-Way Selection
- **Map to Sidebar**: Click markers to select projects and highlight in sidebar
- **Sidebar to Map**: Click projects in sidebar to zoom to markers on map
- **Seamless Integration**: Both views stay synchronized

### 🏗️ View Mode Toggle
- Toggle between "Earth View" (Google Maps) and "3D Model" (Forge Viewer)
- Smooth transitions between map and model viewing
- Persistent project selection across view modes

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API (optional, for enhanced features)

### 2. API Key Configuration

1. In Google Cloud Console, go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the generated API key
4. **Important**: Restrict the API key:
   - Go to **API restrictions** and select "Maps JavaScript API"
   - Go to **Application restrictions** and add your domain(s)

### 3. Environment Variables

1. Copy `env.example` to `.env.local`
2. Add your Google Maps API key:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

### 4. Billing Setup

**Important**: Google Maps requires billing to be enabled even for free tier usage.

1. In Google Cloud Console, go to **Billing**
2. Set up a billing account
3. Monitor usage at **APIs & Services > Quotas**

## Project Data Structure

Projects should include geolocation data:

```typescript
interface Project {
  id: string;
  name: string;
  lat: number;           // Latitude coordinate
  lng: number;           // Longitude coordinate
  urn?: string;          // Optional: Forge viewer URN
  description?: string;  // Optional: Project description
}
```

Example project data:
```typescript
const projects = [
  {
    id: "1",
    name: "Main Office Building",
    lat: 28.6139,
    lng: 77.2090,
    urn: "urn:adsk.viewing:fs.file:xyz123...",
    description: "Corporate headquarters project"
  },
  // ... more projects
];
```

## Component Architecture

### GoogleEarthMap Component
- `components/google-earth-map.tsx`
- Handles Google Maps initialization and rendering
- Manages markers and info windows
- Provides map interaction callbacks

### EnhancedProjectPanel Component  
- `components/enhanced-project-panel.tsx`
- Dual-tab interface (Projects/Files)
- Search functionality for both projects and files
- Location-aware project and file listings

### EnhancedBIMDashboard Component
- `enhanced-bim-dashboard.tsx`
- Main dashboard orchestrator
- Manages view mode switching
- Coordinates between map, viewer, and sidebar

## Usage Workflow

1. **Dashboard Load**: User sees Google Earth view with project markers
2. **Map Interaction**: 
   - Click markers to select projects
   - Use map controls to navigate
   - View project info in popup windows
3. **Sidebar Interaction**:
   - Browse projects by list or location
   - Search for specific projects
   - View project details in info panel
4. **Model Viewing**:
   - Switch to 3D viewer for projects with URN
   - Seamless transition between map and model views
   - Project context maintained across views

## Troubleshooting

### Common Issues

1. **Map doesn't load**:
   - Check API key is correctly set in `.env.local`
   - Verify Maps JavaScript API is enabled
   - Check browser console for errors

2. **"For development purposes only" watermark**:
   - Billing account not set up
   - API key restrictions too strict
   - Domain not added to allowed referrers

3. **Markers not appearing**:
   - Check project data has valid lat/lng coordinates
   - Verify coordinates are within valid ranges (-90 to 90 for lat, -180 to 180 for lng)

### Performance Optimization

1. **API Key Restrictions**: Always restrict your API key to specific domains
2. **Quotas**: Monitor API usage in Google Cloud Console
3. **Caching**: Consider caching map tiles for frequently viewed areas

## Cost Management

- Google Maps provides $200 free credit monthly
- Monitor usage in Google Cloud Console
- Set up billing alerts for unexpected charges
- Consider implementing usage limits if needed

## Security Best Practices

1. **API Key Security**:
   - Never commit API keys to version control
   - Use environment variables for configuration
   - Restrict API keys to specific domains/IPs

2. **Data Security**:
   - Don't expose sensitive project coordinates publicly
   - Consider using approximate coordinates for sensitive locations
   - Implement proper authentication for project data access

## Future Enhancements

Potential improvements for the map integration:

1. **Clustering**: Group nearby projects when zoomed out
2. **Custom Map Styles**: Match map appearance to app theme
3. **Drawing Tools**: Allow users to define project boundaries
4. **Satellite Imagery**: Integrate with construction site imagery
5. **Real-time Updates**: Live project status updates on markers
6. **Mobile Optimization**: Touch-friendly controls for mobile devices
