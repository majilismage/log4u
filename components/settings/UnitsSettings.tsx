"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useUnits } from '@/lib/UnitsContext';
import { SPEED_UNITS, DISTANCE_UNITS } from '@/types/units';
import type { SpeedUnit, DistanceUnit } from '@/types/units';

export function UnitsSettings() {
  const { unitPreferences, updateUnitPreferences, isLoading } = useUnits();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [localSpeedUnit, setLocalSpeedUnit] = useState<SpeedUnit>(unitPreferences.speedUnit);
  const [localDistanceUnit, setLocalDistanceUnit] = useState<DistanceUnit>(unitPreferences.distanceUnit);

  // Update local state when preferences change
  React.useEffect(() => {
    setLocalSpeedUnit(unitPreferences.speedUnit);
    setLocalDistanceUnit(unitPreferences.distanceUnit);
  }, [unitPreferences]);

  const hasChanges = localSpeedUnit !== unitPreferences.speedUnit || 
                    localDistanceUnit !== unitPreferences.distanceUnit;

  const handleSave = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setSaveStatus('idle');

    const success = await updateUnitPreferences({
      speedUnit: localSpeedUnit,
      distanceUnit: localDistanceUnit,
    });

    setSaving(false);
    setSaveStatus(success ? 'success' : 'error');

    // Clear status after 3 seconds
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleReset = () => {
    setLocalSpeedUnit(unitPreferences.speedUnit);
    setLocalDistanceUnit(unitPreferences.distanceUnit);
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 