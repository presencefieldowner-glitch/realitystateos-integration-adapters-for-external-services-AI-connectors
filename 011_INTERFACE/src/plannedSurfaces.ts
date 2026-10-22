/**
 * RealityStateOS — Interface / PlannedSurfaces
 * settings.md reserves ports/config for graphql_port and websocket_port,
 * and RealityStateOS/README.md names Mobile/Desktop/XR as Interface
 * surfaces. None of those are bound, real servers here — same honesty
 * principle as LakeTiticaca's own `api.py` docstring ("no servers actually
 * bound here — that's 011_INTERFACE's job"). This module documents the
 * seam explicitly rather than silently omitting it or faking a server that
 * doesn't do anything.
 */

export type PlannedSurface = "graphql" | "websocket" | "mobile" | "desktop" | "xr";

export interface SurfaceStatus {
  surface: PlannedSurface;
  implemented: false;
  reason: string;
}

const REASONS: Record<PlannedSurface, string> = {
  graphql: "no GraphQL schema/resolver layer built yet — REST (restApi.ts) is the only bound HTTP surface",
  websocket: "no WebSocket upgrade handling bound yet — real-time delivery today is VerifiedBus subscribe() in-process only",
  mobile: "native mobile app is a separate client codebase, out of scope for this module",
  desktop: "native desktop app is a separate client codebase, out of scope for this module",
  xr: "XR client is a separate client codebase, out of scope for this module",
};

export function statusOf(surface: PlannedSurface): SurfaceStatus {
  return { surface, implemented: false, reason: REASONS[surface] };
}

export function allPlannedSurfaces(): SurfaceStatus[] {
  return (Object.keys(REASONS) as PlannedSurface[]).map(statusOf);
}
