import { NextResponse } from "next/server";

interface ESPNStandingsEntry {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    logos?: { href: string }[];
  };
  stats: { name: string; displayValue: string; value: number; abbreviation?: string; type?: string }[];
}

interface ESPNStatEntry {
  name: string;
  displayName: string;
  value: number;
  displayValue: string;
  perGameValue?: number;
  perGameDisplayValue?: string;
  rank?: number;
}

interface ESPNStatCategory {
  name: string;
  displayName: string;
  stats: ESPNStatEntry[];
}

interface TeamDefenseStats {
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
  dvoa: number;
}

export async function GET() {
  try {
    // Step 1: Get all 32 teams from standings (for team info, points allowed, logos)
    const standingsUrl = `https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season=2024&type=1`;
    const standingsRes = await fetch(standingsUrl, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 3600 },
    });

    if (!standingsRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch standings", stats: [] },
        { status: 500 }
      );
    }

    const standingsData = await standingsRes.json();
    const teams = extractTeamsFromStandings(standingsData);

    if (teams.length === 0) {
      return NextResponse.json(
        { error: "No teams found in standings", stats: [] },
        { status: 500 }
      );
    }

    // Step 2: Fetch detailed per-team statistics in parallel (for yards, sacks, INTs, etc.)
    const detailedStats = await Promise.all(
      teams.map((team) => fetchTeamDetailedStats(team))
    );

    // Step 3: Compute composite defensive efficiency rating (0-100 scale)
    computeEfficiencyRating(detailedStats);

    return NextResponse.json({
      stats: detailedStats,
      lastUpdated: new Date().toISOString(),
      source: "ESPN API - 2024 Season",
    });
  } catch (error) {
    console.error("Error in NFL stats API:", error);
    return NextResponse.json(
      { error: "Failed to fetch NFL statistics", stats: [] },
      { status: 500 }
    );
  }
}

/**
 * Extract basic team info + points allowed from standings data
 */
function extractTeamsFromStandings(data: {
  children?: { standings?: { entries: ESPNStandingsEntry[] } }[];
}): { id: string; abbr: string; fullName: string; logo: string; pointsAllowed: number; gamesPlayed: number }[] {
  const teams: { id: string; abbr: string; fullName: string; logo: string; pointsAllowed: number; gamesPlayed: number }[] = [];

  if (!data.children) return teams;

  for (const conference of data.children) {
    if (!conference.standings?.entries) continue;
    for (const entry of conference.standings.entries) {
      const team = entry.team;
      const stats = entry.stats || [];

      const getStat = (names: string[]): number => {
        for (const name of names) {
          const stat = stats.find(
            (s) => s.name === name || s.abbreviation === name || s.type === name
          );
          if (stat) return stat.value || parseFloat(stat.displayValue) || 0;
        }
        return 0;
      };

      const wins = getStat(["wins", "W"]);
      const losses = getStat(["losses", "L"]);
      const gamesPlayed = wins + losses || 17;
      const pointsAllowed = getStat(["pointsAllowed", "pointsAgainst", "PA"]);

      teams.push({
        id: team.id,
        abbr: team.abbreviation,
        fullName: team.displayName,
        logo: team.logos?.[0]?.href || "",
        pointsAllowed,
        gamesPlayed,
      });
    }
  }

  return teams;
}

/**
 * Compute a composite defensive efficiency rating (0–100) for each team.
 * Lower points/yards allowed is better; higher sacks/INTs/fumbles is better.
 * Each component is min-max normalised then weighted.
 */
