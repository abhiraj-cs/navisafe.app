"use client";

import React, { useEffect, useState, memo, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-geosearch/dist/geosearch.css';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import { blackSpots, type BlackSpot } from '@/lib/data';
import { getSafetyBriefing } from '@/lib/actions';
import { haversineDistance } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

const COLLISION_THRESHOLD = 50; // meters

type MapProps = {
  startLocation: string;
  endLocation: string;
  onSafetyBriefing: (briefing: string | null) => void;
  onMapError: (message: string) => void;
  onLoading: (loading: boolean) => void;
};

const ChangeView = ({ bounds }: { bounds: LatLngBoundsExpression | null }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
};

function MapComponent({ startLocation, endLocation, onSafetyBriefing, onMapError, onLoading }: MapProps) {
  const [route, setRoute] = useState<LatLngExpression[] | null>(null);
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const geoProviderRef = useRef<OpenStreetMapProvider | null>(null);
  
  if (!geoProviderRef.current) {
    geoProviderRef.current = new OpenStreetMapProvider();
  }

  useEffect(() => {
    // This effect ensures we only try to render the map on the client
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    onSafetyBriefing(null);

    const geocodeAndFetch = async () => {
        if (!startLocation || !endLocation || !geoProviderRef.current) return;
        
        onLoading(true);
        setRoute(null); // Clear previous route

        try {
            const startResults = await geoProviderRef.current.search({ query: startLocation });
            const endResults = await geoProviderRef.current.search({ query: endLocation });

            if (startResults.length === 0 || endResults.length === 0) {
                throw new Error('Could not find one or both locations. Please try again with more specific addresses.');
            }
            
            const newStartCoords: [number, number] = [startResults[0].y, startResults[0].x];
            const newEndCoords: [number, number] = [endResults[0].y, endResults[0].x];
            
            setStartCoords(newStartCoords);
            setEndCoords(newEndCoords);

            // Fetch route
            const osrmStart = `${newStartCoords[1]},${newStartCoords[0]}`;
            const osrmEnd = `${newEndCoords[1]},${newEndCoords[0]}`;
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmStart};${osrmEnd}?geometries=geojson`);

            if (!response.ok) throw new Error('Failed to fetch route from OSRM');
            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                throw new Error('No route found between the specified locations.');
            }

            const routeGeometry = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            setRoute(routeGeometry);
            setBounds(L.latLngBounds(routeGeometry));

            // Collision detection
            const routePoints = routeGeometry.map((p: [number, number]) => ({ lat: p[0], lon: p[1] }));
            const collidingSpots = new Set<BlackSpot>();

            for (const spot of blackSpots) {
                for (const point of routePoints) {
                if (haversineDistance({ lat: spot.lat, lon: spot.lng }, point) <= COLLISION_THRESHOLD) {
                    collidingSpots.add(spot);
                    break; 
                }
                }
            }

            const briefing = await getSafetyBriefing(Array.from(collidingSpots));
            onSafetyBriefing(briefing);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            console.error(err);
            onMapError(`Failed to calculate the route. ${errorMessage}`);
            // If route fails, just show markers if they exist
            const newBounds = [startCoords, endCoords].filter(Boolean) as LatLngExpression[];
            if (newBounds.length > 0) {
              setBounds(L.latLngBounds(newBounds));
            }
        } finally {
            onLoading(false);
        }
    };
    
    if (startLocation && endLocation) {
        geocodeAndFetch();
    } else {
        // Default view for Alappuzha and Pathanamthitta
        setBounds(L.latLngBounds([9.0, 76.2], [9.7, 77.0]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocation, endLocation]);
  
  const startMarker = startCoords ? (startCoords as LatLngExpression) : null;
  const endMarker = endCoords ? (endCoords as LatLngExpression) : null;

  return (
    <div className="h-full w-full z-0">
      {!isMapReady ? (
        <div className="h-full w-full bg-muted flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <MapContainer
            center={[9.35, 76.6]} // Center between Alappuzha and Pathanamthitta
            zoom={9}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {blackSpots.map(spot => (
            <CircleMarker
                key={spot.id}
                center={[spot.lat, spot.lng]}
                radius={8}
                pathOptions={{
                color: spot.risk_level === 'High' ? 'hsl(var(--destructive))' : 'hsl(28 80% 52% / 0.8)',
                fillColor: spot.risk_level === 'High' ? 'hsl(var(--destructive))' : 'hsl(28 80% 52% / 0.8)',
                fillOpacity: 0.7,
                }}
            >
                <Popup>
                <b>Risk Level: {spot.risk_level}</b>
                <br />
                {spot.accident_history}
                </Popup>
            </CircleMarker>
            ))}

            {route && <Polyline pathOptions={{ color: 'hsl(var(--primary))', weight: 6 }} positions={route} />}

            {startMarker && <Marker position={startMarker}><Popup>Start</Popup></Marker>}
            {endMarker && <Marker position={endMarker}><Popup>End</Popup></Marker>}

            <ChangeView bounds={bounds} />
        </MapContainer>
      )}
    </div>
  );
}

export default MapComponent;
