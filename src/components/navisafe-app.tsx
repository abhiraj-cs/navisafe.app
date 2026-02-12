'use client';

import { useState, useMemo, useCallback } from 'react';
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
  X,
  TextCursorInput,
  Pin,
  LogIn,
  LogOut,
  Route as RouteIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ThemeToggle } from '@/components/theme-toggle';
import { collection, addDoc, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { BlackSpot } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { haversineDistance } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import Link from 'next/link';

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

const NEARBY_THRESHOLD = 50; // 50 meters to consider a spot 'nearby'
type NewSpotInfo = { lat: number; lng: number } | null;
type CurrentLocation = { lat: number; lng: number } | null;
type RouteDetails = any; // Will hold the full OSRM route object
export type TravelMode = 'car' | 'bike';
type SpotToConfirm = BlackSpot | null;
type StopLocation = { lat: number; lng: number; name: string };


export default function NaviSafeApp() {
  const { db } = useFirebase();
  const { isLoggedIn, isAdmin, logout } = useAuth();
  
  const blackSpotsQuery = useMemo(() => (db ? collection(db, 'black_spots') : null), [db]);
  const { data: blackSpots, loading: blackSpotsLoading } = useCollection<BlackSpot>(
    blackSpotsQuery
  );
  
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(null);

  const [activeRoute, setActiveRoute] = useState<{ start: string | { lat: number, lng: number }, end: string }>({ start: '', end: '' });
  const [isRoutePlanned, setIsRoutePlanned] = useState(false);
  const [stops, setStops] = useState<StopLocation[]>([]);
  const [stopToAdd, setStopToAdd] = useState<StopLocation | null>(null);

  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<RouteDetails>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('car');
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const [isAddMode, setIsAddMode] = useState(false);
  const [newSpotInfo, setNewSpotInfo] = useState<NewSpotInfo>(null);
  const [spotToConfirm, setSpotToConfirm] = useState<SpotToConfirm>(null);
  const [isProcessingSpot, setIsProcessingSpot] = useState(false);
  const [spotToDelete, setSpotToDelete] = useState<BlackSpot | null>(null);

  const [newSpotRisk, setNewSpotRisk] = useState<'High' | 'Medium'>('Medium');
  const [newSpotDescription, setNewSpotDescription] = useState('');
  const [locateUser, setLocateUser] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [panToStart, setPanToStart] = useState(false);

  const [rerouteInfo, setRerouteInfo] = useState<any | null>(null);
  const [showReroutePopup, setShowReroutePopup] = useState(false);

  const [isCoordAddOpen, setIsCoordAddOpen] = useState(false);
  const [coordLat, setCoordLat] = useState('');
  const [coordLng, setCoordLng] = useState('');

  const stopDistances = useMemo(() => {
    if (!routeDetails || !stops.length || !routeDetails.legs) return [];
    const distances: { cumulativeDistance: number }[] = [];
    let accumulatedDistance = 0;
    stops.forEach((_, index) => {
        const leg = routeDetails.legs?.[index];
        const legDistance = leg?.distance || 0;
        accumulatedDistance += legDistance;
        distances.push({ cumulativeDistance: accumulatedDistance });
    });
    return distances;
  }, [routeDetails, stops]);

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
    setIsNavigating(false);
    setStops([]);
    setRerouteInfo(null);
    setShowReroutePopup(false);
    setActiveRoute({ start: startValue, end: endInput });
  };
  
  const handleToggleNavigation = () => {
    if (!isNavigating) {
      setPanToStart(true);
      setTimeout(() => setPanToStart(false), 500);
      toast({
        title: 'Navigation Started',
        description: 'Tracking your location.',
      });
    } else {
      toast({
        title: 'Navigation Stopped',
      });
    }
    setIsNavigating(!isNavigating);
  };
  
  const handleCancelRoute = () => {
    setActiveRoute({ start: '', end: '' });
    setStartInput('');
    setEndInput('');
    setIsRoutePlanned(false);
    setIsNavigating(false);
    setSafetyBriefing(null);
    setRouteDetails(null);
    setStops([]);
    setRerouteInfo(null);
    setShowReroutePopup(false);
    toast({
      title: 'Route Cleared',
      description: 'The planned route has been removed.',
    });
  };

  const processNewSpotAddition = async (latlng: { lat: number, lng: number }) => {
    if (isProcessingSpot) return;
    setIsProcessingSpot(true);
    toast({
      title: 'Verifying Location...',
      description: 'Snapping to the nearest road and checking for nearby spots.',
    });

    try {
      // 1. Snap to nearest road using OSRM
      const osrmUrl = `https://router.project-osrm.org/nearest/v1/driving/${latlng.lng},${latlng.lat}`;
      const osrmRes = await fetch(osrmUrl);
      const osrmJson = await osrmRes.json();

      if (osrmJson.code !== 'Ok' || !osrmJson.waypoints || osrmJson.waypoints.length === 0) {
        throw new Error('Could not find a road near this location.');
      }
      
      const snappedCoords = osrmJson.waypoints[0].location;
      const snappedLat = snappedCoords[1];
      const snappedLng = snappedCoords[0];

      // 2. Check for nearby existing black spots
      const nearbySpot = blackSpots?.find(spot => {
        const distance = haversineDistance({ lat: spot.lat, lon: spot.lng }, { lat: snappedLat, lon: snappedLng });
        return distance < NEARBY_THRESHOLD;
      });

      if (nearbySpot) {
        // 3a. If nearby spot found, ask for confirmation to increment
        setSpotToConfirm(nearbySpot);
      } else {
        // 3b. If no nearby spot, open the 'add new' dialog
        setNewSpotInfo({ lat: snappedLat, lng: snappedLng });
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could Not Add Spot',
        description: error.message || 'An error occurred while processing the location.',
      });
    } finally {
      setIsProcessingSpot(false);
    }
  };

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    if (isAddMode) {
      processNewSpotAddition(latlng);
    } else if (isRoutePlanned) {
      toast({
        title: 'Finding location...',
        description: 'Getting details for the selected stop.',
      });
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`);
        const data = await response.json();
        const name = data.display_name || `Stop at ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        setStopToAdd({ lat: latlng.lat, lng: latlng.lng, name });
      } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Could not get location name',
            description: 'Using coordinates as the name.',
        });
        const name = `Stop at ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        setStopToAdd({ lat: latlng.lat, lng: latlng.lng, name });
      }
    }
  };
  
  const handleSubmitCoordinates = () => {
    const lat = parseFloat(coordLat);
    const lng = parseFloat(coordLng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({
        variant: 'destructive',
        title: 'Invalid Coordinates',
        description: 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).',
      });
      return;
    }

    processNewSpotAddition({ lat, lng });

    setIsCoordAddOpen(false); // Close the dialog
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
          setLocateUser(true);
          setIsSearching(false);
          toast({
            title: 'Location Found',
            description: "Your current location has been set as the starting point.",
          });
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

  const handleSaveNewSpot = () => {
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
      report_count: 1,
    };

    const blackSpotsCollection = collection(db, 'black_spots');

    addDoc(blackSpotsCollection, newSpot)
      .then(() => {
        toast({
          title: 'Black Spot Added',
          description: 'The new accident-prone area has been added to the map.',
        });
      })
      .catch((serverError: any) => {
        const permissionError = new FirestorePermissionError({
          path: blackSpotsCollection.path,
          operation: 'create',
          requestResourceData: newSpot,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

    setNewSpotInfo(null);
    setNewSpotDescription('');
    setNewSpotRisk('Medium');
    setIsAddMode(false);
  };
  
  const handleConfirmIncrement = () => {
    if (!spotToConfirm || !db) return;

    const spotRef = doc(db, 'black_spots', spotToConfirm.id);
    updateDoc(spotRef, {
      report_count: increment(1)
    })
    .then(() => {
       toast({
          title: 'Report Confirmed',
          description: `Thank you for confirming the hazard at this location.`,
        });
    })
    .catch((serverError: any) => {
       const permissionError = new FirestorePermissionError({
          path: spotRef.path,
          operation: 'update',
          requestResourceData: { report_count: "increment" },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    
    setSpotToConfirm(null);
  };

  const handleRouteDetails = (details: RouteDetails) => {
    if (details) {
      setRouteDetails(details);
      setIsRoutePlanned(true);
    } else {
      setRouteDetails(null);
      setIsRoutePlanned(false);
    }
  };

  const handleRerouteInfo = (info: any) => {
    if (info && info.spotsAvoided > 0) {
      setRerouteInfo(info);
      setShowReroutePopup(true);
    } else {
      setRerouteInfo(null);
    }
  };

  const handleAddStopConfirm = () => {
    if (!stopToAdd) return;
    setStops([...stops, stopToAdd]);
    toast({
      title: 'Stop Added',
      description: 'Route updated. Alternative routes are now disabled.',
    });
    setStopToAdd(null);
  };

  const handleRemoveStop = (indexToRemove: number) => {
    setStops(stops.filter((_, index) => index !== indexToRemove));
    toast({
      title: 'Stop Removed',
      description: 'The route has been updated.',
    });
  };

  const handleDeleteSpotRequest = useCallback((spot: BlackSpot) => {
    setSpotToDelete(spot);
  }, []);

  const confirmDeleteSpot = () => {
    if (!spotToDelete || !db) return;

    const spotRef = doc(db, 'black_spots', spotToDelete.id);
    deleteDoc(spotRef)
      .then(() => {
        toast({
          title: 'Spot Removed',
          description: 'The accident-prone area has been removed from the map.',
        });
      })
      .catch((serverError: any) => {
        const permissionError = new FirestorePermissionError({
          path: spotRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    
    setSpotToDelete(null);
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
        open={!!spotToDelete}
        onOpenChange={() => setSpotToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              accident-prone area.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSpot}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!stopToAdd}
        onOpenChange={() => setStopToAdd(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Stop</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to add this location as a stop to your route? Adding a stop will disable alternative routes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="font-medium text-foreground -mt-2 mb-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm">
            {stopToAdd?.name}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddStopConfirm}>Add Stop</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog
        open={!!newSpotInfo}
        onOpenChange={() => setNewSpotInfo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Accident-Prone Area</AlertDialogTitle>
            <AlertDialogDescription>
              A valid road location has been selected. Please provide the details for this
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

      <AlertDialog
        open={isCoordAddOpen}
        onOpenChange={(isOpen) => {
          setIsCoordAddOpen(isOpen);
          if (!isOpen) {
            setCoordLat('');
            setCoordLng('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Accident Area by Coordinates</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the latitude and longitude of the accident-prone area.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lat-input">Latitude</Label>
              <Input
                id="lat-input"
                placeholder="e.g., 9.931233"
                value={coordLat}
                onChange={(e) => setCoordLat(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng-input">Longitude</Label>
              <Input
                id="lng-input"
                placeholder="e.g., 76.267303"
                value={coordLng}
                onChange={(e) => setCoordLng(e.target.value)}
                type="number"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitCoordinates}>
              Check Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog
        open={!!spotToConfirm}
        onOpenChange={() => setSpotToConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Hazard Area</AlertDialogTitle>
            <AlertDialogDescription>
              An accident-prone area has already been reported nearby. Do you want to
              confirm this report? This will increase its visibility.
            </AlertDialogDescription>
          </AlertDialogHeader>
           <Card className="text-sm bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800">
              <CardContent className="pt-4 space-y-1">
                  <p><strong>Risk:</strong> {spotToConfirm?.risk_level}</p>
                  <p><strong>Description:</strong> {spotToConfirm?.accident_history}</p>
                  <p><strong>Current Reports:</strong> {spotToConfirm?.report_count}</p>
              </CardContent>
          </Card>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmIncrement}>
              Yes, Confirm Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReroutePopup} onOpenChange={setShowReroutePopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RouteIcon className="h-6 w-6 text-blue-600" />
              Safer Route Recommended
            </AlertDialogTitle>
            <AlertDialogDescription>
              We&apos;ve identified a safer route for your journey. Your safety is our priority.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-foreground/90">
            <p>
              The recommended route is approximately{' '}
              <strong>{formatDuration(rerouteInfo?.timeDifference ?? 0)} longer</strong> but it avoids{' '}
              <strong>{rerouteInfo?.spotsAvoided} known accident zone(s)</strong>.
            </p>
            <p className="text-xs text-muted-foreground pt-2 border-t mt-2">
              The safer route is selected by default. You can still choose the faster (but riskier) route by clicking on it on the map.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowReroutePopup(false)}>
              Got it!
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
            {isLoggedIn ? (
              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" title="Login">
                <Link href="/login">
                  <LogIn className="h-5 w-5" />
                  <span className="sr-only">Login</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Search Form */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan a Route</CardTitle>
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
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className={`w-full transition-colors ${
                      isAddMode
                        ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-400'
                        : 'dark:border-slate-800'
                    }`}
                    onClick={() => setIsAddMode(!isAddMode)}
                    disabled={isSearching || isProcessingSpot || !isLoggedIn}
                  >
                    {isProcessingSpot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isAddMode ? <X className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {isProcessingSpot ? 'Verifying...' : isAddMode ? 'Cancel' : 'Add on Map'}
                  </Button>
                   <Button
                    variant="outline"
                    className="w-full dark:border-slate-800"
                    onClick={() => setIsCoordAddOpen(true)}
                    disabled={isSearching || isProcessingSpot || !isLoggedIn}
                  >
                    <TextCursorInput className="mr-2 h-4 w-4" />
                    Add by Coords
                  </Button>
                </div>
                {isAddMode && (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 p-2 mt-2 bg-slate-50 dark:bg-slate-900 rounded-md border dark:border-slate-800">
                    Click a location on the map to add a new black spot.
                  </div>
                )}
                 {!isLoggedIn && (
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 p-2 mt-2 bg-slate-50 dark:bg-slate-900 rounded-md border dark:border-slate-800">
                    Please login to contribute data.
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
                  {stops.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800/50">
                      <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300">Stops</h4>
                        {stops.map((stop, index) => (
                          <div key={index} className="flex items-center justify-between bg-white/50 dark:bg-black/20 p-2 rounded-md text-sm">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <Pin className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium block truncate" title={stop.name}>
                                    {stop.name}
                                </p>
                                {stopDistances[index] && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {(stopDistances[index].cumulativeDistance / 1000).toFixed(1)} km from start
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleRemoveStop(index)}>
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  )}
                   <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleToggleNavigation}
                      className={`w-full text-white ${
                        isNavigating
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {isNavigating ? (
                        <X className="mr-2 h-4 w-4" />
                      ) : (
                        <Navigation className="mr-2 h-4 w-4" />
                      )}
                      {isNavigating ? 'Stop' : 'Navigate'}
                    </Button>
                     <Button
                        variant="outline"
                        onClick={handleCancelRoute}
                        className="w-full"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                  </div>
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
          Powered By Group 2 S6C
        </div>
      </div>

      {/* MAP AREA */}
      <div
        className={`flex-1 relative h-[60vh] md:h-full w-full bg-slate-200 ${
          isAddMode ? 'cursor-crosshair' : (isRoutePlanned ? 'cursor-copy' : '')
        }`}
      >
        <MapComponent
          startLocation={activeRoute.start}
          endLocation={activeRoute.end}
          stops={stops}
          blackSpots={blackSpots || []}
          travelMode={travelMode}
          onMapClick={handleMapClick}
          onSafetyBriefing={setSafetyBriefing}
          onRouteDetails={handleRouteDetails}
          onMapError={message => {
            if (message) {
              toast({
                variant: 'destructive',
                title: 'Route Error',
                description: message,
              });
            }
            setIsRoutePlanned(false);
          }}
          onLoading={setIsSearching}
          locateUser={locateUser}
          panToStart={panToStart}
          isNavigating={isNavigating}
          isAdmin={isAdmin}
          onSpotDeleteRequest={handleDeleteSpotRequest}
          onRerouteInfo={handleRerouteInfo}
        />
        {isAddMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] p-4 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-2xl pointer-events-none text-center">
            <MapPin className="mx-auto h-8 w-8 text-blue-600" />
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Click to place a new black spot
            </p>
          </div>
        )}
         {isRoutePlanned && !isAddMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow-lg pointer-events-none text-center">
            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
              Click on the map to add a stop
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
