import { FSRS, generatorParameters, createEmptyCard, Rating, Card, State } from "ts-fsrs";

const params = generatorParameters({ enable_fuzz: true });
export const fsrs = new FSRS(params);
export { createEmptyCard, Rating, State };
export type { Card };
