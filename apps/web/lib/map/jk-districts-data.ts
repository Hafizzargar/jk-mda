export interface DistrictCivicIssue {
  id: string;
  title: string;
  category: 'water' | 'road' | 'power' | 'healthcare' | 'landslide' | 'flood';
  severity: 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'resolved';
  location: string;
  updatedAgo: string;
}

export interface DistrictProject {
  id: string;
  title: string;
  agency: string;
  budget?: string;
  status: 'ongoing' | 'approved' | 'completed';
  completion: number;
}

export interface DistrictWeather {
  temp: number;
  condition: string;
  high: number;
  low: number;
  precipitation?: string;
}

export interface JKDistrictMetadata {
  id: string;
  name: string;
  division: string;
  divisionKey: 'chenab-valley' | 'kashmir' | 'jammu' | 'pir-panjal' | 'leh';
  color: string;
  glowColor: string;
  center: [number, number]; // [lng, lat]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  image: string;
  headquarters: string;
  elevation: string;
  majorRoads: string[];
  stats: {
    newsCount: number;
    problemsCount: number;
    projectsCount: number;
    alertsCount: number;
  };
  trendingTopics: string[];
  weather: DistrictWeather;
  topIssues: DistrictCivicIssue[];
  projects: DistrictProject[];
}

export interface JKDistrictGeoFeature {
  type: 'Feature';
  id: string;
  properties: JKDistrictMetadata;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface JKDistrictGeoCollection {
  type: 'FeatureCollection';
  features: JKDistrictGeoFeature[];
}

// 22 Districts Data for J&K and Ladakh
export const JK_DISTRICTS_DATA: Record<string, JKDistrictMetadata> = {
  doda: {
    id: 'doda',
    name: 'Doda',
    division: 'Chenab Valley',
    divisionKey: 'chenab-valley',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.7)',
    center: [75.54, 33.14],
    bbox: [75.25, 32.88, 75.95, 33.45],
    image: '/districts/doda.jpg',
    headquarters: 'Doda City',
    elevation: '1,107 m (3,632 ft)',
    majorRoads: ['NH-244 (Batote-Kishtwar)', 'Doda-Bhadarwah Road', 'Pul Doda Highway'],
    stats: {
      newsCount: 12,
      problemsCount: 4,
      projectsCount: 3,
      alertsCount: 2,
    },
    trendingTopics: ['Road Restoration', 'Water Supply', 'Tourism in Bhadarwah', 'Horticulture'],
    weather: {
      temp: 14,
      condition: 'Partly Cloudy',
      high: 18,
      low: 8,
      precipitation: '15%',
    },
    topIssues: [
      {
        id: 'iss-doda-1',
        title: 'Road damage & subsidence near Jakyas corridor on NH-244',
        category: 'road',
        severity: 'high',
        status: 'active',
        location: 'Jakyas - Bhaderwah link',
        updatedAgo: '2h ago',
      },
      {
        id: 'iss-doda-2',
        title: 'Irregular drinking water supply in rural Bhadarwah hamlets',
        category: 'water',
        severity: 'medium',
        status: 'investigating',
        location: 'Bhadarwah rural blocks',
        updatedAgo: '4h ago',
      },
      {
        id: 'iss-doda-3',
        title: 'Frequent high-altitude landslide risk at Batote-Kishtwar highway',
        category: 'landslide',
        severity: 'high',
        status: 'active',
        location: 'Assar & Khellani stretch',
        updatedAgo: '6h ago',
      },
      {
        id: 'iss-doda-4',
        title: 'Shortage of specialized medical officers at District Hospital Doda',
        category: 'healthcare',
        severity: 'medium',
        status: 'active',
        location: 'Doda HQ',
        updatedAgo: '1d ago',
      },
    ],
    projects: [
      {
        id: 'proj-doda-1',
        title: 'Sudh Mahadev - Dranga - Khellani Tunnel Bypass',
        agency: 'NHIDCL',
        budget: '₹2,100 Cr',
        status: 'ongoing',
        completion: 68,
      },
      {
        id: 'proj-doda-2',
        title: 'Bhadarwah Eco-Tourism & Lavender Processing Cluster',
        agency: 'CSIR-IIIM / Tourism Dept',
        budget: '₹45 Cr',
        status: 'ongoing',
        completion: 82,
      },
      {
        id: 'proj-doda-3',
        title: 'High-Altitude Jal Jeevan Mission Gravity Feeder Lines',
        agency: 'Jal Shakti Department',
        budget: '₹120 Cr',
        status: 'ongoing',
        completion: 55,
      },
    ],
  },

