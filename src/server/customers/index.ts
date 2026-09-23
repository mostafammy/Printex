export { normalizePhone } from "./normalizePhone";
export { normalizeCustomerName } from "./normalizeName";
export { createCustomer, findCustomers, getCustomer } from "./service";
export { archiveCustomer, updateCustomer } from "./update";
export { createClassification, deactivateClassification, findClassifications, updateClassification } from "./classifications";
export { promoteCashBuyer, reversePromotion } from "./promotion";
export { customerInput, customerSearchQuery } from "./schemas";
export type { CustomerInput, CustomerSearchQuery } from "./schemas";
