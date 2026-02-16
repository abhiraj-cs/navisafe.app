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
};

export function LocationInput({ value, onValueChange, placeholder, disabled, className, icon }: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const providerRef = useRef<OpenStreetMapProvider | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    const initializeProvider = async () => {
        if (!providerRef.current) {
            const { OpenStreetMapProvider: Provider } = await import('leaflet-geosearch');
            providerRef.current = new Provider();
        }
    };
    initializeProvider();
  }, []);

  useEffect(() => {
    if (debouncedValue.trim().length > 2 && showSuggestions && providerRef.current) {
      const fetchSuggestions = async () => {
        setIsLoading(true);
        try {
          const results = await providerRef.current!.search({ query: debouncedValue });
          setSuggestions(results);
        } catch (error) {
          console.error("Failed to fetch location suggestions", error);
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [debouncedValue, showSuggestions]);

  const handleSelect = (suggestion: SearchResult) => {
    onValueChange(suggestion.label);
    setShowSuggestions(false);
    inputRef.current?.blur();
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
          {!isLoading && suggestions.length > 0 && (
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
           {!isLoading && suggestions.length === 0 && debouncedValue.length > 2 && (
            <div className="p-3 text-sm text-muted-foreground">No results found.</div>
           )}
        </div>
      )}
    </div>
  );
}
