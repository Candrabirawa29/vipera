import { openDB, DBSchema, IDBPDatabase } from "idb";
import { CalculatedSplit } from "../running/splits";
import { IntervalResultLap, WorkoutStepConfig } from "../running/interval-engine";
import { GhostRunSnapshot } from "../running/ghost";

export interface StoredRunPoint {
  id?: number;
  runId: string;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  elapsedTime: number; // active seconds
  distanceFromStart: number; // cumulative meters
  pace?: number | null;
  isPaused: boolean;
}

export interface ActiveRunState {
  id: string; // Client UUID
  userId: string;
  title: string;
  activityType: string;
  startedAt: string; // ISO
  duration: number; // seconds
  distance: number; // meters
  isPaused: boolean;
  pausedAt?: number | null;
  totalPausedDuration: number; // seconds
  workout?: {
    id?: string;
    title: string;
    steps: WorkoutStepConfig[];
  } | null;
  ghost?: GhostRunSnapshot | null;
  lastUpdated: number;
}

export interface CompletedRunPayload {
  id: string;
  userId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  duration: number; // active seconds
  distance: number; // meters
  averagePace: number; // sec/km
  fastestPace: number;
  averageSpeed: number; // m/s
  maxSpeed: number;
  elevationGain: number;
  elevationLoss: number;
  calories: number;
  activityType: string;
  notes?: string;
  feeling?: string;
  energy?: number;
  legCondition?: number;
  weatherSnapshot?: Record<string, unknown>;
  idempotencyKey: string;
  points: StoredRunPoint[];
  splits: CalculatedSplit[];
  intervals?: IntervalResultLap[];
  workoutId?: string;
  workoutTitle?: string;
}

export interface SyncQueueItem {
  id: string; // runId
  payload: CompletedRunPayload;
  status: "PENDING" | "SYNCING" | "FAILED" | "SYNCED";
  attempts: number;
  lastError?: string;
  queuedAt: number;
}

interface ViperaRunDBSchema extends DBSchema {
  active_run: {
    key: string;
    value: ActiveRunState;
  };
  active_points: {
    key: number;
    value: StoredRunPoint;
    indexes: { "by-run": string };
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { "by-status": string };
  };
  local_runs: {
    key: string;
    value: CompletedRunPayload;
  };
  workouts: {
    key: string;
    value: {
      id: string;
      title: string;
      description?: string;
      isPreset?: boolean;
      steps: WorkoutStepConfig[];
      updatedAt: number;
    };
  };
}

const DB_NAME = "vipera_run_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ViperaRunDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<ViperaRunDBSchema>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only accessible in browser environment"));
  }

  if (!dbPromise) {
    dbPromise = openDB<ViperaRunDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Active run draft
        if (!db.objectStoreNames.contains("active_run")) {
          db.createObjectStore("active_run", { keyPath: "id" });
        }

        // GPS points stream
        if (!db.objectStoreNames.contains("active_points")) {
          const pointsStore = db.createObjectStore("active_points", {
            keyPath: "id",
            autoIncrement: true,
          });
          pointsStore.createIndex("by-run", "runId");
        }

        // Offline sync queue
        if (!db.objectStoreNames.contains("sync_queue")) {
          const syncStore = db.createObjectStore("sync_queue", { keyPath: "id" });
          syncStore.createIndex("by-status", "status");
        }

        // Local cache of completed runs
        if (!db.objectStoreNames.contains("local_runs")) {
          db.createObjectStore("local_runs", { keyPath: "id" });
        }

        // Workouts
        if (!db.objectStoreNames.contains("workouts")) {
          db.createObjectStore("workouts", { keyPath: "id" });
        }
      },
    });
  }

  return dbPromise;
}

// Active Run Persistence
export async function saveActiveRunDraft(run: ActiveRunState): Promise<void> {
  const db = await getLocalDB();
  await db.put("active_run", run);
}

export async function getActiveRunDraft(): Promise<ActiveRunState | null> {
  try {
    const db = await getLocalDB();
    const runs = await db.getAll("active_run");
    return runs.length > 0 ? runs[0] : null;
  } catch {
    return null;
  }
}

export async function clearActiveRunDraft(runId?: string): Promise<void> {
  try {
    const db = await getLocalDB();
    if (runId) {
      await db.delete("active_run", runId);
      // Also delete points for this run
      const tx = db.transaction("active_points", "readwrite");
      const index = tx.store.index("by-run");
      let cursor = await index.openCursor(runId);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } else {
      await db.clear("active_run");
      await db.clear("active_points");
    }
  } catch (err) {
    console.error("Failed to clear active run draft:", err);
  }
}

// Append GPS point locally
export async function appendActivePoint(point: StoredRunPoint): Promise<number> {
  const db = await getLocalDB();
  return (await db.add("active_points", point)) as number;
}

export async function getActiveRunPoints(runId: string): Promise<StoredRunPoint[]> {
  const db = await getLocalDB();
  return await db.getAllFromIndex("active_points", "by-run", runId);
}

// Sync Queue
export async function queueRunForSync(payload: CompletedRunPayload): Promise<void> {
  const db = await getLocalDB();
  // Save in local_runs for immediate offline visibility
  await db.put("local_runs", payload);

  // Add to sync queue
  const queueItem: SyncQueueItem = {
    id: payload.id,
    payload,
    status: "PENDING",
    attempts: 0,
    queuedAt: Date.now(),
  };
  await db.put("sync_queue", queueItem);
}

export async function getPendingSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await getLocalDB();
    const all = await db.getAll("sync_queue");
    return all.filter((item) => item.status === "PENDING" || item.status === "FAILED");
  } catch {
    return [];
  }
}

export async function updateSyncStatus(
  id: string,
  status: "PENDING" | "SYNCING" | "FAILED" | "SYNCED",
  lastError?: string
): Promise<void> {
  try {
    const db = await getLocalDB();
    const item = await db.get("sync_queue", id);
    if (item) {
      item.status = status;
      if (lastError) item.lastError = lastError;
      if (status === "SYNCING") item.attempts += 1;
      await db.put("sync_queue", item);
    }
  } catch (err) {
    console.error("Failed to update sync status:", err);
  }
}

export async function removeSyncedItem(id: string): Promise<void> {
  try {
    const db = await getLocalDB();
    await db.delete("sync_queue", id);
  } catch (err) {
    console.error("Failed to remove synced item:", err);
  }
}

// Local Completed Runs Cache
export async function getCachedCompletedRuns(): Promise<CompletedRunPayload[]> {
  try {
    const db = await getLocalDB();
    const runs = await db.getAll("local_runs");
    return runs.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getCachedRunById(id: string): Promise<CompletedRunPayload | null> {
  try {
    const db = await getLocalDB();
    const run = await db.get("local_runs", id);
    return run || null;
  } catch {
    return null;
  }
}
