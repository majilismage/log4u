"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { UnitPreferences, UnitConfig } from '@/types/units';
import { DEFAULT_UNIT_PREFERENCES, SPEED_UNITS, DISTANCE_UNITS } from '@/types/units';

interface UnitsContextType {
  unitPreferences: UnitPreferences;
  unitConfig: UnitConfig;
  updateUnitPreferences: (preferences: Partial<UnitPreferences>) => Promise<boolean>;
  isLoading: boolean;
  refreshPreferences: () => Promise<void>;
}

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [unitPreferences, setUnitPreferences] = useState<UnitPreferences>(DEFAULT_UNIT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch unit preferences from the server
  const fetchUnitPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/unit-preferences');
      
      if (response.ok) {
        const data = await response.json();
        if (data.unitPreferences) {
          setUnitPreferences(data.unitPreferences);
        } else {
          // Use defaults if no preferences are set
          setUnitPreferences(DEFAULT_UNIT_PREFERENCES);
        }
      } else if (response.status === 404) {
        // No preferences set yet, use defaults
        setUnitPreferences(DEFAULT_UNIT_PREFERENCES);
      } else {
        console.error('Failed to fetch unit preferences', { status: response.status });
        setUnitPreferences(DEFAULT_UNIT_PREFERENCES);
      }
    } catch (error) {
      console.error('Error fetching unit preferences', error);
      setUnitPreferences(DEFAULT_UNIT_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update unit preferences on the server
  const updateUnitPreferences = useCallback(async (newPreferences: Partial<UnitPreferences>): Promise<boolean> => {
    try {
      const updatedPreferences = { ...unitPreferences, ...newPreferences };
      
      const response = await fetch('/api/user/unit-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unitPreferences: updatedPreferences }),
      });

      if (response.ok) {
        setUnitPreferences(updatedPreferences);
        console.log('Unit preferences updated successfully', updatedPreferences);
        return true;
      } else {
        console.error('Failed to update unit preferences', { status: response.status });
        return false;
      }
    } catch (error) {
      console.error('Error updating unit preferences', error);
      return false;
    }
  }, [unitPreferences]);

  const refreshPreferences = useCallback(async () => {
    await fetchUnitPreferences();
  }, [fetchUnitPreferences]);

  // Create unit config object
  const unitConfig: UnitConfig = useMemo(() => ({
    speed: {
      unit: unitPreferences.speedUnit,
      label: SPEED_UNITS[unitPreferences.speedUnit].label,
      symbol: SPEED_UNITS[unitPreferences.speedUnit].symbol,
    },
    distance: {
      unit: unitPreferences.distanceUnit,
      label: DISTANCE_UNITS[unitPreferences.distanceUnit].label,
      symbol: DISTANCE_UNITS[unitPreferences.distanceUnit].symbol,
    },
  }), [unitPreferences]);

  // Load preferences on mount
  useEffect(() => {
    fetchUnitPreferences();
  }, [fetchUnitPreferences]);

  const contextValue = useMemo(() => ({
    unitPreferences,
    unitConfig,
    updateUnitPreferences,
    isLoading,
    refreshPreferences,
  }), [unitPreferences, unitConfig, updateUnitPreferences, isLoading, refreshPreferences]);

  return (
    <UnitsContext.Provider value={contextValue}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  const context = useContext(UnitsContext);
  if (context === undefined) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
} 