/**
 * Live Open-Source Weather & Regional Environmental Telemetry Service
 * Powered by Open-Meteo (open-meteo.com) - 100% Free, Open-Source, No API Key Required
 */

export interface RegionalStationWeather {
  station_id: 'srinagar' | 'jammu' | 'doda' | 'poonch' | 'leh';
  name: string;
  region: string;
  elevation: string;
  temp_c: number;
  wind_kph: number;
  weather_desc: string;
  is_day: boolean;
  status: 'optimal' | 'moderate' | 'harsh';
}

const REGIONAL_STATIONS: {
  id: RegionalStationWeather['station_id'];
  name: string;
  region: string;
  lat: number;
  lon: number;
  elevation: string;
  fallbackTemp: number;
}[] = [
  { id: 'srinagar', name: 'Srinagar Station', region: 'Kashmir Valley', lat: 34.08, lon: 74.80, elevation: '1,585m', fallbackTemp: 14.5 },
  { id: 'jammu', name: 'Jammu Tawi Observatory', region: 'Jammu Plains', lat: 32.73, lon: 74.86, elevation: '327m', fallbackTemp: 24.2 },
  { id: 'doda', name: 'Kishtwar / Doda Gorge', region: 'Chenab Valley', lat: 33.14, lon: 75.77, elevation: '1,638m', fallbackTemp: 12.0 },
  { id: 'poonch', name: 'Pir Panjal Foothills', region: 'Pir Panjal', lat: 33.77, lon: 74.09, elevation: '1,021m', fallbackTemp: 16.0 },
  { id: 'leh', name: 'Leh Plateau Station', region: 'Leh & Ladakh', lat: 34.15, lon: 77.58, elevation: '3,524m', fallbackTemp: -1.5 },
];

function weatherCodeToDesc(code: number): string {
  if (code === 0) return 'Clear Skies';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Mountain Fog';
  if (code >= 51 && code <= 65) return 'Rain / Drizzle';
  if (code >= 71 && code <= 77) return 'Snow Flurries';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 85 && code <= 86) return 'Snow Showers';
  if (code >= 95) return 'Severe Thunderstorm';
  return 'Stable';
}

let cachedWeather: RegionalStationWeather[] | null = null;
let lastWeatherFetchTime = 0;
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

export async function getRegionalWeather(): Promise<RegionalStationWeather[]> {
  const now = Date.now();
  if (cachedWeather && now - lastWeatherFetchTime < WEATHER_CACHE_TTL_MS) {
    return cachedWeather;
  }

  try {
    const weatherPromises = REGIONAL_STATIONS.map(async (st) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}&current_weather=true`;
        const res = await fetch(url, {
          next: { revalidate: 300 }, // Cache for 5 minutes
          headers: { 'User-Agent': 'KJIN-Regional-Telemetry/1.0' },
          signal: AbortSignal.timeout(1200), // Fast 1.2s timeout to avoid blocking page renders
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const cur = data.current_weather;
        const temp = typeof cur?.temperature === 'number' ? cur.temperature : st.fallbackTemp;
        const wind = typeof cur?.windspeed === 'number' ? cur.windspeed : 4.5;
        const desc = weatherCodeToDesc(cur?.weathercode ?? 0);
        const isDay = cur?.is_day === 1;

        const status: RegionalStationWeather['status'] =
          temp <= 0 ? 'harsh' : temp > 35 ? 'moderate' : 'optimal';

        return {
          station_id: st.id,
          name: st.name,
          region: st.region,
          elevation: st.elevation,
          temp_c: Math.round(temp * 10) / 10,
          wind_kph: Math.round(wind * 10) / 10,
          weather_desc: desc,
          is_day: isDay,
          status,
        };
      } catch {
        // Safe fallback if network is offline
        return {
          station_id: st.id,
          name: st.name,
          region: st.region,
          elevation: st.elevation,
          temp_c: st.fallbackTemp,
          wind_kph: 5.0,
          weather_desc: 'Station Active',
          is_day: true,
          status: 'optimal' as const,
        };
      }
    });

    const results = await Promise.all(weatherPromises);
    cachedWeather = results;
    lastWeatherFetchTime = Date.now();
    return results;
  } catch (err) {
    console.warn('[Weather] Regional telemetry fallback triggered:', err);
    if (cachedWeather) return cachedWeather;
    return REGIONAL_STATIONS.map((st) => ({
      station_id: st.id,
      name: st.name,
      region: st.region,
      elevation: st.elevation,
      temp_c: st.fallbackTemp,
      wind_kph: 5.0,
      weather_desc: 'Operational',
      is_day: true,
      status: 'optimal' as const,
    }));
  }
}
