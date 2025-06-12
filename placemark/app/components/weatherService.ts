interface WeatherData {
  convectionMeteofrance?: {
    times: string[]
    data: GeoJSON.FeatureCollection
  }
  convectionMeandair?: {
    times: string[]
    data: GeoJSON.FeatureCollection
  }
}

class WeatherService {
  private authToken: string | null = null
  private refreshToken: string | null = null
  private readonly API_BASE_URL = 'https://api.guidor.fr'

  async login(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: "sharik.abubucker@Skyconseil.fr",
          password: "Sharik@Abu04",
          device: {
            device_id: "000-000-000",
            device_name: "Placemark Web Client"
          }
        })
      })

      if (response.ok) {
        const authData = await response.json()
        this.authToken = authData.Authorization
        this.refreshToken = authData.RefreshToken
        console.log('Authentification')
        return true
      } else {
        console.error(`Err: ${response.status}`)
        return false
      }
    } catch (error) {
      console.error('Err:', error)
      return false
    }
  }
}
interface WeatherData {
  convectionMeteofrance?: {
    times: string[];
    data: GeoJSON.FeatureCollection;
  };
  convectionMeandair?: {
    times: string[];
    data: GeoJSON.FeatureCollection;
  };
}

class WeatherService {
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private readonly API_BASE_URL = 'https://api.guidor.fr';

  async login(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: "sharik.abubucker@Skyconseil.fr",
          password: "Sharik@Abu04",
          device: {
            device_id: "000-000-000",
            device_name: "Placemark Web Client"
          }
        })
      });

      if (response.ok) {
        const authData = await response.json();
        this.authToken = authData.Authorization;
        this.refreshToken = authData.RefreshToken;
        console.log('Authentification météo réussie');
        return true;
      } else {
        console.error(`Erreur d'authentification météo: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de la connexion météo:', error);
      return false;
    }
  }

  private async apiRequest(endpoint: string): Promise<any> {
    if (!this.authToken) {
      const loginSuccess = await this.login();
      if (!loginSuccess) return null;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error(`Erreur API météo: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error('Erreur lors de la requête API météo:', error);
      return null;
    }
  }

  async getConvectionMeteofrance(): Promise<GeoJSON.FeatureCollection | null> {
    const convectionData = await this.apiRequest('/v1/convections/?source=meteofrance&format=geojson&area_name=global');
    return convectionData;
  }

  async getAllWeatherData(): Promise<WeatherData> {
    const weatherData: WeatherData = {};

    // Convection MétéoFrance
    const convectionMF = await this.getConvectionMeteofrance();
    if (convectionMF) {
      weatherData.convectionMeteofrance = {
        times: [],
        data: convectionMF
      };
    }

    return weatherData;
  }
}

export const weatherService = new WeatherService();