  kishtwar: {
    id: 'kishtwar',
    name: 'Kishtwar',
    division: 'Chenab Valley',
    divisionKey: 'chenab-valley',
    color: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.7)',
    center: [75.76, 33.31],
    bbox: [75.40, 33.00, 76.40, 33.90],
    image: '/districts/doda.jpg',
    headquarters: 'Kishtwar Town',
    elevation: '1,638 m (5,374 ft)',
    majorRoads: ['NH-244', 'Sinthan Top Pass Road', 'Paddar-Machail Road'],
    stats: {
      newsCount: 8,
      problemsCount: 3,
      projectsCount: 4,
      alertsCount: 1,
    },
    trendingTopics: ['Hydroelectric Projects', 'Sinthan Pass Clearance', 'Machail Yatra Route'],
    weather: {
      temp: 11,
      condition: 'Clear Sky',
      high: 16,
      low: 5,
    },
    topIssues: [
      {
        id: 'iss-kishtwar-1',
        title: 'Sinthan Top high altitude pass slippery due to sudden frost',
        category: 'road',
        severity: 'high',
        status: 'active',
        location: 'Sinthan Pass Summit (3,748m)',
        updatedAgo: '1h ago',
      },
      {
        id: 'iss-kishtwar-2',
        title: 'Delayed compensation claims for hydro transmission line corridor',
        category: 'power',
        severity: 'medium',
        status: 'investigating',
        location: 'Paku Dul stretch',
        updatedAgo: '1d ago',
      },
    ],
    projects: [
      {
        id: 'proj-kishtwar-1',
        title: '1,000 MW Pakal Dul Hydroelectric Project',
        agency: 'CVPPPL',
        budget: '₹8,112 Cr',
        status: 'ongoing',
        completion: 72,
      },
      {
        id: 'proj-kishtwar-2',
        title: 'Vailoo - Sinthan Top Tunnel Pre-feasibility',
        agency: 'NHIDCL',
        budget: '₹4,500 Cr',
        status: 'approved',
        completion: 20,
      },
    ],
  },

  ramban: {
    id: 'ramban',
    name: 'Ramban',
    division: 'Chenab Valley',
    divisionKey: 'chenab-valley',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.7)',
    center: [75.24, 33.24],
    bbox: [75.00, 33.05, 75.45, 33.45],
    image: '/districts/doda.jpg',
    headquarters: 'Ramban',
    elevation: '1,156 m (3,793 ft)',
    majorRoads: ['NH-44 (Jammu-Srinagar Highway)', 'Banihal Qazigund Tunnel Road'],
    stats: {
      newsCount: 14,
      problemsCount: 5,
      projectsCount: 2,
      alertsCount: 3,
    },
    trendingTopics: ['NH-44 Convoys', 'Panthyal Tunnel', 'USBRL Rail Link'],
    weather: {
      temp: 15,
      condition: 'Sunny',
      high: 20,
      low: 10,
    },
    topIssues: [
      {
        id: 'iss-ramban-1',
        title: 'Shooting stones risk between Mehar and Cafeteria Morh on NH-44',
        category: 'landslide',
        severity: 'high',
        status: 'active',
        location: 'Mehar-Cafeteria Stretch',
        updatedAgo: '30m ago',
      },
    ],
    projects: [
      {
        id: 'proj-ramban-1',
        title: 'T-5 & Panthyal Bypasses 4-Laning',
        agency: 'NHAI',
        budget: '₹1,800 Cr',
        status: 'ongoing',
        completion: 94,
      },
    ],
  },

  srinagar: {
    id: 'srinagar',
    name: 'Srinagar',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.79, 34.08],
    bbox: [74.65, 33.95, 74.98, 34.22],
    image: '/districts/srinagar.jpg',
    headquarters: 'Srinagar City',
    elevation: '1,585 m (5,200 ft)',
    majorRoads: ['NH-1 (Srinagar-Baramulla)', 'Boulevard Road', 'Bypass Highway NH-44'],
    stats: {
      newsCount: 28,
      problemsCount: 6,
      projectsCount: 5,
      alertsCount: 1,
    },
    trendingTopics: ['Smart City Projects', 'Dal Lake Conservation', 'Downtown Traffic Revamp'],
    weather: {
      temp: 16,
      condition: 'Sunny',
      high: 21,
      low: 7,
    },
    topIssues: [
      {
        id: 'iss-srinagar-1',
        title: 'Commercial drainage overflow in Batamaloo & Hari Singh High Street',
        category: 'water',
        severity: 'medium',
        status: 'investigating',
        location: 'Batamaloo Market',
        updatedAgo: '3h ago',
      },
    ],
    projects: [
      {
        id: 'proj-srinagar-1',
        title: 'Srinagar Smart City Water Metro & River Front Regeneration',
        agency: 'SSCL',
        budget: '₹980 Cr',
        status: 'ongoing',
        completion: 85,
      },
    ],
  },

  anantnag: {
    id: 'anantnag',
    name: 'Anantnag',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [75.15, 33.73],
    bbox: [74.95, 33.45, 75.45, 33.95],
    image: '/districts/kashmir.jpg',
    headquarters: 'Anantnag Town',
    elevation: '1,600 m (5,249 ft)',
    majorRoads: ['NH-44', 'Anantnag-Pahalgam Highway', 'Kulgam-Anantnag Link'],
    stats: {
      newsCount: 15,
      problemsCount: 4,
      projectsCount: 3,
      alertsCount: 1,
    },
    trendingTopics: ['Pahalgam Eco Tourism', 'Apple Mandi Dispatches', 'Lidder River Water Health'],
    weather: {
      temp: 15,
      condition: 'Partly Cloudy',
      high: 19,
      low: 6,
    },
    topIssues: [
      {
        id: 'iss-anantnag-1',
        title: 'Congestion on NH-44 approach road during peak apple dispatch hours',
        category: 'road',
        severity: 'medium',
        status: 'active',
        location: 'Bijbehara Fruit Mandi',
        updatedAgo: '4h ago',
      },
    ],
    projects: [
      {
        id: 'proj-anantnag-1',
        title: 'Pahalgam Tourist Circuit Infrastructure Augmentation',
        agency: 'Tourism Dept',
        budget: '₹85 Cr',
        status: 'ongoing',
        completion: 78,
      },
    ],
  },

  baramulla: {
    id: 'baramulla',
    name: 'Baramulla',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.36, 34.20],
    bbox: [74.05, 33.95, 74.65, 34.45],
    image: '/districts/kashmir.jpg',
    headquarters: 'Baramulla',
    elevation: '1,593 m (5,226 ft)',
    majorRoads: ['NH-1', 'Tangmarg-Gulmarg Road', 'Sopore Bypass'],
    stats: {
      newsCount: 18,
      problemsCount: 3,
      projectsCount: 4,
      alertsCount: 1,
    },
    trendingTopics: ['Gulmarg Gondola Winter Prep', 'Sopore Apple Trade', 'Jhelum Dredging'],
    weather: {
      temp: 14,
      condition: 'Clear',
      high: 19,
      low: 5,
    },
    topIssues: [],
    projects: [],
  },

  budgam: {
    id: 'budgam',
    name: 'Budgam',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.65, 33.95],
    bbox: [74.45, 33.80, 74.85, 34.10],
    image: '/districts/kashmir.jpg',
    headquarters: 'Budgam',
    elevation: '1,610 m',
    majorRoads: ['Srinagar Airport Road', 'Doodhpathri Link Road', 'Yusmarg Highway'],
    stats: { newsCount: 10, problemsCount: 2, projectsCount: 2, alertsCount: 0 },
    trendingTopics: ['Doodhpathri Eco Development', 'Airport Expansion'],
    weather: { temp: 15, condition: 'Sunny', high: 20, low: 6 },
    topIssues: [],
    projects: [],
  },

  bandipora: {
    id: 'bandipora',
    name: 'Bandipora',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.64, 34.42],
    bbox: [74.40, 34.25, 74.90, 34.65],
    image: '/districts/kashmir.jpg',
    headquarters: 'Bandipora',
    elevation: '1,578 m',
    majorRoads: ['Bandipora-Gurez Road (Razdan Pass)', 'Sopore-Bandipora Road'],
    stats: { newsCount: 7, problemsCount: 2, projectsCount: 1, alertsCount: 1 },
    trendingTopics: ['Razdan Pass Telemetry', 'Gurez Border Tourism', 'Wular Lake Dredging'],
    weather: { temp: 13, condition: 'Clear', high: 18, low: 4 },
    topIssues: [],
    projects: [],
  },

  ganderbal: {
    id: 'ganderbal',
    name: 'Ganderbal',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.77, 34.22],
    bbox: [74.65, 34.15, 75.35, 34.45],
    image: '/districts/kashmir.jpg',
    headquarters: 'Ganderbal',
    elevation: '1,619 m',
    majorRoads: ['NH-1D (Srinagar-Leh Highway)', 'Kangan-Sonamarg Highway'],
    stats: { newsCount: 11, problemsCount: 3, projectsCount: 3, alertsCount: 1 },
    trendingTopics: ['Z-Morh Tunnel Operations', 'Sonamarg Winter Sports', 'Sindh River Canal'],
    weather: { temp: 12, condition: 'Cool', high: 17, low: 3 },
    topIssues: [],
    projects: [],
  },

  kulgam: {
    id: 'kulgam',
    name: 'Kulgam',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [75.02, 33.64],
    bbox: [74.80, 33.45, 75.15, 33.75],
    image: '/districts/kashmir.jpg',
    headquarters: 'Kulgam',
    elevation: '1,739 m',
    majorRoads: ['Kulgam-Anantnag Road', 'Aharbal Tourist Road'],
    stats: { newsCount: 6, problemsCount: 2, projectsCount: 1, alertsCount: 0 },
    trendingTopics: ['Aharbal Waterfall Tourism', 'Horticulture Subsidies'],
    weather: { temp: 14, condition: 'Clear', high: 18, low: 5 },
    topIssues: [],
    projects: [],
  },

  kupwara: {
    id: 'kupwara',
    name: 'Kupwara',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.25, 34.53],
    bbox: [73.90, 34.25, 74.50, 34.80],
    image: '/districts/kashmir.jpg',
    headquarters: 'Kupwara',
    elevation: '1,615 m',
    majorRoads: ['Kupwara-Tangdhar (Sadhna Pass)', 'Lolab Valley Highway'],
    stats: { newsCount: 9, problemsCount: 3, projectsCount: 2, alertsCount: 1 },
    trendingTopics: ['Sadhna Pass Road Widening', 'Bangus Valley Tourism'],
    weather: { temp: 13, condition: 'Clear', high: 17, low: 4 },
    topIssues: [],
    projects: [],
  },

  pulwama: {
    id: 'pulwama',
    name: 'Pulwama',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.89, 33.87],
    bbox: [74.75, 33.75, 75.10, 34.00],
    image: '/districts/kashmir.jpg',
    headquarters: 'Pulwama',
    elevation: '1,630 m',
    majorRoads: ['NH-44 Bypass', 'Pampore Saffron Corridor', 'Tral Link Road'],
    stats: { newsCount: 13, problemsCount: 3, projectsCount: 2, alertsCount: 0 },
    trendingTopics: ['Saffron Harvest GI Verification', 'Industrial Estate Awantipora'],
    weather: { temp: 15, condition: 'Sunny', high: 20, low: 6 },
    topIssues: [],
    projects: [],
  },

  shopian: {
    id: 'shopian',
    name: 'Shopian',
    division: 'Kashmir Valley',
    divisionKey: 'kashmir',
    color: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    center: [74.83, 33.71],
    bbox: [74.60, 33.55, 74.98, 33.85],
    image: '/districts/kashmir.jpg',
    headquarters: 'Shopian',
    elevation: '2,057 m',
    majorRoads: ['Mughal Road (Peer Ki Gali Highway)', 'Shopian-Srinagar Road'],
    stats: { newsCount: 11, problemsCount: 3, projectsCount: 2, alertsCount: 1 },
    trendingTopics: ['Mughal Road Transit Window', 'High Density Apple Orchards'],
    weather: { temp: 12, condition: 'Partly Cloudy', high: 16, low: 4 },
    topIssues: [],
    projects: [],
  },

  jammu: {
    id: 'jammu',
    name: 'Jammu',
    division: 'Jammu Plains',
    divisionKey: 'jammu',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    center: [74.86, 32.72],
    bbox: [74.60, 32.50, 75.10, 33.00],
    image: '/districts/jammu.jpg',
    headquarters: 'Jammu City',
    elevation: '327 m (1,073 ft)',
    majorRoads: ['NH-44', 'Jammu-Akhnoor Highway', 'Jammu Ring Road'],
    stats: {
      newsCount: 27,
      problemsCount: 5,
      projectsCount: 6,
      alertsCount: 1,
    },
    trendingTopics: ['Jammu Ring Road Expansion', 'Tawi Riverfront Project', 'Bahu Ropeway'],
    weather: {
      temp: 24,
      condition: 'Sunny',
      high: 29,
      low: 16,
    },
    topIssues: [
      {
        id: 'iss-jammu-1',
        title: 'Tawi river embankment reinforcement near Bhagwati Nagar',
        category: 'flood',
        severity: 'medium',
        status: 'active',
        location: 'Bhagwati Nagar',
        updatedAgo: '5h ago',
      },
    ],
    projects: [
      {
        id: 'proj-jammu-1',
        title: 'Tawi Riverfront Promenade & Artificial Lake',
        agency: 'Jammu Smart City Ltd',
        budget: '₹400 Cr',
        status: 'ongoing',
        completion: 75,
      },
    ],
  },

  kathua: {
    id: 'kathua',
    name: 'Kathua',
    division: 'Jammu Plains',
    divisionKey: 'jammu',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    center: [75.51, 32.38],
    bbox: [75.25, 32.20, 75.90, 32.70],
    image: '/districts/jammu.jpg',
    headquarters: 'Kathua',
    elevation: '307 m',
    majorRoads: ['NH-44 Gateway', 'Delhi-Amritsar-Katra Expressway corridor'],
    stats: { newsCount: 10, problemsCount: 2, projectsCount: 3, alertsCount: 0 },
    trendingTopics: ['Industrial Corridor Lakhanpur', 'Expressway Land Acquisition'],
    weather: { temp: 25, condition: 'Sunny', high: 30, low: 17 },
    topIssues: [],
    projects: [],
  },

  samba: {
    id: 'samba',
    name: 'Samba',
    division: 'Jammu Plains',
    divisionKey: 'jammu',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    center: [75.11, 32.55],
    bbox: [74.95, 32.40, 75.25, 32.70],
    image: '/districts/jammu.jpg',
    headquarters: 'Samba',
    elevation: '384 m',
    majorRoads: ['NH-44', 'Border Ring Highway'],
    stats: { newsCount: 8, problemsCount: 2, projectsCount: 2, alertsCount: 0 },
    trendingTopics: ['Bari Brahmana Industrial Hub', 'AIIMS Vijaypur Logistics'],
    weather: { temp: 24, condition: 'Sunny', high: 29, low: 16 },
    topIssues: [],
    projects: [],
  },

  udhampur: {
    id: 'udhampur',
    name: 'Udhampur',
    division: 'Jammu Plains',
    divisionKey: 'jammu',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    center: [75.13, 32.92],
    bbox: [74.90, 32.75, 75.40, 33.15],
    image: '/districts/jammu.jpg',
    headquarters: 'Udhampur',
    elevation: '756 m',
    majorRoads: ['NH-44', 'Dhar Road', 'Chenani-Nashri Tunnel Approach'],
    stats: { newsCount: 16, problemsCount: 3, projectsCount: 3, alertsCount: 1 },
    trendingTopics: ['Devika River Rejuvenation', 'Northern Command Logistics'],
    weather: { temp: 20, condition: 'Clear', high: 25, low: 12 },
    topIssues: [
      {
        id: 'iss-udh-1',
        title: 'Drinking water distribution snag in higher Chenani sectors',
        category: 'water',
        severity: 'medium',
        status: 'active',
        location: 'Chenani Block',
        updatedAgo: '2h ago',
      },
    ],
    projects: [],
  },

  reasi: {
    id: 'reasi',
    name: 'Reasi',
    division: 'Jammu Plains',
    divisionKey: 'jammu',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    center: [74.83, 33.08],
    bbox: [74.55, 32.90, 75.05, 33.30],
    image: '/districts/jammu.jpg',
    headquarters: 'Reasi',
    elevation: '466 m',
    majorRoads: ['Katra-Reasi Road', 'Salal Dam Highway', 'Chenab Rail Bridge Road'],
    stats: { newsCount: 12, problemsCount: 3, projectsCount: 4, alertsCount: 1 },
    trendingTopics: ['World Highest Chenab Rail Bridge', 'Salal Lithium Exploration', 'Vaishno Devi Pilgrim Flow'],
    weather: { temp: 21, condition: 'Sunny', high: 26, low: 13 },
    topIssues: [],
    projects: [],
  },

  rajouri: {
    id: 'rajouri',
    name: 'Rajouri',
    division: 'Pir Panjal',
    divisionKey: 'pir-panjal',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.7)',
    center: [74.30, 33.37],
    bbox: [74.05, 33.00, 74.60, 33.60],
    image: '/districts/doda.jpg',
    headquarters: 'Rajouri Town',
    elevation: '915 m',
    majorRoads: ['NH-144A (Jammu-Poonch Highway)', 'Kotranka-Khawas Road'],
    stats: { newsCount: 11, problemsCount: 3, projectsCount: 2, alertsCount: 0 },
    trendingTopics: ['Jammu-Poonch Highway 4-Laning', 'Border Villages Solar Grid'],
    weather: { temp: 18, condition: 'Sunny', high: 23, low: 11 },
    topIssues: [],
    projects: [],
  },

  poonch: {
    id: 'poonch',
    name: 'Poonch',
    division: 'Pir Panjal',
    divisionKey: 'pir-panjal',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.7)',
    center: [74.10, 33.77],
    bbox: [73.90, 33.55, 74.35, 34.00],
    image: '/districts/doda.jpg',
    headquarters: 'Poonch',
    elevation: '1,005 m',
    majorRoads: ['NH-144A', 'Mughal Road (Poonch-Shopian)'],
    stats: { newsCount: 9, problemsCount: 3, projectsCount: 2, alertsCount: 1 },
    trendingTopics: ['Mughal Road Tunnel Proposal', 'Border Area Grid Augmentation'],
    weather: { temp: 17, condition: 'Partly Cloudy', high: 22, low: 10 },
    topIssues: [],
    projects: [],
  },

  leh: {
    id: 'leh',
    name: 'Leh',
    division: 'Leh & Ladakh',
    divisionKey: 'leh',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.7)',
    center: [77.58, 34.15],
    bbox: [76.80, 33.20, 79.50, 35.50],
    image: '/districts/leh.jpg',
    headquarters: 'Leh Town',
    elevation: '3,524 m (11,562 ft)',
    majorRoads: ['Leh-Manali Highway', 'Srinagar-Leh Highway (NH-1D)', 'Khardung La Road'],
    stats: { newsCount: 12, problemsCount: 2, projectsCount: 3, alertsCount: 1 },
    trendingTopics: ['Pangong Winter Tourism', 'Khardung La Snow Telemetry', 'Solar Microgrid Hamlets'],
    weather: { temp: 6, condition: 'Crisp & Sunny', high: 10, low: -2 },
    topIssues: [],
    projects: [],
  },

  kargil: {
    id: 'kargil',
    name: 'Kargil',
    division: 'Leh & Ladakh',
    divisionKey: 'leh',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.7)',
    center: [76.13, 34.55],
    bbox: [75.50, 33.80, 77.00, 34.90],
    image: '/districts/ladakh.jpg',
    headquarters: 'Kargil',
    elevation: '2,676 m (8,780 ft)',
    majorRoads: ['NH-1D (Zojila Pass Road)', 'Kargil-Zanskar Highway'],
    stats: { newsCount: 8, problemsCount: 2, projectsCount: 2, alertsCount: 1 },
    trendingTopics: ['Zojila Tunnel Construction Milestone', 'Zanskar Highway Upgrades'],
    weather: { temp: 8, condition: 'Clear', high: 13, low: 0 },
    topIssues: [],
    projects: [],
  },
};

