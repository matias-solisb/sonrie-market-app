import { medusaIntegrationTestRunner } from "@medusajs/test-utils";

type RunnerOptions = Parameters<typeof medusaIntegrationTestRunner>[0];

/**
 * Reemplazo de medusaIntegrationTestRunner para una suite desactivada:
 * no levanta la app ni la BD y deja la suite marcada como "skipped".
 */
export const skippedSuite =
  (reason: string) =>
  (_options: RunnerOptions): void => {
    describe.skip(reason, () => {
      it("suite desactivada", () => {});
    });
  };
