export const formatPhoneNumber = (value) => {
  if (!value) return value;
  
  // Remove all non-numeric characters
  const phoneNumber = value.replace(/[^\d]/g, '');
  
  // Limit to 10 digits
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)})-${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)})-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const airportData = [
  { "code": "ATL", "name": "Hartsfield-Jackson Atlanta International Airport", "city": "Atlanta", "state": "GA", "country": "USA" },
  { "code": "LAX", "name": "Los Angeles International Airport", "city": "Los Angeles", "state": "CA", "country": "USA" },
  { "code": "ORD", "name": "Chicago O'Hare International Airport", "city": "Chicago", "state": "IL", "country": "USA" },
  { "code": "DFW", "name": "Dallas/Fort Worth International Airport", "city": "Dallas", "state": "TX", "country": "USA" },
  { "code": "DEN", "name": "Denver International Airport", "city": "Denver", "state": "CO", "country": "USA" },
  { "code": "JFK", "name": "John F. Kennedy International Airport", "city": "New York", "state": "NY", "country": "USA" },
  { "code": "LGA", "name": "LaGuardia Airport", "city": "New York", "state": "NY", "country": "USA" },
  { "code": "EWR", "name": "Newark Liberty International Airport", "city": "Newark", "state": "NJ", "country": "USA" },
  { "code": "SFO", "name": "San Francisco International Airport", "city": "San Francisco", "state": "CA", "country": "USA" },
  { "code": "SJC", "name": "Norman Y. Mineta San José International Airport", "city": "San Jose", "state": "CA", "country": "USA" },
  { "code": "OAK", "name": "Oakland International Airport", "city": "Oakland", "state": "CA", "country": "USA" },
  { "code": "SEA", "name": "Seattle-Tacoma International Airport", "city": "Seattle", "state": "WA", "country": "USA" },
  { "code": "LAS", "name": "McCarran International Airport", "city": "Las Vegas", "state": "NV", "country": "USA" },
  { "code": "MCO", "name": "Orlando International Airport", "city": "Orlando", "state": "FL", "country": "USA" },
  { "code": "MIA", "name": "Miami International Airport", "city": "Miami", "state": "FL", "country": "USA" },
  { "code": "FLL", "name": "Fort Lauderdale-Hollywood International Airport", "city": "Fort Lauderdale", "state": "FL", "country": "USA" },
  { "code": "BOS", "name": "Logan International Airport", "city": "Boston", "state": "MA", "country": "USA" },
  { "code": "MSP", "name": "Minneapolis-Saint Paul International Airport", "city": "Minneapolis", "state": "MN", "country": "USA" },
  { "code": "DTW", "name": "Detroit Metropolitan Wayne County Airport", "city": "Detroit", "state": "MI", "country": "USA" },
  { "code": "PHL", "name": "Philadelphia International Airport", "city": "Philadelphia", "state": "PA", "country": "USA" },
  { "code": "PHX", "name": "Phoenix Sky Harbor International Airport", "city": "Phoenix", "state": "AZ", "country": "USA" },
  { "code": "IAH", "name": "George Bush Intercontinental Airport", "city": "Houston", "state": "TX", "country": "USA" },
  { "code": "HOU", "name": "William P. Hobby Airport", "city": "Houston", "state": "TX", "country": "USA" },
  { "code": "BWI", "name": "Baltimore/Washington International Airport", "city": "Baltimore", "state": "MD", "country": "USA" },
  { "code": "DCA", "name": "Ronald Reagan Washington National Airport", "city": "Washington", "state": "DC", "country": "USA" },
  { "code": "IAD", "name": "Washington Dulles International Airport", "city": "Washington", "state": "DC", "country": "USA" },
  { "code": "MDW", "name": "Chicago Midway International Airport", "city": "Chicago", "state": "IL", "country": "USA" },
  { "code": "TPA", "name": "Tampa International Airport", "city": "Tampa", "state": "FL", "country": "USA" },
  { "code": "PDX", "name": "Portland International Airport", "city": "Portland", "state": "OR", "country": "USA" },
  { "code": "STL", "name": "Lambert-St. Louis International Airport", "city": "St. Louis", "state": "MO", "country": "USA" },
  { "code": "HNL", "name": "Daniel K. Inouye International Airport", "city": "Honolulu", "state": "HI", "country": "USA" },
  { "code": "ANC", "name": "Ted Stevens Anchorage International Airport", "city": "Anchorage", "state": "AK", "country": "USA" },
  
  { "code": "YYZ", "name": "Toronto Pearson International Airport", "city": "Toronto", "country": "Canada" },
  { "code": "YVR", "name": "Vancouver International Airport", "city": "Vancouver", "country": "Canada" },
  { "code": "YUL", "name": "Montréal-Pierre Elliott Trudeau International Airport", "city": "Montreal", "country": "Canada" },
  { "code": "YYC", "name": "Calgary International Airport", "city": "Calgary", "country": "Canada" },
  
  { "code": "LHR", "name": "London Heathrow Airport", "city": "London", "country": "UK" },
  { "code": "LGW", "name": "London Gatwick Airport", "city": "London", "country": "UK" },
  { "code": "STN", "name": "London Stansted Airport", "city": "London", "country": "UK" },
  { "code": "MAN", "name": "Manchester Airport", "city": "Manchester", "country": "UK" },
  
  { "code": "CDG", "name": "Charles de Gaulle Airport", "city": "Paris", "country": "France" },
  { "code": "ORY", "name": "Orly Airport", "city": "Paris", "country": "France" },
  { "code": "FRA", "name": "Frankfurt Airport", "city": "Frankfurt", "country": "Germany" },
  { "code": "MUC", "name": "Munich Airport", "city": "Munich", "country": "Germany" },
  { "code": "AMS", "name": "Amsterdam Airport Schiphol", "city": "Amsterdam", "country": "Netherlands" },
  { "code": "ZUR", "name": "Zurich Airport", "city": "Zurich", "country": "Switzerland" },
  { "code": "VIE", "name": "Vienna International Airport", "city": "Vienna", "country": "Austria" },
  { "code": "FCO", "name": "Leonardo da Vinci-Fiumicino Airport", "city": "Rome", "country": "Italy" },
  { "code": "MXP", "name": "Milan Malpensa Airport", "city": "Milan", "country": "Italy" },
  { "code": "BCN", "name": "Barcelona-El Prat Airport", "city": "Barcelona", "country": "Spain" },
  { "code": "MAD", "name": "Adolfo Suárez Madrid–Barajas Airport", "city": "Madrid", "country": "Spain" },
  { "code": "LIS", "name": "Lisbon Airport", "city": "Lisbon", "country": "Portugal" },
  { "code": "CPH", "name": "Copenhagen Airport", "city": "Copenhagen", "country": "Denmark" },
  { "code": "ARN", "name": "Stockholm Arlanda Airport", "city": "Stockholm", "country": "Sweden" },
  { "code": "OSL", "name": "Oslo Airport", "city": "Oslo", "country": "Norway" },
  { "code": "HEL", "name": "Helsinki Airport", "city": "Helsinki", "country": "Finland" },
  
  { "code": "IST", "name": "Istanbul Airport", "city": "Istanbul", "country": "Turkey" },
  { "code": "SAW", "name": "Sabiha Gökçen International Airport", "city": "Istanbul", "country": "Turkey" },
  
  { "code": "DXB", "name": "Dubai International Airport", "city": "Dubai", "country": "UAE" },
  { "code": "AUH", "name": "Abu Dhabi International Airport", "city": "Abu Dhabi", "country": "UAE" },
  { "code": "DOH", "name": "Hamad International Airport", "city": "Doha", "country": "Qatar" },
  
  { "code": "BOM", "name": "Chhatrapati Shivaji Maharaj International Airport", "city": "Mumbai", "country": "India" },
  { "code": "DEL", "name": "Indira Gandhi International Airport", "city": "Delhi", "country": "India" },
  { "code": "BLR", "name": "Kempegowda International Airport", "city": "Bangalore", "country": "India" },
  { "code": "MAA", "name": "Chennai International Airport", "city": "Chennai", "country": "India" },
  { "code": "HYD", "name": "Rajiv Gandhi International Airport", "city": "Hyderabad", "country": "India" },
  { "code": "CCU", "name": "Netaji Subhas Chandra Bose International Airport", "city": "Kolkata", "country": "India" },
  { "code": "AMD", "name": "Sardar Vallabhbhai Patel International Airport", "city": "Ahmedabad", "country": "India" },
  
  { "code": "NRT", "name": "Narita International Airport", "city": "Tokyo", "country": "Japan" },
  { "code": "HND", "name": "Haneda Airport", "city": "Tokyo", "country": "Japan" },
  { "code": "KIX", "name": "Kansai International Airport", "city": "Osaka", "country": "Japan" },
  { "code": "ICN", "name": "Incheon International Airport", "city": "Seoul", "country": "South Korea" },
  { "code": "GMP", "name": "Gimpo International Airport", "city": "Seoul", "country": "South Korea" },
  
  { "code": "PEK", "name": "Beijing Capital International Airport", "city": "Beijing", "country": "China" },
  { "code": "PKX", "name": "Beijing Daxing International Airport", "city": "Beijing", "country": "China" },
  { "code": "PVG", "name": "Shanghai Pudong International Airport", "city": "Shanghai", "country": "China" },
  { "code": "SHA", "name": "Shanghai Hongqiao International Airport", "city": "Shanghai", "country": "China" },
  { "code": "CAN", "name": "Guangzhou Baiyun International Airport", "city": "Guangzhou", "country": "China" },
  { "code": "CTU", "name": "Chengdu Shuangliu International Airport", "city": "Chengdu", "country": "China" },
  
  { "code": "SIN", "name": "Singapore Changi Airport", "city": "Singapore", "country": "Singapore" },
  { "code": "KUL", "name": "Kuala Lumpur International Airport", "city": "Kuala Lumpur", "country": "Malaysia" },
  { "code": "BKK", "name": "Suvarnabhumi Airport", "city": "Bangkok", "country": "Thailand" },
  { "code": "DMK", "name": "Don Mueang International Airport", "city": "Bangkok", "country": "Thailand" },
  { "code": "CGK", "name": "Soekarno-Hatta International Airport", "city": "Jakarta", "country": "Indonesia" },
  { "code": "MNL", "name": "Ninoy Aquino International Airport", "city": "Manila", "country": "Philippines" },
  { "code": "SGN", "name": "Tan Son Nhat International Airport", "city": "Ho Chi Minh City", "country": "Vietnam" },
  { "code": "HAN", "name": "Noi Bai International Airport", "city": "Hanoi", "country": "Vietnam" },
  
  { "code": "SYD", "name": "Sydney Kingsford Smith Airport", "city": "Sydney", "country": "Australia" },
  { "code": "MEL", "name": "Melbourne Airport", "city": "Melbourne", "country": "Australia" },
  { "code": "BNE", "name": "Brisbane Airport", "city": "Brisbane", "country": "Australia" },
  { "code": "PER", "name": "Perth Airport", "city": "Perth", "country": "Australia" },
  { "code": "AKL", "name": "Auckland Airport", "city": "Auckland", "country": "New Zealand" },
  { "code": "CHC", "name": "Christchurch Airport", "city": "Christchurch", "country": "New Zealand" },
  
  { "code": "GRU", "name": "São Paulo-Guarulhos International Airport", "city": "São Paulo", "country": "Brazil" },
  { "code": "GIG", "name": "Rio de Janeiro-Galeão International Airport", "city": "Rio de Janeiro", "country": "Brazil" },
  { "code": "EZE", "name": "Ezeiza International Airport", "city": "Buenos Aires", "country": "Argentina" },
  { "code": "BOG", "name": "El Dorado International Airport", "city": "Bogotá", "country": "Colombia" },
  { "code": "LIM", "name": "Jorge Chávez International Airport", "city": "Lima", "country": "Peru" },
  { "code": "SCL", "name": "Arturo Merino Benítez International Airport", "city": "Santiago", "country": "Chile" },
  
  { "code": "CAI", "name": "Cairo International Airport", "city": "Cairo", "country": "Egypt" },
  { "code": "JNB", "name": "O.R. Tambo International Airport", "city": "Johannesburg", "country": "South Africa" },
  { "code": "CPT", "name": "Cape Town International Airport", "city": "Cape Town", "country": "South Africa" },
  { "code": "ADD", "name": "Addis Ababa Bole International Airport", "city": "Addis Ababa", "country": "Ethiopia" },
  { "code": "NBO", "name": "Jomo Kenyatta International Airport", "city": "Nairobi", "country": "Kenya" },
  
  { "code": "MEX", "name": "Mexico City International Airport", "city": "Mexico City", "country": "Mexico" },
  { "code": "CUN", "name": "Cancún International Airport", "city": "Cancún", "country": "Mexico" },
  { "code": "GDL", "name": "Guadalajara International Airport", "city": "Guadalajara", "country": "Mexico" }
];

const airportMap = airportData.reduce((map, airport) => {
  map[airport.code] = airport;
  return map;
}, {});

export const formatAirportDisplay = (airportCode) => {
  if (!airportCode) return airportCode;
  
  const airport = airportMap[airportCode.toUpperCase()];
  if (!airport) return airportCode;
  
  if (airport.country === 'USA' && airport.state) {
    return `${airport.city}, ${airport.state} (${airport.code})`;
  } else if (airport.country && airport.country !== 'USA') {
    return `${airport.city}, ${airport.country} (${airport.code})`;
  } else {
    return `${airport.city} (${airport.code})`;
  }
};