import type { RoomOptions } from "../net/roomOptions";
export interface CouchSetup { options: RoomOptions; players: number; keyboard: boolean }
let prepared: CouchSetup | null = null;
export function prepareCouch(setup: CouchSetup): void { prepared = setup; }
export function takeCouch(): CouchSetup | null { const setup = prepared; prepared = null; return setup; }
export function hasCouch(): boolean { return prepared !== null; }
