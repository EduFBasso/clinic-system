import { createContext } from 'react';

export interface ServerTimeContextValue {
    effectiveNow: Date;
    offsetMs: number;
    ready: boolean;
    resync: () => void;
    timezone: string; // IANA timezone id used for display (e.g., 'America/Sao_Paulo')
    setTimezone: (tz: string) => void; // update preference
    lastSyncAt: Date | null; // when last successful sync ended
}

export const Ctx = createContext<ServerTimeContextValue | null>(null);
