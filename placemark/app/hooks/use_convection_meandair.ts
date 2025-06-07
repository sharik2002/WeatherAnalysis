import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { dataAtom } from 'state/jotai';
import { usePersistence } from 'app/lib/persistence/context';
import { newFeatureId } from 'app/lib/id';
import { IFolder, IWrappedFeature } from 'types';
import { generateNKeysBetween } from 'fractional-indexing';

interface ConvectionData {
  success: boolean;
  data?: any;
  analysisTime?: string;
  timestamp?: string;
  error?: string;
}

interface ConvectionState {
  loading: boolean;
  data: ConvectionData | null;
  error: string | null;
  lastUpdate: string | null;
}

// Variables pour stocker les tokens d'authentification
let AUTH_TOKEN: string | null = null;
let REFRESH_TOKEN: string | null = null;

async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.guidor.fr/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        device: {
          device_id: "000-000-000",
          device_name: "Mac mini Dragonfly"
        }
      })
    });

    if (response.ok) {
      const authData = await response.json();
      AUTH_TOKEN = authData.Authorization;
      REFRESH_TOKEN = authData.RefreshToken;
      console.log("Authentication successful for Meandair convection");
      return true;
    } else {
      console.error(`Authentication error: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
}

async function apiRequest(endpoint: string, method: string = "GET"): Promise<any> {
  if (!AUTH_TOKEN) {
    console.error("Authentication token missing");
    return null;
  }

  try {
    const response = await fetch(`https://api.guidor.fr${endpoint}`, {
      method,
      headers: {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      return await response.json();
    } else {
      console.error(`API error: ${response.status} - ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error("API request error:", error);
    return null;
  }
}

async function getMeandairConvectionData(): Promise<ConvectionData> {
  console.log("Retrieving Meandair convection data...");
  
  // Récupérer les temps d'analyse disponibles
  const meandairTimes = await apiRequest("/v1/convections/analysis_time?source=meandair");
  console.log("Meandair times received:", meandairTimes);
  
  let analysisTime = null;
  if (meandairTimes && typeof meandairTimes === 'object' && 'analysis_times' in meandairTimes) {
    if (meandairTimes.analysis_times.length > 0) {
      analysisTime = meandairTimes.analysis_times[0];
    }
  }
  
  // Utiliser le temps actuel si aucun temps d'analyse n'est disponible
  if (!analysisTime) {
    analysisTime = new Date().toISOString().slice(0, 13) + ':00:00Z';
    console.log(`Using current time for Meandair: ${analysisTime}`);
  }
  
  // Récupérer les données de convection
  const meandairData = await apiRequest(`/v1/convections/?source=meandair&format=geojson&analysis_time=${analysisTime}`);
  
  if (meandairData) {
    console.log("Meandair convection data retrieved successfully");
    return {
      success: true,
      data: meandairData,
      analysisTime,
      timestamp: new Date().toISOString()
    };
  } else {
    console.error("Error retrieving Meandair convection data");
    return {
      success: false,
      error: "Failed to retrieve Meandair convection data"
    };
  }
}

export function useConvectionMeandair() {
  const [state, setState] = useState<ConvectionState>({
    loading: false,
    data: null,
    error: null,
    lastUpdate: null
  });

  const [data] = useAtom(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  const fetchConvectionData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // S'authentifier si nécessaire
      if (!AUTH_TOKEN) {
        const email = "sharik.abubucker@Skyconseil.fr";
        const password = "Sharik@Abu04";
        
        const loginSuccess = await login(email, password);
        if (!loginSuccess) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to authenticate with Guidor API'
          }));
          return;
        }
      }

      // Récupérer les données de convection Meandair
      const convectionData = await getMeandairConvectionData();
      
      if (convectionData.success && convectionData.data) {
        setState({
          loading: false,
          data: convectionData,
          error: null,
          lastUpdate: new Date().toISOString()
        });

        // Créer ou mettre à jour le dossier de convection Meandair
        await updateConvectionFolder(convectionData);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: convectionData.error || 'Failed to fetch convection data'
        }));
      }
    } catch (error) {
      console.error('Error fetching convection data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, []);

  const updateConvectionFolder = useCallback(async (convectionData: ConvectionData) => {
    try {
      // Rechercher le dossier "Convection Meandair Locale" existant
      let convectionFolder: IFolder | null = null;
      for (const folder of data.folderMap.values()) {
        if (folder.name === "Convection Meandair Locale") {
          convectionFolder = folder;
          break;
        }
      }

      // Créer le dossier s'il n'existe pas
      if (!convectionFolder) {
        const folderId = newFeatureId();
        const folderAt = generateNKeysBetween(null, null, 1)[0];
        
        convectionFolder = {
          id: folderId,
          name: "Convection Meandair Locale",
          at: folderAt,
          expanded: true,
          locked: false,
          visibility: true,
          folderId: null
        };

        console.log("Creating new convection folder");
      }

      // Supprimer les anciennes features de convection dans ce dossier
      const oldFeatures: string[] = [];
      for (const feature of data.featureMap.values()) {
        if (feature.folderId === convectionFolder.id) {
          oldFeatures.push(feature.id);
        }
      }

      // Créer les nouvelles features à partir des données GeoJSON
      const newFeatures: IWrappedFeature[] = [];
      if (convectionData.data && convectionData.data.features) {
        const ats = generateNKeysBetween(null, null, convectionData.data.features.length);
        
        convectionData.data.features.forEach((feature: any, index: number) => {
          // Ajouter des propriétés supplémentaires à la feature
          const enhancedFeature = {
            ...feature,
            properties: {
              ...feature.properties,
              source: 'meandair',
              analysisTime: convectionData.analysisTime,
              retrievedAt: convectionData.timestamp,
              type: 'convection'
            }
          };

          newFeatures.push({
            id: newFeatureId(),
            at: ats[index],
            folderId: convectionFolder!.id,
            feature: enhancedFeature
          });
        });
      }

      // Effectuer la transaction pour mettre à jour les données
      await transact({
        note: "Updated Meandair convection data",
        putFolders: [convectionFolder],
        putFeatures: newFeatures,
        deleteFeatures: oldFeatures
      });

      console.log(`Updated convection folder with ${newFeatures.length} features`);
    } catch (error) {
      console.error('Error updating convection folder:', error);
    }
  }, [data, transact]);

  return {
    ...state,
    refetch: fetchConvectionData
  };
} 