/**
 * ⏳ A loading screen over Foundry's black start-up (2026-10-04).
 *
 * Lewis: "I'm just getting a black screen for 1 or 2 minutes ... the black screen doesn't have a loading bar".
 * Foundry prepares every world actor before it draws anything, and on a big world (doomsday-funtime: 47 MB of
 * actors) that holds the page's main thread for a minute or more; even DevTools will not open. Nothing written
 * in JavaScript can update while that runs, so the bar's motion is a CSS `transform` animation, which browsers
 * run on the compositor thread and keep moving while the page itself is blocked. The stage text changes between
 * Foundry's start-up hooks, the only moments the page is free.
 */

const ROOT_ID = 'tongs-loading-overlay';

const CSS = `
#${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center;
  background: #0b0b0e; color: #e6e6ea; font-family: system-ui, sans-serif; pointer-events: none;
  transition: opacity .4s ease; }
#${ROOT_ID}.tongs-leaving { opacity: 0; }
#${ROOT_ID} .tongs-loading-card { width: min(28rem, 90vw); text-align: center; }
#${ROOT_ID} .tongs-loading-title { font-size: 1.15rem; margin: 0 0 .4rem; }
#${ROOT_ID} .tongs-loading-stage { color: #a8a8b3; margin: 0 0 1rem; min-height: 1.3em; }
#${ROOT_ID} .tongs-loading-bar { height: 6px; border-radius: 3px; overflow: hidden; background: #26262c; }
#${ROOT_ID} .tongs-loading-bar > div { width: 30%; height: 100%; background: #c9a227;
  animation: tongs-loading-slide 1.4s ease-in-out infinite; will-change: transform; }
#${ROOT_ID} .tongs-loading-hint { color: #7d7d88; font-size: .85rem; margin-top: 1rem; }
@keyframes tongs-loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(340%); } }
`;

/** The loading screen itself: one element, added once, replaced text, removed once. */
export class LoadingOverlay {
  private root: HTMLElement | null = null;

  public constructor(private readonly doc: Document) {}

  public get isShowing(): boolean {
    return this.root !== null;
  }

  /** Adds the screen if it is not already there. Safe before `<body>` exists: it waits for it. */
  public show(title: string, stage: string): void {
    if (this.root || this.doc.getElementById(ROOT_ID)) return;
    const root = this.doc.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'progressbar');
    root.setAttribute('aria-label', 'Loading the world');
    root.innerHTML =
      `<style>${CSS}</style><div class="tongs-loading-card">` +
      '<p class="tongs-loading-title"></p><p class="tongs-loading-stage"></p>' +
      '<div class="tongs-loading-bar"><div></div></div>' +
      '<p class="tongs-loading-hint">Big worlds can take a minute or two to open. Hang tight.</p></div>';
    this.root = root;
    this.setTitle(title);
    this.setStage(stage);
    // Foundry's types say <body> always exists; on a page still parsing it may not, so check it as nullable.
    const body = (): HTMLElement | null => this.doc.querySelector('body');
    const attach = (): void => {
      if (this.root === root) (body() ?? this.doc.documentElement).append(root);
    };
    if (body()) attach();
    else this.doc.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  public setTitle(title: string): void {
    const el = this.root?.querySelector('.tongs-loading-title');
    if (el) el.textContent = title;
  }

  public setStage(stage: string): void {
    const el = this.root?.querySelector('.tongs-loading-stage');
    if (el) el.textContent = stage;
  }

  /** Fades the screen out and removes it. */
  public hide(fadeMs = 400): void {
    const root = this.root;
    if (!root) return;
    this.root = null;
    root.classList.add('tongs-leaving');
    setTimeout(() => {
      root.remove();
    }, fadeMs);
  }
}
