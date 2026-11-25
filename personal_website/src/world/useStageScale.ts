// Measures the stage area and keeps the stage at the largest crisp scale that fits (ENGINE.md section 5).
import { computeMetrics, currentDpr, sameMetrics, type StageMetrics } from './pixels';
import { useMeasured } from './useMeasured';

export type StageScale = {
  /** Put this on the element whose box is the area available to the stage. */
  areaRef: (element: HTMLElement | null) => void;
  metrics: StageMetrics;
};

/** Before the area is in the page: the window, less a status bar of the usual height. */
const guess = (): StageMetrics => computeMetrics(window.innerWidth, Math.max(1, window.innerHeight - 32), currentDpr());

function measure(area: HTMLElement): StageMetrics | null {
  const rect = area.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return computeMetrics(rect.width, rect.height, currentDpr());
}

export function useStageScale(): StageScale {
  const { ref, value } = useMeasured(guess, measure, sameMetrics);
  return { areaRef: ref, metrics: value };
}
