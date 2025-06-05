#!/usr/bin/env python3
import requests
import json

# Variable for storing authentication tokens
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
        # The storage process
        AUTH_TOKEN = auth_data.get("Authorization")
        REFRESH_TOKEN = auth_data.get("RefreshToken")
        print("Authentification succes")
        return True
    else:
        print(f"Erreur d'authentification: {response.status_code}")
        return False

def api_request(endpoint, method="GET", data=None):
    global AUTH_TOKEN
    if not AUTH_TOKEN:
        print("Error")
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
        print(f"Others: {method}")
        return None
    
    if response.status_code in [200, 201]:
        return response.json()
    else:
        print(f"Erreur API: {response.status_code}")
        return None


# Getting weather data

# Convection MEteoFrance x
# Convection Mendair
# convection Meteomatics x
#Turbulence WSI 
# Turbulance Meandair  
# Turbulance Meteomatics  
# Turbulance MéteoFrance
# Icing WSI  x
# Icing Meandair 
# Icing Meteomatics 
# Icing MéteoFrance x


# Convection MEteoFrance 

# Get available times
#convection_times = api_request("/v1/convections/analysis_time?source=meteofrance")
# Download data
#convection_data = api_request("/v1/convections/?source=meteofrance&format=geojson&area_name=global")

# Convection Mendair

# Get available times
#meandair_times = api_request("/v1/convections/analysis_time?source=meandair")
# Download data
#meandair_data = api_request(f"/v1/convections/?source=meandair&format=geojson&analysis_time={analysis_time}")

# Convection Meteomatics

# Get available times
#meteomatics_times = api_request("/v1/convections/analysis_time?source=meteomatics")
# Download data (need specific analysis_time)
#meteomatics_data = api_request(f"/v1/convections/?source=meteomatics&format=geojson&analysis_time={analysis_time}")

#Turbulence WSI 

# Get forecast times
#wsi_turb_forecasts = api_request("/v1/turbulence/?num_fc=8")
# Get detailed times for specific forecast
#detailed_times = api_request(f"/v1/turbulence/{forecast_time}")
# Download content
#turb_content = api_request(f"/v1/turbulence/content/{content_filename}")

# Turbulance Meandair  

# Get available times
#meteomatics_times = api_request("/v1/convections/analysis_time?source=meteomatics")
# Download data (need specific analysis_time)
#meteomatics_data = api_request(f"/v1/convections/?source=meteomatics&format=geojson&analysis_time={analysis_time}")

# Turbulance Meteomatics 




# Turbulance MéteoFrance

# Get available times
#meteofrance_turb_times = api_request("/v1/turbulence/analysis_time?source=meteofrance")
# Download data
#meteofrance_turb_data = api_request(f"/v1/turbulence/?source=meteofrance&format=geojson&analysis_time={analysis_time}")

# Icing WSI 

# Get forecast times
#wsi_icing_forecasts = api_request("/v1/icing/?num_fc=8")
# Get detailed times for specific forecast
#detailed_icing_times = api_request(f"/v1/icing/{forecast_time}")
# Download content
#icing_content = api_request(f"/v1/icing/content/{content_filename}")

# Icing Meandair 




# Icing Meteomatics 

# Get available times
#meandair_icing_times = api_request("/v1/icing/analysis_time?source=meandair")
# Download data
#meandair_icing_data = api_request(f"/v1/icing/?source=meandair&format=geojson&analysis_time={analysis_time}")

# Icing MéteoFrance

# Get available times
#meteofrance_icing_times = api_request("/v1/icing/analysis_time?source=meteofrance")
# Download data
#meteofrance_icing_data = api_request(f"/v1/icing/?source=meteofrance&format=geojson&analysis_time={analysis_time}")

