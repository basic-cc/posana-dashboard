'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Lead, CITY_META, STATUS_COLORS, STATUS_LABELS, STORE_TYPE_LABELS } from './types';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';

function getBaseSize(zoom: number): number {
  if (zoom <= 10) return 24;
  if (zoom <= 12) return 19;
  if (zoom <= 14) return 15;
  return 12;
}

function createColorIcon(color: string, selected: boolean, zoom: number) {
  const base = getBaseSize(zoom);
  const size = selected ? base + 7 : base;
  const shadow = selected
    ? `0 0 0 3px white, 0 0 0 5px ${color}, 0 3px 10px rgba(0,0,0,0.5)`
    : `0 0 0 2.5px white, 0 2px 8px rgba(0,0,0,0.4)`;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:${shadow};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapController({ city }: { city: string }) {
  const map = useMap();
  const prevCity = useRef(city);

  useEffect(() => {
    if (city === prevCity.current) return;
    prevCity.current = city;
    const meta = CITY_META[city];
    if (meta?.lat !== null && meta?.lng !== null && meta !== undefined) {
      map.flyTo([meta.lat as number, meta.lng as number], 12, { duration: 1 });
    }
  }, [city, map]);

  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    const handler = () => onZoomChange(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map, onZoomChange]);

  return null;
}

export interface FlyToTarget {
  lat: number;
  lng: number;
  ts: number;
}

function FlyToController({ target }: { target: FlyToTarget | null }) {
  const map = useMap();
  const lastTs = useRef<number | null>(null);

  useEffect(() => {
    if (!target || target.ts === lastTs.current) return;
    lastTs.current = target.ts;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 1 });
  }, [target, map]);

  return null;
}

const LIGHT_TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
const DARK_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

interface Props {
  leads: Lead[];
  selectedLeadId?: string;
  city: string;
  onLeadSelect: (lead: Lead) => void;
  flyToTarget?: FlyToTarget | null;
}

export default function MapView({ leads, selectedLeadId, city, onLeadSelect, flyToTarget }: Props) {
  const [zoom, setZoom] = useState(12);
  const mappable = leads.filter((l) => l.lat !== null && l.lng !== null);
  const clusterKey = mappable.map((l) => l.id).join(',');
  const handleZoomChange = useCallback((z: number) => setZoom(z), []);
  const isDark = useIsDarkMode();
  const tiles = isDark ? DARK_TILES : LIGHT_TILES;

  return (
    <MapContainer
      center={[40.7128, -74.006]}
      zoom={12}
      className="h-full w-full z-0"
    >
      <TileLayer attribution={tiles.attribution} url={tiles.url} />
      <MapController city={city} />
      <ZoomTracker onZoomChange={handleZoomChange} />
      <FlyToController target={flyToTarget ?? null} />
      <MarkerClusterGroup key={clusterKey}>
        {mappable.map((lead) => (
          <Marker
            key={lead.id}
            position={[lead.lat!, lead.lng!]}
            icon={createColorIcon(STATUS_COLORS[lead.status], lead.id === selectedLeadId, zoom)}
            eventHandlers={{ click: () => onLeadSelect(lead) }}
            zIndexOffset={lead.id === selectedLeadId ? 1000 : 0}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{lead.store_name}</p>
                {lead.neighborhood && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{lead.neighborhood}</p>
                )}
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ background: STATUS_COLORS[lead.status] }}
                >
                  {STATUS_LABELS[lead.status]}
                </span>
                {lead.store_type && (
                  <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                    {STORE_TYPE_LABELS[lead.store_type]}
                  </p>
                )}
                {lead.profiles?.name && (
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{lead.profiles.name}</p>
                )}
                <button
                  onClick={() => onLeadSelect(lead)}
                  className="mt-2 text-xs text-teal-600 dark:text-teal-400 font-medium hover:underline"
                >
                  View details →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
