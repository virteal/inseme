/**
 * Parses a string input to extract location data (lat, lng, name).
 * Supports:
 * - Google Maps "place" URLs
 * - OpenStreetMap URLs
 * - Geo URIs
 * - Apple/Bing/Waze URLs
 * - DMS coordinates
 * - "lat, lng" strings
 *
 * @param {string} input - The input string to parse.
 * @param {object} [options] - Optional configuration.
 * @param {object} [options.center] - Default center { lat, lng } to check distance against.
 * @param {number} [options.maxDistanceKm=200] - Maximum allowed distance in km from center.
 * @returns {object|null} - Returns { lat, lng, name, zoom } or null if not parsed or too far.
 */
export function parseLocationInput(input, options = {}) {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  let result = null;

  // Helper to calculate distance in km
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // 1. Try parsing as "lat, lng"
  const latLngRegex =
    /^-?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*-?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  if (!trimmed.startsWith("http") && !trimmed.startsWith("geo:") && latLngRegex.test(trimmed)) {
    const [latStr, lngStr] = trimmed.split(",").map((s) => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      result = { lat, lng, name: `${lat}, ${lng}`, zoom: 16 };
    }
  }

  // 2. DMS Coordinates (Degrees Minutes Seconds)
  // Example: 42° 18' 23.0" N 9° 08' 55.1" E
  if (!result) {
    const dmsRegex =
      /(\d+)°\s*(\d+)'\s*(\d+(\.\d+)?)"\s*([NS])\s*,?\s*(\d+)°\s*(\d+)'\s*(\d+(\.\d+)?)"\s*([EW])/i;
    const dmsMatch = trimmed.match(dmsRegex);
    if (dmsMatch) {
      const parseDMS = (deg, min, sec, dir) => {
        let dd = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
        if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") {
          dd = dd * -1;
        }
        return dd;
      };
      const lat = parseDMS(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[5]);
      const lng = parseDMS(dmsMatch[6], dmsMatch[7], dmsMatch[8], dmsMatch[10]);
      result = { lat, lng, name: trimmed, zoom: 16 };
    }
  }

  // 3. Geo URI
  // Example: geo:42.30640,9.14863
  if (!result && trimmed.startsWith("geo:")) {
    const matches = trimmed.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (matches) {
      result = {
        lat: parseFloat(matches[1]),
        lng: parseFloat(matches[2]),
        name: "Geo URI",
        zoom: 16,
      };
    }
  }

  // 4. Google Maps URLs
  if (!result && trimmed.includes("google.com/maps")) {
    const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    let lat = null;
    let lng = null;
    let zoom = 15;

    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }

    const placeMatch = trimmed.match(/\/place\/([^/]+)\//);
    let name = "Emplacement partagé";
    if (placeMatch) {
      try {
        name = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      } catch (e) {
        name = placeMatch[1].replace(/\+/g, " ");
      }
    } else if (lat && lng) {
      name = `Repère placé (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    }

    if (lat !== null && lng !== null) {
      result = { lat, lng, name, zoom };
    }
  }

  // 5. OpenStreetMap
  if (!result && trimmed.includes("openstreetmap.org")) {
    // Try mlat/mlon params first
    const mlatMatch = trimmed.match(/mlat=(-?\d+\.\d+)/);
    const mlonMatch = trimmed.match(/mlon=(-?\d+\.\d+)/);
    if (mlatMatch && mlonMatch) {
      result = {
        lat: parseFloat(mlatMatch[1]),
        lng: parseFloat(mlonMatch[1]),
        name: "OpenStreetMap Location",
        zoom: 16,
      };
    } else {
      // Try hash params #map=zoom/lat/lng
      const mapMatch = trimmed.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
      if (mapMatch) {
        result = {
          lat: parseFloat(mapMatch[1]),
          lng: parseFloat(mapMatch[2]),
          name: "OpenStreetMap Location",
          zoom: 16,
        };
      }
    }
  }

  // 6. Apple Maps
  if (!result && trimmed.includes("maps.apple.com")) {
    const llMatch = trimmed.match(/[?&](ll|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) {
      result = {
        lat: parseFloat(llMatch[2]),
        lng: parseFloat(llMatch[3]),
        name: "Apple Maps Location",
        zoom: 16,
      };
    }
  }

  // 7. Bing Maps
  if (!result && trimmed.includes("bing.com/maps")) {
    const cpMatch = trimmed.match(/[?&]cp=(-?\d+\.\d+)~(-?\d+\.\d+)/);
    if (cpMatch) {
      result = {
        lat: parseFloat(cpMatch[1]),
        lng: parseFloat(cpMatch[2]),
        name: "Bing Maps Location",
        zoom: 16,
      };
    }
  }

  // 8. Waze
  if (!result && trimmed.includes("waze.com")) {
    const llMatch = trimmed.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llMatch) {
      result = {
        lat: parseFloat(llMatch[1]),
        lng: parseFloat(llMatch[2]),
        name: "Waze Location",
        zoom: 16,
      };
    }
  }

  // Validation: Check distance from center if provided
  if (result && options.center && options.center.lat && options.center.lng) {
    const maxDist = options.maxDistanceKm || 200;
    const dist = getDistanceFromLatLonInKm(
      options.center.lat,
      options.center.lng,
      result.lat,
      result.lng
    );
    if (dist > maxDist) {
      console.warn(`Location rejected: ${dist.toFixed(2)}km from center (max ${maxDist}km)`);
      return null;
    }
  }

  return result;
}
