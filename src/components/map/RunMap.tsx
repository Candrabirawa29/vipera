"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";

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
}

export default function RunMap({
  points,
  currentPosition,
  interactive = true,
  className = "w-full h-full min-h-[180px]",
  zoom = 16,
}: RunMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);

  const [isAutoFollowing, setIsAutoFollowing] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = currentPosition?.latitude ?? points[0]?.latitude ?? -6.2088;
    const initialLng = currentPosition?.longitude ?? points[0]?.longitude ?? 106.8456;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom,
      zoomControl: false, // clean minimal look, avoid giant default buttons
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    const tileUrl =
      process.env.NEXT_PUBLIC_MAP_TILE_URL ||
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    // If user manually drags/pans map, pause auto-following until they recenter
    if (interactive) {
      map.on("dragstart", () => {
        setIsAutoFollowing(false);
      });
    }

    mapInstanceRef.current = map;

    // Trigger invalidateSize to prevent partial tile rendering on mount
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Polyline and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);

    // 1. Polyline Real-Time Update
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latLngs, {
        color: "#10b981", // High-visibility athletic emerald
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(latLngs);
    }

    // 2. Start Marker (Placed at the very first point)
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
        zIndexOffset: 500,
      }).addTo(map);
    }

    // 3. Current Live Position Marker (Pulsating athletic dot)
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

      // Auto-follow panTo if active
      if (isAutoFollowing) {
        map.panTo([activePoint.latitude, activePoint.longitude], { animate: true });
      }
    }

    // Historical review mode (when not live tracking, fit all bounds)
    if (latLngs.length > 1 && !currentPosition) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [25, 25] });
    }
  }, [points, currentPosition, isAutoFollowing]);

  // Recenter Click Handler
  const handleRecenter = useCallback(() => {
    const map = mapInstanceRef.current;
    const activePoint = currentPosition || (points.length > 0 ? points[points.length - 1] : null);
    if (map && activePoint) {
      map.setView([activePoint.latitude, activePoint.longitude], zoom, { animate: true });
      setIsAutoFollowing(true);
    }
  }, [currentPosition, points, zoom]);

  return (
    <div
      style={{ isolation: "isolate" }}
      className={`relative overflow-hidden rounded-xl border border-border z-0 ${className}`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Recenter Button if user panned away */}
      {!isAutoFollowing && currentPosition && (
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/95 text-foreground border border-border text-xs font-mono font-medium shadow-md hover:bg-muted transition-all cursor-pointer backdrop-blur-sm active:scale-95"
          aria-label="Recenter Map"
        >
          <LocateFixed className="w-3.5 h-3.5 text-primary" />
          <span>Recenter</span>
        </button>
      )}
    </div>
  );
}
