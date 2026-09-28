/**
 * Abstract BoardCommand: base class for optimistic undoable board commands.
 * (contracts/board-engine.md §Commands, plan.md S1)
 */

export type CommandState =
  | "created"
  | "applied"
  | "committed"
  | "rolledBack"
  | "superseded";

export type CancelReason = "superseded" | "aborted" | "stale";

export interface CommandOutcome {
  readonly success: boolean;
  readonly messageAr?: string;
}

export abstract class BoardCommand {
  protected _state: CommandState = "created";

  get state(): CommandState {
    return this._state;
  }

  abstract execute(): Promise<CommandOutcome>;

  cancel(reason: CancelReason): void {
    if (this._state === "created" || this._state === "applied") {
      this._state = reason === "superseded" ? "superseded" : "rolledBack";
    }
  }
}
