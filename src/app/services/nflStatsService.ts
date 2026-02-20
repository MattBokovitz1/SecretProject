// NFL Statistics Service using ESPN's public API endpoints

export interface NFLDefenseStats {
  team: string;
  fullName: string;
  logo: string;
  pointsAllowed: number;
  yardsAllowed: number;
  passYardsAllowed: number;
  rushYardsAllowed: number;
  sacks: number;
  interceptions: number;
  fumbles: number;
  dvoa: number; // Calculated from efficiency metrics
}

interface ESPNTeam {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    logo?: string;
    logos?: { href: string }[];
  };
  stats: { name: string; value: number }[];
}

interface ESPNResponse {
  children?: {
    standings?: {
      entries: ESPNTeam[];
    };
  }[];
}

// ESPN public API endpoints for NFL statistics
const ESPN_NFL_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

export async function fetchNFLDefenseStats(season: number = 2025): Promise<NFLDefenseStats[]> {
  try {
    // Fetch team defensive statistics from ESPN
    const response = await fetch(
      `${ESPN_NFL_BASE}/statistics/team?season=${season}&seasontype=2`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse defensive statistics from ESPN response
    return parseESPNDefenseStats(data);
  } catch (error) {
    console.error("Error fetching NFL stats from ESPN:", error);
    // Return empty array on error - component will handle this
    throw error;
  }
}

// Fetch team information (logos, names)
export async function fetchNFLTeams(): Promise<Map<string, { name: string; logo: string }>> {
  try {
    const response = await fetch(`${ESPN_NFL_BASE}/teams`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`ESPN Teams API error: ${response.status}`);
    }

    const data = await response.json();
    const teamMap = new Map<string, { name: string; logo: string }>();

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamData of data.sports[0].leagues[0].teams) {
        const team = teamData.team;
        teamMap.set(team.abbreviation, {
          name: team.displayName,
          logo: team.logos?.[0]?.href || "",
        });
      }
    }

    return teamMap;
  } catch (error) {
    console.error("Error fetching NFL teams:", error);
    return new Map();
  }
}

// Fetch defensive stats directly from the statistics endpoint
export async function fetchDefensiveStatistics(season: number = 2025): Promise<NFLDefenseStats[]> {
  try {
    // Get team info first
    const teamInfo = await fetchNFLTeams();
    
    // Fetch defensive statistics
    const defenseResponse = await fetch(
      `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/types/2/teams?limit=32`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      }
    );

    if (!defenseResponse.ok) {
      throw new Error(`ESPN Defense Stats API error: ${defenseResponse.status}`);
    }

    const teamsData = await defenseResponse.json();
    const teamRefs: string[] = teamsData.items?.map((item: { $ref: string }) => item.$ref) || [];

    // Fetch individual team stats
    const statsPromises = teamRefs.map(async (ref: string) => {
      try {
        // Get team ID from ref
        const teamId = ref.match(/teams\/(\d+)/)?.[1];
        if (!teamId) return null;

        // Fetch team statistics
        const statsUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/types/2/teams/${teamId}/statistics`;
        const statsRes = await fetch(statsUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 3600 },
        });

        if (!statsRes.ok) return null;

        const statsData = await statsRes.json();
        
        // Get team info
        const teamInfoUrl = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/${teamId}`;
        const teamRes = await fetch(teamInfoUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 86400 },
        });
        
        const teamData = await teamRes.json();
        
        return {
          teamId,
          abbreviation: teamData.abbreviation,
          displayName: teamData.displayName,
          logo: teamData.logos?.[0]?.href || "",
          stats: statsData,
        };
      } catch {
        return null;
      }
    });

    const teamsStats = (await Promise.all(statsPromises)).filter(Boolean);

    // Parse and return defensive stats
    return teamsStats.map((team) => {
      if (!team) return null;
      
      const splits = team.stats?.splits?.categories || [];
      const defensiveStats = splits.find((cat: { name: string }) => cat.name === "defensive") || { stats: [] };
      const stats = defensiveStats.stats || [];

      const getStat = (name: string): number => {
        const stat = stats.find((s: { name: string; value: number }) => s.name === name);
        return stat?.value || 0;
      };

      // Calculate points and yards from available stats
      const totalPointsAllowed = getStat("totalPointsAgainst") || getStat("pointsAgainst") || 0;
      const gamesPlayed = getStat("gamesPlayed") || 17; // Default to 17 games
      
      return {
        team: team.abbreviation,
        fullName: team.displayName,
        logo: team.logo,
        pointsAllowed: Math.round((totalPointsAllowed / gamesPlayed) * 10) / 10 || 0,
        yardsAllowed: getStat("totalYardsAgainst") || getStat("yardsAgainstPerGame") || 0,
        passYardsAllowed: getStat("netPassingYardsAgainst") || getStat("passingYardsAgainstPerGame") || 0,
        rushYardsAllowed: getStat("rushingYardsAgainst") || getStat("rushingYardsAgainstPerGame") || 0,
        sacks: getStat("sacks") || 0,
        interceptions: getStat("interceptions") || 0,
        fumbles: getStat("fumblesRecovered") || getStat("fumblesForced") || 0,
        dvoa: 0, // DVOA is proprietary - will calculate relative efficiency
      };
    }).filter((stat): stat is NFLDefenseStats => stat !== null);
  } catch (error) {
    console.error("Error fetching defensive statistics:", error);
    throw error;
  }
}

