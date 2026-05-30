type City = { name: string; lat: number; lng: number; country: string };

const cache = new Map<string, string | null>();
let citiesPromise: Promise<City[]> | null = null;

const COORD_RE = /Latitude, Longitude:\s*([\d.-]+),\s*([\d.-]+)/;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function loadCities(): Promise<City[]> {
   if (!citiesPromise) {
      citiesPromise = import("cities.json").then(({ default: raw }) =>
         raw.map((c) => ({
            name: c.name,
            lat: parseFloat(c.lat),
            lng: parseFloat(c.lng),
            country: c.country,
         }))
      );
   }
   return citiesPromise;
}

export async function geocodeLocation(
   rawLocation: string | null
): Promise<string | null> {
   if (!rawLocation) return null;

   if (cache.has(rawLocation)) return cache.get(rawLocation)!;

   const match = rawLocation.match(COORD_RE);
   if (!match) {
      cache.set(rawLocation, null);
      return null;
   }

   const lat = parseFloat(match[1]);
   const lng = parseFloat(match[2]);
   if (lat === 0 && lng === 0) {
      cache.set(rawLocation, null);
      return null;
   }
   const cities = await loadCities();

   let minDist = Infinity;
   let nearest: City | null = null;
   for (const city of cities) {
      const d = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
      if (d < minDist) {
         minDist = d;
         nearest = city;
      }
   }

   const result = nearest
      ? `${nearest.name}, ${regionNames.of(nearest.country) ?? nearest.country}`
      : null;

   cache.set(rawLocation, result);
   return result;
}
