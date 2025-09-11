import { useEffect, useState } from 'react';

export function useNow(tickMs = 60000) {
    const [now, setNow] = useState<Date>(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), Math.max(250, tickMs));
        return () => clearInterval(id);
    }, [tickMs]);
    return now;
}
