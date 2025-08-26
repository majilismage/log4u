'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { validateCORS, TILE_PROVIDERS, selectTileProvider } from '@/lib/mapTileProviders';

// Dynamic import with no SSR
const MapLibreWrapper = dynamic(() => import('@/components/maps/MapLibreWrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  )
});

interface TileProviderTest {
  name: string;
  status: 'pending' | 'testing' | 'success' | 'failed';
  corsValid?: boolean;
  responseTime?: number;
  error?: string;
}

interface NetworkMetrics {
  tilesRequested: number;
  tilesLoaded: number;
  tilesFailed: number;
  avgLoadTime: number;
  corsErrors: number;
}

export default function TestMapCORS() {
  const [providerTests, setProviderTests] = useState<TileProviderTest[]>([
    { name: 'Stadia Maps', status: 'pending' },
    { name: 'Carto CDN', status: 'pending' },
    { name: 'OpenStreetMap (Expected to fail)', status: 'pending' }
  ]);
  
  const [selectedProvider, setSelectedProvider] = useState<string>('auto');
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({
    tilesRequested: 0,
    tilesLoaded: 0,
    tilesFailed: 0,
    avgLoadTime: 0,
    corsErrors: 0
  });
  
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  // Monitor console errors for CORS issues
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      originalError(...args);
      const errorMessage = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          // Handle error objects more carefully
          if (arg.message) return arg.message;
          if (arg.error) return arg.error.message || JSON.stringify(arg.error);
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      if (errorMessage.toLowerCase().includes('cors') || 
          errorMessage.toLowerCase().includes('cross-origin') ||
          errorMessage.toLowerCase().includes('tile')) {
        setConsoleErrors(prev => [...prev, errorMessage]);
        if (errorMessage.toLowerCase().includes('cors')) {
          setNetworkMetrics(prev => ({ ...prev, corsErrors: prev.corsErrors + 1 }));
        }
      }
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  // Monitor network requests for tile loading
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource' && entry.name.includes('.png')) {
          setNetworkMetrics(prev => {
            const newMetrics = { ...prev };
            newMetrics.tilesRequested++;
            
            if ((entry as PerformanceResourceTiming).responseEnd > 0) {
              newMetrics.tilesLoaded++;
              const loadTime = (entry as PerformanceResourceTiming).responseEnd - 
                              (entry as PerformanceResourceTiming).fetchStart;
              newMetrics.avgLoadTime = (newMetrics.avgLoadTime * (newMetrics.tilesLoaded - 1) + loadTime) / newMetrics.tilesLoaded;
            } else {
              newMetrics.tilesFailed++;
            }
            
            return newMetrics;
          });
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
    return () => observer.disconnect();
  }, []);

  const testProvider = async (providerName: string) => {
    setProviderTests(prev => prev.map(test => 
      test.name === providerName ? { ...test, status: 'testing' } : test
    ));

    const startTime = performance.now();
    
    try {
      let provider;
      switch (providerName) {
        case 'Stadia Maps':
          provider = TILE_PROVIDERS.stadia;
          break;
        case 'Carto CDN':
          provider = TILE_PROVIDERS.cartoFallback;
          break;
        case 'OpenStreetMap (Expected to fail)':
          provider = {
            name: 'OpenStreetMap',
            urls: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          };
          break;
        default:
          throw new Error('Unknown provider');
      }

      const isValid = await validateCORS(provider);
      const responseTime = performance.now() - startTime;

      setProviderTests(prev => prev.map(test => 
        test.name === providerName 
          ? { 
              ...test, 
              status: isValid ? 'success' : 'failed',
              corsValid: isValid,
              responseTime,
              error: isValid ? undefined : 'CORS validation failed'
            }
          : test
      ));
    } catch (error) {
      const responseTime = performance.now() - startTime;
      setProviderTests(prev => prev.map(test => 
        test.name === providerName 
          ? { 
              ...test, 
              status: 'failed',
              corsValid: false,
              responseTime,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          : test
      ));
    }
  };

  const testAllProviders = async () => {
    setIsTestingAll(true);
    setConsoleErrors([]);
    setNetworkMetrics({
      tilesRequested: 0,
      tilesLoaded: 0,
      tilesFailed: 0,
      avgLoadTime: 0,
      corsErrors: 0
    });

    for (const test of providerTests) {
      await testProvider(test.name);
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsTestingAll(false);
  };

  const handleAutoSelect = async () => {
    setSelectedProvider('auto');
    const provider = await selectTileProvider();
    console.log('Auto-selected provider:', provider.name);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Map Tile Provider CORS Testing</h1>
        <p className="text-muted-foreground">
          Test different tile providers for CORS compatibility and performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Tile Provider Tests</CardTitle>
            <CardDescription>Validate CORS headers for each provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testAllProviders} 
              disabled={isTestingAll}
              className="w-full"
            >
              {isTestingAll ? 'Testing...' : 'Test All Providers'}
            </Button>
            
            <div className="space-y-2">
              {providerTests.map(test => (
                <div 
                  key={test.name} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{test.name}</p>
                    {test.responseTime && (
                      <p className="text-sm text-muted-foreground">
                        {test.responseTime.toFixed(0)}ms
                      </p>
                    )}
                    {test.error && (
                      <p className="text-xs text-red-500">{test.error}</p>
                    )}
                  </div>
                  <Badge variant={
                    test.status === 'success' ? 'default' :
                    test.status === 'failed' ? 'destructive' :
                    test.status === 'testing' ? 'secondary' :
                    'outline'
                  }>
                    {test.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Network Metrics</CardTitle>
            <CardDescription>Real-time tile loading statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Tiles Requested</p>
                <p className="text-2xl font-bold">{networkMetrics.tilesRequested}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiles Loaded</p>
                <p className="text-2xl font-bold text-green-600">
                  {networkMetrics.tilesLoaded}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiles Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {networkMetrics.tilesFailed}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CORS Errors</p>
                <p className="text-2xl font-bold text-orange-600">
                  {networkMetrics.corsErrors}
                </p>
              </div>
            </div>
            
            {networkMetrics.avgLoadTime > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Avg Load Time</p>
                <p className="text-lg font-semibold">
                  {networkMetrics.avgLoadTime.toFixed(2)}ms
                </p>
              </div>
            )}

            {networkMetrics.tilesRequested > 0 && (
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold">
                  {((networkMetrics.tilesLoaded / networkMetrics.tilesRequested) * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Selection</CardTitle>
            <CardDescription>Choose a tile provider for the map</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleAutoSelect}
              variant={selectedProvider === 'auto' ? 'default' : 'outline'}
              className="w-full"
            >
              Auto Select (Recommended)
            </Button>
            
            <Button 
              onClick={() => setSelectedProvider('stadia')}
              variant={selectedProvider === 'stadia' ? 'default' : 'outline'}
              className="w-full"
            >
              Force Stadia Maps
            </Button>
            
            <Button 
              onClick={() => setSelectedProvider('carto')}
              variant={selectedProvider === 'carto' ? 'default' : 'outline'}
              className="w-full"
            >
              Force Carto CDN
            </Button>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Current: <span className="font-medium">{selectedProvider}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Display */}
      <Card>
        <CardHeader>
          <CardTitle>Live Map Test</CardTitle>
          <CardDescription>
            Interactive map using the selected tile provider. Watch the console for any errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] w-full rounded-lg overflow-hidden border">
            <MapLibreWrapper mode="single" />
          </div>
        </CardContent>
      </Card>

      {/* Console Errors */}
      {consoleErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Console CORS Errors</CardTitle>
            <CardDescription>Captured CORS-related errors from the console</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {consoleErrors.map((error, index) => (
                <div key={index} className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Click "Test All Providers" to validate CORS headers for each tile provider</li>
            <li>Watch the Network Metrics to see tile loading performance in real-time</li>
            <li>Use Provider Selection to switch between different tile sources</li>
            <li>Interact with the map (pan, zoom) to trigger more tile loads</li>
            <li>Check Console CORS Errors section for any cross-origin issues</li>
            <li>Open browser DevTools Network tab for detailed request inspection</li>
          </ol>
          
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Expected Results:</p>
            <ul className="text-sm text-blue-600 dark:text-blue-400 mt-1 space-y-1">
              <li>✅ Stadia Maps - Should pass CORS validation</li>
              <li>✅ Carto CDN - Should pass CORS validation</li>
              <li>❌ OpenStreetMap - Expected to fail (no CORS headers)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}