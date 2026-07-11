"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { RegionRiskSummary, CatchmentRiskSummary } from "@/lib/live-risk";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/risk-level";

interface Props {
  regions: RegionRiskSummary[];
  catchments: CatchmentRiskSummary[];
}

// Tailwind token → concrete hex (Leaflet Marker needs an icon; we render a colored dot
// divIcon so the map mirrors the dashboard's token-based palette).
const LEVEL_COLORS: Record<RiskLevel, string> = {
  warning: "#c53030",
  watch: "#9b3a2b",
  clear: "#3b7d4f",
  unknown: "#8a827d",
};

function dotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "storm-alert-map-dot",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(20,17,16,0.15)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const GHANA_CENTER: [number, number] = [7.95, -1.02];

export default function CoverageMap({ regions, catchments }: Props) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-xl border border-border">
      <MapContainer
        center={GHANA_CENTER}
        zoom={6}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {regions.map((region) => (
          <Marker
            key={region.code}
            position={[region.lat, region.lon]}
            icon={dotIcon(LEVEL_COLORS[region.level])}
          >
            <Popup>
              <strong>{region.name}</strong>
              <br />
              {RISK_LEVEL_LABELS[region.level]}
            </Popup>
          </Marker>
        ))}

        {catchments.map((catchment) => (
          <Circle
            key={catchment.code}
            center={[catchment.lat, catchment.lon]}
            radius={catchment.radiusKm * 1000}
            pathOptions={{
              color: LEVEL_COLORS[catchment.level],
              fillColor: LEVEL_COLORS[catchment.level],
              fillOpacity: 0.15,
            }}
          >
            <Popup>
              <strong>{catchment.displayName}</strong>
              <br />
              {RISK_LEVEL_LABELS[catchment.level]}
            </Popup>
          </Circle>
        ))}
      </MapContainer>
    </div>
  );
}
