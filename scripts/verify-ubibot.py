#!/usr/bin/env python3
"""
UbiBot Integration Verification Script
Compares official UbiBot API data with BIM Dashboard API

Run this script anytime to verify the integration is working correctly:
  python3 scripts/verify-ubibot.py

Official UbiBot API Documentation:
  - Quick Start: https://www.ubibot.com/platform-api/1232/quick-start/
  - Get Channels: https://www.ubibot.com/platform-api/1113/get-channels/
  - Data Forwarding: https://www.ubibot.com/platform-api/channel-feeds/2327/channel-data-forwarding/
  - Feed Summaries: https://www.ubibot.com/platform-api/2735/get-channel-feed-summaries/

Authentication:
  - Account Key: Found at console.ubibot.com -> Account -> Security
  - API Key: Found on each channel page (per-device)
  
API Endpoints:
  - Base URL: https://api.ubibot.com (recommended)
  - Alternative: https://webapi.ubibot.com (also works)
"""

import json
import urllib.request
import ssl
import os

# Configuration - Update these if needed
UBIBOT_ACCOUNT_KEY = os.environ.get("UBIBOT_ACCOUNT_KEY", "57331dc21926cf756e77bc7f35712e27")
UBIBOT_CHANNEL_ID = "121744"
BIM_PROJECT_ID = "692ea1bd00ea57e33b5c21ce"
BIM_BASE_URL = "http://localhost:3000"

# SSL context for HTTPS
ctx = ssl.create_default_context()

def fetch_json(url):
    """Fetch JSON from URL"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}

def main():
    print("=" * 60)
    print("   UBIBOT INTEGRATION DEEP VERIFICATION")
    print("=" * 60)
    print()
    
    # 1. Fetch from UbiBot Official API
    print("1. UBIBOT OFFICIAL API (api.ubibot.com)")
    print("-" * 60)
    
    ubibot_url = f"https://api.ubibot.com/channels/{UBIBOT_CHANNEL_ID}?account_key={UBIBOT_ACCOUNT_KEY}"
    print(f"   URL: {ubibot_url[:80]}...")
    
    ubibot_data = fetch_json(ubibot_url)
    
    if "error" in ubibot_data:
        print(f"   ERROR: {ubibot_data['error']}")
        return
    
    channel = ubibot_data.get("channel", {})
    last_values_raw = channel.get("last_values", "{}")
    
    # Parse last_values (it's a JSON string)
    if isinstance(last_values_raw, str):
        last_values = json.loads(last_values_raw)
    else:
        last_values = last_values_raw
    
    print()
    print("   DEVICE INFO:")
    print(f"   - Channel ID:    {channel.get('channel_id')}")
    print(f"   - Device Serial: {channel.get('serial')}")
    print(f"   - Product:       {channel.get('product_id')}")
    print(f"   - Firmware:      {channel.get('firmware')}")
    print(f"   - MAC Address:   {channel.get('mac_address')}")
    print()
    print("   FIELD MAPPINGS:")
    for i in range(1, 6):
        field_name = channel.get(f"field{i}")
        if field_name:
            print(f"   - field{i}: {field_name}")
    print()
    print("   LATEST VALUES (from UbiBot):")
    
    ubibot_readings = {}
    for key in ["field1", "field2", "field3", "field4", "field5"]:
        if key in last_values:
            val = last_values[key].get("value")
            ts = last_values[key].get("created_at")
            field_name = channel.get(key, key)
            ubibot_readings[key] = val
            print(f"   - {field_name} ({key}): {val} @ {ts}")
    
    print()
    print(f"   CONNECTIVITY:")
    print(f"   - Net Status:      {'Online' if str(channel.get('net')) == '1' else 'Offline'}")
    print(f"   - Last Entry Date: {channel.get('last_entry_date')}")
    print(f"   - Last IP:         {channel.get('last_ip')}")
    
    # 2. Fetch from BIM Dashboard API
    print()
    print()
    print("2. BIM DASHBOARD API (localhost:3000)")
    print("-" * 60)
    
    bim_url = f"http://localhost:3000/api/iot/realtime?projectId={BIM_PROJECT_ID}"
    print(f"   URL: {bim_url}")
    
    bim_data = fetch_json(bim_url)
    
    if "error" in bim_data:
        print(f"   ERROR: {bim_data['error']}")
        return
    
    updates = bim_data.get("updates", [])
    if not updates:
        print("   ERROR: No sensor updates returned")
        return
    
    sensor = updates[0]
    readings = sensor.get("readings", {})
    
    print()
    print("   SENSOR INFO:")
    print(f"   - Sensor ID:     {sensor.get('id')}")
    print(f"   - Display Value: {sensor.get('value')}")
    print(f"   - Status:        {sensor.get('status')}")
    print(f"   - Battery:       {sensor.get('batteryLevel')}%")
    print(f"   - Last Update:   {sensor.get('lastUpdate')}")
    print()
    print("   READINGS (from BIM):")
    print(f"   - Temperature:   {readings.get('temp')} °C")
    print(f"   - Humidity:      {readings.get('rh')} %")
    print(f"   - Light:         {readings.get('light')} lux")
    print(f"   - Voltage:       {readings.get('voltage')} V")
    print(f"   - WiFi RSSI:     {readings.get('rssi')} dBm")
    
    # 3. Comparison
    print()
    print()
    print("3. DATA COMPARISON")
    print("-" * 60)
    print()
    print("   FIELD              UBIBOT          BIM             MATCH")
    print("   " + "-" * 56)
    
    comparisons = [
        ("Temperature", ubibot_readings.get("field1"), readings.get("temp")),
        ("Humidity", ubibot_readings.get("field2"), readings.get("rh")),
        ("Light", ubibot_readings.get("field3"), readings.get("light")),
        ("Voltage", ubibot_readings.get("field4"), readings.get("voltage")),
        ("WiFi RSSI", ubibot_readings.get("field5"), readings.get("rssi")),
    ]
    
    all_match = True
    for name, ubibot_val, bim_val in comparisons:
        match = "✓" if ubibot_val == bim_val else "✗"
        if ubibot_val != bim_val:
            all_match = False
        print(f"   {name:<16} {str(ubibot_val):<15} {str(bim_val):<15} {match}")
    
    print()
    print("=" * 60)
    if all_match:
        print("   ✓ ALL VALUES MATCH - INTEGRATION IS WORKING CORRECTLY")
    else:
        print("   ✗ SOME VALUES DIFFER - CHECK FIELD MAPPING")
    print("=" * 60)
    
    # 4. Configuration Check
    print()
    print()
    print("4. CONFIGURATION CHECK")
    print("-" * 60)
    print()
    print("   REQUIRED ENV VARIABLES:")
    print(f"   - UBIBOT_ACCOUNT_KEY: {UBIBOT_ACCOUNT_KEY[:10]}...{UBIBOT_ACCOUNT_KEY[-5:]}")
    print(f"   - UBIBOT_BASE_URL:    https://api.ubibot.com (NOT webapi.ubibot.com)")
    print()
    print("   SENSOR CONFIGURATION:")
    print(f"   - ubibotChannelId:    {UBIBOT_CHANNEL_ID}")
    print()
    print("   API ENDPOINTS USED:")
    print("   - GET /channels/{id}?account_key={key}  (single channel)")
    print("   - GET /channels?account_key={key}        (all channels)")
    print()

if __name__ == "__main__":
    main()
