-- Seed 20 Realistic Verified News Articles across all 20 Districts of Jammu & Kashmir
-- For KJIN (Kashmir Jammu Information Network)
-- Includes full rich text, categories, districts, images, view counts, and published timestamps.

BEGIN;

-- Temporarily set session_replication_role to replica to allow seeding published state
SET session_replication_role = 'replica';

-- Clean existing seeded test articles if needed
-- DELETE FROM public.articles WHERE slug IN (...);

INSERT INTO public.articles (
  id,
  title,
  slug,
  excerpt,
  content,
  category,
  category_id,
  district,
  district_id,
  author_id,
  author_display_name,
  status,
  published_at,
  published_by,
  created_at,
  updated_at,
  view_count,
  featured_image_url,
  source_name,
  source_url
) VALUES
(
  'e0000001-0000-0000-0000-000000000001',
  'Srinagar Smart City Project Enters Final Phase Along Historic Jhelum Riverfront',
  'srinagar-smart-city-project-enters-final-phase-along-historic-jhelum-riverfront',
  'Extensive pedestrian promenades, illuminated heritage walkways, and advanced eco-friendly sewage interception systems are nearing completion along Srinagar historic riverfront.',
  '## Jhelum Riverfront Revitalisation

The Srinagar Smart City mission has reached a defining milestone this week as final structural work on the pedestrian esplanade stretching from Zero Bridge to Rajbagh reached 94% completion. Designed to reconnect citizens with the historical arterial waterway of the Kashmir valley, the project blends vernacular architecture with flood-resilience engineering.

Municipal engineers confirmed that new eco-dredging barriers and non-invasive bank stabilisation works have prevented seasonal silt overflow while creating over four kilometres of continuous waterfront walkability. 

### Heritage Illumination and Public Spaces

"The objective is twofold: protecting the environmental integrity of the Jhelum while revitalising public community life in Srinagar city centre," said an executive engineer supervising the sector. The waterfront now includes energy-efficient LED heritage lampposts inspired by traditional Kashmiri woodcraft, dedicated cycling pathways, open-air reading plazas, and Wi-Fi-enabled kiosks.

Public feedback from local residents and university students visiting the promenade has been overwhelmingly encouraging, with morning walkers and artisans noting the restoration of clean, safe civic space in the heart of the district.',
  'local',
  'fe9177d3-c927-49a4-9b0d-069035da46c7',
  'srinagar',
  '91d24197-6dde-4333-96db-9dee8c17f487',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '1 hour',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour',
  3842,
  'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80',
  'KJIN Srinagar Bureau',
  'https://kjin.in'
),
(
  'e0000002-0000-0000-0000-000000000002',
  'South Kashmir Apple Harvest Crosses Record Yield Amid Expanded Cold-Storage Network',
  'south-kashmir-apple-harvest-crosses-record-yield-amid-expanded-cold-storage-network',
  'Horticultural farmers in Anantnag district celebrate unprecedented productivity as high-density apple orchards and scientific CA store logistics shield crops from market distress.',
  '## Bumper Crop in Anantnag Orchards

Orchardists across the southern belt of Kashmir, particularly in the pastoral expanses of Anantnag and Bijbehara, have recorded a 22% rise in export-grade apple output this harvest cycle. The transition toward high-density rootstocks introduced four seasons ago has yielded dense, uniform crop quality that fetches premium prices in northern terminal markets.

Crucially, the historic vulnerability of apple growers—forced distress sales due to highway blockades—has been significantly tempered by the commissioning of four new Controlled Atmosphere (CA) storage units in the district.

### Direct Farmer-to-Mandie Logistics

Growers Association representatives noted that over 45,000 metric tonnes of fresh produce have been safely warehoused in local facilities, allowing cultivators to stagger shipments across winter when market demand peaks.

"For generations our families risked complete financial ruin whenever inclement weather shut transit corridors," shared Ghulam Nabi, an orchardist from Dialgam. "Having access to digital grading and local chilled warehousing has fundamentally shifted our bargaining power."',
  'economy',
  'e52d2e30-b075-4e68-a160-1f73ee98e48b',
  'anantnag',
  'f10ccfee-2895-45ea-b8f2-7d87e33ca585',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Agri Desk',
  'published',
  NOW() - INTERVAL '3 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours',
  2910,
  'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=1200&q=80',
  'KJIN South Bureau',
  'https://kjin.in'
),
(
  'e0000003-0000-0000-0000-000000000003',
  'Cross-LoC Trade Infrastructure in Uri Awaits Clear Policy Direction Five Years On',
  'cross-loc-trade-infrastructure-in-uri-awaits-clear-policy-direction-five-years-on',
  'An investigative ground dispatch from Baramulla Salamabad trade facilitation centre reveals mothballed customs warehouses, dormant weighing scales, and trader debt.',
  '## Ground Zero at Salamabad

Located twelve kilometres from the Line of Control in Baramulla district, the once bustling Salamabad Trade Facilitation Centre stands in eerie quiet. Built to foster confidence-building barter trade across the de facto border, the terminal has remained suspended since April 2019.

Our field investigation inspected the multimillion-rupee infrastructure: multi-axle truck bays, digital weighbridges, quarantine laboratories, and banking counters now gathering dust under locked tarpaulins.

### The Human and Financial Toll

Local merchant associations estimate that over 300 registered cross-LoC traders and approximately 2,000 ancillary workers—including truck drivers, loaders, and forwarding agents—remain financially stranded. Unreconciled barter accounts amounting to over ₹80 crore are still tied up in regulatory limbo.

"We invested our life savings into refrigerated transport and warehousing complexes," said Farooq Ahmad, a former chamber representative in Baramulla. "If resumption is impossible due to national security considerations, then a transparent rehabilitation package for border entrepreneurs is long overdue."',
  'investigation',
  'ff471704-87f4-40f7-a33c-11de38099412',
  'baramulla',
  '23d67444-bd5a-4bcb-9502-ab2cfb0f9917',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Investigative Team',
  'published',
  NOW() - INTERVAL '5 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '5 hours',
  NOW() - INTERVAL '5 hours',
  4150,
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  'KJIN Baramulla Bureau',
  'https://kjin.in'
),
(
  'e0000004-0000-0000-0000-000000000004',
  'Traditional Kani Shawl Weavers in Kanihama Receive GI-Tag Authentication Boost',
  'traditional-kani-shawl-weavers-in-kanihama-receive-gi-tag-authentication-boost',
  'Master artisans in Budgam craft hamlet welcome QR-code backed laser marking systems that protect world-famous Pashmina looms from machine-made counterfeits.',
  '## Preserving centuries of handloom virtuosity

In the quiet village of Kanihama in Budgam district, rhythmic wooden clicks echo from traditional looms as master weavers manipulate tiny *tujis* (eyeless bobbins) of pashmina wool. Here, creating a single authentic Kani shawl requires up to eighteen months of meticulous patience.

For years, the greatest threat to these artisanal families was not diminishing interest, but the flood of cheap industrial polyester imitations sold deceptive labels in metropolitan showrooms.

### Laser Micro-Tagging and Direct Registry

This season, the Directorate of Handicrafts implemented a tamper-proof cryptographic QR tag system. Affixed during laboratory certification at the Craft Development Institute, prospective buyers worldwide can now scan the micro-chip to verify:
- The exact weaver family and village of origin
- 100% genuine Grade-A Changthangi Pashmina fiber purity
- Microscopic images of the hand-woven knots

"When a connoisseur in Paris or Tokyo scans our shawl and sees my father name and portrait, our dignity is restored," explained Mehraj-ud-Din, a fourth-generation master weaver.',
  'culture',
  'e9db6ded-7810-4d36-9f16-5edd1357f419',
  'budgam',
  '988ff998-dcc0-4faf-b300-f96571ddddf6',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Arts & Heritage Desk',
  'published',
  NOW() - INTERVAL '8 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '8 hours',
  NOW() - INTERVAL '8 hours',
  1980,
  'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=1200&q=80',
  'KJIN Budgam Desk',
  'https://kjin.in'
),
(
  'e0000005-0000-0000-0000-000000000005',
  'Pampore Saffron Farmers Adopt Precision Drip Irrigation to Counter Rainfall Deficits',
  'pampore-saffron-farmers-adopt-precision-drip-irrigation-to-counter-rainfall-deficits',
  'Growers across Pulwama historic saffron plateaus combine traditional soil expertise with modern water management to secure prize purple blossoms.',
  '## Saffron Plateaus Turn Purple in Pampore

The high-altitude Karewa tablelands of Pampore in Pulwama district are world-renowned for producing *Crocus sativus*, the saffron crocus celebrated for having the highest crocin and safranal content among global varieties.

However, prolonged dry spells during the critical September-October sprouting period had threatened yield volumes over consecutive years. In response, a collaborative initiative between the National Saffron Mission and farming cooperatives has introduced solar-powered micro-sprinkler networks.

### Rejuvenating the Spice Capital

Early field evaluations indicate that fields under precision moisture regulation registered an average 35% higher flower count compared to rain-dependent plots. The India International Kashmir Saffron Trading Centre (IIKSTC) at Dusoo has reported record arrivals for quality grading and vacuum packing.

"Saffron is not just cash crop for Pulwama; it is part of our cultural soul," said Haji Bashir Ahmad, head of the local growers panel. "Modern hydrology ensures our children will continue tending these purple fields."',
  'economy',
  'e52d2e30-b075-4e68-a160-1f73ee98e48b',
  'pulwama',
  '86297546-e670-4253-8f98-fef1f9415696',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '12 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours',
  3420,
  'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=1200&q=80',
  'KJIN Agriculture Desk',
  'https://kjin.in'
),
(
  'e0000006-0000-0000-0000-000000000006',
  'Assembly Deliberations in Jammu Focus on Industrial Land Allocation and Local Employment',
  'assembly-deliberations-in-jammu-focus-on-industrial-land-allocation-and-local-employment',
  'Legislators convene in the winter capital to evaluate the New Industrial Policy, demanding statutory quotas for regional youth in upcoming manufacturing estates.',
  '## High-Stakes Policy Debates in Jammu

Intense parliamentary debate animated the Legislative Assembly session in Jammu today as lawmakers from across party lines scrutinized implementation benchmarks of the industrial expansion framework. With over ₹66,000 crore worth of industrial investment proposals received, discussions centered on the balance between encouraging outside capital and safeguarding environmental and employment safeguards.

Key questions were raised concerning the absorption rates of engineering and polytechnic graduates from local institutions into industrial estates situated in Bari Brahmana, Samba, and Ghati.

### Proposed Legislative Amendments

Several legislators submitted a joint resolution urging the administration to mandate:
1. A minimum 70% non-executive employment quota for bonafide J&K domiciles.
2. Mandatory environmental impact reviews for chemical and heavy metallurgy plants.
3. Rapid title transfers for indigenous small and medium enterprise (MSME) incubators.

The Minister for Industries assured the House that a tripartite review committee comprising industry chambers, university placement directors, and labor officials will submit binding recommendations within forty-five days.',
  'politics',
  'f1ad852c-67b8-468e-a5bb-94f5c52ab2f8',
  'jammu',
  'cc984dc5-41e5-4b42-b509-f1be34eb69cd',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Political Bureau',
  'published',
  NOW() - INTERVAL '16 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '16 hours',
  NOW() - INTERVAL '16 hours',
  2150,
  'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
  'KJIN Secretariat Desk',
  'https://kjin.in'
),
(
  'e0000007-0000-0000-0000-000000000007',
  'Zojila Tunnel Construction Maintains Round-The-Clock Momentum Ahead of Winter',
  'zojila-tunnel-construction-maintains-round-the-clock-momentum-ahead-of-winter',
  'Drilling teams beneath the treacherous Zojila Pass in Ganderbal district conquer complex geological faults to guarantee year-round lifeline to Ladakh.',
  '## Engineering Triumph in the High Himalayas

Perched at an altitude of over 11,500 feet in Ganderbal district, the 13.14-kilometre Zojila Tunnel project represents one of the most audacious civil engineering undertakings in South Asia. Once completed, the twin-tube passageway will reduce the perilous four-hour crossing of the snow-bound Zojila Pass into a swift fifteen-minute transit.

Senior project directors from the National Highways and Infrastructure Development Corporation (NHIDCL) reported today that heading excavation on both the Baltal (Kashmir) and Minamarg (Ladakh) portals has surpassed the halfway threshold.

### Overcoming Sub-Zero Challenges

Heavy specialized hydraulic drill jumbos and automated concrete-lining gantries are operating inside climate-controlled tunnel shafts even as outside ambient temperatures plunge below minus twenty degrees Celsius.

"This is not merely transit infrastructure; it is an economic and humanitarian lifeline that permanently ends five months of winter isolation for hundreds of thousands of people," remarked the lead tunnel engineer during a site briefing.',
  'local',
  'fe9177d3-c927-49a4-9b0d-069035da46c7',
  'ganderbal',
  'a295dd4e-f7da-4c86-9e13-ab63accdbfa0',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '1 day',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  4890,
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  'KJIN Ganderbal Bureau',
  'https://kjin.in'
),
(
  'e0000008-0000-0000-0000-000000000008',
  'Border Villages in Karnah and Machil Celebrate First High-Speed Fibre Internet Connections',
  'border-villages-in-karnah-and-machil-celebrate-first-high-speed-fibre-internet-connections',
  'Students in Kupwara frontier sectors gain reliable digital access, transforming school curricula and remote telemedicine consultations across snowbound valleys.',
  '## Digital Connectivity Over Frontier Mountain Ridges

For school children in the remote border tehsils of Karnah, Machil, and Keran in northern Kupwara district, winter traditionally signaled academic blackout. When towering mountain passes like Sadhna and Zamindar Khan closed under meters of snow, educational institutions had virtually no contact with outer educational hubs.

This week, an optical fiber network routed across fortified snow-clearing corridors was formally activated, bringing high-speed broadband to seventy-two government high schools and primary healthcare centers.

### Educational Equality for Frontier Youth

Classrooms in Government Higher Secondary School Tangdhar held their first interactive virtual science lecture with professors in Srinagar this morning.

"Previously our students had to wait for weeks just to receive printed exam forms," remarked school principal Fatima Begum. "Now they are browsing digital reference libraries and taking online entrance coaching in real time with metropolitan students."',
  'education',
  '85c84c80-aaec-46d7-a653-3bde0f1cdc4d',
  'kupwara',
  'f0af7a36-6f55-481c-8b30-2e574f217508',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Education Correspondent',
  'published',
  NOW() - INTERVAL '1 day 4 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '1 day 4 hours',
  NOW() - INTERVAL '1 day 4 hours',
  1650,
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kupwara Desk',
  'https://kjin.in'
),
(
  'e0000009-0000-0000-0000-000000000009',
  'Wular Lake Restoration: Silt Dredging Yields Ecological Recovery as Fisherfolk Await Subsidies',
  'wular-lake-restoration-silt-dredging-yields-ecological-recovery-as-fisherfolk-await-subsidies',
  'An in-depth inquiry into South Asia largest freshwater lake in Bandipora examines water quality improvements alongside economic challenges faced by traditional boatmen.',
  '## Ecological Renaissance at Wular

Spanning across the Bandipora plains, Wular Lake serves as a natural flood reservoir and biological refuge for migratory avian species traversing the Central Asian Flyway. Over decades of unchecked willow plantation encroachments and upstream siltation, the open water expanse had contracted dramatically.

A comprehensive multi-phase restoration drive by the Wular Conservation and Management Authority (WUCMA) has successfully desilted over 4.5 square kilometres of critical lakebed, visibly restoring crystal-clear water channels and migratory bird arrival figures.

### The Livelihoods Question

While ornithologists and environmental scientists praise the open-water expansion, our investigation visited the lakeside villages of Zurimanz and Kulhama to assess local community impact.

Over 12,000 households depend exclusively on water-chestnut (*singhara*) foraging and endemic fish harvesting. Fisherfolk report that deep-water dredging has temporarily displaced traditional shallow-water fish breeding nests.

"We welcome the revival of the lake, but we require direct seasonal credit subsidies and motorized skiffs while fish populations stabilize in the deeper basins," urged local cooperative leader Mohammad Shafi.',
  'investigation',
  'ff471704-87f4-40f7-a33c-11de38099412',
  'bandipora',
  '8efa8064-d91e-4bd5-b8d4-20551f5e0664',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Investigative Desk',
  'published',
  NOW() - INTERVAL '1 day 8 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '1 day 8 hours',
  NOW() - INTERVAL '1 day 8 hours',
  3100,
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
  'KJIN Bandipora Bureau',
  'https://kjin.in'
),
(
  'e0000010-0000-0000-0000-000000000010',
  'Mughal Road Connectivity Upgrades Under Review to Enable All-Weather Commercial Transit',
  'mughal-road-connectivity-upgrades-under-review-to-enable-all-weather-commercial-transit',
  'Shopian and Poonch district stakeholders advocate for tunnel infrastructure beneath Pir Ki Gali to avert seasonal closures and slash Kashmir-Pir Panjal travel time.',
  '## The Historic Mughal Passage

The historic Mughal Road, traversing the 11,400-foot Pir Ki Gali pass between Shopian in the Kashmir Valley and Bafliaz in Poonch district, serves as the vital alternative link to the overloaded Jammu-Srinagar national highway.

During summer months, the corridor witnesses brisk commercial exchange: Kashmir apples and walnuts move south while Pir Panjal cattle and dairy products enter valley mandies. Yet between December and March, heavy avalanche drifts force prolonged closure.

### Feasibility Study for Pir Ki Gali Tunnel

A detailed project feasibility assessment for an eight-kilometre twin-tube bypass tunnel between Dubjan and Peer Ki Gali is now under final ministerial review. 

Trade councils from both Shopian and Rajouri-Poonch emphasize that constructing this tunnel would permanently stabilize inter-regional connectivity, provide immediate disaster backup during highway disruptions, and foster year-round tourism along historical heritage ruins.',
  'local',
  'fe9177d3-c927-49a4-9b0d-069035da46c7',
  'shopian',
  'ad8781eb-4337-466e-aac9-16f44ced2c6c',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '1 day 14 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '1 day 14 hours',
  NOW() - INTERVAL '1 day 14 hours',
  2470,
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
  'KJIN Shopian Desk',
  'https://kjin.in'
),
(
  'e0000011-0000-0000-0000-000000000011',
  'Historic Aharbal Falls Eco-Tourism Circuit Attracts Record Autumn Footfall in Kulgam',
  'historic-aharbal-falls-eco-tourism-circuit-attracts-record-autumn-footfall-in-kulgam',
  'Referred to as the Niagara of Kashmir, Aharbal waterfall and its pine-clad hiking trails witness surge in nature lovers following upgraded visitor safety infrastructure.',
  '## Autumn Splendor at Aharbal

Rushing with deafening power down a twenty-five-metre sheer basalt gorge, Aharbal Falls in south Kashmir Kulgam district has recorded its highest single-season tourist footfall in modern record. Over eighty-five thousand domestic travelers and trekkers visited the eco-tourism park this autumn.

The District Administration and Tourism Development Authority recently completed safety railings, paved forest pathways, solar lighting, and zero-plastic waste recycling checkpoints around the site.

### Trekking Gateway to Kungwattan and Konsernag

Beyond the waterfall itself, Aharbal serves as the trailhead for alpine expeditions into the meadows of Kungwattan and the high-altitude glacial lake of Konsernag (13,000 ft).

"The organized camp accommodations and trained local pony-guides have created sustainable livelihood for our youth while protecting pristine meadow ecology," noted Kulgam Tourism Association director Tariq Ahmad.',
  'culture',
  'e9db6ded-7810-4d36-9f16-5edd1357f419',
  'kulgam',
  '65f46cdb-e904-46ac-b30a-6fc39aba3039',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Travel & Culture Bureau',
  'published',
  NOW() - INTERVAL '2 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  1820,
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kulgam Desk',
  'https://kjin.in'
),
(
  'e0000012-0000-0000-0000-000000000012',
  'USBRL Rail Link Testing Advances: Direct Delhi-to-Srinagar Service Prepares for Launch',
  'usbrl-rail-link-testing-advances-direct-delhi-to-srinagar-service-prepares-for-launch',
  'Northern Railway engineers conduct full-speed locomotive trials across Udhampur-Reasi-Banihal sections, setting the stage for direct train travel into Kashmir Valley.',
  '## Closing the Final Railway Gap

The Udhampur-Srinagar-Baramulla Rail Link (USBRL) stands on the cusp of final commissioning, ending more than two decades of monumental tunneling and bridge construction across the treacherous young fold geology of the Pir Panjal mountain range.

High-speed oscillating train trials were conducted between Katra and Sangaldan, passing smoothly through Udhampur district rail junctions. Track telemetry instruments confirmed optimal ballast stability and acoustic absorption inside long-distance escape tunnels.

### Revolutionary Economic Impact

Direct all-weather passenger and parcel express trains connecting New Delhi directly to Srinagar within twelve hours are scheduled to commence formal operations following the Commissioner of Railway Safety (CRS) statutory clearance.

"For J&K horticulture, handicrafts, and budget travel, this rail corridor is the single greatest economic game-changer since independence," explained a senior commercial traffic manager in Udhampur.',
  'economy',
  'e52d2e30-b075-4e68-a160-1f73ee98e48b',
  'udhampur',
  '4d8529f7-df15-4cb2-b966-44271b1584e3',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Transportation Desk',
  'published',
  NOW() - INTERVAL '2 days 6 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '2 days 6 hours',
  NOW() - INTERVAL '2 days 6 hours',
  4620,
  'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80',
  'KJIN Udhampur Bureau',
  'https://kjin.in'
),
(
  'e0000013-0000-0000-0000-000000000013',
  'Worlds Highest Chenab Rail Bridge Hosts Inaugural Himalayan Marathon in Reasi',
  'worlds-highest-chenab-rail-bridge-hosts-inaugural-himalayan-marathon-in-reasi',
  'Athletes from twenty-two nations race 359 metres above the river gorge in an unprecedented athletic spectacle spotlighting J&K engineering wonder.',
  '## Athletic Milestone in the Clouds

Suspended 359 metres above the rushing Chenab River—taller than the Eiffel Tower—the magnificent Chenab Rail Bridge in Reasi district served as the dramatic backdrop for the inaugural "Himalayan Sky Marathon" this weekend.

Over eight hundred endurance runners from across India and twenty-two international federations competed across half-marathon and full 42.2-kilometre categories traversing mountain switchbacks and the engineering marvel itself.

### Global Visual Showcase

Spectators lined panoramic vantage points along Kauri and Bakkal villages as athletes dashed across the wind-engineered steel arch.

"Running across this canyon with the morning mist rising from the river below was the most breathtaking experience of my sporting life," remarked winning marathoner Elena Rostova. Youth sports organizers in Reasi plan to establish the marathon as an annual fixture on the world mountain athletics circuit.',
  'sports',
  'e21e9bfc-27c4-4256-90ee-657df34ebc09',
  'reasi',
  'b351e755-90d0-432d-8f41-e890808f8ad2',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Sports Desk',
  'published',
  NOW() - INTERVAL '2 days 12 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '2 days 12 hours',
  NOW() - INTERVAL '2 days 12 hours',
  3540,
  'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=80',
  'KJIN Reasi Bureau',
  'https://kjin.in'
),
(
  'e0000014-0000-0000-0000-000000000014',
  'Ghati Industrial Estate in Kathua Emerges as Regional Manufacturing and Pharma Hub',
  'ghati-industrial-estate-in-kathua-emerges-as-regional-manufacturing-and-pharma-hub',
  'Strategic proximity to Punjab border and 24x7 automated power corridors fuel private capital inflows into south Jammu gateway district.',
  '## Industrial Renaissance at Ghati

Located along National Highway 44 just minutes from the Punjab border, the Ghati Industrial Estate in Kathua district has transformed into J&K fastest growing manufacturing corridor. Over the past twelve months, twelve large pharmaceutical formulation units, automated textile mills, and consumer electronics assembly plants have commenced operations.

The park features dedicated 220kV power substations, automated effluent treatment facilities, and direct container rail siding connectivity to Mundra and Nhava Sheva ports.

### Skill Development and Employment

The influx of capital has led to the establishment of industry-sponsored technical training labs at the Government Polytechnic College in Kathua. Local engineering students now undergo structured apprenticeships directly on cutting-edge automated production lines.

"Kathua geographical positioning as the logistics gateway to Jammu and Kashmir offers businesses unparalleled supply-chain efficiencies," stated the Industrial Association president.',
  'economy',
  'e52d2e30-b075-4e68-a160-1f73ee98e48b',
  'kathua',
  'ff8bfeb4-4549-47ac-984f-3dccf23f9aa8',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Business Desk',
  'published',
  NOW() - INTERVAL '3 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days',
  1750,
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kathua Bureau',
  'https://kjin.in'
),
(
  'e0000015-0000-0000-0000-000000000015',
  'Border Tourism Circuit Expanded with Heritage Conservation at Samba Fort',
  'border-tourism-circuit-expanded-with-heritage-conservation-at-samba-fort',
  'Archaeological restoration of 19th-century ramparts and peaceful border retreat ceremonies at Chamliyal boost domestic traveler arrivals in Samba.',
  '## Reviving Samba Historic Fortifications

Perched majestically on a ridge overlooking the Basantar River, the historic Samba Fort, dating to the reign of Raja Suchet Singh in the 1820s, has undergone extensive architectural stabilization. Master masons using traditional lime-mortar and hand-cut stone masonry have restored the intricate arches, royal barracks, and carved wooden balconies.

The fort now serves as the centerpiece of Samba new heritage tourism trail, linking travelers with the sacred shrine of Chamliyal and border peace viewpoints.

### Community Tourism Entrepreneurship

Lakeside cafeterias, local calico-print textile workshops, and artisan souvenir kiosks operated by women-led self-help groups have been inaugurated within the fort perimeter.

"For decades, travelers simply bypassed Samba on the national highway," observed local historian Rajeshwar Singh. "Restoring our heritage anchors our youth to their rich history while generating thriving hospitality enterprises."',
  'local',
  'fe9177d3-c927-49a4-9b0d-069035da46c7',
  'samba',
  '683d2677-2b48-487b-942b-f64e4e956cdc',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Heritage Desk',
  'published',
  NOW() - INTERVAL '3 days 8 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '3 days 8 hours',
  NOW() - INTERVAL '3 days 8 hours',
  1430,
  'https://images.unsplash.com/photo-1599818494921-137b089c25bb?auto=format&fit=crop&w=1200&q=80',
  'KJIN Samba Bureau',
  'https://kjin.in'
),
(
  'e0000016-0000-0000-0000-000000000016',
  'Baba Ghulam Shah Badshah University Secures Patent for High-Altitude Herbal Formulations',
  'baba-ghulam-shah-badshah-university-secures-patent-for-high-altitude-herbal-formulations',
  'Biotechnology researchers in Rajouri achieve clinical breakthrough using indigenous medicinal plants from Pir Panjal mountain ecosystems.',
  '## Breakthrough Botanical Research in Rajouri

A research team at the Centre for Biodiversity and Biotechnology at Baba Ghulam Shah Badshah University (BGSBU) in Rajouri has been awarded a national patent for novel therapeutic compounds derived from alpine flora native to the Pir Panjal mountains.

The patented formulation utilizes bioactive extracts from *Artemisia nilagirica* and *Picrorhiza kurroa* to treat high-altitude pulmonary edema and chronic inflammatory ailments without synthetic side effects.

### Commercialization and Farmer Buy-Back

The university has signed a technology transfer agreement with a leading botanical pharmaceutical firm. The agreement guarantees that commercial raw materials will be sourced exclusively via contract farming with hill farmers in Rajouri and Poonch.

"This is scientific validation of centuries of traditional Gujjar and Bakarwal ethno-botanical wisdom," stated lead scientist Dr. Parvez Alam. "It demonstrates that regional universities can conduct world-class applied biomedical innovation."',
  'education',
  '85c84c80-aaec-46d7-a653-3bde0f1cdc4d',
  'rajouri',
  '3f07b973-2277-425d-872f-edbe9895b079',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Science Desk',
  'published',
  NOW() - INTERVAL '4 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days',
  2100,
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80',
  'KJIN Rajouri Bureau',
  'https://kjin.in'
),
(
  'e0000017-0000-0000-0000-000000000017',
  'Poonchi Folk Ballads Documented in Extensive Digital Oral History Archival Project',
  'poonchi-folk-ballads-documented-in-extensive-digital-oral-history-archival-project',
  'Linguists and cultural ethnographers record centuries-old Pahari ballads, Sufi kafis, and border narratives across Poonch historic frontier tehsils.',
  '## Preserving the Living Voices of Pir Panjal

In border villages stretching from Mandi to Haveli in Poonch district, an urgent cultural rescue effort is underway. Elder bards known as *Dhadhis* and *Qisse-Khwans* are gathering in village squares to perform ancient verse epics passed down purely through oral recitation for over seven centuries.

A collaborative project supported by Jammu University and the Academy of Art, Culture, and Languages has captured over three hundred hours of high-definition digital master recordings.

### Multifaceted Linguistic Heritage

Poonchi—a distinct dialect bridging Pahari, Gojri, and Punjabi—possesses rich poetic meters capturing trans-Himalayan pastoral migration, border separations, and Sufi syncretic spirituality.

"When an elder bard passes away without his repertoire being transcribed, it is akin to an entire library burning down," said project director Professor Shamim Akhter. The digitized archive will be hosted openly online with translations in English, Urdu, and Hindi for global scholarly research.',
  'culture',
  'e9db6ded-7810-4d36-9f16-5edd1357f419',
  'poonch',
  '7cab1869-b120-4cb8-9640-56ab7a00b27f',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Culture Desk',
  'published',
  NOW() - INTERVAL '4 days 12 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '4 days 12 hours',
  NOW() - INTERVAL '4 days 12 hours',
  1380,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  'KJIN Poonch Bureau',
  'https://kjin.in'
),
(
  'e0000018-0000-0000-0000-000000000018',
  'Lavender Revolution in Bhaderwah Sparks Agro-Entrepreneurship Wave Across Chenab Valley',
  'lavender-revolution-in-bhaderwah-sparks-agro-entrepreneurship-wave-across-chenab-valley',
  'Farmers in Doda district replace subsistence maize farming with purple lavender cultivation, multiplying household incomes through aromatic oil extraction.',
  '## The Purple Transformation of Bhaderwah

On the terraced hillslopes of Bhaderwah valley in Doda district, agricultural topography has undergone a dramatic aesthetic and financial metamorphosis. What were once stony fields yielding modest subsistence crops of maize are now vivid expanses of fragrant purple lavender (*Lavandula angustifolia*).

Spearheaded by the CSIR-Indian Institute of Integrative Medicine (IIIM) Aroma Mission, lavender cultivation has expanded across more than 2,500 hectares in Doda district alone.

### High-Value Essential Oil Distillation

Over thirty-five community distillation plants have been installed in mountain hamlets. One hectare of lavender yields approximately 35-40 litres of pure essential oil, which currently sells at ₹10,000 to ₹12,000 per litre to cosmetics, wellness, and pharmaceutical manufacturers.

"Young graduates who previously left for seasonal labor in distant cities are now staying home to manage aroma startups and eco-stays," explained Bharat Bhushan, an award-winning progressive farmer from Tipri.',
  'economy',
  'e52d2e30-b075-4e68-a160-1f73ee98e48b',
  'doda',
  '03d2bcac-3736-44d1-a92b-c13568a079ca',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Chenab Desk',
  'published',
  NOW() - INTERVAL '5 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  3150,
  'https://images.unsplash.com/photo-1528183429752-a97d0bf99b5a?auto=format&fit=crop&w=1200&q=80',
  'KJIN Doda Bureau',
  'https://kjin.in'
),
(
  'e0000019-0000-0000-0000-000000000019',
  'Hydroelectric Projects Along Chenab River: Assessing Environmental Compliance and Local Employment',
  'hydroelectric-projects-along-chenab-river-assessing-environmental-compliance-and-local-employment',
  'An investigative report from Kishtwar examines dam construction across Pakal Dul, Kiru, and Kwar, balancing clean energy targets with fragile mountain geology.',
  '## The Powerhouse of the Himalayas

With its thunderous descent through steep mountain gorges, the Chenab River basin in Kishtwar district is host to one of the highest concentrations of mega-hydroelectric projects in India. Projects including Pakal Dul (1,000 MW), Kiru (624 MW), Kwar (540 MW), and Ratle (850 MW) represent over ₹30,000 crore in cumulative national energy infrastructure investment.

Our investigative team spent five days interviewing geological experts, power corporations, and displaced villagers across Kishtwar tehsils.

### Balancing Renewable Ambition with Ecological Stability

The investigation revealed that while advanced tunneling boring machines (TBMs) have replaced hazardous open blasting in several sensitive sectors, muck-disposal compliance along riverbanks requires stricter autonomous monitoring during monsoon swells.

Local youth bodies also presented petitions demanding audited enforcement of local employment covenants:
- Enforcing transparent apprenticeship rosters for project-affected families.
- Timely compensatory afforestation along deforested ridge slopes.
- Modernizing seismic monitoring sensors linked directly to public emergency portals.',
  'investigation',
  'ff471704-87f4-40f7-a33c-11de38099412',
  'kishtwar',
  '3f1936df-7195-42c6-ae0d-661a72e01ff4',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'KJIN Environmental Investigations',
  'published',
  NOW() - INTERVAL '5 days 8 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '5 days 8 hours',
  NOW() - INTERVAL '5 days 8 hours',
  2840,
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  'KJIN Kishtwar Bureau',
  'https://kjin.in'
),
(
  'e0000020-0000-0000-0000-000000000020',
  'National Highway 44 Realignment: Panthyal Tunnel Bypasses Historic Shooting-Stone Threat',
  'national-highway-44-realignment-panthyal-tunnel-bypasses-historic-shooting-stone-threat',
  'Travelers on the Jammu-Srinagar highway celebrate the commissioning of steel-reinforced tunnel bypasses across Ramban district perilous rockfall zones.',
  '## Conquering Panthyal Nightmare Stretch

For generations of Kashmir travelers, the name "Panthyal" in Ramban district evoked sheer anxiety. The notorious mountain face, fractured by seismic faultlines and freeze-thaw cycles, regularly showered heavy shooting stones and landslides onto the highway below, halting thousands of vehicles for days on end.

This week, the National Highways Authority of India (NHAI) completed the statutory safety audit of the twin-tube Panthyal T-5 Tunnel and connecting viaducts, allowing unrestricted two-way commercial traffic.

### Uninterrupted All-Weather Artery

The new tunnel completely bypasses the vertical rockfall zone, carrying vehicles inside reinforced concrete arches equipped with emergency jet-fan ventilation, automated smoke detection, and SOS telephone bays every 150 metres.

"Crossing Ramban during winter or spring showers used to be a gamble with one life," said truck driver Gurmeet Singh, who has traversed the corridor for twenty-five years. "Today we drove through Panthyal in ninety seconds with complete peace of mind."',
  'politics',
  'f1ad852c-67b8-468e-a5bb-94f5c52ab2f8',
  'ramban',
  '0b6516af-de25-422f-87d1-960ff0bbf4ce',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  'Hafiz Zargar',
  'published',
  NOW() - INTERVAL '6 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days',
  4210,
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  'KJIN Highway Bureau',
  'https://kjin.in'
);

