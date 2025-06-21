import { useEffect, useState, useCallback } from 'react';
import { useAtom } from 'jotai';
import { dataAtom } from 'state/jotai';
import { usePersistence } from 'app/lib/persistence/context';
import { newFeatureId } from 'app/lib/id';
import { IFolder, IWrappedFeature } from 'types';
import { generateNKeysBetween } from 'fractional-indexing';

// interface of the data 
interface ConvectionData {
  success: boolean;
  data?: any;
  analysisTime?: string;
  timestamp?: string;
  error?: string;
}

// interface of the state of data we received
interface ConvectionState {
  loading: boolean;
  data: ConvectionData | null;
  error: string | null;
  lastUpdate: string | null;
  availableAnalysisTimes: string[];
  loadingAnalysisTimes: boolean;
  availableValidityTimes: string[];
  selectedValidityTime: string | null;
  loadingValidityTimes: boolean;
}

// Ajouter cette fonction ici
function formatDateForDisplay(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Erreur de formatage de date:', error);
    return dateString;
  }
}

// authentification who i to delete soon
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
      console.log("Authentification réussie pour les convections Meteo France")
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

// post the connexion
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

// get the available analysis time
async function getAvailableAnalysisTimes(): Promise<string[]> {
  console.log("Récupération des temps d'analyse disponibles...");
  
  const meteoFranceTimes = await apiRequest("/v1/convections/analysis_time?source=meteofrance");
  console.log("Temps MeteofranceTimes reçus:", meteoFranceTimes);
  
  if (meteoFranceTimes && typeof meteoFranceTimes === 'object' && 'analysis_times' in meteoFranceTimes) {
    return meteoFranceTimes.analysis_times || [];
  }
  
  return [];
}

// get the data 
async function getMeteoFranceConvectionData(selectedAnalysisTime?: string): Promise<ConvectionData> {
  console.log("Récupération des données de convection MeteoFrance...");
  
  let analysisTime = selectedAnalysisTime;
  
  // Si aucun temps n'est spécifié, récupérer les temps disponibles
  if (!analysisTime) {
    const availableTimes = await getAvailableAnalysisTimes();
    if (availableTimes.length > 0) {
      analysisTime = availableTimes[0];
    } else {
      // Utiliser le temps actuel si aucun temps d'analyse n'est disponible
      analysisTime = new Date().toISOString().slice(0, 13) + ':00:00Z';
      console.log(`Utilisation du temps actuel pour MeteoFrance: ${analysisTime}`);
    }
  }
  
  // Récupérer les données de convection
  const meteofranceData = await apiRequest(`/v1/convections/?source=meteofrance&format=geojson&analysis_time=${analysisTime}`);
  
  if (meteofranceData) {
    console.log("Données de convection Meteo France récupérées avec succès");
    return {
      success: true,
      data: meteofranceData,
      analysisTime,
      timestamp: new Date().toISOString()
    };
  } else {
    console.error("Erreur lors de la récupération des données de convection MeteoFrance");
    return {
      success: false,
      error: "Échec de la récupération des données de convection MeteoFrance"
    };
  }
}

// extract validity time
function extractValidityTimes(convectionData: ConvectionData): string[] {
  if (!convectionData.data?.features) return [];

  const validityTimes = new Set<string>();

  convectionData.data.features.forEach((feature: any) => {
    if (feature.properties?.validity_start_time) {
      validityTimes.add(feature.properties.validity_start_time);
    }
  });

  return Array.from(validityTimes).sort();
}

// filter it
function filterPolygonsByValidityTime(
  convectionData: ConvectionData,
  selectedTime: string | null
): ConvectionData {
  if (!selectedTime || !convectionData.data?.features) {
    return convectionData;
  }

  const filteredFeatures = convectionData.data.features.filter(
    (feature: any) => feature.properties?.validity_start_time === selectedTime
  );

  return {
    ...convectionData,
    data: {
      ...convectionData.data,
      features: filteredFeatures,
    },
  };
}

