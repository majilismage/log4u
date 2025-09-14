// Minimal country name to ISO2 code mapping for geocoding constraints.
// Extend as needed.
export const COUNTRY_TO_ISO2: Record<string, string> = {
  'united states': 'us',
  'usa': 'us',
  'united kingdom': 'gb',
  'uk': 'gb',
  'england': 'gb',
  'scotland': 'gb',
  'wales': 'gb',
  'northern ireland': 'gb',
  'ireland': 'ie',
  'france': 'fr',
  'germany': 'de',
  'netherlands': 'nl',
  'spain': 'es',
  'portugal': 'pt',
  'italy': 'it',
  'greece': 'gr',
  'norway': 'no',
  'sweden': 'se',
  'finland': 'fi',
  'denmark': 'dk',
  'czech republic': 'cz',
  'czechia': 'cz',
  'austria': 'at',
  'switzerland': 'ch',
  'belgium': 'be',
  'poland': 'pl',
}

export function toIso2(country?: string): string | undefined {
  if (!country) return undefined
  const key = country.trim().toLowerCase()
  return COUNTRY_TO_ISO2[key]
}

