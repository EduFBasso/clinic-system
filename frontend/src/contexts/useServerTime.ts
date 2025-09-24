import { useContext } from 'react';
import { Ctx } from './ServerTimeContext';
import type { ServerTimeContextValue } from './ServerTimeContext';

export function useServerTime() {
    return useContext(Ctx) as ServerTimeContextValue | null;
}