// final usage of all request 
export function useConvectionMeteoFrance() {
  const [state, setState] = useState<ConvectionState>({
    loading: false,
    data: null,
    error: null,
    lastUpdate: null,
    availableAnalysisTimes: [],
    loadingAnalysisTimes: false,
    availableValidityTimes: [],
    selectedValidityTime: null,
    loadingValidityTimes: false,
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
  const fetchConvectionData = useCallback(
    async (selectedAnalysisTime?: string, shouldDisplay: boolean = true) => {
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
              error: "Échec de l'authentification avec l'API Guidor",
            }));
            return;
          }
        }

        // Récupérer les données de convection MeteoFrance
        const convectionData = await getMeteoFranceConvectionData(
          selectedAnalysisTime
        );

        if (convectionData.success && convectionData.data) {
          // Extraire les temps de validité disponibles
          const validityTimes = extractValidityTimes(convectionData);
          const currentSelectedValidityTime = state.selectedValidityTime || validityTimes[0] || null;

          setState(prev => ({
            ...prev,
            loading: false,
            data: convectionData,
            error: null,
            lastUpdate: new Date().toISOString(),
            availableValidityTimes: validityTimes,
            selectedValidityTime: currentSelectedValidityTime
          }));

          // Créer le dossier seulement si shouldDisplay est true
          if (shouldDisplay) {
            const filteredData = filterPolygonsByValidityTime(
              convectionData, 
              currentSelectedValidityTime
            );
            
            // Passer les paramètres sélectionnés pour le nom du dossier
            await updateConvectionFolder(
              filteredData, 
              selectedAnalysisTime || convectionData.analysisTime || 'Unknown', 
              currentSelectedValidityTime
            );
          }
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error:
              convectionData.error ||
              "Échec de la récupération des données de convection",
          }));
        }
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des données de convection:",
          error
        );
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        }));
      }
    },
    [state.selectedValidityTime]
  );

  const updateConvectionFolder = useCallback(
    async (
      convectionData: ConvectionData, 
      selectedAnalysisTime: string, 
      selectedValidityTime: string | null
    ) => {
      try {
        // Gérer le cas où selectedAnalysisTime peut être undefined
        const analysisTimeToUse = selectedAnalysisTime || convectionData.analysisTime || 'Unknown';
        const formattedAnalysisTime = formatDateForDisplay(analysisTimeToUse);
        const formattedValidityTime = selectedValidityTime 
          ? formatDateForDisplay(selectedValidityTime)
          : 'Non spécifié';
        
        // Créer le nom du dossier avec les valeurs sélectionnées par l'utilisateur
        const folderName = `Convection MeteoFrance - Analyse: ${formattedAnalysisTime} - Début: ${formattedValidityTime}`;
        
        // Créer un nouveau dossier à chaque fois
        const folderId = newFeatureId();
        const folderAt = generateNKeysBetween(null, null, 1)[0];

        const convectionFolder: IFolder = {
          id: folderId,
          name: folderName,
          at: folderAt,
          expanded: true,
          locked: false,
          visibility: true,
          folderId: null,
        };

        console.log(`Création d'un nouveau dossier de convection: ${folderName}`);

        // Créer les nouvelles features à partir des données GeoJSON filtrées
        const newFeatures: IWrappedFeature[] = [];
        if (convectionData.data && convectionData.data.features) {
          const ats = generateNKeysBetween(
            null,
            null,
            convectionData.data.features.length
          );

          convectionData.data.features.forEach(
            (feature: any, index: number) => {
              // Ajouter des propriétés supplémentaires à la feature
              const enhancedFeature = {
                ...feature,
                properties: {
                  ...feature.properties,
                  source: "meteofrance",
                  analysisTime: analysisTimeToUse, // Utiliser la valeur sûre
                  selectedValidityTime: selectedValidityTime,
                  retrievedAt: convectionData.timestamp,
                  type: "convection",
                  folderName: folderName,
                },
              };

              newFeatures.push({
                id: newFeatureId(),
                at: ats[index],
                folderId: convectionFolder.id,
                feature: enhancedFeature
              });
            }
          );
        }

        // Effectuer la transaction pour mettre à jour les données
        await transact({
          note: "Mise à jour des données de convection MeteoFrance",
          putFolders: [convectionFolder],
          putFeatures: newFeatures,
          deleteFeatures: []
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
    refetch: fetchConvectionData // Maintenir la compatibilitéaa
  };
}
