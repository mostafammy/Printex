import React from "react";
import { User, CheckCircle2, ChevronRight, Layers } from "lucide-react";

export interface WizardStepperProps {
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly itemCount: number;
  readonly onStepSelect: (step: number) => void;
}

const STEPS = [
  { step: 1, title: "العميل والتسليم", subtitle: "تحديد جهة الطلب والأولوية", icon: User },
  { step: 2, title: "مواصفات الأصناف", subtitle: "المقاسات والخامات والكميات", icon: Layers },
  { step: 3, title: "المراجعة والتأكيد", subtitle: "التدقيق النهائي وتجهيز أمر الشغل", icon: CheckCircle2 },
];

export function WizardStepper({ currentStep, onStepSelect }: WizardStepperProps) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/20 bg-card/60 p-4 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-card/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step;

          return (
            <React.Fragment key={s.step}>
              <button
                type="button"
                onClick={() => onStepSelect(s.step)}
                className={`group flex flex-1 items-center gap-3.5 rounded-2xl p-3 text-start transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
                    : isDone
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black transition-transform duration-300 group-hover:scale-110 ${
                    isActive
                      ? "bg-white/20 text-white shadow-inner"
                      : isDone
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-bold uppercase tracking-wider opacity-75">
                      المرحلة 0{s.step}
                    </span>
                    {isActive && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-white animate-ping" />
                    )}
                  </div>
                  <span className="truncate text-sm font-black tracking-tight">{s.title}</span>
                  <span className="truncate text-2xs opacity-80">{s.subtitle}</span>
                </div>
              </button>

              {idx < STEPS.length - 1 && (
                <div className="hidden sm:flex items-center text-muted-foreground/30 px-1">
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
