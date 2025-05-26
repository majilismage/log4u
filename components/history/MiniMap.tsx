import React from 'react';

interface MiniMapProps {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

const MiniMap: React.FC<MiniMapProps> = ({ startLat, startLng, endLat, endLng }) => {
  // Construct the URL for the OpenStreetMap static image
  // Example: https://static-maps.yandex.ru/1.x/?lang=en-US&ll=37.620393,55.753960&z=10&l=map&pt=37.620393,55.753960,pm2rdm~37.640393,55.763960,pm2blm
  // We will use a simpler version from a different provider if available, or stick to basics.
  // For OpenStreetMap, a common pattern is to use a service that renders static maps.
  // Let's use a simple marker and line approach.
  // Format: https://render.openstreetmap.org/cgi-bin/export?bbox=minLng,minLat,maxLng,maxLat&scale=...&layer=mapnik
  // A more direct way for markers and paths:
  // https://staticmap.openstreetmap.de/staticmap.php?center=Y,X&zoom=Z&size=WxH&maptype=M&markers=lat,lon,type|lat,lon,type&path=color:0xRRGGBB,weight:W|lat,lon|lat,lon...

  // Determine bounding box for auto-zoom, or pick a fixed zoom level.
  // For simplicity, we'll use a fixed zoom and center between the two points.
  // However, a more robust solution would calculate the bounding box.

  const centerLat = (startLat + endLat) / 2;
  const centerLng = (startLng + endLng) / 2;
  const zoom = 5; // Adjust zoom level as needed
  const width = 300; // Width of the map image
  const height = 200; // Height of the map image

  // Marker format: lon,lat,icon_color (e.g., -0.1278,51.5074,blue)
  // Path format: color:0xRRGGBBAA,weight:W|lon1,lat1|lon2,lat2
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${startLng},${startLat},ol-marker-green|${endLng},${endLat},ol-marker-red&path=color:0x0000ff,weight:3|${startLng},${startLat}|${endLng},${endLat}`;

  return (
    <div className="p-2 bg-slate-50 dark:bg-neutral-700/50 rounded-md shadow-sm">
      <img
        src={staticMapUrl}
        alt={`Map from ${startLat.toFixed(2)},${startLng.toFixed(2)} to ${endLat.toFixed(2)},${endLng.toFixed(2)}`}
        width={width}
        height={height}
        className="rounded"
      />
    </div>
  );
};

export default MiniMap; 