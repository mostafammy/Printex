"use client";

import React, { useState } from "react";
import { Plus, ArrowRight, ArrowLeft, Layers, CheckCircle2 } from "lucide-react";
import type { ClientDepartment, ClientProductType, OrderItemState } from "./types";
import { WizardStepper } from "./WizardStepper";
import { Step1OrderMeta } from "./Step1OrderMeta";
import { ItemCard } from "./ItemCard";
import { Step3Review } from "./Step3Review";

export interface InteractiveNewOrderWizardProps {
  readonly cashCustomer: { id: string; label: string } | null;
  readonly departments: ClientDepartment[];
  readonly productTypes: ClientProductType[];
  readonly initialItemsCount: number;
}

export function InteractiveNewOrderWizard({
  cashCustomer,
  departments,
  productTypes,
  initialItemsCount,
}: InteractiveNewOrderWizardProps) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("WALK_IN");
  const [priority, setPriority] = useState("NORMAL");
  const [mode, setMode] = useState("GROUPED");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<OrderItemState[]>(() =>
    Array.from({ length: Math.max(1, initialItemsCount) }, (_, i) => ({
      id: `item_${i + 1}`,
      productTypeId: "",
      quantity: 1,
      widthValue: "",
      heightValue: "",
      dimensionUnit: "CM",
      departmentId: "",
      material: "",
      finishNotes: "",
      dueDate: "",
      requiresDesign: true,
      requiresReview: true,
      description: "",
    }))
  );

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}`,
        productTypeId: "",
        quantity: 1,
        widthValue: "",
        heightValue: "",
        dimensionUnit: "CM",
        departmentId: "",
        material: "",
        finishNotes: "",
        dueDate: "",
        requiresDesign: true,
        requiresReview: true,
        description: "",
      },
    ]);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, patch: Partial<OrderItemState>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper
        currentStep={step}
        totalSteps={3}
        itemCount={items.length}
        onStepSelect={(s) => setStep(s)}
      />

      <input type="hidden" name="itemCount" value={items.length} />

      {/* Step 1: Order Metadata */}
      <div className={step === 1 ? "block animate-in fade-in duration-300" : "hidden"}>
        <Step1OrderMeta
          cashCustomer={cashCustomer}
          channel={channel}
          priority={priority}
          mode={mode}
          dueDate={dueDate}
          onChannelChange={setChannel}
          onPriorityChange={setPriority}
          onModeChange={setMode}
          onDueDateChange={setDueDate}
        />
      </div>

      {/* Step 2: Work Items Configuration */}
      <div className={step === 2 ? "flex flex-col gap-5 animate-in fade-in duration-300" : "hidden"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-base font-black text-foreground">
              أصناف العمل وتفاصيل الإنتاج ({items.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary shadow-xs hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة صنف آخر</span>
          </button>
        </div>

        {items.map((item, idx) => (
          <ItemCard
            key={item.id}
            item={item}
            index={idx}
            departments={departments}
            productTypes={productTypes}
            canDelete={items.length > 1}
            onChange={handleItemChange}
            onDelete={handleDeleteItem}
          />
        ))}
      </div>

      {/* Step 3: Review & Summary */}
      <div className={step === 3 ? "block animate-in fade-in duration-300" : "hidden"}>
        <Step3Review
          channel={channel}
          priority={priority}
          mode={mode}
          dueDate={dueDate}
          items={items}
          isSubmitting={isSubmitting}
          onEditStep={(s) => setStep(s)}
        />
      </div>

      {/* ── Wizard Floating Navigation Footer ── */}
      <div className="sticky bottom-4 z-20 mt-4 flex items-center justify-between rounded-3xl border border-white/20 bg-card/80 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-card/70">
        <div>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-background/80 px-5 py-2.5 text-xs font-bold text-foreground shadow-2xs hover:bg-muted active:scale-95 transition-all"
            >
              <ArrowRight className="h-4 w-4" />
              <span>المرحلة السابقة</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-3">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(3, s + 1))}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-xs font-black text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <span>المتابعة إلى {step === 1 ? "مواصفات الأصناف" : "المراجعة والتأكيد"}</span>
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              onClick={() => setIsSubmitting(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3 text-xs font-black text-white shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? "جاري الحفظ..." : "إصدار وتأكيد أمر الشغل"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
