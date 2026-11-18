/**
 * Live Open-Source Weather & Regional Environmental Telemetry Service
 * Powered by Open-Meteo (open-meteo.com) - 100% Free, Open-Source, No API Key Required
 */

export interface RegionalStationWeather {
  station_id: 'srinagar' | 'jammu' | 'doda' | 'ramban' | 'kishtwar' | 'poonch' | 'rajouri' | 'leh' | 'kargil' | string;
  name: string;
  district?: string;
  districtSlug?: string;
  region: string;
  elevation: string;
  coordinates?: string;
  temp_c: number;
  wind_kph: number;
  weather_desc: string;
  is_day: boolean;
  status: 'optimal' | 'moderate' | 'harsh';
}

export const REGIONAL_STATIONS: {
  id: RegionalStationWeather['station_id'];
  name: string;
  district: string;
  districtSlug: string;
  region: string;
  lat: number;
  lon: number;
  elevation: string;
  coordinates: string;
  fallbackTemp: number;
}[] = [
  {
    id: 'srinagar',
    name: 'Srinagar Central Station',
    district: 'Srinagar',
    districtSlug: 'srinagar',
    region: 'Kashmir Valley',
    lat: 34.08,
    lon: 74.80,
    elevation: '1,585m',
    coordinates: '34.0837° N, 74.7973° E',
    fallbackTemp: 14.5,
  },
  {
    id: 'doda',
    name: 'Doda Chenab Gorge Hub',
    district: 'Doda',
    districtSlug: 'doda',
    region: 'Chenab Valley',
    lat: 33.14,
    lon: 75.54,
    elevation: '1,107m',
    coordinates: '33.1448° N, 75.5458° E',
    fallbackTemp: 15.2,
  },
  {
    id: 'ramban',
    name: 'Ramban Panthyal Transit Node',
    district: 'Ramban',
    districtSlug: 'ramban',
    region: 'Chenab Valley',
    lat: 33.24,
    lon: 75.24,
    elevation: '1,156m',
    coordinates: '33.2415° N, 75.2419° E',
    fallbackTemp: 16.0,
  },
  {
    id: 'jammu',
    name: 'Jammu Tawi Observatory',
    district: 'Jammu',
    districtSlug: 'jammu',
    region: 'Jammu Plains',
    lat: 32.73,
    lon: 74.86,
    elevation: '327m',
    coordinates: '32.7266° N, 74.8570° E',
    fallbackTemp: 24.2,
  },
  {
    id: 'poonch',
    name: 'Poonch Pir Panjal Station',
    district: 'Poonch',
    districtSlug: 'poonch',
    region: 'Pir Panjal',
    lat: 33.77,
    lon: 74.09,
    elevation: '1,021m',
    coordinates: '33.7667° N, 74.0922° E',
    fallbackTemp: 16.8,
  },
  {
    id: 'rajouri',
    name: 'Rajouri Frontier Observatory',
    district: 'Rajouri',
    districtSlug: 'rajouri',
    region: 'Pir Panjal',
    lat: 33.38,
    lon: 74.30,
    elevation: '915m',
    coordinates: '33.3812° N, 74.3056° E',
    fallbackTemp: 18.5,
  },
  {
    id: 'kishtwar',
    name: 'Kishtwar High-Altitude Radar',
    district: 'Kishtwar',
    districtSlug: 'kishtwar',
    region: 'Chenab Valley',
    lat: 33.31,
    lon: 75.76,
    elevation: '1,638m',
    coordinates: '33.3128° N, 75.7663° E',
    fallbackTemp: 12.8,
  },
  {
    id: 'leh',
    name: 'Leh Trans-Himalayan Station',
    district: 'Leh',
    districtSlug: 'leh',
    region: 'Leh & Ladakh',
    lat: 34.15,
    lon: 77.58,
    elevation: '3,524m',
    coordinates: '34.1526° N, 77.5771° E',
    fallbackTemp: 1.5,
  },
  {
    id: 'kargil',
    name: 'Kargil Suru Valley Station',
    district: 'Kargil',
    districtSlug: 'kargil',
    region: 'Leh & Ladakh',
    lat: 34.56,
    lon: 76.13,
    elevation: '2,676m',
    coordinates: '34.5539° N, 76.1349° E',
    fallbackTemp: 4.8,
  },
];

