// Built-in catalogue of well-known cricket teams that auction teams can be
// mapped onto. Logos are rendered as coloured monograms from these values, so
// no external image hosting is required.

export interface RealTeam {
  key: string;
  name: string;
  shortCode: string;
  /** Primary brand colour (hex). */
  color: string;
  /** Secondary/accent brand colour (hex). */
  accent: string;
  competition: 'IPL' | 'International' | 'PSL';
}

export const REAL_TEAMS: RealTeam[] = [
  { key: 'mi', name: 'Mumbai Indians', shortCode: 'MI', color: '#004BA0', accent: '#D1AB3E', competition: 'IPL' },
  { key: 'csk', name: 'Chennai Super Kings', shortCode: 'CSK', color: '#F9CD05', accent: '#0081C8', competition: 'IPL' },
  { key: 'rcb', name: 'Royal Challengers Bengaluru', shortCode: 'RCB', color: '#D5152A', accent: '#000000', competition: 'IPL' },
  { key: 'kkr', name: 'Kolkata Knight Riders', shortCode: 'KKR', color: '#3A225D', accent: '#D4AF37', competition: 'IPL' },
  { key: 'srh', name: 'Sunrisers Hyderabad', shortCode: 'SRH', color: '#F26522', accent: '#000000', competition: 'IPL' },
  { key: 'dc', name: 'Delhi Capitals', shortCode: 'DC', color: '#17449B', accent: '#EF1B23', competition: 'IPL' },
  { key: 'rr', name: 'Rajasthan Royals', shortCode: 'RR', color: '#EA1A85', accent: '#254AA5', competition: 'IPL' },
  { key: 'pbks', name: 'Punjab Kings', shortCode: 'PBKS', color: '#DD1F2D', accent: '#A7A9AC', competition: 'IPL' },
  { key: 'gt', name: 'Gujarat Titans', shortCode: 'GT', color: '#1B2133', accent: '#B5A16B', competition: 'IPL' },
  { key: 'lsg', name: 'Lucknow Super Giants', shortCode: 'LSG', color: '#1D3A6D', accent: '#7CD2F0', competition: 'IPL' },
  { key: 'isl', name: 'Islamabad United', shortCode: 'ISU', color: '#E03A3E', accent: '#1B1B1B', competition: 'PSL' },
  { key: 'kar', name: 'Karachi Kings', shortCode: 'KK', color: '#00A5DF', accent: '#F5C400', competition: 'PSL' },
  { key: 'lah', name: 'Lahore Qalandars', shortCode: 'LQ', color: '#0B7A3B', accent: '#F1B434', competition: 'PSL' },
  { key: 'pes', name: 'Peshawar Zalmi', shortCode: 'PZ', color: '#F5C400', accent: '#1B1B1B', competition: 'PSL' },
  { key: 'mul', name: 'Multan Sultans', shortCode: 'MS', color: '#1B4F9C', accent: '#66C7E8', competition: 'PSL' },
  { key: 'que', name: 'Quetta Gladiators', shortCode: 'QG', color: '#4B1E78', accent: '#C9A227', competition: 'PSL' },
  { key: 'ind', name: 'India', shortCode: 'IND', color: '#1565C0', accent: '#FF9933', competition: 'International' },
  { key: 'pak', name: 'Pakistan', shortCode: 'PAK', color: '#01411C', accent: '#FFFFFF', competition: 'International' },
  { key: 'aus', name: 'Australia', shortCode: 'AUS', color: '#12674A', accent: '#F2C300', competition: 'International' },
  { key: 'eng', name: 'England', shortCode: 'ENG', color: '#12395B', accent: '#CF142B', competition: 'International' },
  { key: 'sa', name: 'South Africa', shortCode: 'SA', color: '#007749', accent: '#FFB612', competition: 'International' },
  { key: 'nz', name: 'New Zealand', shortCode: 'NZ', color: '#1B1B1B', accent: '#B3B3B3', competition: 'International' },
  { key: 'sl', name: 'Sri Lanka', shortCode: 'SL', color: '#00308F', accent: '#FFB300', competition: 'International' },
  { key: 'wi', name: 'West Indies', shortCode: 'WI', color: '#7B0828', accent: '#F2C300', competition: 'International' },
  { key: 'ban', name: 'Bangladesh', shortCode: 'BAN', color: '#006A4E', accent: '#F42A41', competition: 'International' },
  { key: 'afg', name: 'Afghanistan', shortCode: 'AFG', color: '#0066B3', accent: '#D32011', competition: 'International' },
];

export function getRealTeam(key: string | null | undefined): RealTeam | null {
  if (!key) return null;
  return REAL_TEAMS.find((t) => t.key === key) ?? null;
}

/** Groups the catalogue for rendering in a grouped dropdown. */
export function realTeamsByCompetition(): { competition: string; teams: RealTeam[] }[] {
  const order: RealTeam['competition'][] = ['IPL', 'PSL', 'International'];
  return order.map((competition) => ({
    competition,
    teams: REAL_TEAMS.filter((t) => t.competition === competition),
  }));
}
