import type { TrayAction } from '../modifiers/ModifierBar.js';
import { PAN_STEP, type TrayActionHandlers } from './TrayActions.js';

/**
 * The four pan arrows. Moved out of `TrayActionList` 2026-10-12, when the dual class button took that
 * file to its 200 line limit. Spread into the list where they always stood, so the order is unchanged.
 */
export function panButtons(handlers: TrayActionHandlers): readonly TrayAction[] {
  return [
    /*
     * ⚠️ The signs match panBy's finger metaphor, and they read backwards on purpose. Pressing right
     * moves the VIEW right, which is the same as dragging the map LEFT, so the delta is negated.
     * Getting this wrong produces buttons that work perfectly and go the wrong way, which no build
     * and no type can catch.
     */
    {
      id: 'pan-left',
      label: '←',
      title: 'Pan left',
      group: 'pan',
      activate: () => {
        handlers.panBy(PAN_STEP, 0);
      },
    },
    {
      id: 'pan-right',
      label: '→',
      title: 'Pan right',
      group: 'pan',
      activate: () => {
        handlers.panBy(-PAN_STEP, 0);
      },
    },
    {
      id: 'pan-up',
      label: '↑',
      title: 'Pan up',
      group: 'pan',
      activate: () => {
        handlers.panBy(0, PAN_STEP);
      },
    },
    {
      id: 'pan-down',
      label: '↓',
      title: 'Pan down',
      group: 'pan',
      activate: () => {
        handlers.panBy(0, -PAN_STEP);
      },
    },
  ];
}
