"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  Map as MapIcon, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  Navigation 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Dynamically import the map to ensure it's client-side only
const MapComponent = dynamic(() => import('@/components/map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium">Loading Map Engine...</p>
    </div>
  ),
});

export default function NaviSafeApp() {
  const [startInput, setStartInput] = useState('Alappuzha');
  const [endInput, setEndInput] = useState('Pathanamthitta');
  
  // This state triggers the map update
  const [activeRoute, setActiveRoute] = useState({ start: '', end: '' });
  
  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startInput.trim() || !endInput.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Locations",
        description: "Please enter both a start and destination."
      });
      return;
    }
    
    setSafetyBriefing(null);
    setActiveRoute({ start: startInput, end: endInput });
  };

  // Determine alert style based on briefing content
  const isHighRisk = safetyBriefing && (
    safetyBriefing.toLowerCase().includes("caution") || 
    safetyBriefing.toLowerCase().includes("high risk") ||
    safetyBriefing.toLowerCase().includes("danger")
  );

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* SIDEBAR CONTROL PANEL */}
      <div className="w-full md:w-[400px] flex-shrink-0 bg-white border-r border-slate-200 z-20 shadow-xl flex flex-col h-[40vh] md:h-full">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white shadow-md">
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="h-6 w-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight">NaviSafe</h1>
          </div>
          <p className="text-slate-400 text-xs">AI-Powered Safety Navigation</p>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Search Form */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan Your Journey</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute left-3 top-2.5 h-4 w-4 rounded-full border-2 border-slate-300" />
                    <Input
                      className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      placeholder="Start Location"
                      value={startInput}
                      onChange={(e) => setStartInput(e.target.value)}
                      disabled={isSearching}
                    />
                  </div>
                  
                  <div className="relative">
                    <MapIcon className="absolute left-3 top-2.5 h-4 w-4 text-blue-500" />
                    <Input
                      className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      placeholder="Destination"
                      value={endInput}
                      onChange={(e) => setEndInput(e.target.value)}
                      disabled={isSearching}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 transition-colors" 
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Route...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Safer Route
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Safety Briefing Result */}
          {safetyBriefing && !isSearching && (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-500">
              <Alert 
                className={`border shadow-sm ${
                  isHighRisk 
                    ? "bg-red-50 border-red-200 text-red-900" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                {isHighRisk ? (
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                )}
                <AlertTitle className="font-bold ml-2">
                  {isHighRisk ? "Safety Warning" : "Route Clear"}
                </AlertTitle>
                <AlertDescription className="mt-2 ml-1 text-sm leading-relaxed whitespace-pre-line opacity-90">
                  {safetyBriefing}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center text-xs text-slate-400 bg-slate-50">
          Powered by OpenStreetMap & AI Analytics
        </div>
      </div>

      {/* MAP AREA */}
      <div className="flex-1 relative h-[60vh] md:h-full w-full bg-slate-200">
        <MapComponent
          startLocation={activeRoute.start}
          endLocation={activeRoute.end}
          onSafetyBriefing={setSafetyBriefing}
          onMapError={(message) => {
            toast({ variant: 'destructive', title: 'Route Error', description: message });
          }}
          onLoading={setIsSearching}
        />
      </div>

    </div>
  );
}
