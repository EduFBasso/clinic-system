// src/types/models.ts
export interface Professional {
    id: number;
    first_name: string;
    last_name: string;
    display_name?: string;
    email: string;
    phone?: string;
    specialty?: string;
    register_number?: string;
    city?: string;
    state?: string;
    is_active?: boolean;
    is_superuser?: boolean;
    is_staff?: boolean;
    can_manage_professionals?: boolean;
    created_at?: string;
    deactivated_at?: string | null;
    deactivation_reason?: string | null;
}

export interface Client {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    // outros campos...
}
