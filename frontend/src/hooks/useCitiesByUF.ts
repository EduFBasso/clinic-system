import { useEffect, useMemo, useState } from 'react';
import { BR_CITIES_FALLBACK } from '../data/br-cities-fallback';

type City = { id: number; name: string };
type IbgeCity = { id?: number; nome?: string };

// Simple in-memory cache per session
const memCache: Record<string, City[]> = {};

function cacheKey(uf: string) {
    return `ibge.cities.${uf}.v1`;
}

export function useCitiesByUF(uf: string | undefined) {
    const ufCode = (uf || '').toUpperCase();
    const [cities, setCities] = useState<City[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ufCode) {
            setCities([]);
            setLoading(false);
            setError(null);
            return;
        }

        // Memory cache
        if (memCache[ufCode]) {
            setCities(memCache[ufCode]);
            setLoading(false);
            setError(null);
            return;
        }

        // localStorage cache (TTL 7d)
        try {
            const raw = localStorage.getItem(cacheKey(ufCode));
            if (raw) {
                const parsed = JSON.parse(raw) as { ts: number; data: City[] };
                const age = Date.now() - parsed.ts;
                if (age < 7 * 24 * 60 * 60 * 1000) {
                    memCache[ufCode] = parsed.data;
                    setCities(parsed.data);
                    setLoading(false);
                    setError(null);
                    return;
                }
            }
        } catch {
            // ignore storage or JSON errors
        }

        let aborted = false;
        setLoading(true);
        setError(null);

        const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(
            ufCode,
        )}/municipios?orderBy=nome`;

        fetch(url)
            .then(async res => {
                if (!res.ok) throw new Error(`IBGE ${res.status}`);
                return res.json();
            })
            .then((arr: unknown) => {
                if (aborted) return;
                const list = Array.isArray(arr) ? (arr as IbgeCity[]) : [];
                const data: City[] = list
                    .filter(
                        x =>
                            typeof x?.nome === 'string' &&
                            typeof x?.id === 'number',
                    )
                    .map(x => ({ id: x.id as number, name: x.nome as string }));
                memCache[ufCode] = data;
                try {
                    localStorage.setItem(
                        cacheKey(ufCode),
                        JSON.stringify({ ts: Date.now(), data }),
                    );
                } catch {
                    // ignore storage quota errors
                }
                setCities(data);
                setLoading(false);
            })
            .catch(err => {
                if (aborted) return;
                const fallback = BR_CITIES_FALLBACK[ufCode];
                if (fallback && fallback.length) {
                    const data = fallback.map((name, i) => ({
                        id: i + 1,
                        name,
                    }));
                    memCache[ufCode] = data;
                    setCities(data);
                    setError(null);
                } else {
                    setError(err?.message || 'Falha ao carregar cidades');
                    setCities([]);
                }
                setLoading(false);
            });

        return () => {
            aborted = true;
        };
    }, [ufCode]);

    const names = useMemo(() => cities.map(c => c.name), [cities]);
    return { cities, names, loading, error } as const;
}
