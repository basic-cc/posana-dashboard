'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Lead, STATUS_COLORS, STATUS_LABELS, STORE_TYPE_LABELS } from './types';

function createColorIcon(color: string, selected: boolean) {
  const size = selected ? 18 : 13;
  const border = selected ? '3px solid white' : '2px solid white';
  const shadow = selected
    ? '0 0 0 2px ' + color + ', 0 2px 6px rgba(0,0,0,0.4)'
    : '0 1px 4px rgba(0,0,0,0.3)';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:${shadow};"></div>`,
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
    if (city === 'nyc') map.flyTo([40.7128, -74.006], 12, { duration: 1 });
    else if (city === 'sf') map.flyTo([37.7749, -122.4194], 12, { duration: 1 });
  }, [city, map]);

  return null;
}

interface Props {
  leads: Lead[];
  selectedLeadId?: string;
  city: string;
  onLeadSelect: (lead: Lead) => void;
}

export default function MapView({ leads, selectedLeadId, city, onLeadSelect }: Props) {
  const mappable = leads.filter((l) => l.lat !== null && l.lng !== null);

  return (
    <MapContainer
      center={[40.7128, -74.006]}
      zoom={12}
      className="h-full w-full z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController city={city} />
      <MarkerClusterGroup chunkedLoading>
        {mappable.map((lead) => (
          <Marker
            key={lead.id}
            position={[lead.lat!, lead.lng!]}
            icon={createColorIcon(STATUS_COLORS[lead.status], lead.id === selectedLeadId)}
            eventHandlers={{ click: () => onLeadSelect(lead) }}
            zIndexOffset={lead.id === selectedLeadId ? 1000 : 0}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <p className="font-semibold text-gray-900">{lead.store_name}</p>
                {lead.neighborhood && (
                  <p className="text-gray-500 text-xs">{lead.neighborhood}</p>
                )}
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ background: STATUS_COLORS[lead.status] }}
                >
                  {STATUS_LABELS[lead.status]}
                </span>
                {lead.store_type && (
                  <p className="text-gray-600 text-xs mt-1">
                    {STORE_TYPE_LABELS[lead.store_type]}
                  </p>
                )}
                {lead.profiles?.name && (
                  <p className="text-gray-500 text-xs mt-1">{lead.profiles.name}</p>
                )}
                <button
                  onClick={() => onLeadSelect(lead)}
                  className="mt-2 text-xs text-green-600 font-medium hover:underline"
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
