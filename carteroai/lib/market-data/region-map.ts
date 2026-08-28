/**
 * Mapa de país -> región amplia, usado para agregar la distribución
 * geográfica de la cartera a un nivel legible (en vez de decenas de países
 * sueltos). Los países no reconocidos van a "Otros mercados" (que es
 * distinto de "Sin clasificar": aquí SÍ sabemos el país, solo agregamos).
 */
const REGION_BY_COUNTRY: Record<string, string> = {
  'united states': 'Norteamérica',
  usa: 'Norteamérica',
  us: 'Norteamérica',
  canada: 'Norteamérica',
  'united kingdom': 'Europa',
  uk: 'Europa',
  germany: 'Europa',
  france: 'Europa',
  spain: 'Europa',
  italy: 'Europa',
  netherlands: 'Europa',
  switzerland: 'Europa',
  sweden: 'Europa',
  denmark: 'Europa',
  norway: 'Europa',
  belgium: 'Europa',
  ireland: 'Europa',
  finland: 'Europa',
  austria: 'Europa',
  portugal: 'Europa',
  poland: 'Europa',
  japan: 'Asia-Pacífico',
  china: 'Asia-Pacífico (emergentes)',
  'hong kong': 'Asia-Pacífico',
  taiwan: 'Asia-Pacífico (emergentes)',
  'south korea': 'Asia-Pacífico',
  korea: 'Asia-Pacífico',
  india: 'Asia-Pacífico (emergentes)',
  australia: 'Asia-Pacífico',
  singapore: 'Asia-Pacífico',
  brazil: 'Latinoamérica',
  mexico: 'Latinoamérica',
  'south africa': 'Otros mercados emergentes',
  'saudi arabia': 'Otros mercados emergentes',
};

export function mapCountryToRegion(country: string): string {
  const key = country.trim().toLowerCase();
  return REGION_BY_COUNTRY[key] ?? 'Otros mercados';
}

export function mapSectorLabel(sector: string): string {
  // FMP ya usa etiquetas GICS razonablemente legibles; solo normalizamos capitalización.
  return sector.trim();
}
