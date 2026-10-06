"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  latitude: number;
  longitude: number;
  heading?: number | null;
}

interface RunMapProps {
  points: MapPoint[];
  currentPosition?: MapPoint | null;
  interactive?: boolean;
  className?: string;
  zoom?: number;
  showKmMarkers?: boolean;
  splits?: Array<{ splitNumber: number; distance: number }>;
}

export default function RunMap({
  points,
  currentPosition,
  interactive = true,
  className = "w-full h-full min-h-[280px]",
  zoom = 15,
}: RunMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const finishMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (GBK Jakarta or first point)
    const initialLat = currentPosition?.latitude ?? points[0]?.latitude ?? -6.2088;
    const initialLng = currentPosition?.longitude ?? points[0]?.longitude ?? 106.8456;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    // Clean Dark / Sporty CartoDB or OpenStreetMap tiles
    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL ||
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Polyline and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);

    // 1. Polyline
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latLngs, {
        color: "#10b981", // High visibility athletic emerald
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(latLngs);
    }

    // 2. Start Marker
    if (points.length > 0 && !startMarkerRef.current) {
      const startIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div class="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-md text-white font-bold text-[10px]">
            S
          </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      startMarkerRef.current = L.marker([points[0].latitude, points[0].longitude], {
        icon: startIcon,
      }).addTo(map);
    }

    // 3. Current Active Position Marker (pulsing athletic dot)
    const activePoint = currentPosition || (points.length > 0 ? points[points.length - 1] : null);
    if (activePoint) {
      const currentIcon = L.divIcon({
        className: "bg-transparent border-0",
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="absolute w-8 h-8 rounded-full bg-emerald-400 opacity-40 animate-ping"></div>
            <div class="relative w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-lg"></div>
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!currentMarkerRef.current) {
        currentMarkerRef.current = L.marker([activePoint.latitude, activePoint.longitude], {
          icon: currentIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        currentMarkerRef.current.setLatLng([activePoint.latitude, activePoint.longitude]);
      }
    }

    // 4. Auto-center or fit bounds
    if (latLngs.length > 1 && !currentPosition) {
      // Historical review mode: fit full route
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (activePoint && currentPosition) {
      // Live tracking mode: smoothly pan to current position
      map.panTo([activePoint.latitude, activePoint.longitude], { animate: true });
    }
  }, [points, currentPosition]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
