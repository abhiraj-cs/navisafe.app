'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Map as MapIcon,
  Search,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  PlusCircle,
  MapPin,
  Crosshair,
  Car,
  Bike,
  Clock,
  Milestone,
  Play,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ThemeToggle } from '@/components/theme-toggle';
import { collection, addDoc } from 'firebase/firestore';
import { BlackSpot } from '@/lib/data';
import { useFirebase } from '@/firebase';

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

type NewSpotInfo = { lat: number; lng: number } | null;
type CurrentLocation = { lat: number; lng: number } | null;
type RouteDetails = { distance: number; duration: number } | null;
export type TravelMode = 'car' | 'bike';


export default function NaviSafeApp() {
  const { db } = useFirebase();
  const { data: blackSpots, loading: blackSpotsLoading } = useCollection<BlackSpot>(
    db ? collection(db, 'black_spots') : null
  );
  
  const [startInput, setStartInput] = useState('Alappuzha');
  const [endInput, setEndInput] = useState('Pathanamthitta');
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(null);

  const [activeRoute, setActiveRoute] = useState<{ start: string | { lat: number, lng: number }, end: string }>({ start: '', end: '' });
  const [isRoutePlanned, setIsRoutePlanned] = useState(false);

  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<RouteDetails>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('car');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const [isAddMode, setIsAddMode] = useState(false);
  const [newSpotInfo, setNewSpotInfo] = useState<NewSpotInfo>(null);
  const [newSpotRisk, setNewSpotRisk] = useState<'High' | 'Medium'>('Medium');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [locateUser, setLocateUser] = useState(false);
  const [startNavigation, setStartNavigation] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAddMode) setIsAddMode(false);
    
    let startValue: string | { lat: number, lng: number } = startInput;

    if (startInput === 'My Current Location' && currentLocation) {
      startValue = currentLocation;
    } else if (!startInput.trim() || !endInput.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing Locations',
        description: 'Please enter both a start and destination.',
      });
      return;
    }

    setSafetyBriefing(null);
    setRouteDetails(null);
    setIsRoutePlanned(false);
    setStartNavigation(false);
    setActiveRoute({ start: startValue, end: endInput });
  };
  
  const handleStartNavigation = () => {
    setStartNavigation(true);
    toast({
      title: 'Navigation Started',
      description: 'Centering map on your starting location.',
    });
     setTimeout(() => setStartNavigation(false), 500);
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (isAddMode) {
      setNewSpotInfo(latlng);
    }
  };

  const handleLocateUser = () => {
    setIsSearching(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userLocation = { lat: latitude, lng: longitude };
          setCurrentLocation(userLocation);
          setStartInput('My Current Location');
          setLocateUser(true); // Triggers map to locate user
          setIsSearching(false);
          toast({
            title: 'Location Found',
            description: "Your current location has been set as the starting point.",
          });
          // Reset locateUser after a short delay so it can be triggered again
          setTimeout(() => setLocateUser(false), 500);
        },
        (error) => {
          setIsSearching(false);
          toast({
            variant: 'destructive',
            title: 'Location Error',
            description: error.message || 'Could not get your current location.',
          });
        }
      );
    } else {
      setIsSearching(false);
      toast({
        variant: 'destructive',
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
      });
    }
  };

  const handleSaveNewSpot = async () => {
    if (!newSpotInfo || !newSpotDescription.trim() || !db) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Information',
        description:
          'Please provide a valid description for the new black spot.',
      });
      return;
    }

    const newSpot: Omit<BlackSpot, 'id'> = {
      lat: newSpotInfo.lat,
      lng: newSpotInfo.lng,
      risk_level: newSpotRisk,
      accident_history: newSpotDescription,
    };

    try {
      await addDoc(collection(db, 'black_spots'), newSpot);
      toast({
        title: 'Black Spot Added',
        description: 'The new accident-prone area has been added to the map.',
      });
    } catch (error: any) {
       toast({
        variant: 'destructive',
        title: 'Failed to Add Spot',
        description: error.message || 'There was a problem saving the new spot.',
      });
    }


    setNewSpotInfo(null);
    setNewSpotDescription('');
    setNewSpotRisk('Medium');
    setIsAddMode(false);
  };
  
  const handleRouteDetails = (details: RouteDetails) => {
    if (details) {
      setRouteDetails(details);
      setIsRoutePlanned(true);
    } else {
      setIsRoutePlanned(false);
    }
  };


  const isHighRisk =
    safetyBriefing &&
    (safetyBriefing.toLowerCase().includes('caution') ||
      safetyBriefing.toLowerCase().includes('high risk') ||
      safetyBriefing.toLowerCase().includes('danger'));

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}min`;
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      <AlertDialog
        open={!!newSpotInfo}
        onOpenChange={() => setNewSpotInfo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Accident-Prone Area</AlertDialogTitle>
            <AlertDialogDescription>
              You've marked a new location. Please provide the details for this
              black spot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Risk Level</Label>
              <RadioGroup
                defaultValue="Medium"
                value={newSpotRisk}
                onValueChange={(val: 'High' | 'Medium') => setNewSpotRisk(val)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Medium" id="r-medium" />
                  <Label htmlFor="r-medium">Medium Risk</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="High"
                    id="r-high"
                    className="text-red-600 border-red-600"
                  />
                  <Label htmlFor="r-high">High Risk</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Accident History / Description
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., 'Sharp blind curve, frequent head-on collisions.'"
                value={newSpotDescription}
                onChange={e => setNewSpotDescription(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveNewSpot}>
              Save Spot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SIDEBAR CONTROL PANEL */}
      <div className="w-full md:w-[400px] flex-shrink-0 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 z-20 shadow-xl flex flex-col h-[40vh] md:h-full">
        {/* Header */}
        <div className="p-4 bg-slate-900 dark:bg-black text-white shadow-md flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Navigation className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">NaviSafe</h1>
              <p className="text-slate-400 text-xs">
                AI-Powered Safety Navigation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search Form */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Enter Travel Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={travelMode === 'car' ? 'secondary' : 'ghost'}
                    onClick={() => setTravelMode('car')}
                    className="dark:data-[state=active]:bg-slate-700"
                  >
                    <Car className="mr-2 h-4 w-4" />
                    Car
                  </Button>
                  <Button
                    type="button"
                    variant={travelMode === 'bike' ? 'secondary' : 'ghost'}
                    onClick={() => setTravelMode('bike')}
                    className="dark:data-[state=active]:bg-slate-700"
                  >
                    <Bike className="mr-2 h-4 w-4" />
                    Bike
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="relative flex items-center gap-2">
                    <div className="absolute left-3 top-2.5 h-4 w-4 rounded-full border-2 border-slate-400 dark:border-slate-600" />
                    <Input
                      className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500"
                      placeholder="Start Location"
                      value={startInput}
                      onChange={e => setStartInput(e.target.value)}
                      disabled={isSearching}
                    />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleLocateUser}
                        disabled={isSearching}
                        className="flex-shrink-0"
                        aria-label="Use my location"
                      >
                        <Crosshair className="h-4 w-4 text-blue-500" />
                      </Button>
                  </div>

                  <div className="relative">
                    <MapIcon className="absolute left-3 top-2.5 h-4 w-4 text-blue-500" />
                    <Input
                      className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500"
                      placeholder="Destination"
                      value={endInput}
                      onChange={e => setEndInput(e.target.value)}
                      disabled={isSearching}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
                  disabled={isSearching || blackSpotsLoading}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Route...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Plan Route
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contribute Data</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className={`w-full transition-colors ${
                    isAddMode
                      ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-400'
                      : 'dark:border-slate-800'
                  }`}
                  onClick={() => setIsAddMode(!isAddMode)}
                  disabled={isSearching}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {isAddMode ? 'Cancel' : 'Add Accident Area'}
                </Button>
                {isAddMode && (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 p-2 mt-2 bg-slate-50 dark:bg-slate-900 rounded-md border dark:border-slate-800">
                    Click a location on the map to add a new black spot.
                  </div>
                )}
              </CardContent>
            </Card>
          
          {/* Route Details & Start Button */}
          {isRoutePlanned && !isSearching && (
             <Card className="border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 animate-in fade-in duration-500">
                <CardHeader>
                  <CardTitle className="text-base text-blue-800 dark:text-blue-300">Route Ready</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-around items-center text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Milestone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <p className="font-bold text-lg">{(routeDetails!.distance / 1000).toFixed(1)}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">km</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <p className="font-bold text-lg">{formatDuration(routeDetails!.duration)}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Est. Time</p>
                    </div>
                  </div>
                   <Button
                    onClick={handleStartNavigation}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Navigation
                  </Button>
                </CardContent>
              </Card>
          )}


          {/* Safety Briefing Result */}
          {safetyBriefing && !isSearching && (
            <div className="animate-in slide-in-from-bottom-2 fade-in duration-500">
              <Alert
                className={`border shadow-sm ${
                  isHighRisk
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300'
                }`}
              >
                {isHighRisk ? (
                  <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-500" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                )}
                <AlertTitle className="font-bold ml-2">
                  {isHighRisk ? 'Safety Warning' : 'Route Clear'}
                </AlertTitle>
                <AlertDescription className="mt-2 ml-1 text-sm leading-relaxed whitespace-pre-line opacity-90">
                  {safetyBriefing}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/50 dark:border-slate-800">
          Powered by OpenStreetMap & AI Analytics
        </div>
      </div>

      {/* MAP AREA */}
      <div
        className={`flex-1 relative h-[60vh] md:h-full w-full bg-slate-200 ${
          isAddMode ? 'cursor-crosshair' : ''
        }`}
      >
        <MapComponent
          startLocation={activeRoute.start}
          endLocation={activeRoute.end}
          blackSpots={blackSpots || []}
          travelMode={travelMode}
          onMapClick={handleMapClick}
          onSafetyBriefing={setSafetyBriefing}
          onRouteDetails={handleRouteDetails}
          onMapError={message => {
            toast({
              variant: 'destructive',
              title: 'Route Error',
              description: message,
            });
            setIsRoutePlanned(false);
          }}
          onLoading={setIsSearching}
          locateUser={locateUser}
          startNavigation={startNavigation}
        />
        {isAddMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] p-4 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-2xl pointer-events-none text-center">
            <MapPin className="mx-auto h-8 w-8 text-blue-600" />
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Click to place a new black spot
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