// Projected Polygon Geometries for Jammu, Kashmir & Ladakh Districts
// Real geographical boundaries projected for interactive SVG & GeoJSON rendering
export const JK_DISTRICT_BOUNDARIES: Record<string, [number, number][]> = {
  // DODA (Chenab Valley heartland)
  doda: [
    [75.28, 33.32],
    [75.40, 33.42],
    [75.60, 33.38],
    [75.82, 33.30],
    [75.92, 33.15],
    [75.88, 32.95],
    [75.72, 32.88],
    [75.55, 32.94],
    [75.38, 33.05],
    [75.24, 33.18],
    [75.28, 33.32],
  ],

  // KISHTWAR (Northeast Chenab Valley)
  kishtwar: [
    [75.45, 33.42],
    [75.68, 33.72],
    [76.15, 33.85],
    [76.38, 33.65],
    [76.25, 33.30],
    [75.92, 33.15],
    [75.82, 33.30],
    [75.60, 33.38],
    [75.45, 33.42],
  ],

  // RAMBAN (NH-44 bottleneck corridor)
  ramban: [
    [75.05, 33.22],
    [75.12, 33.40],
    [75.32, 33.42],
    [75.38, 33.25],
    [75.35, 33.10],
    [75.18, 33.08],
    [75.05, 33.22],
  ],

  // SRINAGAR (Kashmir Valley center)
  srinagar: [
    [74.70, 34.02],
    [74.74, 34.18],
    [74.88, 34.22],
    [74.96, 34.10],
    [74.88, 33.98],
    [74.72, 33.96],
    [74.70, 34.02],
  ],

  // ANANTNAG (South Kashmir)
  anantnag: [
    [75.02, 33.62],
    [75.08, 33.88],
    [75.35, 33.95],
    [75.48, 33.75],
    [75.38, 33.52],
    [75.15, 33.50],
    [75.02, 33.62],
  ],

  // BARAMULLA (North Kashmir)
  baramulla: [
    [74.12, 34.10],
    [74.18, 34.38],
    [74.45, 34.42],
    [74.58, 34.25],
    [74.48, 34.05],
    [74.25, 34.02],
    [74.12, 34.10],
  ],

  // BUDGAM (Central Kashmir)
  budgam: [
    [74.50, 33.85],
    [74.54, 34.08],
    [74.72, 34.05],
    [74.78, 33.92],
    [74.68, 33.80],
    [74.50, 33.85],
  ],

  // BANDIPORA (Wular Lake & Razdan corridor)
  bandipora: [
    [74.48, 34.35],
    [74.58, 34.65],
    [74.85, 34.62],
    [74.88, 34.38],
    [74.65, 34.32],
    [74.48, 34.35],
  ],

  // GANDERBAL (Sonamarg & Sindh corridor)
  ganderbal: [
    [74.72, 34.20],
    [74.78, 34.42],
    [75.25, 34.45],
    [75.35, 34.28],
    [74.98, 34.18],
    [74.72, 34.20],
  ],

  // KULGAM (Southwest Kashmir)
  kulgam: [
    [74.85, 33.52],
    [74.90, 33.72],
    [75.12, 33.70],
    [75.15, 33.50],
    [74.98, 33.45],
    [74.85, 33.52],
  ],

  // KUPWARA (Frontier North Kashmir)
  kupwara: [
    [73.95, 34.35],
    [74.05, 34.78],
    [74.45, 34.72],
    [74.42, 34.38],
    [74.15, 34.30],
    [73.95, 34.35],
  ],

  // PULWAMA (Saffron Valley)
  pulwama: [
    [74.80, 33.78],
    [74.82, 33.98],
    [75.05, 33.98],
    [75.08, 33.82],
    [74.92, 33.75],
    [74.80, 33.78],
  ],

  // SHOPIAN (Apple Heartland & Mughal Road origin)
  shopian: [
    [74.65, 33.62],
    [74.68, 33.82],
    [74.88, 33.82],
    [74.85, 33.62],
    [74.72, 33.58],
    [74.65, 33.62],
  ],

  // JAMMU (Tawi Valley Plains)
  jammu: [
    [74.65, 32.55],
    [74.70, 32.88],
    [74.95, 32.95],
    [75.08, 32.78],
    [74.98, 32.55],
    [74.78, 32.50],
    [74.65, 32.55],
  ],

  // KATHUA (Southern Gateway)
  kathua: [
    [75.30, 32.25],
    [75.35, 32.65],
    [75.75, 32.70],
    [75.88, 32.42],
    [75.58, 32.22],
    [75.30, 32.25],
  ],

  // SAMBA (Border Plains)
  samba: [
    [74.98, 32.48],
    [75.02, 32.68],
    [75.25, 32.68],
    [75.28, 32.45],
    [75.10, 32.42],
    [74.98, 32.48],
  ],

  // UDHAMPUR (Shivalik Ridge & Highway)
  udhampur: [
    [74.95, 32.82],
    [75.02, 33.12],
    [75.35, 33.15],
    [75.38, 32.85],
    [75.12, 32.75],
    [74.95, 32.82],
  ],

  // REASI (Chenab Gorge & Vaishno Devi)
  reasi: [
    [74.60, 32.98],
    [74.68, 33.28],
    [74.98, 33.28],
    [75.02, 33.02],
    [74.82, 32.92],
    [74.60, 32.98],
  ],

  // RAJOURI (Pir Panjal foothills)
  rajouri: [
    [74.12, 33.15],
    [74.22, 33.55],
    [74.55, 33.55],
    [74.52, 33.18],
    [74.30, 33.08],
    [74.12, 33.15],
  ],

  // POONCH (Peer Ki Gali mountain frontier)
  poonch: [
    [73.95, 33.62],
    [74.02, 33.98],
    [74.32, 33.95],
    [74.32, 33.65],
    [74.10, 33.58],
    [73.95, 33.62],
  ],

  // KARGIL (Suru Valley & Zojila gateway)
  kargil: [
    [75.55, 33.92],
    [75.65, 34.78],
    [76.45, 34.82],
    [76.85, 34.42],
    [76.55, 33.95],
    [75.95, 33.85],
    [75.55, 33.92],
  ],

  // LEH (High Altitude Desert & Indus Valley)
  leh: [
    [76.75, 34.25],
    [76.95, 35.45],
    [78.95, 35.30],
    [79.45, 33.50],
    [78.25, 33.15],
    [77.35, 33.45],
    [76.75, 34.25],
  ],
};

