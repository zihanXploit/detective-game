import type { CaseDefinition } from "@/domain/case/CaseDefinition";
import { engineCheck } from "./engineCheck";
import { nightService47 } from "./nightService47";

/** Every case the app offers. Adding a case means writing its file and listing it here. */
export const ALL_CASES: readonly CaseDefinition[] = [nightService47, engineCheck];
