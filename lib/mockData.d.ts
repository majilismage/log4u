declare module '*/mockData.json' {
  interface Location {
    town: string;
    country: string;
    lat: number;
    lng: number;
  }

  interface JourneyData {
    from: Location;
    to: Location;
  }

  interface MockData {
    journeyData: JourneyData[];
  }

  const value: MockData;
  export default value;
} 