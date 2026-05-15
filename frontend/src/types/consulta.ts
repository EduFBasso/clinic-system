export type Service = {
    id: number;
    name: string;
    description?: string;
    base_price: number;
    duration_minutes: number;
    is_active: boolean;
};

export type Product = {
    id: number;
    name: string;
    price: number;
    unit: string;
    is_active: boolean;
};

export type SelectedItem = {
    key: string; // 'service-{id}' | 'product-{id}'
    kind: 'service' | 'product';
    id: number;
    name: string;
    unit_price: number;
    quantity: number;
    paid: boolean;
    paidAt?: string; // ISO date: YYYY-MM-DD
};

export function formatBRL(val: number): string {
    return Number(val || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