function computeEfficiencyRating(teams: TeamDefenseStats[]): void {
  if (teams.length === 0) return;

  const vals = (fn: (t: TeamDefenseStats) => number) => teams.map(fn);
  const minMax = (arr: number[]) => ({ min: Math.min(...arr), max: Math.max(...arr) });

  const pts = minMax(vals((t) => t.pointsAllowed));
  const yds = minMax(vals((t) => t.yardsAllowed));
  const sck = minMax(vals((t) => t.sacks));
  const int = minMax(vals((t) => t.interceptions));
  const fum = minMax(vals((t) => t.fumbles));

  const norm = (value: number, mm: { min: number; max: number }) =>
    mm.max === mm.min ? 0.5 : (value - mm.min) / (mm.max - mm.min);

  // Weights: points allowed 30%, yards allowed 25%, sacks 20%, INTs 15%, fumbles 10%
  for (const t of teams) {
    const score =
      (1 - norm(t.pointsAllowed, pts)) * 30 +
      (1 - norm(t.yardsAllowed, yds)) * 25 +
      norm(t.sacks, sck) * 20 +
      norm(t.interceptions, int) * 15 +
      norm(t.fumbles, fum) * 10;

    t.dvoa = Math.round(score * 10) / 10; // 0–100 scale, 1 decimal
  }
}

/**
 * Fetch per-team statistics from ESPN and extract defensive metrics
 * Uses the "opponent" section for yards allowed and the "stats.defensive" section for sacks/INTs
 */
async function fetchTeamDetailedStats(team: {
  id: string;
  abbr: string;
  fullName: string;
  logo: string;
  pointsAllowed: number;
  gamesPlayed: number;
}): Promise<TeamDefenseStats> {
  const base: TeamDefenseStats = {
    team: team.abbr,
    fullName: team.fullName,
    logo: team.logo,
    pointsAllowed: team.gamesPlayed > 0
      ? Math.round((team.pointsAllowed / team.gamesPlayed) * 10) / 10
      : 0,
    yardsAllowed: 0,
    passYardsAllowed: 0,
    rushYardsAllowed: 0,
    sacks: 0,
    interceptions: 0,
    fumbles: 0,
    dvoa: 0,
  };

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/statistics?season=2024`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return base;

    const data = await res.json();
    const results = data.results || data;

    // Helper to find a stat by name within a category's stats array
    const findStat = (categories: ESPNStatCategory[], catName: string, statName: string): number => {
      const cat = categories.find(
        (c) => c.name?.toLowerCase() === catName.toLowerCase()
      );
      if (!cat) return 0;
      const stat = cat.stats?.find(
        (s) => s.name?.toLowerCase() === statName.toLowerCase()
      );
      return stat?.value ?? 0;
    };

    // --- Opponent stats = what the defense allowed ---
    // results.opponent is a list of categories
    const opponentCategories: ESPNStatCategory[] = Array.isArray(results.opponent)
      ? results.opponent
      : [];

    if (opponentCategories.length > 0) {
      // Total yards allowed (in opponent rushing category as "totalYards")
      const totalYards = findStat(opponentCategories, "rushing", "totalYards");
      base.yardsAllowed = team.gamesPlayed > 0
        ? Math.round((totalYards / team.gamesPlayed) * 10) / 10
        : 0;

      // Pass yards allowed (net passing yards)
      const passYards = findStat(opponentCategories, "passing", "netPassingYards");
      base.passYardsAllowed = team.gamesPlayed > 0
        ? Math.round((passYards / team.gamesPlayed) * 10) / 10
        : 0;

      // Rush yards allowed
      const rushYards = findStat(opponentCategories, "rushing", "rushingYards");
      base.rushYardsAllowed = team.gamesPlayed > 0
        ? Math.round((rushYards / team.gamesPlayed) * 10) / 10
        : 0;
    }

    // --- Team's own defensive stats: sacks, INTs, fumbles ---
    // results.stats is a dict with { categories: [...] }
    const statsObj = results.stats;
    const teamCategories: ESPNStatCategory[] = Array.isArray(statsObj)
      ? statsObj
      : Array.isArray(statsObj?.categories)
        ? statsObj.categories
        : [];

    if (teamCategories.length > 0) {
      // Sacks (from "defensive" category)
      base.sacks = findStat(teamCategories, "defensive", "sacks");

      // Interceptions (from "defensiveInterceptions" category)
      base.interceptions = findStat(teamCategories, "defensiveInterceptions", "interceptions");

      // Forced fumbles (from "general" category)
      base.fumbles = findStat(teamCategories, "general", "fumblesForced");
    }

    return base;
  } catch (err) {
    console.error(`Failed to fetch stats for ${team.abbr}:`, err);
    return base;
  }
}
