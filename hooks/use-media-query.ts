"use client"

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Check if window.matchMedia is supported (it's not on the server)
    if (typeof window.matchMedia !== 'function') {
      // console.warn('window.matchMedia is not supported, returning default value.');
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const documentChangeHandler = () => setMatches(mediaQueryList.matches);

    // Set initial state
    setMatches(mediaQueryList.matches);

    // Listen for changes
    // Using addEventListener for modern browsers, with fallback for older ones
    try {
      mediaQueryList.addEventListener('change', documentChangeHandler);
    } catch (e) {
      // Fallback for older browsers
      mediaQueryList.addListener(documentChangeHandler);
    }

    // Cleanup listener on component unmount
    return () => {
      try {
        mediaQueryList.removeEventListener('change', documentChangeHandler);
      } catch (e) {
        // Fallback for older browsers
        mediaQueryList.removeListener(documentChangeHandler);
      }
    };
  }, [query]); // Re-run effect if query changes

  return matches;
} 