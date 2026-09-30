export interface ClientDepartment {
  readonly id: string;
  readonly name: string;
}

export interface ClientProductType {
  readonly id: string;
  readonly name: string;
  readonly defaultDepartmentId: string | null;
  readonly defaultRequiresDesign: boolean;
  readonly defaultRequiresReview: boolean;
}

export interface OrderItemState {
  readonly id: string;
  productTypeId: string;
  quantity: number | "";
  widthValue: number | "";
  heightValue: number | "";
  dimensionUnit: "MM" | "CM" | "M" | "IN";
  departmentId: string;
  material: string;
  finishNotes: string;
  dueDate: string;
  requiresDesign: boolean;
  requiresReview: boolean;
  description: string;
}
