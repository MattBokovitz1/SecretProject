/**
 * Selectors for NFL Stats
 *
 * Selectors are functions that extract and/or derive data from the Redux state.
 * They keep components clean by centralizing "how to read state" logic.
 *
 * KEY CONCEPTS:
 *  - A selector takes the full RootState and returns a value.
 *  - Simple selectors just pluck a field:  state.nflStats.loading
 *  - Derived selectors compute new data from state (sorted lists, radar data, maps).
 *  - createSelector (from Reselect, re-exported by RTK) memoizes derived selectors
 *    so they only recompute when their inputs change — great for performance.
 *
 * WHY SELECTORS MATTER:
 *  - If the state shape changes, you update selectors in ONE place instead of
 *    hunting through every component.
 *  - Memoized selectors prevent unnecessary re-renders — React components that
 *    use useSelector will only re-render if the selector's return value changes.
 */

import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "./store";
import { NFLDefenseStats } from "../services/nflStatsService";
import { MetricKey } from "./nflStatsSlice";

// ============================================================
// 1. Simple selectors — direct field access, no computation
// ============================================================

/** Raw defense data array from the API */
export const selectDefenseData = (state: RootState): NFLDefenseStats[] =>
  state.nflStats.defenseData;

/** Whether data is currently being fetched */
export const selectLoading = (state: RootState): boolean =>
  state.nflStats.loading;

/** Error message (null if no error) */
export const selectError = (state: RootState): string | null =>
  state.nflStats.error;

/** The currently chosen bar-chart metric */
export const selectSelectedMetric = (state: RootState): MetricKey =>
  state.nflStats.selectedMetric;

/** Team 1 abbreviation for radar comparison */
export const selectTeam1 = (state: RootState): string =>
  state.nflStats.team1;

/** Team 2 abbreviation for radar comparison */
export const selectTeam2 = (state: RootState): string =>
  state.nflStats.team2;

// ============================================================
// 2. Derived / memoized selectors — compute new values
// ============================================================

/**
 * Sorted data for the bar chart.
 *
 * createSelector takes:
 *   1. An array of "input selectors" whose return values are watched.
 *   2. A "result function" that receives those values and computes the output.
 *
 * The result function ONLY re-runs when an input selector returns a new value.
 */
export const selectSortedData = createSelector(
  [selectDefenseData, selectSelectedMetric],
  (data, metric): NFLDefenseStats[] => {
    return [...data].sort((a, b) => {
      if (metric === "pointsAllowed" || metric === "yardsAllowed") {
        // Lower is better — ascending sort (best on top)
        const diff = a[metric] - b[metric];
        return diff !== 0 ? diff : a.team.localeCompare(b.team);
      }
      // Higher is better — descending sort (best on top)
      const diff = b[metric] - a[metric];
      return diff !== 0 ? diff : a.team.localeCompare(b.team);
    });
  }
);

/**
 * Map of team abbreviation → logo URL.
 * Used by the custom Y-axis tick renderer in the chart.
 */
export const selectLogoMap = createSelector(
  [selectDefenseData],
  (data): Map<string, string> => new Map(data.map((t) => [t.team, t.logo]))
);

/**
 * Radar chart data for comparing two teams.
 * Re-computes only when the data or team selections change.
 */
export const selectRadarData = createSelector(
  [selectDefenseData, selectTeam1, selectTeam2],
  (data, team1, team2) => {
    const t1 = data.find((t) => t.team === team1);
    const t2 = data.find((t) => t.team === team2);

    if (!t1 || !t2) return [];

    const maxPoints = Math.max(...data.map((t) => t.pointsAllowed)) || 1;
    const maxYards = Math.max(...data.map((t) => t.yardsAllowed)) || 1;
    const maxSacks = Math.max(...data.map((t) => t.sacks)) || 1;
    const maxInt = Math.max(...data.map((t) => t.interceptions)) || 1;
    const maxFumbles = Math.max(...data.map((t) => t.fumbles)) || 1;

    return [
      {
        stat: "Points Allowed",
        [team1]: Math.round(((maxPoints - t1.pointsAllowed) / maxPoints) * 100),
        [team2]: Math.round(((maxPoints - t2.pointsAllowed) / maxPoints) * 100),
        fullMark: 100,
      },
      {
        stat: "Yards Allowed",
        [team1]: Math.round(((maxYards - t1.yardsAllowed) / maxYards) * 100),
        [team2]: Math.round(((maxYards - t2.yardsAllowed) / maxYards) * 100),
        fullMark: 100,
      },
      {
        stat: "Sacks",
        [team1]: Math.round((t1.sacks / maxSacks) * 100),
        [team2]: Math.round((t2.sacks / maxSacks) * 100),
        fullMark: 100,
      },
      {
        stat: "Interceptions",
        [team1]: Math.round((t1.interceptions / maxInt) * 100),
        [team2]: Math.round((t2.interceptions / maxInt) * 100),
        fullMark: 100,
      },
      {
        stat: "Forced Fumbles",
        [team1]: Math.round((t1.fumbles / maxFumbles) * 100),
        [team2]: Math.round((t2.fumbles / maxFumbles) * 100),
        fullMark: 100,
      },
    ];
  }
);

/**
 * Teams sorted by points allowed (for the stats table).
 * Separate from selectSortedData because the table always sorts by points allowed.
 */
export const selectTableData = createSelector(
  [selectDefenseData],
  (data): NFLDefenseStats[] =>
    [...data].sort((a, b) => a.pointsAllowed - b.pointsAllowed)
);

/**
 * Find a team's full name by abbreviation.
 * Returns a selector factory — call it with the abbreviation.
 *
 * Usage:  const fullName = useSelector(selectTeamFullName("BAL"));
 *
 * This pattern is called a "selector factory" — useful when you need
 * to parameterise a selector.
 */
export const selectTeamFullName = (abbr: string) =>
  createSelector(
    [selectDefenseData],
    (data): string | undefined => data.find((t) => t.team === abbr)?.fullName
  );
