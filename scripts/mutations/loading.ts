import type { RecordedMutation } from './shape.ts';

/**
 * The loading screen percentage's mutations. Added 2026-11-14.
 *
 * Each still shows a percentage that moves, which is why a glance at a loading world would pass every one: it is
 * just a number that says done too early, goes backwards, keeps counting down after the time ran out, or learns
 * the wrong lesson from this load for the next.
 */
export const LOADING_MUTATIONS: readonly RecordedMutation[] = [
  {
    file: 'src/ui/loadingEstimate.ts',
    find: '  const fill = Math.min(MAX_PERCENT, Math.max(1, start + width * share));',
    replace: '  const fill = Math.max(1, start + width * share);',
    defect: 'a world still loading says 99% and then sits there',
    tests: ['tests/unit/loadingEstimate.test.ts'],
  },
  {
    file: 'src/ui/loadingEstimate.ts',
    find: '  const slow = measured && real === null && elapsed > usual;',
    replace: '  const slow = false;',
    defect: 'a load running long still says "a few seconds left" long after they have gone',
    tests: ['tests/unit/loadingEstimate.test.ts'],
  },
  {
    file: 'src/ui/loadingEstimate.ts',
    find: '  const measured = LOADING_ORDER.slice(index).every((stage) => typical[stage] !== undefined);',
    replace:
      '  const measured = LOADING_ORDER.slice(index).some((stage) => typical[stage] !== undefined);',
    defect: 'a time left is given from guesses for stages this world has never been timed in',
    tests: ['tests/unit/loadingEstimate.test.ts'],
  },
  {
    file: 'src/ui/LoadingProgress.ts',
    find: "    if (this.stage === 'draw') this.took.draw = (this.now() - this.stageAt) / 1000;",
    replace: '    this.took[this.stage] = (this.now() - this.stageAt) / 1000;',
    defect:
      'a world opened without a map remembers the whole map wait as setup, so its next load expects a long setup',
    tests: ['tests/unit/loadingProgress.test.ts'],
  },
  {
    file: 'src/ui/loadingHistory.ts',
    find: '.slice(-LOADING_SAMPLES);',
    replace: '.slice(0, LOADING_SAMPLES);',
    defect: 'a world that got quicker keeps showing the time its first few loads took',
    tests: ['tests/unit/loadingHistory.test.ts'],
  },
  {
    file: 'src/ui/loadingHistory.ts',
    find: '      // Full, blocked or missing: this load simply is not remembered.',
    replace: "      throw new Error('storage refused');",
    defect: 'a browser that refuses storage gets an error at ready instead of a world',
    tests: ['tests/unit/loadingHistory.test.ts'],
  },
  {
    file: 'src/ui/startLoadingOverlay.ts',
    find: '      percent: Math.max(shown.percent, view.percent),',
    replace: '      percent: view.percent,',
    defect: 'the percentage drops back when this world turns out quicker than the one opened last',
    tests: ['tests/dom/loadingOverlayProgress.test.ts'],
  },
  {
    file: 'src/ui/startLoadingOverlay.ts',
    find: "    const real = progress.current === 'textures' ? foundryPictureProgress(doc) : null;",
    replace: '    const real = foundryPictureProgress(doc);',
    defect:
      'any progress notice on the page moves the bar while characters are still being prepared',
    tests: ['tests/dom/loadingOverlayProgress.test.ts'],
  },
];
