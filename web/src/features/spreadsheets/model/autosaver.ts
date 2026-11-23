// What the editor shows about the content on screen against the stored one.
export type SaveStatus = "saved" | "pending" | "saving" | "failed" | "conflict";

interface AutosaverOptions {
  // Milliseconds without a change before a save starts.
  delay: number;
  // Stores the content on screen; rejects when the server refuses it.
  save: () => Promise<void>;
  // Whether a rejection says another session saved first; no later save can succeed then.
  isConflict: (error: unknown) => boolean;
  onStatus: (status: SaveStatus) => void;
}

// Saves after each pause in the changes, one save at a time. A change made while a save runs
// starts another save after it; a conflict ends the saving until the page reloads the content.
export class Autosaver {
  private readonly options: AutosaverOptions;
  private status: SaveStatus = "saved";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private changedWhileSaving = false;

  constructor(options: AutosaverOptions) {
    this.options = options;
  }

  // Whether the screen holds a change the server does not.
  get dirty(): boolean {
    return this.status !== "saved";
  }

  touch(): void {
    if (this.status === "conflict") return;

    if (this.running !== undefined) {
      this.changedWhileSaving = true;
      return;
    }

    this.set("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.options.delay);
  }

  // Saves now what waits for the pause; resolves when the screen and the server agree or the
  // save failed.
  async flush(): Promise<void> {
    clearTimeout(this.timer);

    if (this.running !== undefined) {
      await this.running;
      return;
    }

    if (this.status === "saved" || this.status === "conflict") return;

    this.running = this.run();
    await this.running;
  }

  dispose(): void {
    clearTimeout(this.timer);
  }

  private async run(): Promise<void> {
    try {
      do {
        this.set("saving");
        await this.options.save();
      } while (this.takeChange());

      this.set("saved");
    } catch (error) {
      this.set(this.options.isConflict(error) ? "conflict" : "failed");
    } finally {
      this.running = undefined;
    }
  }

  // Whether a change arrived during the save that just ended; reading it clears it.
  private takeChange(): boolean {
    const changed = this.changedWhileSaving;
    this.changedWhileSaving = false;

    return changed;
  }

  private set(status: SaveStatus): void {
    if (status === this.status) return;

    this.status = status;
    this.options.onStatus(status);
  }
}
