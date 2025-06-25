import { useEffect, useState, useCallback } from "react";
import { useAtom } from "jotai";
import { dataAtom } from "state/jotai";
import { usePersistence } from "app/lib/persistence/context";
import { newFeatureId } from "app/lib/id";
import { IFolder, IWrappedFeature } from "types";
import { generateNKeysBetween } from "fractional-indexing";

interface IcingData {
  success: boolean;
  data?: any;
  analysisTime?: string;
  timestamp?: string;
  error?: string;
}

interface IcingState {
  loading: boolean;
  data: IcingData | null;
  error: string | null;
  lastUpdate: string | null;
  availableAnalysisTimes: string[];
  loadingAnalysisTimes: boolean;
  availableValidityTimes: string[];
  selectedValidityTime: string | null;
  loadingValidityTimes: boolean;
}

// Fonction pour formater les dates
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
          device_id: "000-000",
          device_name: "Mac mini Dragonfly",
        },
      }),
    });

    if (response.ok) {
      const authData = await response.json();
      AUTH_TOKEN = authData.Authorization;
      REFRESH_TOKEN = authData.RefreshToken;
      console.log("Authentification réussie pour le givrage Météo-France");
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

async function apiRequest(
  endpoint: string,
  method: string = "GET"
): Promise<any> {
  if (!AUTH_TOKEN) {
    console.error("Token d'authentification manquant");
    return null;
  }

  try {
    const response = await fetch(`https://api.guidor.fr${endpoint}`, {
      method,
      headers: {
        Authorization: AUTH_TOKEN,
        "Content-Type": "application/json",
      },
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
  console.log("Récupération des temps d'analyse disponibles pour le givrage...");

  const meteofranceTimes = await apiRequest(
    "/v1/icing/analysis_time?source=meteofrance"
  );
  console.log("Temps Météo-France reçus:", meteofranceTimes);

  if (
    meteofranceTimes &&
    typeof meteofranceTimes === "object" &&
    "analysis_times" in meteofranceTimes
  ) {
    return meteofranceTimes.analysis_times || [];
  }

  return [];
}

async function getMeteofranceIcingData(
  selectedAnalysisTime?: string
): Promise<IcingData> {
  console.log("Récupération des données de givrage Météo-France...");

  let analysisTime = selectedAnalysisTime;

  // Si aucun temps n'est spécifié, récupérer les temps disponibles
  if (!analysisTime) {
    const availableTimes = await getAvailableAnalysisTimes();
    if (availableTimes.length > 0) {
      analysisTime = availableTimes[0];
    } else {
      // Utiliser le temps actuel si aucun temps d'analyse n'est disponible
      analysisTime = new Date().toISOString().slice(0, 13) + ":00:00Z";
      console.log(`Utilisation du temps actuel pour Météo-France: ${analysisTime}`);
    }
  }

  // Récupérer les données de givrage
  const meteofranceData = await apiRequest(
    `/v1/icing/?source=meteofrance&format=geojson&analysis_time=${analysisTime}`
  );

  if (meteofranceData) {
    console.log("Données de givrage Météo-France récupérées avec succès");
    return {
      success: true,
      data: meteofranceData,
      analysisTime,
      timestamp: new Date().toISOString(),
    };
  } else {
    console.error(
      "Erreur lors de la récupération des données de givrage Météo-France"
    );
    return {
      success: false,
      error: "Échec de la récupération des données de givrage Météo-France",
    };
  }
}

// Extraire les temps de validité
function extractValidityTimes(icingData: IcingData): string[] {
  if (!icingData.data?.features) return [];

  const validityTimes = new Set<string>();

  icingData.data.features.forEach((feature: any) => {
    if (feature.properties?.validity_start_time) {
      validityTimes.add(feature.properties.validity_start_time);
    }
  });

  return Array.from(validityTimes).sort();
}

// Filtrer par temps de validité
function filterPolygonsByValidityTime(
  icingData: IcingData,
  selectedTime: string | null
): IcingData {
  if (!selectedTime || !icingData.data?.features) {
    return icingData;
  }

  const filteredFeatures = icingData.data.features.filter(
    (feature: any) => feature.properties?.validity_start_time === selectedTime
  );

  return {
    ...icingData,
    data: {
      ...icingData.data,
      features: filteredFeatures,
    },
  };
}

// Hook principal
export function useIcingMeteofrance() {
  const [state, setState] = useState<IcingState>({
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
    setState((prev) => ({ ...prev, loadingAnalysisTimes: true, error: null }));

    try {
      // S'authentifier si nécessaire
      if (!AUTH_TOKEN) {
        const email = "sharik.abubucker@Skyconseil.fr";
        const password = "Sharik@Abu04";

        const loginSuccess = await login(email, password);
        if (!loginSuccess) {
          setState((prev) => ({
            ...prev,
            loadingAnalysisTimes: false,
            error: "Échec de l'authentification avec l'API Guidor",
          }));
          return;
        }
      }

      const analysisTimes = await getAvailableAnalysisTimes();

      setState((prev) => ({
        ...prev,
        loadingAnalysisTimes: false,
        availableAnalysisTimes: analysisTimes,
        error: null,
      }));
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des temps d'analyse:",
        error
      );
      setState((prev) => ({
        ...prev,
        loadingAnalysisTimes: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }));
    }
  }, []);

  // Fonction pour récupérer les données de givrage avec un temps d'analyse spécifique
  const fetchIcingData = useCallback(
    async (selectedAnalysisTime?: string, shouldDisplay: boolean = true) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        // S'authentifier si nécessaire
        if (!AUTH_TOKEN) {
          const email = "sharik.abubucker@Skyconseil.fr";
          const password = "Sharik@Abu04";

          const loginSuccess = await login(email, password);
          if (!loginSuccess) {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: "Échec de l'authentification avec l'API Guidor",
            }));
            return;
          }
        }

        // Récupérer les données de givrage Météo-France
        const icingData = await getMeteofranceIcingData(selectedAnalysisTime);

        if (icingData.success && icingData.data) {
          // Extraire les temps de validité disponibles
          const validityTimes = extractValidityTimes(icingData);
          const currentSelectedValidityTime = state.selectedValidityTime || validityTimes[0] || null;

          setState((prev) => ({
            ...prev,
            loading: false,
            data: icingData,
            error: null,
            lastUpdate: new Date().toISOString(),
            availableValidityTimes: validityTimes,
            selectedValidityTime: currentSelectedValidityTime
          }));

          // Créer le dossier seulement si shouldDisplay est true
          if (shouldDisplay) {
            const filteredData = filterPolygonsByValidityTime(
              icingData, 
              currentSelectedValidityTime
            );
            
            // Passer les paramètres sélectionnés pour le nom du dossier
            await updateIcingFolder(
              filteredData, 
              selectedAnalysisTime || icingData.analysisTime || 'Unknown', 
              currentSelectedValidityTime
            );
          }
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error:
              icingData.error ||
              "Échec de la récupération des données de givrage",
          }));
        }
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des données de givrage:",
          error
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        }));
      }
    },
    [state.selectedValidityTime]
  );

  const updateIcingFolder = useCallback(
    async (
      icingData: IcingData, 
      selectedAnalysisTime: string, 
      selectedValidityTime: string | null
    ) => {
      try {
        // Gérer le cas où selectedAnalysisTime peut être undefined
        const analysisTimeToUse = selectedAnalysisTime || icingData.analysisTime || 'Unknown';
        const formattedAnalysisTime = formatDateForDisplay(analysisTimeToUse);
        const formattedValidityTime = selectedValidityTime 
          ? formatDateForDisplay(selectedValidityTime)
          : 'Non spécifié';
        
        // Créer le nom du dossier avec les valeurs sélectionnées par l'utilisateur
        const folderName = `Givrage Météo-France - Analyse: ${formattedAnalysisTime} - Début: ${formattedValidityTime}`;
        
        // Créer un nouveau dossier à chaque fois
        const folderId = newFeatureId();
        const folderAt = generateNKeysBetween(null, null, 1)[0];

        const icingFolder: IFolder = {
          id: folderId,
          name: folderName,
          at: folderAt,
          expanded: true,
          locked: false,
          visibility: true,
          folderId: null,
        };

        console.log(`Création d'un nouveau dossier de givrage: ${folderName}`);

        // Créer les nouvelles features à partir des données GeoJSON filtrées
        const newFeatures: IWrappedFeature[] = [];
        if (icingData.data && icingData.data.features) {
          const ats = generateNKeysBetween(
            null,
            null,
            icingData.data.features.length
          );

          icingData.data.features.forEach(
            (feature: any, index: number) => {
              // Ajouter des propriétés supplémentaires à la feature
              const enhancedFeature = {
                ...feature,
                properties: {
                  ...feature.properties,
                  source: "meteofrance",
                  analysisTime: analysisTimeToUse,
                  selectedValidityTime: selectedValidityTime,
                  retrievedAt: icingData.timestamp,
                  type: "icing",
                  folderName: folderName,
                },
              };

              newFeatures.push({
                id: newFeatureId(),
                at: ats[index],
                folderId: icingFolder.id,
                feature: enhancedFeature,
              });
            }
          );
        }

        // Effectuer la transaction pour créer le nouveau dossier et ses features
        await transact({
          note: `Création des données de givrage Météo-France - ${folderName}`,
          putFolders: [icingFolder],
          putFeatures: newFeatures,
          deleteFeatures: [],
        });

        console.log(
          `Nouveau dossier de givrage créé avec ${newFeatures.length} features: ${folderName}`
        );
      } catch (error) {
        console.error(
          "Erreur lors de la création du dossier de givrage:",
          error
        );
      }
    },
    [transact]
  );

  const setSelectedValidityTime = useCallback(
    async (validityTime: string | null) => {
      setState((prev) => ({
        ...prev,
        selectedValidityTime: validityTime,
      }));

      // Recharger les données avec le nouveau filtre seulement si on a des données
      if (state.data) {
        const filteredData = filterPolygonsByValidityTime(
          state.data,
          validityTime
        );
        // Utiliser l'analysis time des données actuelles et le validity time sélectionné
        await updateIcingFolder(
          filteredData, 
          state.data.analysisTime || 'Unknown', 
          validityTime
        );
      }
    },
    [state.data, updateIcingFolder]
  );

  // Charger automatiquement les temps d'analyse disponibles au montage
  useEffect(() => {
    fetchAvailableAnalysisTimes();
  }, [fetchAvailableAnalysisTimes]);

  return {
    ...state,
    fetchIcingData,
    fetchAvailableAnalysisTimes,
    setSelectedValidityTime,
    refetch: fetchIcingData,
  };
}
