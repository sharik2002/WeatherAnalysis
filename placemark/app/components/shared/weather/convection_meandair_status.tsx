import React, { useState } from 'react';
import { useConvectionMeandair } from 'app/hooks/hooks weather/use_convection_meandair';

export function ConvectionStatusMeandair() {
  const { 
    loading, 
    loadingAnalysisTimes,
    availableAnalysisTimes,
    data, 
    error, 
    lastUpdate, 
    fetchConvectionData,
    fetchAvailableAnalysisTimes,
    availableValidityTimes,
    selectedValidityTime,
    setSelectedValidityTime,
    loadingValidityTimes
  } = useConvectionMeandair();

  const [selectedAnalysisTime, setSelectedAnalysisTime] = useState<string>('');
  const [showTimeSelector, setShowTimeSelector] = useState(false);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Jamais';
    return new Date(isoString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFetchData = () => {
    if (selectedAnalysisTime) {
      fetchConvectionData(selectedAnalysisTime);
      setShowTimeSelector(false);
    } else {
      fetchConvectionData();
    }
  };

  const handleShowSelector = () => {
    setShowTimeSelector(true);
    if (availableAnalysisTimes.length === 0) {
      fetchAvailableAnalysisTimes();
    }
  };

  // Nouvelle fonction pour récupérer les données sans les afficher
  const handleFetchDataOnly = () => {
    if (selectedAnalysisTime) {
      fetchConvectionData(selectedAnalysisTime, false); // false = ne pas afficher
    } else {
      fetchConvectionData(undefined, false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Convection Meandair</h3>
        <div className="flex gap-1">
          {!showTimeSelector ? (
            <>
              <button
                onClick={handleShowSelector}
                disabled={loading || loadingAnalysisTimes}
                className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-600 hover:bg-purple-200 disabled:bg-gray-100 disabled:text-gray-400"
              >
                Choisir
              </button>
              <button
                onClick={handleFetchDataOnly}
                disabled={loading}
                className={`text-xs px-2 py-1 rounded ${
                  loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                }`}
              >
                {loading ? 'Récupération...' : 'Récupérer'}
              </button>
              <button
                onClick={() => fetchConvectionData()}
                disabled={loading}
                className={`text-xs px-2 py-1 rounded ${
                  loading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              >
                {loading ? 'Actualisation...' : 'Actualiser'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowTimeSelector(false)}
              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Filtre temps d'analyse - toujours visible */}
      <div className="mb-3 p-2 bg-gray-50 rounded border">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Temps d'analyse:
        </label>
        <div className="flex items-center gap-2">
          <select
            value={selectedAnalysisTime}
            onChange={(e) => setSelectedAnalysisTime(e.target.value)}
            disabled={loadingAnalysisTimes}
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">
              {loadingAnalysisTimes 
                ? "Chargement..." 
                : availableAnalysisTimes.length === 0 
                  ? "Aucun temps disponible - Cliquer sur actualiser"
                  : "Dernier temps disponible"
              }
            </option>
            {availableAnalysisTimes.map((time) => (
              <option key={time} value={time}>
                {formatTime(time)}
              </option>
            ))}
          </select>
          <button
            onClick={fetchAvailableAnalysisTimes}
            disabled={loadingAnalysisTimes}
            className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50"
            title="Actualiser les temps disponibles"
          >
            {loadingAnalysisTimes ? '⟳' : '🔄'}
          </button>
        </div>
      </div>

      {/* Filtre temps de validité - toujours visible si des temps sont disponibles */}
      {availableValidityTimes.length > 0 && (
        <div className="mb-3 p-2 bg-green-50 rounded border">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Temps de validité (filtrage):
          </label>
          <select
            value={selectedValidityTime || ''}
            onChange={(e) => setSelectedValidityTime(e.target.value || null)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">Tous les polygones</option>
            {availableValidityTimes.map((time) => (
              <option key={time} value={time}>
                {formatTime(time)}
              </option>
            ))}
          </select>
        </div>
      )}

      {showTimeSelector && (
        <div className="mb-3 p-2 bg-blue-50 rounded border">
          <button
            onClick={handleFetchData}
            disabled={loading}
            className={`w-full text-xs px-2 py-1 rounded ${
              loading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-100 text-green-600 hover:bg-green-200'
            }`}
          >
            {loading ? 'Récupération...' : selectedAnalysisTime ? 'Récupérer et afficher les données' : 'Récupérer et afficher (dernier temps)'}
          </button>
        </div>
      )}

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Statut:</span>
          <span className={`font-medium ${
            error ? 'text-red-600' :
            data?.success ? 'text-green-600' : 'text-gray-500'
          }`}>
            {error ? 'Erreur' :
             data?.success ? 'Actif' : 'En attente'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Dernière MAJ:</span>
          <span className="font-medium">{formatTime(lastUpdate)}</span>
        </div>

        {data?.analysisTime && (
          <div className="flex justify-between">
            <span>Analyse:</span>
            <span className="font-medium">{formatTime(data.analysisTime)}</span>
          </div>
        )}

        {availableAnalysisTimes.length > 0 && (
          <div className="flex justify-between">
            <span>Temps disponibles:</span>
            <span className="font-medium text-blue-600">{availableAnalysisTimes.length}</span>
          </div>
        )}

        {selectedValidityTime && (
          <div className="flex justify-between">
            <span>Filtre actif:</span>
            <span className="font-medium text-green-600">{formatTime(selectedValidityTime)}</span>
          </div>
        )}

        {data?.data?.features && (
          <div className="flex justify-between">
            <span>Cellules:</span>
            <span className="font-medium text-blue-600">
              {data.data.features.length}
              {selectedValidityTime && ` (filtrées)`}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
