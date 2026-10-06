/**
 * Screen Wake Lock API helper to prevent the phone display from sleeping while running.
 */

export class ScreenWakeManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isRequested = false;
  private listenerAttached = false;

  public async requestLock(): Promise<boolean> {
    this.isRequested = true;
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }

    if (!this.listenerAttached && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      this.listenerAttached = true;
    }

    try {
      if (!this.wakeLock || this.wakeLock.released) {
        this.wakeLock = await navigator.wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  public async releaseLock(): Promise<void> {
    this.isRequested = false;
    if (this.listenerAttached && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      this.listenerAttached = false;
    }

    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {
        // Ignore release errors
      }
      this.wakeLock = null;
    }
  }

  public isLockActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }

  private handleVisibilityChange = async () => {
    if (this.isRequested && document.visibilityState === "visible" && !this.wakeLock) {
      await this.requestLock();
    }
  };
}

export const wakeManager = new ScreenWakeManager();
