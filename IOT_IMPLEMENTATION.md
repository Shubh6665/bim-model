# IoT Sensor Management Implementation

This document describes the complete IoT sensor management system implemented for the BIM Model Viewer.

## Overview

The IoT system allows users to place, view, and manage various types of sensors within 3D BIM models. Users can interact with sensors through a dedicated IoT panel and visualize them directly in the 3D model with different colors and states.

## Features Implemented

### 1. IoT Dashboard Panel

- **All Sensors View**: Display all sensors placed in the model
- **Insert New Sensor**: Place new sensors by type
- **Sensor Type Filters**: Filter sensors by type with visibility toggles
- **Search Functionality**: Search sensors by name or room
- **Real-time Updates**: Live sensor data simulation

### 2. Sensor Types Supported

1. **Temperature** - Red color (#ef4444)
2. **CO2** - Yellow color (#eab308)
3. **Light** - Amber color (#f59e0b)
4. **Humidity** - Blue color (#3b82f6)
5. **Seismic and accelerometric** - Purple color (#a855f7)
6. **Energy consumption** - Green color (#22c55e)

### 3. Sensor States

- **Online** - Normal operation with live data updates
- **Offline** - Grayed out appearance, no data updates
- **Warning** - Yellow glow, indicates sensor issues
- **Selected** - Highlighted appearance when clicked

### 4. Interactive Features

#### In the IoT Panel:
- Click "All sensors" to view all placed sensors
- Click "Insert new sensor" to enter placement mode
- Use sensor type buttons to filter by specific types
- Click eye icons to toggle sensor type visibility
- Click on any sensor to view detailed information
- Search sensors by name or location

#### In the 3D Model:
- Sensors appear as colored spheres
- Click on sensors to view details
- Sensors scale based on camera distance
- Different colors indicate sensor types
- Different opacity indicates status (online/offline)

#### Sensor Placement:
1. Click "Insert new sensor" in the IoT panel
2. Select the desired sensor type
3. Click anywhere on the 3D model to place the sensor
4. Sensor automatically appears with default values
5. Press Escape to exit placement mode

## Technical Architecture

### Components Structure

```
app/
├── components/
│   ├── iot-panel.tsx                 # Main IoT UI panel
│   ├── forge-viewer.tsx              # 3D viewer with IoT integration
│   └── forge-iot-extension.ts        # Forge viewer IoT extension
├── context/
│   └── sensor-context.tsx            # React context for sensor state
├── services/
│   └── sensor-service.ts             # Sensor data management service
└── api/iot/sensors/
    └── route.ts                      # REST API for sensor CRUD operations
```

### State Management

The system uses React Context (`SensorProvider`) to manage:
- Sensor data collection
- Selected sensor state
- Placement mode state
- Sensor type visibility
- Real-time updates

### 3D Integration

The Forge Viewer extension (`IoTSensorExtension`) handles:
- Rendering sensors as 3D objects in the model
- Click detection on sensors
- Sensor placement interaction
- Camera-based scaling and visibility
- Material management for different states

## API Endpoints

### GET /api/iot/sensors
Retrieve sensors with optional filtering:
- `?projectId=<id>` - Filter by project
- `?type=<sensorType>` - Filter by sensor type

### POST /api/iot/sensors
Create a new sensor with full sensor data structure.

### PUT /api/iot/sensors?id=<sensorId>
Update existing sensor properties.

### DELETE /api/iot/sensors?id=<sensorId>
Remove sensor from the system.

## Data Structure

```typescript
interface Sensor {
  id: string;
  name: string;
  type: string;
  status: "Online" | "Offline" | "Warning";
  value: string;
  position: { x: number; y: number; z: number };
  batteryLevel: number;
  lastUpdate: string;
  room: string;
  color?: string;
  projectId?: string;
  modelPosition?: { x: number; y: number; z: number };
}
```

## Usage Instructions

### For End Users

1. **Viewing Sensors**:
   - Switch to IoT panel using the header navigation
   - View all sensors in the list
   - Click on sensors to see detailed information
   - Use search to find specific sensors

2. **Adding Sensors**:
   - Click "Insert new sensor"
   - Choose sensor type from the grid
   - Click on the 3D model where you want to place it
   - Sensor appears immediately with default values

3. **Managing Sensors**:
   - Use type filter buttons to show/hide sensor categories
   - Click eye icons to toggle visibility
   - Select sensors to view details and options
   - Remove sensors using the detail panel

### For Developers

1. **Adding New Sensor Types**:
   - Update `SENSOR_TYPES` array in `iot-panel.tsx`
   - Add color configuration in `sensor-service.ts`
   - Update materials in `forge-iot-extension.ts`

2. **Customizing Sensor Appearance**:
   - Modify materials in `IoTSensorExtension.initializeMaterials()`
   - Adjust geometry in `createSensorMesh()`
   - Update scaling logic in `updateSensorLOD()`

3. **Extending Functionality**:
   - Add new sensor properties to the `Sensor` interface
   - Update API endpoints for additional data
   - Extend context methods for new operations

## Real-time Simulation

The system includes a simulation that:
- Updates sensor values every 10 seconds
- Simulates realistic value changes based on sensor type
- Updates timestamps automatically
- Maintains sensor status states

## Integration with BIM Models

- Sensors are rendered in the Forge Viewer overlay scene
- Positions are stored in model coordinates
- Sensors persist across model loads
- Integration with existing Forge Viewer tools

## Future Enhancements

Potential improvements for the system:
1. **Historical Data**: Store and visualize sensor data over time
2. **Alerts System**: Configure alerts for sensor thresholds
3. **Sensor Grouping**: Group sensors by zones or systems
4. **Export Features**: Export sensor data and reports
5. **Mobile Support**: Responsive design for mobile devices
6. **Integration**: Connect with real IoT devices and APIs

## Troubleshooting

### Common Issues

1. **Sensors not appearing**: Check if Forge Viewer loaded properly and IoT extension is active
2. **Placement not working**: Ensure placement mode is active and model geometry is loaded
3. **Context errors**: Verify SensorProvider wraps the dashboard component
4. **API errors**: Check MongoDB connection and collection setup

### Debug Methods

- Check browser console for extension loading messages
- Verify sensor context state in React Developer Tools
- Monitor network requests to sensor API endpoints
- Check Forge Viewer scene for sensor meshes

## Performance Considerations

- Sensors use Level-of-Detail (LOD) scaling based on camera distance
- Overlay scene prevents interference with model selection
- Efficient material reuse for different sensor states
- Optimized raycasting for sensor placement and selection