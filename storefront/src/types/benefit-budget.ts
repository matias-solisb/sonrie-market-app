// Respuesta de GET /store/benefit-budget (backend: módulo benefit-budget).
// Montos en CLP enteros. `periodo` es "YYYY-MM" en hora de Santiago.
export type StoreBenefitBudget = {
  periodo: string
  tope: number
  consumido: number
  disponible: number
  campaign: { id: string; nombre: string }
}
