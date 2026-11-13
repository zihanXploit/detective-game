import type { CaseDefinition } from "@/domain/case/CaseDefinition";
import { engineCheck } from "./engineCheck";

/** Every case the app offers. Adding a case means writing its file and listing it here. */
export const ALL_CASES: readonly CaseDefinition[] = [engineCheck];
