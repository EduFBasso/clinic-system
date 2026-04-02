// src/types/models.ts
export interface Professional {
  id: number;
  first_name: string;
  last_name: string;
  register_number: string;
  email: string;
}

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  // outros campos...
}
