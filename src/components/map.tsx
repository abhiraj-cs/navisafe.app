'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  onDeleteSpot: (spotId: string) => void;
};

const primaryRouteStyle = { color: '#3b82f6', weight: 7, opacity: 0.9 };
const alternativeRouteStyle = { color: '#9ca3af', weight: 5, opacity: 0.7 };

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
  onMapClick,
  onDeleteSpot
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const routeLayers = useRef<L.LayerGroup | null>(null);
  const startMarker = useRef<L.Marker | null>(null);
  const endMarker = useRef<L.Marker | null>(null);
  const blackSpotsLayer = useRef<L.LayerGroup | null>(null);
  const userLocationMarker = useRef<L.Marker | null>(null);

  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  });

  const onDeleteSpotRef = useRef(onDeleteSpot);
  useEffect(() => {
    onDeleteSpotRef.current = onDeleteSpot;
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
      
      routeLayers.current = L.layerGroup().addTo(leafletMap.current);
      blackSpotsLayer.current = L.layerGroup().addTo(leafletMap.current);

       const handleZoomEnd = () => {
        if (!leafletMap.current || !blackSpotsLayer.current) return;
        const map = leafletMap.current;
        const layer = blackSpotsLayer.current;

        if (map.getZoom() >= 12) {
          if (!map.hasLayer(layer)) map.addLayer(layer);
        } else {
          if (map.hasLayer(layer)) map.removeLayer(layer);
        }
      }

      leafletMap.current.on('click', (e) => {
        onMapClickRef.current(e.latlng);
      });
      
      leafletMap.current.on('zoomend', handleZoomEnd);

      leafletMap.current.on('popupopen', (e) => {
        const popupNode = e.popup.getElement();
        if (!popupNode) return;

        const deleteButton = popupNode.querySelector('.delete-spot-button') as HTMLButtonElement;
        if (deleteButton) {
          L.DomEvent.on(deleteButton, 'click', L.DomEvent.stop);
          const spotId = deleteButton.dataset.spotId;
          if (spotId) {
            deleteButton.onclick = () => {
              onDeleteSpotRef.current(spotId);
              leafletMap.current?.closePopup();
            };
          }
        }
      });
      
      // Initial check
      handleZoomEnd();
    }
    
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
      const radius = 8 + Math.min(spot.report_count, 10);
      L.circleMarker([spot.lat, spot.lng], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.6,
      })
      .bindPopup(`
        <div class="p-2 text-sm max-w-xs">
          <h3 class="font-bold mb-1 ${spot.risk_level === 'High' ? 'text-red-600' : 'text-orange-600'}">⚠️ ${spot.risk_level} Risk Zone</h3>
          <p class="mb-2">${spot.accident_history}</p>
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-2 border-t border-slate-200 dark:border-slate-700 pt-2">Reported by <strong>${spot.report_count}</strong> user(s).</div>
          <button data-spot-id="${spot.id}" class="delete-spot-button w-full text-xs text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded-md transition-colors">Remove Spot</button>
        </div>
      `)
      .addTo(blackSpotsLayer.current!);
    });
  }, [blackSpots]);

  // Fetch and score routes based on start/end locations
  useEffect(() => {
    const fetchRoutes = async () => {
      setRoutes([]);
      setSelectedRouteIndex(0);
      onRouteDetails(null);
      onSafetyBriefing(null);
      
      if ((typeof startLocation === 'string' && !startLocation.trim()) || !endLocation.trim()) {
        if (routeLayers.current) routeLayers.current.clearLayers();
        if (startMarker.current && leafletMap.current) leafletMap.current.removeLayer(startMarker.current);
        if (endMarker.current && leafletMap.current) leafletMap.current.removeLayer(endMarker.current);
        return;
      }

      if (!leafletMap.current) return;
      
      onLoading(true);
      onMapError("");

      if (routeLayers.current) routeLayers.current.clearLayers();
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
        
        startMarker.current = L.marker(sCoords).addTo(leafletMap.current).bindPopup(startRes[0].label);
        endMarker.current = L.marker(eCoords).addTo(leafletMap.current).bindPopup(endRes[0].label);

        const profile = travelMode === 'car' ? 'driving' : 'biking';

        const url = `https://router.project-osrm.org/route/v1/${profile}/${sCoords[1]},${sCoords[0]};${eCoords[1]},${eCoords[0]}?geometries=geojson&alternatives=true&overview=full`;
        const res = await fetch(url);
        const json = await res.json();

        if (!json.routes || !json.routes.length) {
          throw new Error("No route could be found between the locations.");
        }
        
        const routesWithScores = json.routes.map((route: any) => {
          const coordinates = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          let riskScore = 0;
          const detectedSpots = new Set<string>();

          coordinates.forEach((point: [number, number]) => {
            (blackSpots || []).forEach(spot => {
              if (detectedSpots.has(spot.id)) return;

              const dist = haversineDistance({ lat: spot.lat, lon: spot.lng }, { lat: point[0], lon: point[1] });
              if (dist < COLLISION_THRESHOLD) {
                riskScore += (spot.risk_level === 'High' ? 10 : 5);
                detectedSpots.add(spot.id);
              }
            });
          });
          return { ...route, riskScore };
        });

        const sortedRoutes = routesWithScores.sort((a: any, b: any) => {
          if (a.riskScore !== b.riskScore) {
            return a.riskScore - b.riskScore;
          }
          return a.duration - b.duration;
        });

        setRoutes(sortedRoutes);
        setSelectedRouteIndex(0);

      } catch (e: any) {
        console.error("Routing error:", e);
        setRoutes([]);
        onMapError(e.message || "An unknown error occurred during routing.");
      } finally {
        onLoading(false);
      }
    };

    fetchRoutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocation, endLocation, travelMode, blackSpots]);

  // Draw/update routes when they or selection changes
  useEffect(() => {
    if (!leafletMap.current || !routeLayers.current) return;

    routeLayers.current.clearLayers();

    if (routes.length === 0) {
      onRouteDetails(null);
      return;
    }

    // Draw alternative routes first (grey)
    routes.forEach((route, index) => {
      if (index === selectedRouteIndex) return;
      const coordinates = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
      const polyline = L.polyline(coordinates, alternativeRouteStyle).addTo(routeLayers.current!);
      polyline.on('click', () => {
        setSelectedRouteIndex(index);
      });
    });

    // Draw primary route last (blue, on top)
    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute) return;

    const coordinates = selectedRoute.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
    const primaryPolyline = L.polyline(coordinates, primaryRouteStyle).addTo(routeLayers.current!);
    
    const bounds = L.latLngBounds(coordinates);
    leafletMap.current.fitBounds(bounds, { padding: [50, 50] });

    onRouteDetails({ distance: selectedRoute.distance, duration: selectedRoute.duration });
    
    const runSafetyAnalysis = async () => {
      onSafetyBriefing(null); // Clear previous briefing
      onLoading(true);
      try {
        const detected = new Set<BlackSpot>();
        coordinates.forEach((point: [number, number]) => {
           blackSpots.forEach(spot => {
             const dist = haversineDistance({ lat: spot.lat, lon: spot.lng }, { lat: point[0], lon: point[1] });
             if (dist < COLLISION_THRESHOLD) {
               detected.add(spot);
             }
           });
        });

        const briefing = await getSafetyBriefing(Array.from(detected));
        onSafetyBriefing(briefing);
      } catch (e) {
        console.error("Safety briefing error:", e);
        onSafetyBriefing('Could not retrieve safety briefing.');
      } finally {
        onLoading(false);
      }
    };

    runSafetyAnalysis();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selectedRouteIndex]);


  return <div ref={mapRef} className="h-full w-full z-0" />;
};

export default MapComponent;
