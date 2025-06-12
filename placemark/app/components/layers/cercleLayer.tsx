import { Layer, Source } from "react-map-gl";

const redCircleGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [2.3522, 48.8566], 
      },
      properties: {},
    },
  ],
};

export function RedCircleLayer() {
  return (
    <>
      <Source id="red-circle" type="geojson" data={redCircleGeoJSON}>
        <Layer
          id="red-circle-layer"
          type="circle"
          paint={{
            "circle-radius": 12,
            "circle-color": "#ff0000",
            "circle-opacity": 0.7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          }}
        />
      </Source>
    </>
  );
}