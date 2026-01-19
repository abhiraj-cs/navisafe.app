'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { BlackSpot } from '@/lib/data';
import { getSafetyBriefing } from '@/lib/actions';
import { haversineDistance } from '@/lib/utils';
import { TravelMode } from './navisafe-app';

const COLLISION_THRESHOLD = 500; 

type MapProps = {
  startLocation: string | { lat: number; lng: number };
  endLocation: string;
  blackSpots: BlackSpot[];
  travelMode: TravelMode;
  locateUser: boolean;
  startNavigation: boolean;
  onSafetyBriefing: (briefing: string | null) => void;
  onRouteDetails: (details: { distance: number, duration: number } | null) => void;
  onMapError: (message: string) => void;
  onLoading: (loading: boolean) => void;
  onMapClick: (latlng: { lat: number, lng: number }) => void;
};

const MapComponent = ({ 
  startLocation, 
  endLocation, 
  blackSpots,
  travelMode,
  locateUser,
  startNavigation,
  onSafetyBriefing, 
  onRouteDetails,
  onMapError,
  onLoading,
  onMapClick
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const routeLayer = useRef<L.Polyline | null>(null);
  const startMarker = useRef<L.Marker | null>(null);
  const endMarker = useRef<L.Marker | null>(null);
  const blackSpotsLayer = useRef<L.LayerGroup | null>(null);
  const userLocationMarker = useRef<L.Marker | null>(null);

  // Use a ref to hold the latest onMapClick callback to prevent stale closures
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  });

  // Initialize map
  useEffect(() => {
    if (leafletMap.current === null && mapRef.current) {
      leafletMap.current = L.map(mapRef.current, {
        center: [9.35, 76.6],
        zoom: 9,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(leafletMap.current);
      
      // Initialize black spots layer
      blackSpotsLayer.current = L.layerGroup().addTo(leafletMap.current);

      leafletMap.current.on('click', (e) => {
        // Always call the latest version of the callback
        onMapClickRef.current(e.latlng);
      });
    }
    
    // Cleanup on unmount
    const map = leafletMap.current;
    return () => {
      if (map) {
        map.remove();
        leafletMap.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle locating the user
  useEffect(() => {
    if (locateUser && leafletMap.current) {
      leafletMap.current.locate({ setView: true, maxZoom: 16 });

      const onLocationFound = (e: L.LocationEvent) => {
        if (userLocationMarker.current) {
          userLocationMarker.current.setLatLng(e.latlng);
        } else {
          userLocationMarker.current = L.marker(e.latlng).addTo(leafletMap.current!)
            .bindPopup("You are here").openPopup();
        }
      }

      const onLocationError = (e: L.ErrorEvent) => {
        onMapError("GPS location not found.");
      }

      leafletMap.current.on('locationfound', onLocationFound);
      leafletMap.current.on('locationerror', onLocationError);

      return () => {
        leafletMap.current?.off('locationfound', onLocationFound);
        leafletMap.current?.off('locationerror', onLocationError);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateUser]);

  // Handle starting navigation
  useEffect(() => {
    if (startNavigation && leafletMap.current && startMarker.current) {
      const startLatLng = startMarker.current.getLatLng();
      leafletMap.current.setView(startLatLng, 16, { animate: true });
    }
  }, [startNavigation]);

  // Update black spots
  useEffect(() => {
    if (!leafletMap.current || !blackSpotsLayer.current) return;
    
    blackSpotsLayer.current.clearLayers();
    
    blackSpots.forEach((spot) => {
      const color = spot.risk_level === 'High' ? '#ef4444' : '#f97316';
      L.circleMarker([spot.lat, spot.lng], {
        radius: 12,
        color: color,
        fillColor: color,
        fillOpacity: 0.6,
      })
      .bindPopup(`
        <div class="p-2">
          <h3 class="font-bold ${spot.risk_level === 'High' ? 'text-red-600' : 'text-orange-600'}">⚠️ ${spot.risk_level} Risk Zone</h3>
          <p class="text-sm">${spot.accident_history}</p>
        </div>
      `)
      .addTo(blackSpotsLayer.current!);
    });
  }, [blackSpots]);

  // Handle route search
  useEffect(() => {
    const fetchRoute = async () => {
      // Do not fetch a route if either location is missing
      if ((typeof startLocation === 'string' && !startLocation.trim()) || !endLocation.trim()) {
        onRouteDetails(null);
        if (routeLayer.current && leafletMap.current) leafletMap.current.removeLayer(routeLayer.current);
        if (startMarker.current && leafletMap.current) leafletMap.current.removeLayer(startMarker.current);
        if (endMarker.current && leafletMap.current) leafletMap.current.removeLayer(endMarker.current);
        return;
      }

      if (!leafletMap.current) return;
      
      onLoading(true);
      onSafetyBriefing(null);
      onRouteDetails(null);
      onMapError("");

      // Clear previous route layers
      if (routeLayer.current) leafletMap.current.removeLayer(routeLayer.current);
      if (startMarker.current) leafletMap.current.removeLayer(startMarker.current);
      if (endMarker.current) leafletMap.current.removeLayer(endMarker.current);
      
      try {
        const provider = new OpenStreetMapProvider();
        
        let startRes;
        if (typeof startLocation === 'string') {
          startRes = await provider.search({ query: startLocation });
        } else {
           startRes = [{ x: startLocation.lng, y: startLocation.lat, label: 'My Current Location' }];
        }
        
        const endRes = await provider.search({ query: endLocation });

        if (!startRes.length || !endRes.length) {
          throw new Error("One or both locations could not be found.");
        }

        const sCoords: [number, number] = [startRes[0].y, startRes[0].x];
        const eCoords: [number, number] = [endRes[0].y, endRes[0].x];
        
        // Use the correct OSRM profile based on travel mode
        const profile = travelMode === 'car' ? 'driving' : 'biking';

        // Fetch route from OSRM
        const url = `https://router.project-osrm.org/route/v1/${profile}/${sCoords[1]},${sCoords[0]};${eCoords[1]},${eCoords[0]}?geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();

        if (!json.routes || !json.routes.length) {
          throw new Error("No route could be found between the locations.");
        }
        
        const route = json.routes[0];
        const coordinates = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);

        // Pass details up to the parent component
        onRouteDetails({ distance: route.distance, duration: route.duration });
        
        // Add new route polyline
        routeLayer.current = L.polyline(coordinates, { color: '#3b82f6', weight: 6 }).addTo(leafletMap.current);
        
        // Add markers
        startMarker.current = L.marker(sCoords).addTo(leafletMap.current).bindPopup(startRes[0].label);
        endMarker.current = L.marker(eCoords).addTo(leafletMap.current).bindPopup(endRes[0].label);

        // Fit map to bounds
        const bounds = L.latLngBounds(coordinates);
        leafletMap.current.fitBounds(bounds, { padding: [50, 50] });

        // Collision Detection
        const detected = new Set<BlackSpot>();
        coordinates.forEach((point: [number, number], index: number) => {
           if (index % 10 !== 0) return; // Optimization
           blackSpots.forEach(spot => {
             const dist = haversineDistance({ lat: spot.lat, lon: spot.lng }, { lat: point[0], lon: point[1] });
             if (dist < COLLISION_THRESHOLD) detected.add(spot);
           });
        });

        // Get AI Safety Briefing
        const briefing = await getSafetyBriefing(Array.from(detected));
        onSafetyBriefing(briefing);

      } catch (e: any) {
        console.error("Routing error:", e);
        onMapError(e.message || "An unknown error occurred during routing.");
      } finally {
        onLoading(false);
      }
    };

    fetchRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocation, endLocation, travelMode]); // Removed blackspots dependency to avoid re-fetching on DB updates

  return <div ref={mapRef} className="h-full w-full z-0" />;
};

export default MapComponent;
