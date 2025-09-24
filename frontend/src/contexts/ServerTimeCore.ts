import { createContext } from 'react';

export interface ServerTimeContextValue {
    effectiveNow: Date;
    offsetMs: number;
    ready: boolean;
    resync: () => void;
}

export const Ctx = createContext<ServerTimeContextValue | null>(null);
