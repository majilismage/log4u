"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useUnits } from '@/lib/UnitsContext';
import { SPEED_UNITS, DISTANCE_UNITS } from '@/types/units';
import { formatZoomDistance, convertZoomDistanceToKm, convertDistanceFromKm } from '@/lib/unit-conversions';
import type { SpeedUnit, DistanceUnit } from '@/types/units';

export function UnitsSettings() {
  const { unitPreferences, updateUnitPreferences, isLoading } = useUnits();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [localSpeedUnit, setLocalSpeedUnit] = useState<SpeedUnit>(unitPreferences.speedUnit);
  const [localDistanceUnit, setLocalDistanceUnit] = useState<DistanceUnit>(unitPreferences.distanceUnit);
  const [localMapZoomDistance, setLocalMapZoomDistance] = useState<number>(
    // Convert from stored km to user's preferred unit for display
    convertDistanceFromKm(unitPreferences.mapZoomDistance || 100, unitPreferences.distanceUnit)
  );

  // Update local state when preferences change
  React.useEffect(() => {
    setLocalSpeedUnit(unitPreferences.speedUnit);
    setLocalDistanceUnit(unitPreferences.distanceUnit);
    setLocalMapZoomDistance(
      convertDistanceFromKm(unitPreferences.mapZoomDistance || 100, unitPreferences.distanceUnit)
    );
  }, [unitPreferences]);

  // Handle unit change - convert map zoom distance to new unit
  React.useEffect(() => {
    if (localDistanceUnit !== unitPreferences.distanceUnit) {
      // Convert current zoom distance from old unit to new unit
      const currentZoomDistanceKm = convertZoomDistanceToKm(localMapZoomDistance, unitPreferences.distanceUnit);
      const newZoomDistance = convertDistanceFromKm(currentZoomDistanceKm, localDistanceUnit);
      setLocalMapZoomDistance(Math.round(newZoomDistance));
    }
  }, [localDistanceUnit]);

  // Convert local zoom distance to km for comparison with stored value
  const localMapZoomDistanceKm = convertZoomDistanceToKm(localMapZoomDistance, localDistanceUnit);
  
  const hasChanges = localSpeedUnit !== unitPreferences.speedUnit || 
                    localDistanceUnit !== unitPreferences.distanceUnit ||
                    Math.abs(localMapZoomDistanceKm - (unitPreferences.mapZoomDistance || 100)) > 0.1;

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setSaveStatus('idle');

    const success = await updateUnitPreferences({
      speedUnit: localSpeedUnit,
      distanceUnit: localDistanceUnit,
      mapZoomDistance: localMapZoomDistanceKm,
    });

    setSaving(false);
    setSaveStatus(success ? 'success' : 'error');

    // Clear status after 3 seconds
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleReset = () => {
    setLocalSpeedUnit(unitPreferences.speedUnit);
    setLocalDistanceUnit(unitPreferences.distanceUnit);
    setLocalMapZoomDistance(
      convertDistanceFromKm(unitPreferences.mapZoomDistance || 100, unitPreferences.distanceUnit)
    );
    setSaveStatus('idle');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Units Preferences</CardTitle>
          <CardDescription>
            Choose your preferred units for displaying distances and speeds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Units Preferences</CardTitle>
        <CardDescription>
          Choose your preferred units for displaying distances and speeds. These settings will apply to all journey entries and calculations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Speed Units Section */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Speed Units</Label>
            <p className="text-sm text-muted-foreground">
              Choose how speeds are displayed and entered
            </p>
          </div>
          <RadioGroup
            value={localSpeedUnit}
            onValueChange={(value) => setLocalSpeedUnit(value as SpeedUnit)}
            className="grid grid-cols-1 gap-3"
          >
            {Object.entries(SPEED_UNITS).map(([unit, config]) => (
              <div key={unit} className="flex items-center space-x-3">
                <RadioGroupItem value={unit} id={`speed-${unit}`} />
                <Label 
                  htmlFor={`speed-${unit}`} 
                  className="cursor-pointer flex-1 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{config.label}</span>
                    <span className="text-sm text-muted-foreground">{config.symbol}</span>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Distance Units Section */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Distance Units</Label>
            <p className="text-sm text-muted-foreground">
              Choose how distances are displayed and calculated
            </p>
          </div>
          <RadioGroup
            value={localDistanceUnit}
            onValueChange={(value) => setLocalDistanceUnit(value as DistanceUnit)}
            className="grid grid-cols-1 gap-3"
          >
            {Object.entries(DISTANCE_UNITS).map(([unit, config]) => (
              <div key={unit} className="flex items-center space-x-3">
                <RadioGroupItem value={unit} id={`distance-${unit}`} />
                <Label 
                  htmlFor={`distance-${unit}`} 
                  className="cursor-pointer flex-1 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{config.label}</span>
                    <span className="text-sm text-muted-foreground">{config.symbol}</span>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Map Zoom Distance Section */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Map Zoom Distance</Label>
            <p className="text-sm text-muted-foreground">
              Default distance radius when viewing maps centered on your last location
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-1 max-w-xs">
              <Input
                type="number"
                value={Math.round(localMapZoomDistance)}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value)) {
                    setLocalMapZoomDistance(value);
                  }
                }}
                min="5"
                max="500"
                step="1"
                className="text-center"
              />
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {DISTANCE_UNITS[localDistanceUnit].symbol}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Range: 5-500 {DISTANCE_UNITS[localDistanceUnit].symbol}. 
            This controls how zoomed in the map appears when opening to your last location.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Settings saved!</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Failed to save settings</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={saving}
              >
                Reset
              </Button>
            )}
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>

        {/* Preview Section */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
          <div className="mt-2 space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Distance example:</span>{' '}
              <span className="font-medium">15.2 {DISTANCE_UNITS[localDistanceUnit].symbol}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Speed example:</span>{' '}
              <span className="font-medium">25.5 {SPEED_UNITS[localSpeedUnit].symbol}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Map zoom distance:</span>{' '}
              <span className="font-medium">{localMapZoomDistance} {DISTANCE_UNITS[localDistanceUnit].symbol} radius</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 