export interface ClientBasic {
    id: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    address_street?: string;
    address_number?: string;
    city?: string;
    state?: string;
}
