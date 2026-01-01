"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Map as MapIcon, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { LatLngExpression } from 'leaflet';
import { useToast } from '@/hooks/use-toast';

const Map = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

type GeoCodedLocation = {
  lat: number;
  lon: number;
  display_name: string;
};

export default function NaviSafeApp() {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapId, setMapId] = useState(Date.now()); // Used to force remount of Map component
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const geocode = async (address: string): Promise<GeoCodedLocation | null> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
      if (!response.ok) throw new Error('Geocoding service failed');
      const data = await response.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name };
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startInput || !endInput) {
      setError('Please enter both a start and end location.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSafetyBriefing(null);

    const start = await geocode(startInput);
    const end = await geocode(endInput);

    if (!start || !end) {
      setError('Could not find one or both locations. Please try again with more specific addresses.');
      setIsLoading(false);
      return;
    }

    setStartCoords([start.lat, start.lon]);
    setEndCoords([end.lat, end.lon]);
    setMapId(Date.now()); // Change key to force remount
    setIsLoading(false); // Map component will handle its own loading
  };
  
  const isWarning = safetyBriefing && (safetyBriefing.includes("Caution") || safetyBriefing.includes("passes near"));

  return (
    <div className="relative h-screen w-screen font-body">
      <Map
        key={mapId}
        startCoords={startCoords}
        endCoords={endCoords}
        onSafetyBriefing={setSafetyBriefing}
        onMapError={(message) => {
            toast({ variant: 'destructive', title: 'Map Error', description: message });
        }}
      />
      <div className="absolute top-4 left-4 right-4 md:left-4 md:right-auto md:w-full md:max-w-sm z-10">
        <Card className="shadow-2xl bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-primary" />
              NaviSafe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Start Location (e.g., 'Waterloo, London')"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  disabled={isLoading}
                />
                <Input
                  placeholder="End Location (e.g., 'Canary Wharf, London')"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              {error && <p className="text-sm text-destructive px-1">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Find Safer Route
              </Button>
            </form>

            {safetyBriefing && (
              <div className="mt-4">
                  <Alert variant={isWarning ? "destructive" : "default"}>
                    {isWarning ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
                    <AlertTitle className="font-headline">{isWarning ? "Safety Warning" : "Route Clear"}</AlertTitle>
                    <AlertDescription>
                      {safetyBriefing}
                    </AlertDescription>
                  </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}