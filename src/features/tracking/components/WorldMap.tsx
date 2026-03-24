import { useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useTranslation } from 'react-i18next';
import { trackingLocations } from '../../../data/tracking-locations';
import MapMarker from './MapMarker';
import MapTooltip from './MapTooltip';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const WorldMap: React.FC = () => {
  const { t } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMarkerEnter = useCallback((index: number, e: React.MouseEvent<SVGGElement>) => {
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
    if (rect) {
      const clientRect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        x: clientRect.left - rect.left + clientRect.width / 2,
        y: clientRect.top - rect.top,
      });
    }
    setHoveredIndex(index);
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  return (
    <div className="relative bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl p-4 md:p-6 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 3500,
          center: [25.5, 42.7],
        }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1F1F1F"
                stroke="#0A0A0A"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { fill: '#333333', outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>
        {trackingLocations.map((location, index) => (
          <Marker key={location.city} coordinates={location.coordinates}>
            <MapMarker
              coordinates={location.coordinates}
              color={location.color}
              index={index}
              onMouseEnter={(e) => handleMarkerEnter(index, e)}
              onMouseLeave={handleMarkerLeave}
            />
          </Marker>
        ))}
      </ComposableMap>

      {hoveredIndex !== null && (
        <MapTooltip
          location={trackingLocations[hoveredIndex]}
          position={tooltipPos}
          t={t}
        />
      )}
    </div>
  );
};

export default WorldMap;
