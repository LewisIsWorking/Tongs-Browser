import { describeImport, readImportBuild } from './importBuild.js';
import type { ImportBuild } from './importBuild.js';

/**
 * The welcome's optional "start from a ComeOnOver character" file picker. Added 2026-10-05.
 *
 * Reads the file in the player's browser and says at once what it found ("Theo: Level 1 Dwarf Fighter")
 * or that it is not a ComeOnOver Foundry export, so a wrong file is caught before anything is asked of a
 * GM. A name read from the file fills the name box if the player has not typed one.
 */
export const MAX_IMPORT_BYTES = 512 * 1024;

export class ImportPicker {
  private build: ImportBuild | null = null;
  private readonly status: HTMLElement;

  public constructor(
    private readonly doc: Document,
    card: HTMLElement,
    private readonly name: HTMLInputElement
  ) {
    const label = this.doc.createElement('label');
    label.textContent = 'Start from a ComeOnOver character (optional)';
    const input = this.doc.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.id = 'tongs-welcome-import';
    label.htmlFor = input.id;
    this.status = this.doc.createElement('p');
    this.status.className = 'tw-import-status';
    this.status.textContent = 'Export it from the Character Creator or Viewer as "Foundry VTT".';
    card.append(label, input, this.status);
    input.addEventListener('change', () => {
      void this.read(input.files?.[0]);
    });
  }

  public get chosen(): ImportBuild | null {
    return this.build;
  }

  /** Public for tests: what choosing a file does. */
  public async read(file: Blob | undefined): Promise<void> {
    this.build = null;
    if (file === undefined) {
      this.status.textContent = '';
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      this.status.textContent = 'That file is too big to be a character export.';
      return;
    }
    const build = readImportBuild(parseJson(await file.text()));
    if (build === null || build.items.length === 0) {
      this.status.textContent = 'That is not a ComeOnOver "Foundry VTT" character export.';
      return;
    }
    this.build = build;
    if (this.name.value.trim() === '' && build.name !== '') {
      this.name.value = build.name;
    }
    const who = build.name === '' ? '' : `${build.name}: `;
    this.status.textContent = `Will import ${who}${describeImport(build)}.`;
  }
}

/** A file that is not JSON reads as nothing, the same as JSON that is not a character. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
