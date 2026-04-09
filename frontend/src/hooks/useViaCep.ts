import { useState, useCallback } from 'react';

export type ViaCepStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

interface ViaCepAddress {
    address: string;
    neighborhood: string;
    city: string;
    state: string;
}

export function useViaCep(onFound: (data: ViaCepAddress) => void) {
    const [status, setStatus] = useState<ViaCepStatus>('idle');

    const lookup = useCallback(
        async (cep: string) => {
            const digits = cep.replace(/\D/g, '');
            if (digits.length !== 8) {
                setStatus('idle');
                return;
            }
            setStatus('loading');
            try {
                const res = await fetch(
                    `https://viacep.com.br/ws/${digits}/json/`,
                );
                if (!res.ok) throw new Error('network');
                const data = await res.json();
                if (data.erro) {
                    setStatus('not_found');
                    return;
                }
                onFound({
                    address: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || '',
                });
                setStatus('found');
            } catch {
                setStatus('error');
            }
        },
        [onFound],
    );

    return { status, lookup };
}