def get_weather_data():
    # Convection MétéoFrance 
    convection_times = api_request("/v1/convections/analysis_time?source=meteofrance")
    convection_data = api_request("/v1/convections/?source=meteofrance&format=geojson&area_name=global")

    # Convection Meandair
    meandair_times = api_request("/v1/convections/analysis_time?source=meandair")
    if meandair_times and len(meandair_times) > 0:
        analysis_time = meandair_times[0] 
        meandair_data = api_request(f"/v1/convections/?source=meandair&format=geojson&analysis_time={analysis_time}")

    # Convection Meteomatics
    meteomatics_times = api_request("/v1/convections/analysis_time?source=meteomatics")
    if meteomatics_times and len(meteomatics_times) > 0:
        analysis_time = meteomatics_times[0]
        meteomatics_data = api_request(f"/v1/convections/?source=meteomatics&format=geojson&analysis_time={analysis_time}")

    # Turbulence WSI 
    wsi_turb_forecasts = api_request("/v1/turbulence/?num_fc=8")
    if wsi_turb_forecasts and len(wsi_turb_forecasts) > 0:
        forecast_time = wsi_turb_forecasts[0]['forecast_time']  
        detailed_times = api_request(f"/v1/turbulence/{forecast_time}")
        if detailed_times and len(detailed_times) > 0:
            content_filename = detailed_times[0]['filename']  
            turb_content = api_request(f"/v1/turbulence/content/{content_filename}")

    # Turbulence Meandair
    meandair_turb_times = api_request("/v1/turbulence/analysis_time?source=meandair")
    if meandair_turb_times and len(meandair_turb_times) > 0:
        analysis_time = meandair_turb_times[0]
        meandair_turb_data = api_request(f"/v1/turbulence/?source=meandair&format=geojson&analysis_time={analysis_time}")

    # Turbulence Meteomatics
    meteomatics_turb_times = api_request("/v1/turbulence/analysis_time?source=meteomatics")
    if meteomatics_turb_times and len(meteomatics_turb_times) > 0:
        analysis_time = meteomatics_turb_times[0]
        meteomatics_turb_data = api_request(f"/v1/turbulence/?source=meteomatics&format=geojson&analysis_time={analysis_time}")

    # Turbulence MétéoFrance
    meteofrance_turb_times = api_request("/v1/turbulence/analysis_time?source=meteofrance")
    if meteofrance_turb_times and len(meteofrance_turb_times) > 0:
        analysis_time = meteofrance_turb_times[0]
        meteofrance_turb_data = api_request(f"/v1/turbulence/?source=meteofrance&format=geojson&analysis_time={analysis_time}")

    # Icing WSI 
    wsi_icing_forecasts = api_request("/v1/icing/?num_fc=8")
    if wsi_icing_forecasts and len(wsi_icing_forecasts) > 0:
        forecast_time = wsi_icing_forecasts[0]['forecast_time']
        detailed_icing_times = api_request(f"/v1/icing/{forecast_time}")
        if detailed_icing_times and len(detailed_icing_times) > 0:
            content_filename = detailed_icing_times[0]['filename']
            icing_content = api_request(f"/v1/icing/content/{content_filename}")

    # Icing Meandair 
    meandair_icing_times = api_request("/v1/icing/analysis_time?source=meandair")
    if meandair_icing_times and len(meandair_icing_times) > 0:
        analysis_time = meandair_icing_times[0]
        meandair_icing_data = api_request(f"/v1/icing/?source=meandair&format=geojson&analysis_time={analysis_time}")

    # Icing MétéoFrance
    meteofrance_icing_times = api_request("/v1/icing/analysis_time?source=meteofrance")
    if meteofrance_icing_times and len(meteofrance_icing_times) > 0:
        analysis_time = meteofrance_icing_times[0]
        meteofrance_icing_data = api_request(f"/v1/icing/?source=meteofrance&format=geojson&analysis_time={analysis_time}")


if __name__ == "__main__":
 
    if login("sharik.abubucker@Skyconseil.fr", "Sharik@Abu04"):
        get_weather_data()