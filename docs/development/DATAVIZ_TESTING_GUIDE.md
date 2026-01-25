# DataViz Drag & Drop Testing Guide

This guide helps you test the Autodesk Forge DataVisualization with drag & drop functionality in your BIM model.

## 🎯 What You Can Test

### 1. Drag & Drop Sensors
- **Temperature** 🌡️ (Red icons)
- **CO2** 🌿 (Green icons) 
- **Light** 💡 (Yellow icons)
- **Humidity** 💧 (Blue icons)
- **Seismic** 📳 (Purple icons)
- **Energy** ⚡ (Cyan icons)

### 2. Available Controls
- **🎛️ Sensors** - Toggle sensor palette
- **👁️ Show All** - Display all sprites
- **🙈 Hide All** - Hide all sprites
- **🗑️ Clear** - Remove all sprites

## 📋 Testing Steps

### Step 1: Load Your Model
1. Go to your dashboard
2. Switch to **"3D Model"** view
3. Select any RVT project to load in the viewer
4. Wait for "DataViz Ready" status to appear

### Step 2: Open Sensor Palette
1. Look for the **🎛️ Sensors** button in the top toolbar
2. Click it to open the Sensor Palette on the right side
3. You should see 6 different sensor types with drag handles

### Step 3: Test Drag & Drop
1. **Drag any sensor type** from the palette
2. **Drop it onto your 3D model** - anywhere on the building
3. You should see:
   - Blue dashed border during drag
   - "Drop sensor here" overlay
   - Sensor icon appears at drop location
   - Status shows sprite count increase

### Step 4: Test Placement Mode
1. Click **📍 Place** button next to any sensor type
2. Your cursor changes to crosshair
3. **Click anywhere on the 3D model** to place sensor
4. Sensor appears at click location
5. Click **❌ Exit Placement Mode** or press ESC

### Step 5: Test Visibility Controls
1. Click **👁️/🙈** buttons next to sensor types to show/hide
2. Use **Show All** / **Hide All** toolbar buttons
3. Use **Clear** to remove all sprites

### Step 6: Test Selection & Interaction
1. **Click on any placed sensor** in the 3D model
2. Sensor should highlight and appear in IoT panel
3. Hover over sensors to see tooltips with sensor info

## ✅ Expected Results

### Successful Drag & Drop:
- ✅ Sensor palette appears when clicking 🎛️
- ✅ Dragging shows visual feedback
- ✅ Dropping places sensor at correct 3D position
- ✅ Sprite counter increases
- ✅ Console shows: "Sprite added via drag & drop"

### Successful Placement Mode:
- ✅ Cursor changes to crosshair
- ✅ Clicking places sensor
- ✅ Console shows: "Sensor placed via DataViz"

### Successful Visibility:
- ✅ Show/Hide toggles work per sensor type
- ✅ Global show/hide/clear buttons work
- ✅ Sprite counter updates correctly

## 🔧 Status Indicators

Look for these indicators in your viewer:

### Bottom Left Status:
- 🟢 **DataViz Ready** - Extension loaded successfully
- **X sprites** - Current number of active sprites

### Top Toolbar Status:
- **Model ready** - Viewer is loaded
- **DataViz ready** - Extension is active
- **X sprites** - Active sprite count

## 🐛 Troubleshooting

### If Drag & Drop Doesn't Work:
1. Check browser console for errors
2. Ensure model is fully loaded (wait for "Model ready")
3. Try refreshing the page
4. Make sure you're dropping on the 3D model, not empty space

### If Sprites Don't Appear:
1. Check sprite counter in status
2. Try **Show All** button
3. Check if sensor type is visible (eye icon should be green)
4. Ensure you're dropping on model geometry

### If Placement Mode Stuck:
1. Press **ESC** key
2. Click **❌ Exit Placement Mode**
3. Refresh page if needed

## 📊 Console Messages to Look For

### Successful Operations:
```
DataVisualization extension loaded successfully
ForgeDataViz extension loaded successfully
Sprite added via drag & drop: {sensor data}
Added X sprites to DataViz
```

### Error Messages to Report:
```
Error handling drop: {error details}
Error adding sprite: {error details}
DataVisualization extension not loaded
```

## 🎮 Advanced Testing

### Test Multiple Sensors:
1. Add 10+ sensors of different types
2. Test show/hide for each type
3. Test clicking different sensors
4. Test clearing all and re-adding

### Test Edge Cases:
1. Try dropping on different building parts
2. Test with very large models
3. Test rapid drag & drop operations
4. Test with viewer zoom/pan during drag

### Performance Testing:
1. Add 50+ sensors and test performance
2. Check memory usage in browser dev tools
3. Test with multiple sensor types visible/hidden

## 📝 What to Report

If testing successful, report:
- ✅ Drag & drop works smoothly
- ✅ All sensor types can be placed
- ✅ Visibility controls work
- ✅ Performance is acceptable

If issues found, report:
- ❌ Specific steps that failed
- ❌ Console error messages
- ❌ Browser and version used
- ❌ Model size/complexity when issue occurred

## 🔄 Reset Instructions

To reset for fresh testing:
1. Click **🗑️ Clear** to remove all sprites
2. Or refresh the browser page
3. Reload your model
4. Start testing again

---

**Happy Testing! 🚀**

The DataViz system uses the official Autodesk Forge DataVisualization extension with enhanced drag & drop capabilities for easy IoT sensor placement in your BIM models.