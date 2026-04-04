import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';
import type { AnamnesisField } from '../types/AnamnesisTypes';

export function useAnamnesisFields() {
    const [fields, setFields] = useState<AnamnesisField[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setLoading(false);
            return;
        }
        fetch(`${API_BASE}/anamnesis/fields/`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => {
                if (!r.ok) throw new Error('failed');
                return r.json();
            })
            .then((data: AnamnesisField[]) => {
                setFields(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return { fields, loading };
}
