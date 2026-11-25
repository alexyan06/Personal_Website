import { createContext, useContext } from 'react';
import { computeMetrics, type StageMetrics } from './pixels';

/** The stage's scale, for everything positioned over the art. */
export const StageContext = createContext<StageMetrics>(computeMetrics(1280, 720, 1));

export const useStageMetrics = () => useContext(StageContext);
