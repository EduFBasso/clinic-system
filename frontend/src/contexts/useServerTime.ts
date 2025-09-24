import { useContext } from 'react';
import { Ctx } from './ServerTimeCore';
import type { ServerTimeContextValue } from './ServerTimeCore';

export function useServerTime() {
    return useContext(Ctx) as ServerTimeContextValue | null;
}
