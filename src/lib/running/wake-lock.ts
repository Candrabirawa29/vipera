/**
 * Screen Wake Lock API helper to prevent the phone display from sleeping while running.
 */

export class ScreenWakeManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isRequested = false;

  public async requestLock(): Promise<boolean> {
    this.isRequested = true;
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => {
        // Re-acquire if still requested and page became visible again
        this.wakeLock = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  public async releaseLock(): Promise<void> {
    this.isRequested = false;
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch {
        // Ignore release errors
      }
      this.wakeLock = null;
    }
  }

  public handleVisibilityChange = async () => {
    if (this.isRequested && document.visibilityState === "visible" && !this.wakeLock) {
      await this.requestLock();
    }
  };
}

export const wakeManager = new ScreenWakeManager();
