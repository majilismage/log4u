import mockData from './mockData.json';

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockJourneyData() {
  // Get random journey from mock data
  const journeyIndex = Math.floor(Math.random() * mockData.journeyData.length);
  const journey = mockData.journeyData[journeyIndex];

  // Generate random dates (within the last month)
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const randomTime = oneMonthAgo.getTime() + Math.random() * (now.getTime() - oneMonthAgo.getTime());
  const departureDate = new Date(randomTime);
  const arrivalDate = new Date(randomTime + getRandomInt(2, 12) * 60 * 60 * 1000); // 2-12 hours later

  return {
    journeyId: `J${Date.now()}`,
    departureDate: departureDate.toISOString().split('T')[0],
    arrivalDate: arrivalDate.toISOString().split('T')[0],
    fromTown: journey.from.town,
    fromCountry: journey.from.country,
    fromLat: journey.from.lat,
    fromLng: journey.from.lng,
    toTown: journey.to.town,
    toCountry: journey.to.country,
    toLat: journey.to.lat,
    toLng: journey.to.lng,
    distance: getRandomInt(10, 500).toString(),
    avgSpeed: getRandomInt(4, 8).toString(),
    maxSpeed: getRandomInt(7, 10).toString(),
    notes: `Mock journey from ${journey.from.town} to ${journey.to.town}`
  };
} 