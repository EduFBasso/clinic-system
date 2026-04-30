# Reference Client Data Audit
## Para: Evolução do Sistema OdontoArcada

---

## 📋 Client Reference Selecionado

**Sugestão**: Client ID = **51**  
**Nome**: Marabel Aparecida Cavinato Carvalho  
**Arcade ID**: 2196  
**Status**: ✅ Tem 16 tooth procedures pending (dados reais, importados do ERP)

---

## 🔍 Campos a Auditar

### 1. **CLIENT LEVEL**
```
- id: 51
- full_name: (verificar)
- cpf: (verificar)
- email: (verificar)
- phone: (verificar)
- date_of_birth: (verificar)
- created_at: (verificar - data no sistema)
- updated_at: (verificar)
```

**Questões**:
- [ ] Data de criação = data que entrou no sistema (não a data histórica do ERP)?
- [ ] Todos os campos de contato estão preenchidos ou alguns são NULL?

---

### 2. **DENTAL ARCADE LEVEL**
```
- id: 2196
- client_id: 51
- created_at: (verificar)
- updated_at: (verificar)
- status: (verificar - auto-calculated ou manual?)
- teeth_count: (deve ser 32)
```

**Questões**:
- [ ] Arcade status é recalculado automaticamente após cada procedure?
- [ ] Todos os 32 teeth foram criados?
- [ ] Há algum campo custom no arcade que precisa ser exibido?

---

### 3. **TEETH LEVEL** (32 dentes FDI)
```
Para cada dente (arcade.teeth):
- id: ?
- number: 11 até 48 (FDI numbering)
- created_at: ?
- surfaces: ? (should have 5: O, V, L, P, D)
- procedure_count: (quantas procedures estão associadas a este dente)
```

**Questões**:
- [ ] Todos os 32 dentes têm 5 superfícies (O, V, L, P, D)?
- [ ] Qual é a distribuição: quantos dentes tem procedures vs. vazios?
- [ ] As superfícies estão sendo usadas ou são apenas "meta-estrutura"?

---

### 4. **PROCEDURES LEVEL** (o core do problema)

#### Status Distribution
```
- Total procedures: ?
  - Pending: ? (com started_at preenchido: ?)
  - Completed: ? (com completed_at preenchido: ?)
  - Canceled: ? (com motivo ou apenas status?)
  - General (tooth=null): ? 
```

#### Data Quality Check (CRÍTICO)
Para cada procedure, verificar:
```
- id: ?
- code: ? (código do ERP, ex: "210")
- name: ? (descrição da procedure)
- status: ? (pending/completed/canceled)
- tooth_id: ? (número FDI ou NULL para general)
- surface_id: ? (qual superfície ou NULL)
- started_at: ? (DATA - FILLED or NULL?)
- completed_at: ? (DATA - FILLED or NULL?)
- duration_minutes: ? (FILLED or NULL?)
- patient_amount: ? (FILLED or NULL?)
- paid_amount: ? (FILLED or NULL?)
- is_active: true/false
- notes: ? (FILLED or NULL?)
- created_at: (data de importação no sistema)
```

**Questões CRÍTICAS**:
- [ ] De 16 procedures, quantas têm `started_at` preenchido?
- [ ] Os formatos de data são consistentes (YYYY-MM-DD, timestamps, etc)?
- [ ] Qual é o padrão: procedimento criado = started_at preenchido?
- [ ] Ou: só procedures "em andamento" têm started_at?
- [ ] Quanto ao `completed_at`: para procedures "completed", foi preenchido?
- [ ] O campo `duration_minutes` foi importado do ERP ou fica NULL?

#### Grouping for Visual Layer
```
Dentes com procedures:
├── Tooth 11 → procedures: [proc_id_1, proc_id_2, ...]
├── Tooth 12 → procedures: [proc_id_3]
├── ...
└── Teeth sem procedures: [12, 14, 17, 22, 27, ...]

General procedures (tooth=null):
└── [proc_id_N, proc_id_M, ...]
```

---

### 5. **TIMELINE / DATA INTEGRITY**
```
- Primeira procedure started_at: ? (qual data?)
- Última procedure completed_at: ? (qual data?)
- Dentes: algum temporal ordering (ex: "começou pelo dente 11")?
- Procedures: estão em ordem cronológica ou random?
```

**Questões**:
- [ ] Faz sentido temporal? (ex: não começou em 2025 e completou em 2020?)
- [ ] Há procedures "completed" antes de "started"?
- [ ] O dentista espera ver histórico cronológico ou agrupado por dente?

---

## 📊 Template de Resposta

Após executar a query, preencha assim:

```json
{
  "client_id": 51,
  "client_name": "Marabel Aparecida Cavinato Carvalho",
  "arcade_id": 2196,
  "arcade_status": "pending|completed|mixed",
  
  "data_quality": {
    "total_procedures": 16,
    "status_distribution": {
      "pending": 14,
      "completed": 2,
      "canceled": 0,
      "general_procedures": 0
    },
    "started_at_filled": 10,
    "started_at_null": 6,
    "completed_at_filled": 2,
    "completed_at_null": 14,
    "date_format": "YYYY-MM-DD or mixed or NULL",
    "anomalies": [
      "procedure X started after completed",
      "procedure Y has no tooth assignment",
      ...
    ]
  },
  
  "teeth_distribution": {
    "teeth_with_procedures": [11, 12, 21, 22, ...],
    "teeth_empty": [13, 14, 15, 16, 17, 18, ...],
    "coverage_percentage": "37.5% (12 of 32)"
  },
  
  "interface_decisions": {
    "show_general_procedures_in_arcade": "yes|no|separate_panel",
    "sort_procedures_by": "date|tooth|status|user_order",
    "handle_null_dates": "show_placeholder|hide_field|allow_manual_entry",
    "visual_priority": "date_based|tooth_based|status_based"
  }
}
```

---

## 🎯 Próximas Etapas (após preencher o audit)

1. **Você e eu analisamos o objeto preenchido**
2. **Decidimos as regras**:
   - Como exibir procedures sem data?
   - Procedures "general" aparecem na arcada ou em painel separado?
   - Ordenação e agrupamento visual
3. **Criamos uma interface específica para este cliente**
4. **Testamos real workflow da dentista**
5. **Generalizamos para todos os outros clientes**

---

## 📝 Notas

Este documento é nosso "contrato" de dados. Depois que entendermos este cliente perfeitamente, fica **muito mais fácil** escalar para os demais.

**Não vamos "chutar" nenhuma regra.**
**Vamos respeitar os dados reais e o workflow da dentista.**

