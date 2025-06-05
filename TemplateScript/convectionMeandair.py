#!/usr/bin/env python3
import os
import requests 
import json
from datetime import datetime, timezone, timedelta

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
        print(f"API request error: {response.status_code} - {response.text}")
        return None

def save_to_json(data, filename):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)

def round_to_nearest_hour(dt):
    """Arrondit un datetime à l'heure la plus proche"""
    if dt.minute >= 30:
        return dt.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    else:
        return dt.replace(minute=0, second=0, microsecond=0)

def generate_time_intervals():
    """Génère les intervalles de temps de -6h à maintenant par heures arrondies"""
    current_time = datetime.now(timezone.utc)
    time_intervals = []
    
    # Générer les heures de -6h à 0h par intervalles d'1 heure, arrondies
    for i in range(7):  # 0 à 6 (7 heures)
        time_offset = current_time - timedelta(hours=6-i)
        rounded_time = round_to_nearest_hour(time_offset)
        # Format ISO sans microsecondes
        time_str = rounded_time.strftime('%Y-%m-%dT%H:%M:%S+00:00')
        if time_str not in time_intervals:  # Éviter les doublons
            time_intervals.append(time_str)
    
    return time_intervals

def get_available_analysis_times(source):
    """Récupère les heures d'analyse disponibles pour une source"""
    times_data = api_request(f"/v1/convections/analysis_time?source={source}")
    if times_data and isinstance(times_data, dict) and 'analysis_times' in times_data:
        return times_data['analysis_times']
    return []

def find_closest_available_time(target_time, available_times):
    """Trouve l'heure disponible la plus proche de l'heure cible"""
    if not available_times:
        return None
    
    target_dt = datetime.fromisoformat(target_time.replace('Z', '+00:00'))
    closest_time = None
    min_diff = float('inf')
    
    for available_time in available_times:
        try:
            available_dt = datetime.fromisoformat(available_time.replace('Z', '+00:00'))
            diff = abs((target_dt - available_dt).total_seconds())
            if diff < min_diff:
                min_diff = diff
                closest_time = available_time
        except:
            continue
    
    return closest_time

def get_convection_data():
    print("Retrieving convection data...")
    
    # Générer les intervalles de temps souhaités
    desired_intervals = generate_time_intervals()
    print(f"Desired time intervals: {len(desired_intervals)} intervals")
    for interval in desired_intervals:
        print(f"  - {interval}")
    
    # Dictionary to store all results
    all_convection_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "desired_intervals": desired_intervals,
        "sources": {}
    }

    # MétéoFrance Convection (pas de changement)
    print("\n=== MétéoFrance ===")
    convection_times = api_request("/v1/convections/analysis_time?source=meteofrance")
    convection_data = api_request("/v1/convections/?source=meteofrance&format=geojson&area_name=global")
    
    if convection_data:
        print("MétéoFrance data retrieved")
        all_convection_data["sources"]["meteofrance"] = {
            "analysis_times": convection_times,
            "data": convection_data
        }
        save_to_json(convection_data, "meteofrance_convection.json")
    else:
        print("No MétéoFrance data available")

    # Meandair Convection
    print("\n=== Meandair ===")
    available_times = get_available_analysis_times("meandair")
    print(f"Available Meandair times: {len(available_times) if available_times else 0}")
    
    meandair_all_data = []
    
    if available_times:
        # Utiliser les heures disponibles qui correspondent à notre plage
        current_time = datetime.now(timezone.utc)
        six_hours_ago = current_time - timedelta(hours=6)
        
        for available_time in available_times:
            try:
                available_dt = datetime.fromisoformat(available_time.replace('Z', '+00:00'))
                if six_hours_ago <= available_dt <= current_time:
                    print(f"Querying Meandair for available time: {available_time}")
                    meandair_data = api_request(f"/v1/convections/?source=meandair&format=geojson&analysis_time={available_time}")
                    
                    if meandair_data:
                        meandair_all_data.append({
                            "analysis_time": available_time,
                            "data": meandair_data
                        })
                        print(f"  ✓ Data retrieved for {available_time}")
                    else:
                        print(f"  ✗ No data for {available_time}")
            except Exception as e:
                print(f"  ✗ Error processing time {available_time}: {e}")
    else:
        print("No available times found for Meandair")
    
    if meandair_all_data:
        all_convection_data["sources"]["meandair"] = {
            "available_times": available_times,
            "time_series_data": meandair_all_data
        }
        save_to_json(meandair_all_data, "meandair_convection.json")
        print(f"Meandair: {len(meandair_all_data)} time intervals retrieved")
    else:
        print("No Meandair data retrieved")

    # Meteomatics Convection
    print("\n=== Meteomatics ===")
    available_times = get_available_analysis_times("meteomatics")
    print(f"Available Meteomatics times: {len(available_times) if available_times else 0}")
    
    meteomatics_all_data = []
    
    if available_times:
        # Utiliser les heures disponibles qui correspondent à notre plage
        current_time = datetime.now(timezone.utc)
        six_hours_ago = current_time - timedelta(hours=6)
        
        for available_time in available_times:
            try:
                available_dt = datetime.fromisoformat(available_time.replace('Z', '+00:00'))
                if six_hours_ago <= available_dt <= current_time:
                    print(f"Querying Meteomatics for available time: {available_time}")
                    meteomatics_data = api_request(f"/v1/convections/?source=meteomatics&format=geojson&analysis_time={available_time}")
                    
                    if meteomatics_data:
                        meteomatics_all_data.append({
                            "analysis_time": available_time,
                            "data": meteomatics_data
                        })
                        print(f"  ✓ Data retrieved for {available_time}")
                    else:
                        print(f"  ✗ No data for {available_time}")
            except Exception as e:
                print(f"  ✗ Error processing time {available_time}: {e}")
    else:
        print("No available times found for Meteomatics")
    
    if meteomatics_all_data:
        all_convection_data["sources"]["meteomatics"] = {
            "available_times": available_times,
            "time_series_data": meteomatics_all_data
        }
        save_to_json(meteomatics_all_data, "meteomatics_convection.json")
        print(f"Meteomatics: {len(meteomatics_all_data)} time intervals retrieved")
    else:
        print("No Meteomatics data retrieved")
    
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