function weatherCodeToDesc(code: number, stationId?: string, temp?: number): string {
  if (code === 0) {
    if (temp !== undefined && temp <= 0) return 'Sub-zero Freeze';
    if (temp !== undefined && temp <= 6) return 'Crisp & Sunny';
    if (stationId === 'leh' || stationId === 'kargil') return 'Alpine Sunshine';
    if (stationId === 'jammu') return 'Clear & Mild';
    if (stationId === 'srinagar') return 'Clear Valley Sun';
    if (stationId === 'doda' || stationId === 'kishtwar') return 'Highland Clear';
    return 'Clear & Crisp';
  }
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

function getFallbackWeatherList(): RegionalStationWeather[] {
  const fallbackConditions: Record<string, { temp: number; desc: string; status: RegionalStationWeather['status'] }> = {
    srinagar: { temp: 8.4, desc: 'Crisp Valley Sun', status: 'optimal' },
    doda: { temp: 11.2, desc: 'Highland Clear', status: 'optimal' },
    ramban: { temp: 12.8, desc: 'Mild & Sunny', status: 'optimal' },
    jammu: { temp: 21.4, desc: 'Clear & Mild', status: 'optimal' },
    poonch: { temp: 13.5, desc: 'Crisp & Sunny', status: 'optimal' },
    rajouri: { temp: 15.0, desc: 'Sunny & Dry', status: 'optimal' },
    kishtwar: { temp: 6.8, desc: 'Alpine Chill', status: 'moderate' },
    leh: { temp: -2.4, desc: 'Sub-zero Freeze', status: 'harsh' },
    kargil: { temp: 0.8, desc: 'Glacial Chill', status: 'harsh' },
  };

  return REGIONAL_STATIONS.map((st) => {
    const custom = fallbackConditions[st.id] || { temp: st.fallbackTemp, desc: 'Clear & Crisp', status: 'optimal' as const };
    return {
      station_id: st.id,
      name: st.name,
      district: st.district,
      districtSlug: st.districtSlug,
      region: st.region,
      elevation: st.elevation,
      coordinates: st.coordinates,
      temp_c: custom.temp,
      wind_kph: 5.0,
      weather_desc: custom.desc,
      is_day: true,
      status: custom.status,
    };
  });
}

let cachedWeather: RegionalStationWeather[] | null = null;
let lastWeatherFetchTime = 0;
let isFetchingWeather = false;
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes in-memory cache

async function refreshWeatherInBackground(): Promise<void> {
  if (isFetchingWeather) return;
  isFetchingWeather = true;

  try {
    const weatherPromises = REGIONAL_STATIONS.map(async (st) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${st.lat}&longitude=${st.lon}&current_weather=true`;
        const res = await fetch(url, {
          next: { revalidate: 600 },
          headers: { 'User-Agent': 'KJCPL-Regional-Telemetry/1.0' },
          signal: AbortSignal.timeout(3500),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const cur = data.current_weather;
        const temp = typeof cur?.temperature === 'number' ? cur.temperature : st.fallbackTemp;
        const wind = typeof cur?.windspeed === 'number' ? cur.windspeed : 4.5;
        const desc = weatherCodeToDesc(cur?.weathercode ?? 0, st.id, temp);
        const isDay = cur?.is_day === 1;

        const status: RegionalStationWeather['status'] =
          temp <= 0 ? 'harsh' : temp > 35 ? 'moderate' : 'optimal';

        return {
          station_id: st.id,
          name: st.name,
          district: st.district,
          districtSlug: st.districtSlug,
          region: st.region,
          elevation: st.elevation,
          coordinates: st.coordinates,
          temp_c: Math.round(temp * 10) / 10,
          wind_kph: Math.round(wind * 10) / 10,
          weather_desc: desc,
          is_day: isDay,
          status,
        };
      } catch {
        return {
          station_id: st.id,
          name: st.name,
          district: st.district,
          districtSlug: st.districtSlug,
          region: st.region,
          elevation: st.elevation,
          coordinates: st.coordinates,
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
  } catch {
    // Keep existing
  } finally {
    isFetchingWeather = false;
  }
}

export async function getRegionalWeather(): Promise<RegionalStationWeather[]> {
  const now = Date.now();
  if (cachedWeather && now - lastWeatherFetchTime < WEATHER_CACHE_TTL_MS) {
    return cachedWeather;
  }

  // Trigger non-blocking background refresh
  refreshWeatherInBackground().catch(() => {});

  if (cachedWeather && cachedWeather.length > 0) {
    return cachedWeather;
  }

  return getFallbackWeatherList();
}
