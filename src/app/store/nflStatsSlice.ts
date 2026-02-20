/**
 * NFL Stats Slice
 *
 * A "slice" is a collection of Redux reducer logic and actions for a
 * single feature. This slice owns ALL NFL defense-related state:
 *
 *  - defenseData:     the raw array of team stats from the API
 *  - loading:         whether we're currently fetching
 *  - error:           any error message from a failed fetch
 *  - selectedMetric:  which metric the bar chart is showing
 *  - team1 / team2:   the two teams selected for the radar comparison
 *
 * KEY CONCEPTS:
 *  - createSlice:      auto-generates action creators + reducer
 *  - createAsyncThunk: handles async API calls with pending/fulfilled/rejected lifecycle
 *  - extraReducers:    lets the slice respond to the thunk's lifecycle actions
 *  - PayloadAction:    types the payload of an action
 */

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { NFLDefenseStats } from "../services/nflStatsService";

// ---------- State shape ----------

export type MetricKey =
  | "pointsAllowed"
  | "yardsAllowed"
  | "sacks"
  | "interceptions"
  | "dvoa";

interface NFLStatsState {
  defenseData: NFLDefenseStats[];
  loading: boolean;
  error: string | null;
  selectedMetric: MetricKey;
  team1: string;
  team2: string;
}

const initialState: NFLStatsState = {
  defenseData: [],
  loading: false,
  error: null,
  selectedMetric: "pointsAllowed",
  team1: "PHI",
  team2: "DAL",
};

// ---------- Async Thunk ----------

/**
 * createAsyncThunk generates three action types automatically:
 *   - fetchNFLStats.pending   → dispatched when the fetch starts
 *   - fetchNFLStats.fulfilled → dispatched when the fetch succeeds (payload = data)
 *   - fetchNFLStats.rejected  → dispatched when the fetch fails (payload = error message)
 *
 * You dispatch it like a normal action:  dispatch(fetchNFLStats())
 * Redux Toolkit's thunk middleware intercepts it and runs the async function.
 */
export const fetchNFLStats = createAsyncThunk<
  // Return type of the payload creator (what fulfilled receives)
  NFLDefenseStats[],
  // Argument type (what you pass when dispatching — void means nothing)
  void,
  // ThunkAPI config — lets us type rejectWithValue
  { rejectValue: string }
>("nflStats/fetchNFLStats", async (_, { rejectWithValue }) => {
  try {
    const response = await fetch("/api/nfl-stats");

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data = await response.json();

    if (data.stats && data.stats.length > 0) {
      return data.stats as NFLDefenseStats[];
    }

    throw new Error("No data received from API");
  } catch (err) {
    // rejectWithValue sends a typed payload to the rejected case
    return rejectWithValue(
      err instanceof Error ? err.message : "Failed to load data"
    );
  }
});

// ---------- Slice ----------

const nflStatsSlice = createSlice({
  name: "nflStats",

  initialState,

  // Regular (synchronous) reducers — each one automatically creates an action creator.
  // Inside a reducer you can "mutate" state directly because Redux Toolkit uses Immer
  // under the hood, which converts mutations into safe immutable updates.
  reducers: {
    setSelectedMetric(state, action: PayloadAction<MetricKey>) {
      state.selectedMetric = action.payload;
    },

    setTeam1(state, action: PayloadAction<string>) {
      state.team1 = action.payload;
    },

    setTeam2(state, action: PayloadAction<string>) {
      state.team2 = action.payload;
    },
  },

  // extraReducers lets the slice handle actions defined OUTSIDE the slice
  // (in this case, the thunk's pending/fulfilled/rejected actions).
  extraReducers: (builder) => {
    builder
      .addCase(fetchNFLStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNFLStats.fulfilled, (state, action) => {
        state.loading = false;
        state.defenseData = action.payload;

        // Set initial team selections from the fetched data
        if (action.payload.length >= 2) {
          state.team1 = action.payload[0].team;
          state.team2 = action.payload[1].team;
        }
      })
      .addCase(fetchNFLStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "An unknown error occurred";
      });
  },
});

// Export actions so components can dispatch them
export const { setSelectedMetric, setTeam1, setTeam2 } = nflStatsSlice.actions;

// Export the reducer so the store can use it
export default nflStatsSlice.reducer;
