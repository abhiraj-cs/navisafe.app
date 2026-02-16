'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import type { OpenStreetMapProvider, SearchResult } from 'leaflet-geosearch';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

type LocationInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  icon: React.ReactNode;
  onLocationSelect?: (selection: SearchResult) => void;
};

export function LocationInput({ value, onValueChange, placeholder, disabled, className, icon, onLocationSelect }: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [provider, setProvider] = useState<OpenStreetMapProvider | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null); // New state for errors
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    // Dynamically import and initialize the provider on the client side
    import('leaflet-geosearch').then(module => {
        setProvider(new module.OpenStreetMapProvider());
    });
  }, []);

  useEffect(() => {
    // We now have `provider` as a dependency, so this effect will run when it's initialized.
    if (debouncedValue.trim().length > 2 && showSuggestions && provider) {
      const fetchSuggestions = async () => {
        setIsLoading(true);
        setSearchError(null); // Reset error state on new search
        try {
          const results = await provider.search({ query: debouncedValue });
          setSuggestions(results);
        } catch (error) {
          setSuggestions([]); // Clear suggestions on error
          // Check if the error is a TypeError, which can indicate a network issue.
          if (error instanceof TypeError && error.message === 'Failed to fetch') {
             console.error("Location search failed. Please check your network connection.", error);
             setSearchError("Search failed. Check network connection.");
          } else {
             console.error("Failed to fetch location suggestions", error);
             setSearchError("An error occurred while searching.");
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchSuggestions();
    } else {
      setSuggestions([]);
      setSearchError(null); // Clear error when not searching
    }
  }, [debouncedValue, showSuggestions, provider]);

  const handleSelect = (suggestion: SearchResult) => {
    setShowSuggestions(false);
    inputRef.current?.blur();
    if (onLocationSelect) {
      onLocationSelect(suggestion);
    } else {
      onValueChange(suggestion.label);
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none">
        {icon}
      </div>
      <Input
        ref={inputRef}
        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        disabled={disabled}
        autoComplete="off"
      />

      {showSuggestions && debouncedValue.trim().length > 2 && (
        <div className="absolute top-full mt-2 w-full z-30 bg-card border border-border rounded-md shadow-lg animate-in fade-in-0 duration-200">
          {isLoading && <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Searching...</div>}
          
          {!isLoading && searchError && (
             <div className="p-3 text-sm text-destructive">{searchError}</div>
          )}

          {!isLoading && !searchError && suggestions.length > 0 && (
            <ul className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.raw.place_id || index}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(suggestion);
                    }}
                    className="w-full text-left p-3 text-sm hover:bg-accent transition-colors"
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
           {!isLoading && !searchError && suggestions.length === 0 && debouncedValue.length > 2 && (
            <div className="p-3 text-sm text-muted-foreground">No results found.</div>
           )}
        </div>
      )}
    </div>
  );
}
