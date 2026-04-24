export interface AnamnesisField {
    id: number;
    code: string;
    sector: string;
    sector_order: number;
    label: string;
    field_type: 'radio' | 'text' | 'textarea';
    options: string[] | null;
    placeholder: string;
    depends_on: number | null;
    show_when_value: string;
    order: number;
    is_active: boolean;
}

export interface AnamnesisResponse {
    id?: number;
    field: number | null;
    field_label_snap: string;
    value: string;
}
