import React, { useState } from 'react';
import { useConvectionMeteoFrance } from 'app/hooks/hooks weather/use_convection_meteofrance';

export function ConvectionStatusMeteoFrance() {
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
    createConvectionFolder,
    loadingValidityTimes
  } = useConvectionMeteoFrance();

  const [selectedAnalysisTime, setSelectedAnalysisTime] = useState<string>('');
  // NEW ADDED: State to know if a folder has been created
  const [folderCreated, setFolderCreated] = useState<boolean>(false);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    try {
      // Option 1: Forcer UTC avec timeZone
      return new Date(isoString).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC' // 🎯 FORCÉ EN UTC
      });
    } catch (error) {
      console.error('Erreur formatage date:', error);
      return isoString;
    }
  };
  // MODIFIED: Get validity times AND reactivate filter
  const handleFetchValidityTimes = () => {
    if (selectedAnalysisTime) {
      fetchConvectionData(selectedAnalysisTime);
    } else {
      fetchConvectionData(undefined);
    }
    // NEW ADDED: Reactivate filter after data retrieval
    setFolderCreated(false);
  };

  // MODIFIED: Create folder AND disable filter
  const handleCreateFolder = async () => {
    try {
      await createConvectionFolder();
      // NEW ADDED: Disable filter after folder creation
      setFolderCreated(true);
    } catch (error) {
      console.error('Error while creating folder:', error);
      // In case of error, don't disable the filter
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* Title without buttons */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Convection MeteoFrance</h3>
      </div>

      {/* Analysis time filter */}
      <div className="mb-3 p-2 bg-gray-50 rounded border">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Analysis time:
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
                ? "Loading..."
                : availableAnalysisTimes.length === 0
                ? "No time available - Click refresh"
                : "Latest available time"}
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
            title="Refresh available times"
          >
            {loadingAnalysisTimes ? '⟳' : '🔄'}
          </button>
        </div>
      </div>

      {/* Get times button */}
      <div className="mb-3">
        <button
          onClick={handleFetchValidityTimes}
          disabled={loading}
          className={`w-full text-xs px-2 py-1 rounded ${
            loading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          }`}
        >
          {loading ? 'Getting times...' : 'Get times'}
        </button>
      </div>

      {/* MODIFIED: Validity time filter - disabled after folder creation */}
      <div className="mb-3 p-2 bg-green-50 rounded border">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Validity time (filtering):
        </label>
        <select
          value={selectedValidityTime || ''}
          onChange={(e) => setSelectedValidityTime(e.target.value || null)}
          disabled={availableValidityTimes.length === 0 || folderCreated} // NEW ADDED: folderCreated
          className={`w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white ${
            availableValidityTimes.length === 0 || folderCreated // NEW ADDED: folderCreated
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-black'
          }`}
        >
          <option value="">
            {availableValidityTimes.length === 0
              ? "No time available - Get times first"
              : folderCreated // NEW ADDED: Special message after creation
              ? "Folder created - Get new data to filter"
              : "All polygons"}
          </option>
          {availableValidityTimes.map((time) => (
            <option key={time} value={time}>
              {formatTime(time)}
            </option>
          ))}
        </select>
      </div>

      {/* Create folder button */}
      <div className="mb-3">
        <button
          onClick={handleCreateFolder}
          disabled={loading || !data || availableValidityTimes.length === 0}
          className={`w-full text-xs px-2 py-1 rounded ${
            loading || !data || availableValidityTimes.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-100 text-green-600 hover:bg-green-200'
          }`}
        >
          {loading ? 'Creating folder...' : 'Create folder'}
        </button>
      </div>

      {/* Status information */}
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={`font-medium ${
            error ? 'text-red-600' :
            data?.success ? 'text-green-600' : 'text-gray-500'
          }`}>
            {error ? 'Error' :
             data?.success ? 'Active' : 'Pending'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Last update:</span>
          <span className="font-medium">{formatTime(lastUpdate)}</span>
        </div>

        {data?.analysisTime && (
          <div className="flex justify-between">
            <span>Analysis:</span>
            <span className="font-medium">{formatTime(data.analysisTime)}</span>
          </div>
        )}

        {availableAnalysisTimes.length > 0 && (
          <div className="flex justify-between">
            <span>Available times:</span>
            <span className="font-medium text-blue-600">{availableAnalysisTimes.length}</span>
          </div>
        )}

        {availableValidityTimes.length > 0 && (
          <div className="flex justify-between">
            <span>Validity times:</span>
            <span className="font-medium text-green-600">{availableValidityTimes.length}</span>
          </div>
        )}

        {selectedValidityTime && !folderCreated && ( // MODIFIED: Hide if folder created
          <div className="flex justify-between">
            <span>Active filter:</span>
            <span className="font-medium text-green-600">{formatTime(selectedValidityTime)}</span>
          </div>
        )}
        {data?.data?.features && (
          <div className="flex justify-between">
            <span>Cells:</span>
            <span className="font-medium text-blue-600">
              {data.data.features.length}
              {selectedValidityTime && !folderCreated && ` (filtered)`} {/* MODIFIED */}
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