-- Seed Urdu and Hindi Translations for the flagship articles
INSERT INTO public.article_translations (
  id,
  article_id,
  language_code,
  title,
  excerpt,
  content,
  status,
  published_at,
  published_by
) VALUES
(
  'f0000001-0000-0000-0000-000000000001',
  'e0000001-0000-0000-0000-000000000001',
  'ur',
  'سری نگر اسمارٹ سٹی پروجیکٹ تاریخی دریائے جہلم کے کنارے آخری مرحلے میں داخل',
  'سری نگر کے تاریخی دریا کے کنارے وسیع پیدل راستے، روشن ہیریٹیج واک ویز، اور ماحول دوست سیوریج سسٹمز تکمیل کے قریب ہیں۔',
  '## دریائے جہلم کے کنارے کی بحالی

سری نگر اسمارٹ سٹی مشن نے اس ہفتے ایک تاریخی سنگ میل عبور کر لیا ہے، کیونکہ زیرو برج سے راج باغ تک پیدل راستے پر حتمی تعمیراتی کام 94 فیصد تک مکمل ہو چکا ہے۔ کشمیر وادی کی تاریخی آبی گزرگاہ کو شہریوں سے دوبارہ جوڑنے کے لیے ڈیزائن کیا گیا یہ منصوبہ روایتی فن تعمیر اور جدید انجینئرنگ کا خوبصورت امتزاج ہے۔',
  'published',
  NOW() - INTERVAL '1 hour',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d'
),
(
  'f0000001-0000-0000-0000-000000000002',
  'e0000001-0000-0000-0000-000000000001',
  'hi',
  'श्रीनगर स्मार्ट सिटी परियोजना ऐतिहासिक झेलम रिवरफ्रंट पर अंतिम चरण में पहुंची',
  'श्रीनगर के ऐतिहासिक नदी तट पर विस्तृत पैदल मार्ग, हेरिटेज वॉकवे और उन्नत सीवेज प्रणाली का कार्य पूर्णता के करीब है।',
  '## झेलम रिवरफ्रंट का पुनरुद्धार

श्रीनगर स्मार्ट सिटी मिशन ने इस सप्ताह एक महत्वपूर्ण मील का पत्थर हासिल किया है, जब ज़ीरो ब्रिज से राजबाग तक पैदल एस्प्लेनेड पर अंतिम निर्माण कार्य 94% पूरा हो गया। कश्मीर घाटी के इस ऐतिहासिक जलमार्ग को नागरिकों से फिर से जोड़ने के लिए तैयार की गई यह परियोजना स्थानीय वास्तुकला और आधुनिक इंजीनियरिंग का अद्भुत समन्वय है।',
  'published',
  NOW() - INTERVAL '1 hour',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d'
),
(
  'f0000002-0000-0000-0000-000000000001',
  'e0000002-0000-0000-0000-000000000002',
  'ur',
  'جنوبی کشمیر میں سیب کی ریکارڈ پیداوار: جدید کولڈ اسٹوریج نیٹ ورک سے کسان خوشحال',
  'ضلع اننت ناگ کے باغبانوں نے ریکارڈ پیداوار درج کی، جدید سی اے اسٹورز نے کسانوں کو مارکیٹ کے نقصان سے بچایا۔',
  '## اننت ناگ کے باغات میں شاندار پیداوار

جنوبی کشمیر کے اضلاع خصوصاً اننت ناگ اور بیج بہاڑہ میں اس سال سیب کی برآمدی پیداوار میں 22 فیصد کا اضافہ ریکارڈ کیا گیا ہے۔ چار سیزن قبل متعارف کرائی گئی ہائی ڈینسٹی ٹیکنالوجی اب بہترین نتائج دے رہی ہے۔',
  'published',
  NOW() - INTERVAL '3 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d'
),
(
  'f0000005-0000-0000-0000-000000000001',
  'e0000005-0000-0000-0000-000000000005',
  'ur',
  'پامپور: زعفران کے کاشتکاروں نے کم بارش سے نمٹنے کے لیے ڈرپ اریگیشن کا نظام اپنایا',
  'ضلع پلوامہ کے تاریخی زعفرانی علاقوں میں جدید نظام آبپاشی نے فصلوں کو نئی زندگی عطا کی ہے۔',
  '## پامپور کے زعفرانی میدانوں کی خوشبو

پامپور کے بلند و بالا کریوا میدان دنیا بھر میں اعلٰی ترین معیار کے زعفران پیدا کرنے کے لیے مشہور ہیں۔ نیشنل سیفران مشن اور کسان کوآپریٹو کے اشتراک سے شمسی توانائی سے چلنے والے مائیکرو اسپرنکلر نیٹ ورکس لگائے گئے ہیں۔',
  'published',
  NOW() - INTERVAL '12 hours',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d'
),
(
  'f0000018-0000-0000-0000-000000000001',
  'e0000018-0000-0000-0000-000000000018',
  'ur',
  'بھدرواہ میں لیونڈر انقلاب: چناب ویلی میں خوشبودار تیل کے کاروبار نے نوجوانوں کو نئی راہ دکھائی',
  'ضلع ڈوڈہ کے کسانوں نے مکئی کی روایتی کھیتی کی جگہ لیونڈر کی کاشت شروع کر کے گھریلو آمدنی میں کئی گنا اضافہ کیا۔',
  '## بھدرواہ کی وادیوں میں ارغوانی رنگ

ضلع ڈوڈہ کی خوبصورت وادی بھدرواہ میں زراعت نے ایک خوشگوار ارغوانی موڑ لیا ہے۔ روایتی مکئی کی جگہ اب وسیع پیمانے پر ارغوانی لیونڈر کی خوشبو مہک رہی ہے جس سے حاصل ہونے والا تیل عالمی مارکیٹ میں شاندار قیمت پر فروخت ہو رہا ہے۔',
  'published',
  NOW() - INTERVAL '5 days',
  'a51886f0-7fd2-411c-8d96-1bab2bdfcb2d'
);

-- Restore session_replication_role
SET session_replication_role = 'origin';

COMMIT;
