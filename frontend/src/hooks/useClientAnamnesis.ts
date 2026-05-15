import { useEffect, useState } from 'react';
import { API_BASE } from '../config/api';
import { useAnamnesisFields } from './useAnamnesisFields';
import type { AnamnesisResponse } from '../types/AnamnesisTypes';
import { getAccessToken } from '../utils/auth/session';

export interface ClientAnamnesisHook {
    anamnesisFields: ReturnType<typeof useAnamnesisFields>['fields'];
    anamnesisValues: Record<number, string>;
    setAnamnesisValues: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    handleAnamnesisChange: (fieldId: number, value: string) => void;
    saveAnamnesis: (clientId: number, token: string) => Promise<void>;
}

export function useClientAnamnesis(clientId?: number): ClientAnamnesisHook {
    const { fields: anamnesisFields } = useAnamnesisFields();
    const [anamnesisValues, setAnamnesisValues] = useState<Record<number, string>>({});

    // Load existing responses when editing a client
    useEffect(() => {
        if (!clientId) return;
        const token = getAccessToken();
        if (!token) return;
        fetch(`${API_BASE}/anamnesis/responses/?client=${clientId}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => (r.ok ? r.json() : Promise.resolve([])))
            .then((data: AnamnesisResponse[]) => {
                const map: Record<number, string> = {};
                data.forEach(r => { if (r.field !== null) map[r.field] = r.value; });
                setAnamnesisValues(map);
            })
            .catch(() => { /* silent */ });
    }, [clientId]);

    function handleAnamnesisChange(fieldId: number, value: string) {
        const childrenByParent = new Map<number, number[]>();
        anamnesisFields.forEach(field => {
            if (!field.depends_on) return;
            const children = childrenByParent.get(field.depends_on) ?? [];
            children.push(field.id);
            childrenByParent.set(field.depends_on, children);
        });

        const fieldById = new Map(anamnesisFields.map(field => [field.id, field]));

        setAnamnesisValues(prev => {
            const next = { ...prev, [fieldId]: value };

            function clearHiddenDescendants(parentId: number) {
                const childIds = childrenByParent.get(parentId) ?? [];
                childIds.forEach(childId => {
                    const childField = fieldById.get(childId);
                    if (!childField) return;
                    const parentValue = next[parentId] ?? '';
                    const shouldShow = childField.show_when_value
                        ? parentValue === childField.show_when_value
                        : parentValue !== '';
                    if (!shouldShow) delete next[childId];
                    clearHiddenDescendants(childId);
                });
            }

            clearHiddenDescendants(fieldId);
            return next;
        });
    }

    async function saveAnamnesis(clientId: number, token: string): Promise<void> {
        const fieldById = new Map(anamnesisFields.map(field => [field.id, field]));

        function isFieldVisible(fieldId: number): boolean {
            const field = fieldById.get(fieldId);
            if (!field) return false;
            if (!field.depends_on) return true;
            const parent = fieldById.get(field.depends_on);
            if (!parent || !isFieldVisible(parent.id)) return false;
            const parentValue = anamnesisValues[parent.id] ?? '';
            return field.show_when_value
                ? parentValue === field.show_when_value
                : parentValue !== '';
        }

        const entries = anamnesisFields
            .filter(field => isFieldVisible(field.id))
            .map(field => ({ field: field.id, value: anamnesisValues[field.id] ?? '' }));

        await fetch(`${API_BASE}/anamnesis/responses/bulk_save/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ client: clientId, responses: entries }),
        });
    }

    return { anamnesisFields, anamnesisValues, setAnamnesisValues, handleAnamnesisChange, saveAnamnesis };
}
