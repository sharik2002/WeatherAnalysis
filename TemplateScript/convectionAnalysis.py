#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timezone
import os

# Variables for storing authentication tokens
AUTH_TOKEN = None
REFRESH_TOKEN = None

def login(email, password):
    global AUTH_TOKEN, REFRESH_TOKEN
    
    url = "https://api.guidor.fr/v1/auth/login"
    payload = {
        "email": email,
        "password": password,
        "device": {
            "device_id": "000-000-000", 
            "device_name": "Mac mini Dragonfly"
        }
    }
    headers = {"Content-Type": "application/json"}
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    
    if response.status_code == 200:
        auth_data = response.json()
        # Store authentication tokens
        AUTH_TOKEN = auth_data.get("Authorization")
        REFRESH_TOKEN = auth_data.get("RefreshToken")
        print("Authentication successful")
        return True
    else:
        print(f"Authentication error: {response.status_code}")
        return False

def api_request(endpoint, method="GET", data=None):
    global AUTH_TOKEN
    if not AUTH_TOKEN:
        print("Authentication token missing")
        return None
    
    url = f"https://api.guidor.fr{endpoint}"
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, data=json.dumps(data) if data else None)
    else:
        print(f"Unsupported method: {method}")
        return None
    
    if response.status_code in [200, 201]:
        return response.json()
    else:
        print(f"API error: {response.status_code} - {response.text}")
        return None

def get_current_time_iso():
    """Get current time in ISO format"""
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:00:00Z')

def save_to_json(data, filename):
    """Save data to JSON file"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {filename}")
    except Exception as e:
        print(f"Error saving to {filename}: {e}")

def get_convection_data():
    print("Retrieving convection data...")
    
    # Dictionary to store all results
    all_convection_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sources": {}
    }
    
    # MétéoFrance Convection
    convection_times = api_request("/v1/convections/analysis_time?source=meteofrance")
    convection_data = api_request("/v1/convections/?source=meteofrance&format=geojson&area_name=global")
    
    if convection_data:
        print(f"MétéoFrance data retrieved")
        all_convection_data["sources"]["meteofrance"] = {
            "analysis_times": convection_times,
            "data": convection_data
        }
        save_to_json(convection_data, "meteofrance_convection.json")
    else:
        print("No MétéoFrance data available")

    # Meandair Convection
    meandair_times = api_request("/v1/convections/analysis_time?source=meandair")
    print(f"Meandair times received: {meandair_times}")  # Debug
    
    analysis_time = None
    if meandair_times and isinstance(meandair_times, dict) and 'analysis_times' in meandair_times:
        if len(meandair_times['analysis_times']) > 0:
            analysis_time = meandair_times['analysis_times'][0]
    
    # Use current time if no analysis time available
    if not analysis_time:
        print(f"Using current time for Meandair: {analysis_time}")
    
    meandair_data = api_request(f"/v1/convections/?source=meandair&format=geojson&analysis_time={analysis_time}")
    if meandair_data:
        print("Meandair data retrieved")
        all_convection_data["sources"]["meandair"] = {
            "analysis_times": meandair_times,
            "used_analysis_time": analysis_time,
            "data": meandair_data
        }
        save_to_json(meandair_data, "meandair_convection.json")
    else:
        print("Error retrieving Meandair data")

    # Meteomatics Convection
    meteomatics_times = api_request("/v1/convections/analysis_time?source=meteomatics")
    print(f"Meteomatics times received: {meteomatics_times}")  # Debug
    
    analysis_time = None
    if meteomatics_times and isinstance(meteomatics_times, dict) and 'analysis_times' in meteomatics_times:
        if len(meteomatics_times['analysis_times']) > 0:
            analysis_time = meteomatics_times['analysis_times'][0]
    
    # Use current time if no analysis time available
    if not analysis_time:

        print(f"Using current time for Meteomatics: {analysis_time}")
    
    meteomatics_data = api_request(f"/v1/convections/?source=meteomatics&format=geojson&analysis_time={analysis_time}")
    if meteomatics_data:
        print("Meteomatics data retrieved")
        all_convection_data["sources"]["meteomatics"] = {
            "analysis_times": meteomatics_times,
            "used_analysis_time": analysis_time,
            "data": meteomatics_data
        }
        save_to_json(meteomatics_data, "meteomatics_convection.json")
    else:
        print("Error retrieving Meteomatics data")
    
    # Save combined data
    save_to_json(all_convection_data, "all_convection_data.json")
    
    return all_convection_data

if __name__ == "__main__":
    if login("sharik.abubucker@Skyconseil.fr", "Sharik@Abu04"):
        result = get_convection_data()
        print(f"\nConvection data retrieval completed!")
        print(f"Files generated:")
        for filename in ["meteofrance_convection.json", "meandair_convection.json", "meteomatics_convection.json", "all_convection_data.json"]:
            if os.path.exists(filename):
                print(f"  - {filename}")
