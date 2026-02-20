/**
 * Typed Redux Hooks
 *
 * These are thin wrappers around React-Redux's useSelector and useDispatch
 * that bake in the TypeScript types from our store.
 *
 * WHY:
 *  - useAppDispatch knows about async thunks, so dispatch(fetchNFLStats())
 *    is correctly typed.
 *  - useAppSelector infers the RootState type, so you get autocompletion
 *    for state.nflStats.* inside components.
 *
 * USAGE IN COMPONENTS:
 *   import { useAppSelector, useAppDispatch } from "../store/hooks";
 *   const loading = useAppSelector(selectLoading);
 *   const dispatch = useAppDispatch();
 *   dispatch(fetchNFLStats());
 */

import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Use throughout the app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
