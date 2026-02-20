/**
 * Redux Provider Component
 *
 * Next.js App Router uses React Server Components by default.
 * The Redux Provider needs to be a Client Component (uses React context),
 * so we create this small wrapper marked with "use client".
 *
 * We wrap the app's children with <Provider store={store}> in layout.tsx.
 */

"use client";

import { Provider } from "react-redux";
import { store } from "../store/store";

export default function ReduxProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider store={store}>{children}</Provider>;
}
