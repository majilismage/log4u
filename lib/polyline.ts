/**
 * Google Encoded Polyline encoder/decoder.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

export function encodePolyline(coordinates: [number, number][]): string {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coordinates) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    output += encodeValue(latE5 - prevLat);
    output += encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }

  return output;
}

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const [dLat, newIndex1] = decodeValue(encoded, index);
    index = newIndex1;
    const [dLng, newIndex2] = decodeValue(encoded, index);
    index = newIndex2;

    lat += dLat;
    lng += dLng;
    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let output = '';
  while (v >= 0x20) {
    output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  output += String.fromCharCode(v + 63);
  return output;
}

function decodeValue(encoded: string, index: number): [number, number] {
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return [result & 1 ? ~(result >> 1) : result >> 1, index];
}
