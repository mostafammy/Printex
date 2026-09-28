/**
 * Touch and pointer sensors configuration for @dnd-kit/core.
 * (research.md R7, FR-035b, plan.md S1)
 */

import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

export function useBoardSensors() {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 8,
    },
  });

  return useSensors(pointerSensor, touchSensor);
}
