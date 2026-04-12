import { useContext } from 'react';
import { PlanContext } from '../contexts/PlanContext';
import type { PlanContextType } from '../contexts/PlanContext';

export function usePlan(): PlanContextType {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
