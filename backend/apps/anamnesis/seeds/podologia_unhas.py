# Seed data for podologia (nail/foot specialty)
# Matches the legacy hardcoded fields from apps.clients.models.Client
# Used by: python manage.py seed_anamnesis --professional-email=<email>

SECTORS = [
    {
        'sector': 'Histórico',
        'sector_order': 0,
        'fields': [
            {
                'label': 'Atividade esportiva',
                'field_type': 'radio',
                'options': ['Sim', 'Não', 'Às vezes'],
                'order': 0,
            },
            {
                'label': 'Atividade acadêmica',
                'field_type': 'radio',
                'options': ['Sim', 'Não'],
                'order': 1,
            },
            {
                'label': 'Toma medicação',
                'field_type': 'radio',
                'options': ['Sim', 'Não'],
                'order': 2,
            },
            {
                'label': 'Já fez cirurgia',
                'field_type': 'radio',
                'options': ['Sim', 'Não'],
                'order': 3,
            },
            {
                'label': 'Está grávida',
                'field_type': 'radio',
                'options': ['Sim', 'Não'],
                'order': 4,
            },
            {
                'label': 'Sensibilidade à dor',
                'field_type': 'radio',
                'options': ['Baixa', 'Normal', 'Alta'],
                'order': 5,
            },
            {
                'label': 'Histórico clínico',
                'field_type': 'textarea',
                'options': None,
                'order': 6,
            },
        ],
    },
    {
        'sector': 'Calçados',
        'sector_order': 1,
        'fields': [
            {
                'label': 'Calçado utilizado',
                'field_type': 'radio',
                'options': ['Tênis', 'Sapatilha', 'Social', 'Salto alto', 'Rasteirinha', 'Descalço'],
                'order': 0,
            },
            {
                'label': 'Meia utilizada',
                'field_type': 'radio',
                'options': ['Sim', 'Não', 'Às vezes'],
                'order': 1,
            },
        ],
    },
    {
        'sector': 'Pé Direito',
        'sector_order': 2,
        'fields': [
            {
                'label': 'Vista plantar direita',
                'field_type': 'radio',
                'options': ['Normal', 'Plano', 'Cavo', 'Valgo', 'Varo'],
                'order': 0,
            },
            {
                'label': 'Patologias dermatológicas direito',
                'field_type': 'radio',
                'options': ['Ausente', 'Calosidade', 'Fissura', 'Verruga', 'Micose', 'Outro'],
                'order': 1,
            },
            {
                'label': 'Alterações ungueais direito',
                'field_type': 'radio',
                'options': ['Ausente', 'Onicogrifose', 'Onicomicose', 'Unha encravada', 'Outro'],
                'order': 2,
            },
            {
                'label': 'Deformidades direito',
                'field_type': 'radio',
                'options': ['Ausente', 'Hallux Valgus', 'Dedo em martelo', 'Dedo em garra', 'Outro'],
                'order': 3,
            },
            {
                'label': 'Teste de sensibilidade direito',
                'field_type': 'radio',
                'options': ['Normal', 'Diminuído', 'Ausente'],
                'order': 4,
            },
        ],
    },
    {
        'sector': 'Pé Esquerdo',
        'sector_order': 3,
        'fields': [
            {
                'label': 'Vista plantar esquerda',
                'field_type': 'radio',
                'options': ['Normal', 'Plano', 'Cavo', 'Valgo', 'Varo'],
                'order': 0,
            },
            {
                'label': 'Patologias dermatológicas esquerdo',
                'field_type': 'radio',
                'options': ['Ausente', 'Calosidade', 'Fissura', 'Verruga', 'Micose', 'Outro'],
                'order': 1,
            },
            {
                'label': 'Alterações ungueais esquerdo',
                'field_type': 'radio',
                'options': ['Ausente', 'Onicogrifose', 'Onicomicose', 'Unha encravada', 'Outro'],
                'order': 2,
            },
            {
                'label': 'Deformidades esquerdo',
                'field_type': 'radio',
                'options': ['Ausente', 'Hallux Valgus', 'Dedo em martelo', 'Dedo em garra', 'Outro'],
                'order': 3,
            },
            {
                'label': 'Teste de sensibilidade esquerdo',
                'field_type': 'radio',
                'options': ['Normal', 'Diminuído', 'Ausente'],
                'order': 4,
            },
        ],
    },
    {
        'sector': 'Observações',
        'sector_order': 4,
        'fields': [
            {
                'label': 'Outros procedimentos',
                'field_type': 'textarea',
                'options': None,
                'order': 0,
            },
        ],
    },
]
