// Test script to check if room data is available in Forge Viewer
// Copy-paste this in browser console after loading a model

function testRoomData() {
  const viewer = window.NOP_VIEWER;
  
  if (!viewer) {
    console.error('❌ Viewer not found. Make sure model is loaded.');
    return;
  }

  console.log('🔍 Testing room data availability...');
  
  // Method 1: Search for Revit Rooms
  viewer.search('Revit Rooms', 
    (ids) => {
      if (ids && ids.length > 0) {
        console.log(`✅ Found ${ids.length} Revit Rooms!`);
        console.log('Room IDs:', ids);
        
        // Get properties of first room
        viewer.model.getProperties(ids[0], (props) => {
          console.log('📋 Sample Room Properties:', props);
        });
      } else {
        console.log('❌ No Revit Rooms found');
      }
    },
    (err) => {
      console.error('❌ Search error:', err);
    },
    ['Category'], 
    { searchHidden: true }
  );

  // Method 2: Search for any rooms
  viewer.search('Room', 
    (ids) => {
      if (ids && ids.length > 0) {
        console.log(`✅ Found ${ids.length} items with "Room" in name!`);
        console.log('Room-related IDs:', ids);
      } else {
        console.log('❌ No Room-related items found');
      }
    },
    (err) => {
      console.error('❌ Search error:', err);
    },
    ['Name'], 
    { searchHidden: true }
  );

  // Method 3: Check if we have master views
  const doc = viewer.model?.getDocumentNode()?.getDocument();
  if (doc) {
    const root = doc.getRoot();
    const viewables = root.search({'type': 'geometry', 'role': '3d'});
    console.log('📐 Available viewables:', viewables);
    
    const masterViews = viewables.filter(v => 
      v.data.name === v.data.phaseNames
    );
    console.log('🏗️ Master views found:', masterViews.length);
  }
}

// Auto-run after 2 seconds to give time for model loading
setTimeout(testRoomData, 2000);
console.log('🕐 Room data test will run in 2 seconds...');