/**
 * Official National Highways and Major Strategic Corridors of Jammu & Kashmir and Ladakh
 * Includes NH-44, NH-244, NH-1, NH-144A, Mughal Road, NH-501, and Leh-Manali Highway.
 */

export interface JKHighway {
  id: string;
  name: string;
  ref: string;
  type: 'national_highway' | 'expressway' | 'strategic_corridor';
  route: string;
  lengthKm: number;
  status: 'open' | 'partial' | 'closed';
  advisory: string;
  coordinates: [number, number][]; // Array of [longitude, latitude]
}

export const JK_NATIONAL_HIGHWAYS: JKHighway[] = [
  {
    id: 'nh-44',
    name: 'National Highway 44 (Kashmir–Jammu Lifeline)',
    ref: 'NH-44',
    type: 'national_highway',
    route: 'Lakhanpur – Kathua – Samba – Jammu – Udhampur – Chenani-Nashri – Ramban – Banihal – Qazigund – Anantnag – Awantipora – Srinagar',
    lengthKm: 295,
    status: 'partial',
    advisory: 'Intermittent shooting stones at Mehar-Cafeteria Morh (Ramban). Heavy convoys moving under strict traffic control.',
    coordinates: [
      [75.63, 32.37], // Lakhanpur (J&K border)
      [75.52, 32.38], // Kathua
      [75.12, 32.56], // Samba
      [74.95, 32.65], // Bari Brahmana
      [74.87, 32.73], // Jammu City
      [74.92, 32.84], // Jhajjar Kotli
      [75.02, 32.92], // Tikri
      [75.13, 32.93], // Udhampur
      [75.28, 33.04], // Chenani
      [75.31, 33.09], // Nashri Tunnel Portal
      [75.24, 33.15], // Batote Junction
      [75.24, 33.24], // Ramban / Maitra
      [75.20, 33.30], // Ramsu
      [75.20, 33.50], // Banihal / Qazigund Tunnel
      [75.17, 33.59], // Qazigund
      [75.15, 33.73], // Anantnag (Khanabal)
      [75.01, 33.92], // Awantipora
      [74.93, 34.02], // Pampore
      [74.80, 34.08], // Srinagar (Pantha Chowk)
    ],
  },
  {
    id: 'nh-244',
    name: 'National Highway 244 (Chenab Valley Corridor)',
    ref: 'NH-244',
    type: 'national_highway',
    route: 'Batote – Doda – Thathri – Kishtwar – Chhatroo – Sinthan Top – Daksum – Achabal – Khanabal (Anantnag)',
    lengthKm: 274,
    status: 'partial',
    advisory: 'Landslide clearance underway near Jakyas. Sinthan Top pass open for daytime 4x4 light vehicles only due to night frost.',
    coordinates: [
      [75.24, 33.15], // Batote (NH-44 Junction)
      [75.33, 33.12], // Baglihar Ridge
      [75.46, 33.13], // Assar
      [75.54, 33.14], // Doda City (Pul Doda)
      [75.60, 33.17], // Premnagar
      [75.72, 33.15], // Thathri
      [75.77, 33.25], // Kishtwar
      [75.68, 33.40], // Chhatroo
      [75.50, 33.57], // Sinthan Top Summit (3,748m)
      [75.38, 33.62], // Daksum
      [75.28, 33.68], // Kokernag
      [75.15, 33.73], // Khanabal (NH-44 Junction)
    ],
  },
  {
    id: 'nh-1',
    name: 'National Highway 1 (Srinagar–Kargil–Leh Highway)',
    ref: 'NH-1',
    type: 'national_highway',
    route: 'Srinagar – Ganderbal – Kangan – Sonamarg – Baltal – Zojila Pass – Drass – Kargil – Mulbekh – Namika La – Fotu La – Khaltsi – Leh',
    lengthKm: 422,
    status: 'open',
    advisory: 'Zojila Pass open for one-way convoy traffic. Heavy commercial vehicles restricted after 4:00 PM.',
    coordinates: [
      [74.80, 34.08], // Srinagar
      [74.78, 34.22], // Ganderbal
      [74.90, 34.26], // Kangan
      [75.18, 34.29], // Gund
      [75.29, 34.31], // Sonamarg
      [75.41, 34.32], // Baltal
      [75.49, 34.28], // Zojila Pass (3,528m)
      [75.59, 34.35], // Minamarg
      [75.76, 34.43], // Drass
      [76.13, 34.56], // Kargil
      [76.35, 34.38], // Mulbekh
      [76.45, 34.37], // Namika La (3,700m)
      [76.71, 34.28], // Fotu La (4,108m)
      [76.73, 34.32], // Lamayuru
      [76.88, 34.32], // Khaltsi
      [77.03, 34.28], // Saspol
      [77.18, 34.25], // Nimmu
      [77.58, 34.15], // Leh City
    ],
  },
  {
    id: 'mughal-road',
    name: 'Mughal Road (Historic Pir Panjal Corridor)',
    ref: 'Mughal Rd',
    type: 'strategic_corridor',
    route: 'Bafliaz (Poonch) – Posana – Peer Ki Gali – Dubjan – Heerpora – Shopian',
    lengthKm: 84,
    status: 'open',
    advisory: 'Open for light motor vehicles. Caution advised at Peer Ki Gali (3,485m) during evening hours due to icy patches.',
    coordinates: [
      [74.32, 33.60], // Bafliaz (Poonch)
      [74.40, 33.62], // Posana
      [74.52, 33.64], // Peer Ki Gali (3,485m)
      [74.63, 33.67], // Dubjan
      [74.73, 33.70], // Heerpora
      [74.83, 33.72], // Shopian City
    ],
  },
  {
    id: 'nh-144a',
    name: 'National Highway 144A (Jammu–Rajouri–Poonch Corridor)',
    ref: 'NH-144A',
    type: 'national_highway',
    route: 'Jammu – Akhnoor – Chowki Choura – Sunderbani – Nowshera – Rajouri – Bhimber Gali – Surankote – Poonch',
    lengthKm: 240,
    status: 'open',
    advisory: 'Normal vehicular movement on the newly four-laned Akhnoor-Poonch strategic corridor. Four-laning work near Sunderbani.',
    coordinates: [
      [74.87, 32.73], // Jammu City
      [74.74, 32.89], // Akhnoor
      [74.56, 32.99], // Chowki Choura
      [74.49, 33.04], // Sunderbani
      [74.24, 33.16], // Nowshera
      [74.30, 33.38], // Rajouri City
      [74.22, 33.50], // Bhimber Gali
      [74.26, 33.64], // Surankote
      [74.10, 33.77], // Poonch City
    ],
  },
  {
    id: 'nh-501',
    name: 'National Highway 501 (Baramulla–Kupwara–Uri Highway)',
    ref: 'NH-501',
    type: 'national_highway',
    route: 'Srinagar – Pattan – Sangrama – Baramulla – Sheeri – Uri (LOC Frontier)',
    lengthKm: 102,
    status: 'open',
    advisory: 'Clear and open for all traffic. High-speed surveillance operational.',
    coordinates: [
      [74.80, 34.08], // Srinagar
      [74.55, 34.16], // Pattan
      [74.45, 34.20], // Sangrama
      [74.35, 34.20], // Baramulla City
      [74.24, 34.18], // Sheeri
      [74.04, 34.08], // Uri Frontier
    ],
  },
  {
    id: 'nh-3',
    name: 'National Highway 3 (Leh–Manali Trans-Himalayan Highway)',
    ref: 'NH-3',
    type: 'national_highway',
    route: 'Leh – Karu – Upshi – Rumtse – Tanglang La – Debring – Pang – Sarchu – Baralacha La – Darcha – Keylong – Atal Tunnel',
    lengthKm: 428,
    status: 'open',
    advisory: 'Passable for high-ground-clearance vehicles. High mountain passes (Tanglang La 5,328m, Baralacha La 4,890m) require snow chains.',
    coordinates: [
      [77.58, 34.15], // Leh
      [77.72, 33.98], // Karu
      [77.81, 33.83], // Upshi
      [77.78, 33.60], // Rumtse
      [77.62, 33.51], // Tanglang La (5,328m)
      [77.53, 33.32], // Debring
      [77.57, 33.12], // Pang
      [77.58, 32.90], // Sarchu (Border)
    ],
  },
];

/**
 * Returns GeoJSON FeatureCollection for all National Highways
 */
export function getJKHighwaysGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: JK_NATIONAL_HIGHWAYS.map((hw) => ({
      type: 'Feature',
      id: hw.id,
      properties: {
        id: hw.id,
        name: hw.name,
        ref: hw.ref,
        type: hw.type,
        route: hw.route,
        lengthKm: hw.lengthKm,
        status: hw.status,
        advisory: hw.advisory,
      },
      geometry: {
        type: 'LineString',
        coordinates: hw.coordinates,
      },
    })),
  };
}