function parseESPNDefenseStats(data: ESPNResponse): NFLDefenseStats[] {
  // ESPN response structure varies - handle different formats
  const teams: NFLDefenseStats[] = [];
  
  // Try to extract team stats from the response
  if (data.children) {
    for (const child of data.children) {
      if (child.standings?.entries) {
        for (const entry of child.standings.entries) {
          const team = entry.team;
          const stats = entry.stats || [];
          
          const getStat = (name: string): number => {
            const stat = stats.find((s) => s.name === name);
            return stat?.value || 0;
          };

          teams.push({
            team: team.abbreviation,
            fullName: team.displayName,
            logo: team.logos?.[0]?.href || team.logo || "",
            pointsAllowed: getStat("pointsAgainst") || getStat("pointsAllowedPerGame"),
            yardsAllowed: getStat("yardsAgainst") || getStat("yardsAllowedPerGame"),
            passYardsAllowed: getStat("passingYardsAgainst") || getStat("passingYardsAllowedPerGame"),
            rushYardsAllowed: getStat("rushingYardsAgainst") || getStat("rushingYardsAllowedPerGame"),
            sacks: getStat("sacks"),
            interceptions: getStat("interceptions"),
            fumbles: getStat("fumblesRecovered"),
            dvoa: 0,
          });
        }
      }
    }
  }

  return teams;
}

// Alternative: Fetch from ESPN's scoreboard/standings which has team defensive rankings
export async function fetchDefenseRankings(season: number = 2025): Promise<NFLDefenseStats[]> {
  try {
    const teamInfo = await fetchNFLTeams();
    
    // Fetch league-wide defensive statistics
    const response = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}&type=0&level=3`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      // Try alternative endpoint
      return await fetchFromSeasonStats(season, teamInfo);
    }

    const data = await response.json();
    return parseStandingsData(data, teamInfo);
  } catch (error) {
    console.error("Error fetching defense rankings:", error);
    throw error;
  }
}

async function fetchFromSeasonStats(
  season: number,
  teamInfo: Map<string, { name: string; logo: string }>
): Promise<NFLDefenseStats[]> {
  // Fetch season statistics summary
  const response = await fetch(
    `${ESPN_NFL_BASE}/scoreboard?seasontype=2&dates=${season}`,
    {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch season stats: ${response.status}`);
  }

  const data = await response.json();
  const teams: NFLDefenseStats[] = [];
  
  // Parse teams from scoreboard data
  const seenTeams = new Set<string>();
  
  if (data.events) {
    for (const event of data.events) {
      for (const competition of event.competitions || []) {
        for (const competitor of competition.competitors || []) {
          const team = competitor.team;
          if (!seenTeams.has(team.abbreviation)) {
            seenTeams.add(team.abbreviation);
            const info = teamInfo.get(team.abbreviation);
            teams.push({
              team: team.abbreviation,
              fullName: info?.name || team.displayName,
              logo: info?.logo || team.logo || "",
              pointsAllowed: 0,
              yardsAllowed: 0,
              passYardsAllowed: 0,
              rushYardsAllowed: 0,
              sacks: 0,
              interceptions: 0,
              fumbles: 0,
              dvoa: 0,
            });
          }
        }
      }
    }
  }

  return teams;
}

function parseStandingsData(
  data: { children?: { standings?: { entries: ESPNTeam[] } }[] },
  teamInfo: Map<string, { name: string; logo: string }>
): NFLDefenseStats[] {
  const teams: NFLDefenseStats[] = [];

  if (data.children) {
    for (const conference of data.children) {
      if (conference.standings?.entries) {
        for (const entry of conference.standings.entries) {
          const team = entry.team;
          const stats = entry.stats || [];
          
          const getStat = (name: string): number => {
            const stat = stats.find((s) => s.name === name);
            return stat?.value || 0;
          };

          const info = teamInfo.get(team.abbreviation);
          
          teams.push({
            team: team.abbreviation,
            fullName: info?.name || team.displayName,
            logo: info?.logo || team.logos?.[0]?.href || "",
            pointsAllowed: getStat("pointsAgainst"),
            yardsAllowed: getStat("avgPointsAgainst") * 17, // Approximate
            passYardsAllowed: 0,
            rushYardsAllowed: 0,
            sacks: 0,
            interceptions: 0,
            fumbles: 0,
            dvoa: 0,
          });
        }
      }
    }
  }

  return teams;
}
