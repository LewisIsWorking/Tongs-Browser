import type { Page } from 'playwright';

import { PROBE_PREFIX } from '../foundry-session.ts';
import type { Recorder } from './recorder.ts';

/**
 * Natural Ambition's picker, opened for real on a dual class sheet. Added 2026-11-23, after #504.
 *
 * ⭐ WHAT IT PROVES. PF2e's own ChoiceSet prompt, on a real PF2e, lists class feats of BOTH classes on a
 *    Tongs dual class, and still only one class on an ordinary sheet. The unit tests prove the filter
 *    rewrite; only a real world proves PF2e calls the wrapped `queryCompendium` and shows what it returns.
 * ⚠️ THE DUAL CLASS is built here the way `buildDualClass` builds it (first class as the base, its name
 *    "Class1 - Class2", a `class:<second>` RollOption, then the second class's rules), since the module
 *    does not export it. The widening keys on exactly that name and RollOption.
 * ⚠️ The sheets are created with their items in ONE `Actor.create`, so no class feature asks its own
 *    question first. Every sheet is named with PROBE_PREFIX and deleted afterwards, by name.
 */
const SHEET = `${PROBE_PREFIX} Tongs class feat choices`;

/** One feat the picker offered, with the traits its compendium entry carries. */
interface Offered {
  readonly name: string;
  readonly traits: readonly string[];
}

interface PickerOutcome {
  readonly classTrait: string;
  readonly offered: readonly Offered[];
  /** How many of the offered names are in the picker's rendered HTML, not just its data. */
  readonly rendered: number;
}

/** Opens Natural Ambition's picker on a new sheet of `slugs` (two = a dual class) and reads it. */
async function openNaturalAmbition(page: Page, slugs: readonly string[]): Promise<PickerOutcome> {
  return page.evaluate(
    async ({ name, classes }) => {
      const wait = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const source = async (key: string, slug: string) => {
        const pack = game.packs.get(key);
        const index = await pack.getIndex({ fields: ['system.slug'] });
        const entry = index.find(
          (each: { system?: { slug?: string } }) => each.system?.slug === slug
        );
        if (entry === undefined) {
          throw new Error(`${key} has no ${slug}`);
        }
        const data = (await pack.getDocument(entry._id)).toObject();
        delete data._id;
        return data;
      };
      const [first, second] = await Promise.all(
        classes.map(async (slug) => source('pf2e.classes', slug))
      );
      let klass = first;
      if (second !== undefined) {
        const system = structuredClone(first.system);
        const rules = [...(system.rules ?? [])];
        rules.push({
          domain: 'all',
          key: 'RollOption',
          option: `class:${second.system.slug}`,
          priority: 0,
        });
        const seen = new Set(rules.map((rule) => JSON.stringify(rule)));
        for (const rule of second.system.rules ?? []) {
          if (!seen.has(JSON.stringify(rule))) {
            seen.add(JSON.stringify(rule));
            rules.push(rule);
          }
        }
        klass = {
          name: `${first.name} - ${second.name}`,
          type: 'class',
          img: first.img,
          system: { ...system, rules },
        };
      }
      const human = await source('pf2e.ancestries', 'human');
      const actor = await Actor.create({ name, type: 'character', items: [human, klass] });

      const apps = () => [
        ...(foundry.applications.instances?.values() ?? []),
        ...Object.values(ui.windows ?? {}),
      ];
      const before = new Set(apps());
      const feat = await source('pf2e.feats-srd', 'natural-ambition');
      const adding = actor.createEmbeddedDocuments('Item', [feat]).catch((error: unknown) => error);
      let prompt;
      for (let tries = 0; prompt === undefined && tries < 240; tries += 1) {
        await wait(250);
        prompt = apps().find((app) => !before.has(app) && Array.isArray(app.choices));
      }
      if (prompt === undefined) {
        throw new Error('Natural Ambition opened no ChoiceSet prompt within 60 s');
      }
      await wait(500);
      const html = prompt.element?.[0]?.innerHTML ?? prompt.element?.innerHTML ?? '';
      const choices: { value?: unknown; label?: string }[] = prompt.choices;
      const index = await game.packs
        .get('pf2e.feats-srd')
        .getIndex({ fields: ['system.traits.value'] });
      const traitsOf = (uuid: unknown) =>
        index.find((each: { uuid?: string }) => each.uuid === uuid)?.system?.traits?.value ?? [];
      const offered = choices.map((choice) => ({
        name: String(choice.label ?? choice.value),
        traits: traitsOf(choice.value),
      }));
      await prompt.close();
      await Promise.race([adding, wait(10_000)]);
      return {
        classTrait: String(actor.system?.details?.class?.trait ?? actor.class?.slug ?? ''),
        offered,
        rendered: offered.filter((each) => html.includes(each.name)).length,
      };
    },
    { name: `${SHEET} ${slugs.join(' ')}`, classes: [...slugs] }
  );
}

/** Deletes every sheet this check made, by its name, so a crashed run's leftovers go too. */
async function removeSheets(page: Page): Promise<void> {
  await page
    .evaluate(async (prefix) => {
      const ids = game.actors
        .filter((actor: { name?: string }) => actor.name?.startsWith(prefix))
        .map((actor: { id: string }) => actor.id);
      await Actor.deleteDocuments(ids);
    }, SHEET)
    .catch((error: unknown) =>
      console.error(`could not delete the probe sheets: ${String(error)}`)
    );
}

const only = (feats: readonly Offered[], mine: string, not: string) =>
  feats
    .filter((feat) => feat.traits.includes(mine) && !feat.traits.includes(not))
    .map((feat) => feat.name);

const describe = (outcome: PickerOutcome) =>
  `class trait ${outcome.classTrait}, ${outcome.offered.length} offered (${outcome.rendered} in the HTML): ` +
  outcome.offered.map((feat) => feat.name).join(', ');

/** Thaumaturge - Cleric gets both classes' feats; a Cleric gets only the cleric's. */
export async function checkClassFeatChoices(page: Page, recorder: Recorder): Promise<void> {
  const ready = await page.evaluate(
    () =>
      game.system?.id === 'pf2e' &&
      ['pf2e.classes', 'pf2e.feats-srd'].every((key) => game.packs.get(key))
  );
  if (!ready) {
    recorder.skip('dual class feat choices', 'not a PF2e world with the classes and feats packs');
    return;
  }
  try {
    const dual = await openNaturalAmbition(page, ['thaumaturge', 'cleric']);
    const cleric = only(dual.offered, 'cleric', 'thaumaturge');
    const thaumaturge = only(dual.offered, 'thaumaturge', 'cleric');
    const stray = dual.offered.filter(
      (f) => !f.traits.includes('cleric') && !f.traits.includes('thaumaturge')
    );
    recorder.record(
      'a dual class Natural Ambition offers both classes',
      cleric.includes('Healing Hands') &&
        thaumaturge.length > 0 &&
        stray.length === 0 &&
        dual.rendered > 0,
      `cleric only [${cleric.join(', ')}], thaumaturge only [${thaumaturge.join(', ')}]; ${describe(dual)}`
    );

    const single = await openNaturalAmbition(page, ['cleric']);
    const foreign = single.offered.filter((feat) => !feat.traits.includes('cleric'));
    recorder.record(
      'a single class Natural Ambition offers only its class',
      single.offered.length > 0 &&
        foreign.length === 0 &&
        only(single.offered, 'cleric', '').includes('Healing Hands'),
      `not cleric [${foreign.map((feat) => feat.name).join(', ')}]; ${describe(single)}`
    );
  } finally {
    await removeSheets(page);
  }
}