// Official Sovereign International Boundary of India (Survey of India Alignment)
// Strictly traces the outer international boundary with foreign territory (Pakistan, Afghanistan, China/Tibet)
// Does NOT draw any boundary across Punjab or Himachal Pradesh, maintaining seamless union with India
export const INDIA_SOVEREIGN_JK_OUTER_COORDS: [number, number][] = [
  [75.63, 32.37], // Lakhanpur / Ravi River entry (International Border with Pakistan starts here)
  [75.40, 32.30],
  [74.95, 32.45], // Samba sector
  [74.60, 32.65], // RS Pura / Jammu International Border
  [74.40, 32.90], // Akhnoor sector
  [73.95, 33.00], // Bhimber frontier
  [73.60, 33.10], // Mangla frontier
  [73.45, 33.55], // Kotli / Rawalakot sector
  [73.30, 34.15], // Kohala / Jhelum river boundary
  [73.20, 34.40], // Western frontier
  [73.50, 35.00], // Neelum apex
  [73.40, 35.50], // Diamer / Indus river gorge
  [73.70, 36.30], // Western flank
  [74.20, 36.85], // Mintaka Pass
  [74.85, 37.05], // Kilik Pass / Northernmost boundary with Wakhan
  [75.45, 36.90], // Khunjerab Pass
  [76.35, 36.20], // Shaksgam valley ridge
  [76.85, 35.65], // K2 / Karakoram Crest
  [77.20, 35.50], // Indira Col / Siachen northern frontier
  [77.85, 35.55], // Karakoram Pass
  [78.50, 35.35], // Depsang Plains northern rim
  [79.40, 35.00], // Haji Langar / Aksai Chin eastern edge
  [79.85, 34.50], // Lanak La / Lingzi Thang
  [79.50, 33.85], // Pangong Tso eastern tip
  [79.15, 33.20], // Spanggur / Chushul frontier
  [79.25, 32.70], // Demchok / Indus Entry
  [78.80, 32.65], // Hanle southern ridge (International border with Tibet)
];

// Generates an official GeoJSON FeatureCollection of all Districts
export function getJKDistrictsGeoJSON(): JKDistrictGeoCollection {
  const features: JKDistrictGeoFeature[] = Object.keys(JK_DISTRICTS_DATA).map((id) => {
    const coords = JK_DISTRICT_BOUNDARIES[id] || [];
    return {
      type: 'Feature',
      id,
      properties: JK_DISTRICTS_DATA[id],
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

// Generates Survey of India sovereign international boundary LineString GeoJSON
export function getIndiaSovereignBoundaryGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'india-sovereign-jk-boundary',
        properties: {
          name: 'Sovereign International Boundary of India',
          jurisdiction: 'Republic of India — Jammu, Kashmir & Ladakh',
        },
        geometry: {
          type: 'LineString',
          coordinates: INDIA_SOVEREIGN_JK_OUTER_COORDS,
        },
      },
    ],
  };
}
