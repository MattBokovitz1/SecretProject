/**
 * Redux Store Configuration
 *
 * This is the central store for the entire app. It combines all slices
 * (currently just nflStats) into one store and exports typed hooks so
 * you get full TypeScript autocompletion everywhere you use Redux.
 *
 * KEY CONCEPTS:
 *  - configureStore: sets up the store with good defaults (Redux DevTools, thunk middleware)
 *  - RootState: the shape of the entire Redux state tree
 *  - AppDispatch: a typed version of dispatch that knows about thunks
 */

import { configureStore } from "@reduxjs/toolkit";
import nflStatsReducer from "./nflStatsSlice";

export const store = configureStore({
  reducer: {
    // Each key here becomes a top-level key in the state tree.
    // state.nflStats will hold everything from nflStatsSlice.
    nflStats: nflStatsReducer,
  },
});

// Infer the `RootState` type from the store itself.
// Whenever you add a new slice, this type updates automatically.
export type RootState = ReturnType<typeof store.getState>;

// Infer the `AppDispatch` type so thunks are typed correctly.
export type AppDispatch = typeof store.dispatch;
