import {
  getPendingSyncQueue,
  updateSyncStatus,
  removeSyncedItem,
  SyncQueueItem,
} from "./indexed-db";

export type GlobalSyncStatus = "IDLE" | "SYNCING" | "OFFLINE" | "SYNCED" | "FAILED";

type SyncListener = (status: GlobalSyncStatus, pendingCount: number) => void;

class SyncEngine {
  private isSyncing = false;
  private listeners = new Set<SyncListener>();
  private currentStatus: GlobalSyncStatus = "IDLE";

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.notifyStatus("IDLE");
        this.processQueue();
      });

      window.addEventListener("offline", () => {
        this.notifyStatus("OFFLINE");
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus, 0);
    return () => this.listeners.delete(listener);
  }

  private notifyStatus(status: GlobalSyncStatus, count = 0) {
    this.currentStatus = status;
    this.listeners.forEach((cb) => cb(status, count));
  }

  public async processQueue(): Promise<void> {
    if (typeof window === "undefined" || this.isSyncing) return;
    if (!navigator.onLine) {
      this.notifyStatus("OFFLINE");
      return;
    }

    const pending = await getPendingSyncQueue();
    if (pending.length === 0) {
      this.notifyStatus("SYNCED", 0);
      return;
    }

    this.isSyncing = true;
    this.notifyStatus("SYNCING", pending.length);

    let hasFailures = false;

    for (const item of pending) {
      try {
        await updateSyncStatus(item.id, "SYNCING");

        const response = await fetch("/api/runs/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item.payload),
        });

        if (response.ok) {
          await removeSyncedItem(item.id);
        } else {
          const errText = await response.text();
          await updateSyncStatus(item.id, "FAILED", `Server status ${response.status}: ${errText}`);
          hasFailures = true;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        await updateSyncStatus(item.id, "FAILED", message);
        hasFailures = true;
      }
    }

    this.isSyncing = false;
    const remaining = await getPendingSyncQueue();
    if (hasFailures || remaining.length > 0) {
      this.notifyStatus("FAILED", remaining.length);
    } else {
      this.notifyStatus("SYNCED", 0);
    }
  }
}

export const syncEngine = new SyncEngine();
