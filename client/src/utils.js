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
  { "code": "SLC", "name": "Salt Lake City International Airport", "city": "Salt Lake City", "state": "UT", "country": "USA" },
  { "code": "FAT", "name": "Fresno Yosemite International Airport", "city": "Fresno", "state": "CA", "country": "USA" },
  { "code": "ONT", "name": "Ontario International Airport", "city": "Ontario", "state": "CA", "country": "USA" },
  { "code": "TUS", "name": "Tucson International Airport", "city": "Tucson", "state": "AZ", "country": "USA" },
  { "code": "SNA", "name": "John Wayne Airport", "city": "Santa Ana", "state": "CA", "country": "USA" },
  { "code": "SAN", "name": "San Diego International Airport", "city": "San Diego", "state": "CA", "country": "USA" },
  
  // Additional US airports served by major airlines
  { "code": "ALB", "name": "Albany International Airport", "city": "Albany", "state": "NY", "country": "USA" },
  { "code": "ABQ", "name": "Albuquerque International Sunport", "city": "Albuquerque", "state": "NM", "country": "USA" },
  { "code": "AMA", "name": "Rick Husband Amarillo International Airport", "city": "Amarillo", "state": "TX", "country": "USA" },
  { "code": "AUS", "name": "Austin-Bergstrom International Airport", "city": "Austin", "state": "TX", "country": "USA" },
  { "code": "BNA", "name": "Nashville International Airport", "city": "Nashville", "state": "TN", "country": "USA" },
  { "code": "BUR", "name": "Hollywood Burbank Airport", "city": "Burbank", "state": "CA", "country": "USA" },
  { "code": "BDL", "name": "Bradley International Airport", "city": "Hartford", "state": "CT", "country": "USA" },
  { "code": "BUF", "name": "Buffalo Niagara International Airport", "city": "Buffalo", "state": "NY", "country": "USA" },
  { "code": "BOI", "name": "Boise Airport", "city": "Boise", "state": "ID", "country": "USA" },
  { "code": "CHS", "name": "Charleston International Airport", "city": "Charleston", "state": "SC", "country": "USA" },
  { "code": "CLT", "name": "Charlotte Douglas International Airport", "city": "Charlotte", "state": "NC", "country": "USA" },
  { "code": "CLE", "name": "Cleveland Hopkins International Airport", "city": "Cleveland", "state": "OH", "country": "USA" },
  { "code": "CMH", "name": "John Glenn Columbus International Airport", "city": "Columbus", "state": "OH", "country": "USA" },
  { "code": "CRP", "name": "Corpus Christi International Airport", "city": "Corpus Christi", "state": "TX", "country": "USA" },
  { "code": "CVG", "name": "Cincinnati/Northern Kentucky International Airport", "city": "Cincinnati", "state": "OH", "country": "USA" },
  { "code": "DAL", "name": "Dallas Love Field", "city": "Dallas", "state": "TX", "country": "USA" },
  { "code": "DSM", "name": "Des Moines International Airport", "city": "Des Moines", "state": "IA", "country": "USA" },
  { "code": "ELP", "name": "El Paso International Airport", "city": "El Paso", "state": "TX", "country": "USA" },
  { "code": "EWR", "name": "Newark Liberty International Airport", "city": "Newark", "state": "NJ", "country": "USA" },
  { "code": "FAI", "name": "Fairbanks International Airport", "city": "Fairbanks", "state": "AK", "country": "USA" },
  { "code": "FSD", "name": "Joe Foss Field", "city": "Sioux Falls", "state": "SD", "country": "USA" },
  { "code": "GEG", "name": "Spokane International Airport", "city": "Spokane", "state": "WA", "country": "USA" },
  { "code": "GRR", "name": "Gerald R. Ford International Airport", "city": "Grand Rapids", "state": "MI", "country": "USA" },
  { "code": "GSO", "name": "Piedmont Triad International Airport", "city": "Greensboro", "state": "NC", "country": "USA" },
  { "code": "HRL", "name": "Valley International Airport", "city": "Harlingen", "state": "TX", "country": "USA" },
  { "code": "ICT", "name": "Wichita Dwight D. Eisenhower National Airport", "city": "Wichita", "state": "KS", "country": "USA" },
  { "code": "IND", "name": "Indianapolis International Airport", "city": "Indianapolis", "state": "IN", "country": "USA" },
  { "code": "JAX", "name": "Jacksonville International Airport", "city": "Jacksonville", "state": "FL", "country": "USA" },
  { "code": "JNU", "name": "Juneau International Airport", "city": "Juneau", "state": "AK", "country": "USA" },
  { "code": "KTN", "name": "Ketchikan International Airport", "city": "Ketchikan", "state": "AK", "country": "USA" },
  { "code": "LAS", "name": "Harry Reid International Airport", "city": "Las Vegas", "state": "NV", "country": "USA" },
  { "code": "LAX", "name": "Los Angeles International Airport", "city": "Los Angeles", "state": "CA", "country": "USA" },
  { "code": "LBB", "name": "Lubbock Preston Smith International Airport", "city": "Lubbock", "state": "TX", "country": "USA" },
  { "code": "LEX", "name": "Blue Grass Airport", "city": "Lexington", "state": "KY", "country": "USA" },
  { "code": "LIT", "name": "Bill and Hillary Clinton National Airport", "city": "Little Rock", "state": "AR", "country": "USA" },
  { "code": "LNK", "name": "Lincoln Airport", "city": "Lincoln", "state": "NE", "country": "USA" },
  { "code": "MCI", "name": "Kansas City International Airport", "city": "Kansas City", "state": "MO", "country": "USA" },
  { "code": "MEM", "name": "Memphis International Airport", "city": "Memphis", "state": "TN", "country": "USA" },
  { "code": "MHT", "name": "Manchester-Boston Regional Airport", "city": "Manchester", "state": "NH", "country": "USA" },
  { "code": "MKE", "name": "Milwaukee Mitchell International Airport", "city": "Milwaukee", "state": "WI", "country": "USA" },
  { "code": "MSN", "name": "Dane County Regional Airport", "city": "Madison", "state": "WI", "country": "USA" },
  { "code": "MSY", "name": "Louis Armstrong New Orleans International Airport", "city": "New Orleans", "state": "LA", "country": "USA" },
  { "code": "OKC", "name": "Will Rogers World Airport", "city": "Oklahoma City", "state": "OK", "country": "USA" },
  { "code": "OMA", "name": "Eppley Airfield", "city": "Omaha", "state": "NE", "country": "USA" },
  { "code": "PBI", "name": "Palm Beach International Airport", "city": "West Palm Beach", "state": "FL", "country": "USA" },
  { "code": "PIT", "name": "Pittsburgh International Airport", "city": "Pittsburgh", "state": "PA", "country": "USA" },
  { "code": "PVD", "name": "Theodore Francis Green Airport", "city": "Providence", "state": "RI", "country": "USA" },
  { "code": "PWM", "name": "Portland International Jetport", "city": "Portland", "state": "ME", "country": "USA" },
  { "code": "RDU", "name": "Raleigh-Durham International Airport", "city": "Raleigh", "state": "NC", "country": "USA" },
  { "code": "RIC", "name": "Richmond International Airport", "city": "Richmond", "state": "VA", "country": "USA" },
  { "code": "RNO", "name": "Reno-Tahoe International Airport", "city": "Reno", "state": "NV", "country": "USA" },
  { "code": "ROC", "name": "Greater Rochester International Airport", "city": "Rochester", "state": "NY", "country": "USA" },
  { "code": "RSW", "name": "Southwest Florida International Airport", "city": "Fort Myers", "state": "FL", "country": "USA" },
  { "code": "SJU", "name": "Luis Muñoz Marín International Airport", "city": "San Juan", "state": "PR", "country": "USA" },
  { "code": "SMF", "name": "Sacramento International Airport", "city": "Sacramento", "state": "CA", "country": "USA" },
  { "code": "SRQ", "name": "Sarasota-Bradenton International Airport", "city": "Sarasota", "state": "FL", "country": "USA" },
  { "code": "STT", "name": "Cyril E. King Airport", "city": "Charlotte Amalie", "state": "VI", "country": "USA" },
  { "code": "SYR", "name": "Syracuse Hancock International Airport", "city": "Syracuse", "state": "NY", "country": "USA" },
  { "code": "TUL", "name": "Tulsa International Airport", "city": "Tulsa", "state": "OK", "country": "USA" },
  { "code": "TYS", "name": "McGhee Tyson Airport", "city": "Knoxville", "state": "TN", "country": "USA" },
  { "code": "VPS", "name": "Destin-Fort Walton Beach Airport", "city": "Valparaiso", "state": "FL", "country": "USA" },
  { "code": "XNA", "name": "Northwest Arkansas Regional Airport", "city": "Bentonville", "state": "AR", "country": "USA" },
  
  // Alaska Airlines specific destinations
  { "code": "ADK", "name": "Adak Airport", "city": "Adak", "state": "AK", "country": "USA" },
  { "code": "ADQ", "name": "Kodiak Airport", "city": "Kodiak", "state": "AK", "country": "USA" },
  { "code": "AKN", "name": "King Salmon Airport", "city": "King Salmon", "state": "AK", "country": "USA" },
  { "code": "BET", "name": "Bethel Airport", "city": "Bethel", "state": "AK", "country": "USA" },
  { "code": "BRW", "name": "Wiley Post-Will Rogers Memorial Airport", "city": "Utqiagvik", "state": "AK", "country": "USA" },
  { "code": "CDV", "name": "Merle K. (Mudhole) Smith Airport", "city": "Cordova", "state": "AK", "country": "USA" },
  { "code": "DLG", "name": "Dillingham Airport", "city": "Dillingham", "state": "AK", "country": "USA" },
  { "code": "GST", "name": "Gustavus Airport", "city": "Gustavus", "state": "AK", "country": "USA" },
  { "code": "HOM", "name": "Homer Airport", "city": "Homer", "state": "AK", "country": "USA" },
  { "code": "JNU", "name": "Juneau International Airport", "city": "Juneau", "state": "AK", "country": "USA" },
  { "code": "KSM", "name": "St. Mary's Airport", "city": "St. Mary's", "state": "AK", "country": "USA" },
  { "code": "OME", "name": "Nome Airport", "city": "Nome", "state": "AK", "country": "USA" },
  { "code": "OTZ", "name": "Ralph Wien Memorial Airport", "city": "Kotzebue", "state": "AK", "country": "USA" },
  { "code": "PSG", "name": "Petersburg James A. Johnson Airport", "city": "Petersburg", "state": "AK", "country": "USA" },
  { "code": "SCC", "name": "Deadhorse Airport", "city": "Deadhorse", "state": "AK", "country": "USA" },
  { "code": "SIT", "name": "Sitka Rocky Gutierrez Airport", "city": "Sitka", "state": "AK", "country": "USA" },
  { "code": "WRG", "name": "Wrangell Airport", "city": "Wrangell", "state": "AK", "country": "USA" },
  { "code": "YAK", "name": "Yakutat Airport", "city": "Yakutat", "state": "AK", "country": "USA" },
  
  // Southwest Airlines, United Airlines, and Delta Airlines additional destinations (removing duplicates already listed above)
  { "code": "GUM", "name": "Antonio B. Won Pat International Airport", "city": "Tamuning", "state": "GU", "country": "USA" },
  { "code": "LUV", "name": "Lawton-Fort Sill Regional Airport", "city": "Lawton", "state": "OK", "country": "USA" },
  
  // Additional smaller airports served by these airlines
  { "code": "ACY", "name": "Atlantic City International Airport", "city": "Atlantic City", "state": "NJ", "country": "USA" },
  { "code": "AGS", "name": "Augusta Regional Airport", "city": "Augusta", "state": "GA", "country": "USA" },
  { "code": "AVL", "name": "Asheville Regional Airport", "city": "Asheville", "state": "NC", "country": "USA" },
  { "code": "BGM", "name": "Greater Binghamton Airport", "city": "Binghamton", "state": "NY", "country": "USA" },
  { "code": "BHM", "name": "Birmingham-Shuttlesworth International Airport", "city": "Birmingham", "state": "AL", "country": "USA" },
  { "code": "BZN", "name": "Bozeman Yellowstone International Airport", "city": "Bozeman", "state": "MT", "country": "USA" },
  { "code": "CAE", "name": "Columbia Metropolitan Airport", "city": "Columbia", "state": "SC", "country": "USA" },
  { "code": "CID", "name": "The Eastern Iowa Airport", "city": "Cedar Rapids", "state": "IA", "country": "USA" },
  { "code": "COS", "name": "Colorado Springs Airport", "city": "Colorado Springs", "state": "CO", "country": "USA" },
  { "code": "CRW", "name": "Charleston Yeager Airport", "city": "Charleston", "state": "WV", "country": "USA" },
  { "code": "DAY", "name": "James M. Cox Dayton International Airport", "city": "Dayton", "state": "OH", "country": "USA" },
  { "code": "EGE", "name": "Eagle County Regional Airport", "city": "Vail", "state": "CO", "country": "USA" },
  { "code": "EVV", "name": "Evansville Regional Airport", "city": "Evansville", "state": "IN", "country": "USA" },
  { "code": "FAR", "name": "Hector International Airport", "city": "Fargo", "state": "ND", "country": "USA" },
  { "code": "FWA", "name": "Fort Wayne International Airport", "city": "Fort Wayne", "state": "IN", "country": "USA" },
  { "code": "GJT", "name": "Grand Junction Regional Airport", "city": "Grand Junction", "state": "CO", "country": "USA" },
  { "code": "GPT", "name": "Gulfport-Biloxi International Airport", "city": "Gulfport", "state": "MS", "country": "USA" },
  { "code": "GRB", "name": "Austin Straubel International Airport", "city": "Green Bay", "state": "WI", "country": "USA" },
  { "code": "HDN", "name": "Yampa Valley Airport", "city": "Hayden", "state": "CO", "country": "USA" },
  { "code": "HSV", "name": "Huntsville International Airport", "city": "Huntsville", "state": "AL", "country": "USA" },
  { "code": "HTS", "name": "Tri-State Airport", "city": "Huntington", "state": "WV", "country": "USA" },
  { "code": "JAC", "name": "Jackson Hole Airport", "city": "Jackson", "state": "WY", "country": "USA" },
  { "code": "JAN", "name": "Jackson-Medgar Wiley Evers International Airport", "city": "Jackson", "state": "MS", "country": "USA" },
  { "code": "LFT", "name": "Lafayette Regional Airport", "city": "Lafayette", "state": "LA", "country": "USA" },
  { "code": "LSE", "name": "La Crosse Regional Airport", "city": "La Crosse", "state": "WI", "country": "USA" },
  { "code": "MAF", "name": "Midland International Air and Space Port", "city": "Midland", "state": "TX", "country": "USA" },
  { "code": "MLB", "name": "Melbourne Orlando International Airport", "city": "Melbourne", "state": "FL", "country": "USA" },
  { "code": "MOB", "name": "Mobile Regional Airport", "city": "Mobile", "state": "AL", "country": "USA" },
  { "code": "MTJ", "name": "Montrose Regional Airport", "city": "Montrose", "state": "CO", "country": "USA" },
  { "code": "PNS", "name": "Pensacola International Airport", "city": "Pensacola", "state": "FL", "country": "USA" },
  { "code": "PSC", "name": "Tri-Cities Airport", "city": "Pasco", "state": "WA", "country": "USA" },
  { "code": "SAT", "name": "San Antonio International Airport", "city": "San Antonio", "state": "TX", "country": "USA" },
  { "code": "SAV", "name": "Savannah/Hilton Head International Airport", "city": "Savannah", "state": "GA", "country": "USA" },
  { "code": "SBN", "name": "South Bend International Airport", "city": "South Bend", "state": "IN", "country": "USA" },
  { "code": "SGF", "name": "Springfield-Branson National Airport", "city": "Springfield", "state": "MO", "country": "USA" },
  { "code": "SHV", "name": "Shreveport Regional Airport", "city": "Shreveport", "state": "LA", "country": "USA" },
  { "code": "TLH", "name": "Tallahassee International Airport", "city": "Tallahassee", "state": "FL", "country": "USA" },
  { "code": "TOL", "name": "Eugene F. Kranz Toledo Express Airport", "city": "Toledo", "state": "OH", "country": "USA" },
  { "code": "TRI", "name": "Tri-Cities Regional Airport", "city": "Bristol", "state": "TN", "country": "USA" },
  { "code": "TVC", "name": "Cherry Capital Airport", "city": "Traverse City", "state": "MI", "country": "USA" },
  { "code": "TYR", "name": "Tyler Pounds Regional Airport", "city": "Tyler", "state": "TX", "country": "USA" },
  { "code": "VLD", "name": "Valdosta Regional Airport", "city": "Valdosta", "state": "GA", "country": "USA" },
  { "code": "WYS", "name": "Yellowstone Regional Airport", "city": "Cody", "state": "WY", "country": "USA" },
  
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