/**
 * Location Tracking Utility for LARK
 * 
 * This utility provides functions for tracking and managing location data
 * with support for real-time updates, geocoding, and location history.
 */

// Types for location data
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  address?: string;
}

export interface LocationHistoryEntry extends LocationData {
  id: string;
}

// Cache for location data
let currentLocation: LocationData | null = null;
let locationHistory: LocationHistoryEntry[] = [];
let watchId: number | null = null;
let locationUpdateCallbacks: ((location: LocationData) => void)[] = [];

/**
 * Resolve with a fallback location (Baton Rouge, LA by default for law enforcement context)
 * @param resolve - Promise resolver function
 */
function resolveFallbackLocation(resolve: (location: LocationData | null) => void): void {
  // Default to Baton Rouge, LA (central Louisiana location for law enforcement context)
  const fallbackLocation: LocationData = {
    latitude: 30.4515,
    longitude: -91.1871,
    accuracy: 1000, // Low accuracy indicator
    timestamp: Date.now(),
    address: 'Baton Rouge, Louisiana' // Hardcoded address
  };
  
  resolve(fallbackLocation);
}

/**
 * Initialize location tracking
 * @returns Promise that resolves to a boolean indicating if location tracking was successfully initialized
 */
export async function initLocationTracking(): Promise<boolean> {
  try {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return false;
    }

    // Get initial location
    const initialLocation = await getCurrentPosition();
    if (initialLocation) {
      currentLocation = initialLocation;
      addToLocationHistory(initialLocation);
      
      // Start watching position for updates
      startWatchingPosition();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error initializing location tracking:', error);
    return false;
  }
}

/**
 * Get the current position as a Promise
 * @returns Promise that resolves to LocationData or null if unavailable
 */
export async function getCurrentPosition(): Promise<LocationData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation API not supported - using fallback location');
      resolveFallbackLocation(resolve);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        // Try to get address from coordinates
        getAddressFromCoordinates(locationData.latitude, locationData.longitude)
          .then(address => {
            if (address) {
              locationData.address = address;
            }
            resolve(locationData);
          })
          .catch(() => {
            // Resolve with coordinates only if geocoding fails
            resolve(locationData);
          });
      },
      (error) => {
        console.error('Error getting current position:', error);
        // Check error code and provide more specific feedback
        if (error.code === 1) {
          console.log('Location permission denied - using fallback location');
        } else if (error.code === 2) {
          console.log('Location unavailable - using fallback location');
        } else if (error.code === 3) {
          console.log('Location request timed out - using fallback location');
        }
        
        // Use fallback location for Louisiana (Baton Rouge)
        resolveFallbackLocation(resolve);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

/**
 * Start watching position for real-time updates
 */
function startWatchingPosition(): void {
  if (!navigator.geolocation || watchId !== null) {
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      
      // Only update if position has changed significantly
      if (shouldUpdateLocation(locationData)) {
        // Try to get address from coordinates
        getAddressFromCoordinates(locationData.latitude, locationData.longitude)
          .then(address => {
            if (address) {
              locationData.address = address;
            }
            
            currentLocation = locationData;
            addToLocationHistory(locationData);
            
            // Notify all registered callbacks
            notifyLocationUpdated(locationData);
          })
          .catch(() => {
            // Update with coordinates only if geocoding fails
            currentLocation = locationData;
            addToLocationHistory(locationData);
            notifyLocationUpdated(locationData);
          });
      }
    },
    (error) => {
      console.error('Error watching position:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

/**
 * Stop watching position
 */
export function stopLocationTracking(): void {
  if (navigator.geolocation && watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/**
 * Get address from coordinates using reverse geocoding
 * @param latitude Latitude
 * @param longitude Longitude
 * @returns Promise that resolves to an address string or null if unavailable
 */
async function getAddressFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
  try {
    // Use Nominatim OpenStreetMap API for geocoding
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch address');
    }
    
    const data = await response.json();
    
    if (data && data.display_name) {
      // Format the address to be more concise
      const parts = data.display_name.split(',');
      if (parts.length > 2) {
        // Return city and state/country
        return `${parts[parts.length - 3].trim()}, ${parts[parts.length - 2].trim()}`;
      }
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting address from coordinates:', error);
    return null;
  }
}

/**
 * Check if location should be updated based on distance and time
 * @param newLocation New location data
 * @returns Boolean indicating if location should be updated
 */
function shouldUpdateLocation(newLocation: LocationData): boolean {
  if (!currentLocation) {
    return true;
  }
  
  // Update if more than 5 minutes have passed
  const fiveMinutesInMs = 5 * 60 * 1000;
  if (newLocation.timestamp - currentLocation.timestamp > fiveMinutesInMs) {
    return true;
  }
  
  // Update if moved more than 100 meters
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    newLocation.latitude,
    newLocation.longitude
  );
  
  return distance > 0.1; // 100 meters in kilometers
}

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

/**
 * Convert degrees to radians
 * @param deg Degrees
 * @returns Radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Add location to history
 * @param location Location data
 */
function addToLocationHistory(location: LocationData): void {
  const historyEntry: LocationHistoryEntry = {
    ...location,
    id: generateId()
  };
  
  locationHistory.push(historyEntry);
  
  // Keep only the last 100 locations
  if (locationHistory.length > 100) {
    locationHistory = locationHistory.slice(-100);
  }
}

/**
 * Generate a unique ID
 * @returns Unique ID string
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Get the current location
 * @returns Current location data or null if unavailable
 */
export function getCurrentLocation(): LocationData | null {
  return currentLocation;
}

/**
 * Get location history
 * @param limit Maximum number of entries to return
 * @returns Array of location history entries
 */
export function getLocationHistory(limit: number = 10): LocationHistoryEntry[] {
  return locationHistory.slice(-limit);
}

/**
 * Register a callback for location updates
 * @param callback Function to call when location is updated
 */
export function onLocationUpdate(callback: (location: LocationData) => void): void {
  locationUpdateCallbacks.push(callback);
}

/**
 * Unregister a callback for location updates
 * @param callback Function to remove from callbacks
 */
export function offLocationUpdate(callback: (location: LocationData) => void): void {
  locationUpdateCallbacks = locationUpdateCallbacks.filter(cb => cb !== callback);
}

/**
 * Notify all registered callbacks of location update
 * @param location Updated location data
 */
function notifyLocationUpdated(location: LocationData): void {
  locationUpdateCallbacks.forEach(callback => {
    try {
      callback(location);
    } catch (error) {
      console.error('Error in location update callback:', error);
    }
  });
}
