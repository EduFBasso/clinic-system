// frontend\src\types\ClientData.ts
export interface ClientData {
    id?: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    cpf: string; // CPF is a Brazilian individual taxpayer registry identification
    address_street: string;
    address_number: string;
    city: string;
    state: string;
    postal_code: string;
    footwear_used: string;
    sock_used: string;
    sport_activity: string;
    academic_activity: string;
    takes_medication: string;
    had_surgery: string;
    is_pregnant?: boolean; // Optional field for pregnancy status
    pain_sensitivity: string;
    clinical_history: string;
    plantar_view_left: string;
    plantar_view_right: string;
    dermatological_pathologies_left: string;
    dermatological_pathologies_right: string;
    nail_changes_left: string;
    nail_changes_right: string;
    deformities_left: string;
    deformities_right: string;
    sensitivity_test: string;
    other_procedures: string;
}
