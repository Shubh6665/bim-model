# BIM Project Dashboard with Google Maps Integration

A comprehensive Building Information Modeling (BIM) project management dashboard with integrated Google Earth view and Autodesk Forge viewer capabilities.

## 🚀 Features

### 🌍 Google Earth Integration
- **Interactive Map View**: Satellite/Earth-style visualization of project locations
- **Project Markers**: Visual indicators for BIM project locations with custom construction-themed icons
- **Two-Way Selection**: Select projects from map markers or sidebar list with synchronized highlighting
- **Info Windows**: Detailed project information with direct action buttons

### 🏗️ BIM Model Viewing
- **Autodesk Forge Integration**: Professional 3D BIM model viewing capabilities
- **RVT File Processing**: Direct upload and processing of Revit files
- **Multiple Format Support**: Support for RVT, DWG, IFC, and other BIM file formats
- **Real-time Processing**: Live file processing status and progress tracking

### 🔄 Seamless Workflow
- **View Mode Toggle**: Switch between Earth view and 3D model viewer
- **Project Context**: Maintain project selection across different view modes
- **Unified Interface**: Single dashboard for all project management needs
- **Responsive Design**: Works across desktop and mobile devices

### 🔐 Authentication & Security
- **Google OAuth**: Secure authentication using Google accounts
- **Session Management**: Persistent login sessions with NextAuth.js
- **Protected Routes**: Secure access to dashboard and project data

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Google Cloud Platform account (for Maps API)
- Autodesk Forge account (for BIM viewing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <https://github.com/Shubh6665/bim-model>
   cd bim-project-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env.local
   ```
   
   Configure the following environment variables:
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000

   # Autodesk Forge
   FORGE_CLIENT_ID=your_forge_client_id
   FORGE_CLIENT_SECRET=your_forge_client_secret
   FORGE_BUCKET_KEY=your_bucket_key
   FORGE_REGION=us

   # Google Maps API
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 Detailed Setup Guides

### Google Maps API Setup
See [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) for comprehensive Google Maps integration setup instructions.

### Autodesk Forge Setup
See [FORGE_SETUP.md](./FORGE_SETUP.md) for Autodesk Forge API configuration and implementation details.

## 🏗️ Architecture

### Component Structure
```
app/
├── dashboard/
│   ├── enhanced-bim-dashboard.tsx      # Main dashboard orchestrator
│   ├── components/
│   │   ├── google-earth-map.tsx        # Google Maps integration
│   │   ├── enhanced-project-panel.tsx  # Dual-tab project/file browser
│   │   ├── 3d-viewer.tsx              # BIM model viewer container
│   │   └── dashboard-header.tsx        # Navigation header
│   └── page.tsx                        # Dashboard page entry
├── components/
│   ├── forge-viewer.tsx                # Autodesk Forge viewer wrapper
│   └── session-wrapper.tsx             # Authentication wrapper
└── api/
    ├── auth/                           # NextAuth.js endpoints
    └── forge/                          # Forge API routes
```

### Data Flow
1. **Authentication**: Google OAuth → NextAuth.js session
2. **Project Data**: Static/API → Dashboard state management
3. **Map Interaction**: Google Maps events → Project selection
4. **Model Loading**: Project selection → Forge API → 3D viewer
5. **Two-way Sync**: Map ↔ Sidebar selection synchronization

## 🎯 Usage Workflow

### For End Users
1. **Login**: Authenticate using Google account
2. **Explore Projects**: 
   - View project locations on Google Earth
   - Browse projects in sidebar list
   - Search for specific projects
3. **Select Projects**:
   - Click map markers to select projects
   - Or select from sidebar project list
4. **View Models**:
   - Switch to 3D viewer for detailed BIM model examination
   - Use Forge viewer tools for measurement, sectioning, etc.

### For Developers
1. **Add Projects**: Update project data with geolocation coordinates
2. **File Management**: Handle RVT file uploads and processing
3. **API Integration**: Extend Forge API integration for additional features
4. **Styling**: Customize map markers and UI components

## 🔧 Configuration

### Project Data Structure
```typescript
interface Project {
  id: string;
  name: string;
  lat: number;           // Latitude (-90 to 90)
  lng: number;           // Longitude (-180 to 180) 
  urn?: string;          // Forge viewer URN (optional)
  description?: string;  // Project description (optional)
}
```

### Supported File Formats
- **RVT**: Autodesk Revit (primary support)
- **DWG**: AutoCAD drawings
- **IFC**: Industry Foundation Classes
- **NWD/NWC**: Navisworks files

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

### Environment Variables for Production
Ensure all environment variables are configured in your deployment platform:
- Google OAuth credentials
- Autodesk Forge API keys  
- Google Maps API key with proper domain restrictions

## 🔒 Security Considerations

### API Key Security
- **Never commit API keys** to version control
- **Restrict Google Maps API key** to specific domains
- **Use environment variables** for all sensitive configuration
- **Enable billing alerts** for Google Cloud Platform

### Authentication
- NextAuth.js provides secure session management
- Google OAuth ensures reliable user authentication
- Protected routes prevent unauthorized access

## 🐛 Troubleshooting

### Common Issues

1. **Map not loading**:
   - Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
   - Check Google Cloud Console for API restrictions
   - Ensure billing is enabled for Google Maps

2. **Forge viewer issues**:
   - Verify Forge API credentials
   - Check file processing status in Forge dashboard
   - Ensure proper CORS configuration

3. **Authentication problems**:
   - Verify Google OAuth client configuration
   - Check `NEXTAUTH_URL` matches your domain
   - Ensure `NEXTAUTH_SECRET` is set

### Performance Optimization
- Implement project data caching for large datasets
- Use map clustering for many project markers
- Optimize Forge viewer loading for better user experience


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Autodesk Forge** for BIM viewing capabilities
- **Google Maps Platform** for mapping services
- **Next.js** for the React framework
- **NextAuth.js** for authentication
- **Tailwind CSS** for styling
