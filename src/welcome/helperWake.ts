/**
 * When the player's browser asks COO for its helper GM on the welcome's behalf. Added 2026-10-16.
 *
 * 🔔 AmazingRed (C00/C01, 2026-10-15) asked for a character at night and had none by morning: the helper GM was
 *    only called at the moment of asking, so one call turned away (COO allows one visit at a time, ten an hour)
 *    left the request waiting until a GM happened by. Lewis: "wake up TONGs ... when a player joins a world or
 *    requests a sheet", not on a timer. So each page load calls once for a request still waiting, and once for
 *    a party list nobody has shared yet. `HelperCall` still sends nothing while a GM is online, and at most
 *    once a minute.
 */
export class HelperWake {
  private partyList = false;
  private request: string | null = null;

  public constructor(private readonly summon: () => void) {}

  /** No party list shared yet: COO's helper GM shares it (partyListWork.ts). Once per page load. */
  public forPartyList(): void {
    if (!this.partyList) {
      this.partyList = true;
      this.summon();
    }
  }

  /** A sheet request still waiting: once per page load for each request. */
  public forRequest(id: string): void {
    if (this.request !== id) {
      this.request = id;
      this.summon();
    }
  }
}
