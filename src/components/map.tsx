"use client";

import { useEffect, useState, memo } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Popup, useMap } from 'react-leaflet';
import { blackSpots, type BlackSpot } from '@/lib/data';
import { getSafetyBriefing } from '@/lib/actions';
import { haversineDistance } from '@/lib/utils';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { Loader2 } from 'lucide-react';

const COLLISION_THRESHOLD = 50; // meters

type MapProps = {
  startCoords: [number, number] | null;
  endCoords: [number, number] | null;
  onSafetyBriefing: (briefing: string | null) => void;
  onMapError: (message: string) => void;
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

function MapComponent({ startCoords, endCoords, onSafetyBriefing, onMapError }: MapProps) {
  const [route, setRoute] = useState<LatLngExpression[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bounds, setBounds] = useState<LatLngBoundsExpression | null>(null);

  useEffect(() => {
    onSafetyBriefing(null);
    if (startCoords && endCoords) {
      const fetchRoute = async () => {
        setIsLoading(true);
        try {
          // OSRM expects lon, lat
          const osrmStart = `${startCoords[1]},${startCoords[0]}`;
          const osrmEnd = `${endCoords[1]},${endCoords[0]}`;
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${osrmStart};${osrmEnd}?geometries=geojson`);

          if (!response.ok) throw new Error('Failed to fetch route from OSRM');
          const data = await response.json();

          if (!data.routes || data.routes.length === 0) {
            throw new Error('No route found between the specified locations.');
          }

          // OSRM gives [lon, lat], Leaflet wants [lat, lon]
          const routeGeometry = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRoute(routeGeometry);
          setBounds(routeGeometry as LatLngBoundsExpression);

          // Collision detection
          const routePoints = routeGeometry.map((p: [number, number]) => ({ lat: p[0], lon: p[1] }));
          const collidingSpots = new Set<BlackSpot>();

          for (const spot of blackSpots) {
            for (const point of routePoints) {
              if (haversineDistance({ lat: spot.lat, lon: spot.lng }, point) <= COLLISION_THRESHOLD) {
                collidingSpots.add(spot);
                break; // Move to next spot
              }
            }
          }

          const briefing = await getSafetyBriefing(Array.from(collidingSpots));
          onSafetyBriefing(briefing);

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
          console.error(err);
          onMapError(`Failed to calculate the route. ${errorMessage}`);
          // If route fails, just show markers
          setBounds([startCoords, endCoords]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchRoute();
    } else {
        // Set default view if no coords
        setBounds([[51.505, -0.09], [51.515, -0.08]]);
    }
  }, [startCoords, endCoords, onSafetyBriefing, onMapError]);
  
  const startMarker = startCoords ? (startCoords as LatLngExpression) : null;
  const endMarker = endCoords ? (endCoords as LatLngExpression) : null;

  return (
    <>
    {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
          <div className="flex items-center gap-2 text-muted-foreground p-4 bg-background rounded-md shadow-lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing route safety...
          </div>
        </div>
      )}
      <MapContainer
        center={[51.505, -0.09]} // Default center, will be overridden by ChangeView
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
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
    </>
  );
}

export default memo(MapComponent);