import React from 'react';
import { useConvectionMeandair } from 'app/hooks/use_convection_meandair';

export function ConvectionStatus() {
  const { loading, data, error, lastUpdate, refetch } = useConvectionMeandair();

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Jamais';
    return new Date(isoString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">
          Convection Meandair
        </h3>
        <button
          onClick={refetch}
          disabled={loading}
          className={`text-xs px-2 py-1 rounded ${
            loading 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          }`}
        >
          {loading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

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
          <span className="font-medium">
            {formatTime(lastUpdate)}
          </span>
        </div>

        {data?.analysisTime && (
          <div className="flex justify-between">
            <span>Analyse:</span>
            <span className="font-medium">
              {formatTime(data.analysisTime)}
            </span>
          </div>
        )}

        {data?.data?.features && (
          <div className="flex justify-between">
            <span>Cellules:</span>
            <span className="font-medium text-blue-600">
              {data.data.features.length}
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