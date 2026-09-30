/**
 * Barrel for all EdgeHandler families and registry helper.
 * (contracts/board-server.md §EdgeCatalog, plan.md S1)
 */

import { EdgeCatalog, type EdgeHandler } from "../edgeCatalog";
import { approvedHandoffEdges } from "./approvedHandoff";
import { cancelEdges } from "./cancel";
import { collectionEdges } from "./collection";
import { designEdges } from "./design";
import { designHandoffEdges } from "./designHandoff";
import { adminSendBackEdges } from "./adminSendBack";
import { pricingEdges } from "./pricing";
import { productionEdges } from "./production";
import { receptionEdges } from "./reception";
import { reviewEdges } from "./review";
import { systemEdges } from "./system";

export const ALL_EDGE_HANDLERS: readonly EdgeHandler[] = [
  ...receptionEdges,
  ...designEdges,
  ...designHandoffEdges,
  ...adminSendBackEdges,
  ...reviewEdges,
  ...approvedHandoffEdges,
  ...productionEdges,
  ...systemEdges,
  ...pricingEdges,
  ...collectionEdges,
  ...cancelEdges,
];

export function registerDefaultEdges(catalog: EdgeCatalog): EdgeCatalog {
  for (const handler of ALL_EDGE_HANDLERS) {
    catalog.register(handler);
  }
  return catalog;
}

export function createDefaultEdgeCatalog(): EdgeCatalog {
  const catalog = new EdgeCatalog();
  return registerDefaultEdges(catalog);
}

export const edgeCatalog: EdgeCatalog = createDefaultEdgeCatalog();

export {
  approvedHandoffEdges,
  cancelEdges,
  collectionEdges,
  designEdges,
  designHandoffEdges,
  adminSendBackEdges,
  pricingEdges,
  productionEdges,
  receptionEdges,
  reviewEdges,
  systemEdges,
};
