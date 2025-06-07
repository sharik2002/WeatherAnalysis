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
  availableAnalysisTimes: string[];
  loadingAnalysisTimes: boolean;
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
      console.log("Authentification réussie pour les convections Meandair");
      return true;
    } else {
      console.error(`Erreur d'authentification: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error("Erreur de connexion:", error);
    return false;
  }
}

async function apiRequest(endpoint: string, method: string = "GET"): Promise<any> {
  if (!AUTH_TOKEN) {
    console.error("Token d'authentification manquant");
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
      console.error(`Erreur API: ${response.status} - ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.error("Erreur de requête API:", error);
    return null;
  }
}

async function getAvailableAnalysisTimes(): Promise<string[]> {
  console.log("Récupération des temps d'analyse disponibles...");
  
  const meandairTimes = await apiRequest("/v1/convections/analysis_time?source=meandair");
  console.log("Temps Meandair reçus:", meandairTimes);
  
  if (meandairTimes && typeof meandairTimes === 'object' && 'analysis_times' in meandairTimes) {
    return meandairTimes.analysis_times || [];
  }
  
  return [];
}

async function getMeandairConvectionData(selectedAnalysisTime?: string): Promise<ConvectionData> {
  console.log("Récupération des données de convection Meandair...");
  
  let analysisTime = selectedAnalysisTime;
  
  // Si aucun temps n'est spécifié, récupérer les temps disponibles
  if (!analysisTime) {
    const availableTimes = await getAvailableAnalysisTimes();
    if (availableTimes.length > 0) {
      analysisTime = availableTimes[0];
    } else {
      // Utiliser le temps actuel si aucun temps d'analyse n'est disponible
      analysisTime = new Date().toISOString().slice(0, 13) + ':00:00Z';
      console.log(`Utilisation du temps actuel pour Meandair: ${analysisTime}`);
    }
  }
  
  // Récupérer les données de convection
  const meandairData = await apiRequest(`/v1/convections/?source=meandair&format=geojson&analysis_time=${analysisTime}`);
  
  if (meandairData) {
    console.log("Données de convection Meandair récupérées avec succès");
    return {
      success: true,
      data: meandairData,
      analysisTime,
      timestamp: new Date().toISOString()
    };
  } else {
    console.error("Erreur lors de la récupération des données de convection Meandair");
    return {
      success: false,
      error: "Échec de la récupération des données de convection Meandair"
    };
  }
}

export function useConvectionMeandair() {
  const [state, setState] = useState<ConvectionState>({
    loading: false,
    data: null,
    error: null,
    lastUpdate: null,
    availableAnalysisTimes: [],
    loadingAnalysisTimes: false
  });

  const [data] = useAtom(dataAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();

  // Fonction pour récupérer les temps d'analyse disponibles
  const fetchAvailableAnalysisTimes = useCallback(async () => {
    setState(prev => ({ ...prev, loadingAnalysisTimes: true, error: null }));

    try {
      // S'authentifier si nécessaire
      if (!AUTH_TOKEN) {
        const email = "sharik.abubucker@Skyconseil.fr";
        const password = "Sharik@Abu04";
        
        const loginSuccess = await login(email, password);
        if (!loginSuccess) {
          setState(prev => ({
            ...prev,
            loadingAnalysisTimes: false,
            error: 'Échec de l\'authentification avec l\'API Guidor'
          }));
          return;
        }
      }

      const analysisTimes = await getAvailableAnalysisTimes();
      
      setState(prev => ({
        ...prev,
        loadingAnalysisTimes: false,
        availableAnalysisTimes: analysisTimes,
        error: null
      }));

    } catch (error) {
      console.error('Erreur lors de la récupération des temps d\'analyse:', error);
      setState(prev => ({
        ...prev,
        loadingAnalysisTimes: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }));
    }
  }, []);

  // Fonction pour récupérer les données de convection avec un temps d'analyse spécifique
  const fetchConvectionData = useCallback(async (selectedAnalysisTime?: string) => {
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
            error: 'Échec de l\'authentification avec l\'API Guidor'
          }));
          return;
        }
      }

      // Récupérer les données de convection Meandair
      const convectionData = await getMeandairConvectionData(selectedAnalysisTime);
      
      if (convectionData.success && convectionData.data) {
        setState(prev => ({
          ...prev,
          loading: false,
          data: convectionData,
          error: null,
          lastUpdate: new Date().toISOString()
        }));

        // Créer ou mettre à jour le dossier de convection Meandair
        await updateConvectionFolder(convectionData);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: convectionData.error || 'Échec de la récupération des données de convection'
        }));
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de convection:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
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

        console.log("Création d'un nouveau dossier de convection");
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
        note: "Mise à jour des données de convection Meandair",
        putFolders: [convectionFolder],
        putFeatures: newFeatures,
        deleteFeatures: oldFeatures
      });

      console.log(`Dossier de convection mis à jour avec ${newFeatures.length} features`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du dossier de convection:', error);
    }
  }, [data, transact]);

  // Charger automatiquement les temps d'analyse disponibles au montage
  useEffect(() => {
    fetchAvailableAnalysisTimes();
  }, [fetchAvailableAnalysisTimes]);

  return {
    ...state,
    fetchConvectionData,
    fetchAvailableAnalysisTimes,
    refetch: fetchConvectionData // Maintenir la compatibilité
  };
}
