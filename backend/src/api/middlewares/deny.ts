import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";

/** Middleware que corta la petición con 403 y el mensaje indicado. */
export const deny =
  (message: string) =>
  (_req: MedusaRequest, res: MedusaResponse, _next: MedusaNextFunction) => {
    res.status(403).json({ type: "not_allowed", message });
  };
