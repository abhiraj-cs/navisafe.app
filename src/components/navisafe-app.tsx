"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Map as MapIcon, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Map = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

export default function NaviSafeApp() {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMapLoading, setMapIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startInput || !endInput) {
      setError('Please enter both a start and end location.');
      return;
    }
    
    setError('');
    setSafetyBriefing(null);
    setStartLocation(startInput);
    setEndLocation(endInput);
  };
  
  const isWarning = safetyBriefing && (safetyBriefing.includes("Caution") || safetyBriefing.includes("passes near"));
  const isSearching = isLoading || isMapLoading;

  return (
    <div className="relative h-screen w-screen font-body">
      {isSearching && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-20">
          <div className="flex items-center gap-2 text-muted-foreground p-4 bg-background rounded-md shadow-lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing route safety...
          </div>
        </div>
      )}
      <Map
        startLocation={startLocation}
        endLocation={endLocation}
        onSafetyBriefing={setSafetyBriefing}
        onMapError={(message) => {
            toast({ variant: 'destructive', title: 'Map Error', description: message });
        }}
        onLoading={setMapIsLoading}
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
                  disabled={isSearching}
                />
                <Input
                  placeholder="End Location (e.g., 'Canary Wharf, London')"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  disabled={isSearching}
                />
              </div>
              {error && <p className="text-sm text-destructive px-1">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSearching}>
                {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
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
