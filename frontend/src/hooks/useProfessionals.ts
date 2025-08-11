import { useEffect, useState } from 'react';

export interface ProfessionalBasic {
    id: number;
    first_name: string;
    last_name: string;
    register_number: string;
    email: string;
}

export function useProfessionals() {
    const [professionals, setProfessionals] = useState<ProfessionalBasic[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch('https://192.168.0.108:8000/register/professionals-basic/')
            .then(res => {
                if (!res.ok) throw new Error('Erro ao buscar profissionais');
                return res.json();
            })
            .then(data => {
                setProfessionals(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { professionals, loading, error };
}
