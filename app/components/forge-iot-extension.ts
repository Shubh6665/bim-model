// app/components/forge-iot-extension.ts

declare global {
  var Autodesk: any;
  var THREE: any;
}

// Use 'any' for all Autodesk/THREE types to avoid TS errors
export class IoTSensorExtension extends (globalThis.Autodesk?.Viewing?.Extension || class {}) {
  private viewer: any;
  private sensors: { [key: string]: any };
  private sensorMaterial: any;
  private currentInsertInfo: { sensorType: string } | null;

  constructor(viewer: any, options: any) {
    super(viewer, options);
    this.viewer = viewer;
    this.sensors = {};
    this.sensorMaterial = globalThis.THREE ? new globalThis.THREE.MeshBasicMaterial({ color: 0xff00ff, side: globalThis.THREE.DoubleSide }) : null;
    this.currentInsertInfo = null;
    this._onMouseClick = this._onMouseClick.bind(this);
  }

  async load() {
    console.log('IoTSensorExtension loaded.');
    await this.loadAllSensors();
    return true;
  }

  unload() {
    console.log('IoTSensorExtension unloaded.');
    Object.values(this.sensors).forEach(sensorMesh => {
        this.viewer.impl.scene.remove(sensorMesh);
    });
    this.sensors = {};
    return true;
  }

  async loadAllSensors() {
    try {
      const res = await fetch('/api/iot/sensors');
      if (!res.ok) throw new Error('Failed to fetch sensors');
      const sensorsData = await res.json();
      sensorsData.forEach((sensor: any) => this.drawSensor(sensor));
    } catch (error) {
      console.error(error);
    }
  }

  drawSensor(sensorData: any) {
    if (this.sensors[sensorData.sensorId]) return;
    if (!globalThis.THREE) return;
    const sensorGeometry = new globalThis.THREE.SphereGeometry(1.5, 16, 16);
    const sensorMesh = new globalThis.THREE.Mesh(sensorGeometry, this.sensorMaterial);
    sensorMesh.position.set(sensorData.position.x, sensorData.position.y, sensorData.position.z);
    sensorMesh.userData = {
      sensorId: sensorData.sensorId,
      sensorType: sensorData.sensorType,
      hostDbId: sensorData.hostDbId
    };
    this.viewer.impl.scene.add(sensorMesh);
    this.sensors[sensorData.sensorId] = sensorMesh;
  }
  
  public enterInsertMode(sensorType: string) {
    this.currentInsertInfo = { sensorType };
    this.viewer.toolController.activateTool('hitTest');
    this.viewer.addEventListener(globalThis.Autodesk?.Viewing?.HIT_TEST_RESULT, this._onMouseClick);
    alert(`Insert mode for ${sensorType} sensor is active. Click on the model to place it.`);
  }

  private exitInsertMode() {
    this.currentInsertInfo = null;
    this.viewer.removeEventListener(globalThis.Autodesk?.Viewing?.HIT_TEST_RESULT, this._onMouseClick);
    this.viewer.toolController.deactivateTool('hitTest');
  }

  private async _onMouseClick(event: any) {
    if (!this.currentInsertInfo || !event.face) {
      return;
    }
    const hitPoint = event.point;
    const hostDbId = event.dbId;
    try {
      const response = await fetch('/api/iot/sensors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensorType: this.currentInsertInfo.sensorType,
          position: hitPoint,
          hostDbId: hostDbId,
        }),
      });
      if (!response.ok) throw new Error('Failed to save sensor');
      const newSensor = await response.json();
      this.drawSensor(newSensor);
      alert('Sensor placed successfully!');
    } catch (error) {
      console.error('Error placing sensor:', error);
      alert('Failed to place sensor.');
    } finally {
      this.exitInsertMode();
    }
  }
}

