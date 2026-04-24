# Agenda UI Components

This folder contains the centralized building blocks for the agenda experience.
The goal is a single visual and interaction model that scales across Monthly,
Daily, and Desktop surfaces.

## AppointmentCard

Single source of truth for the mini card visuals and behavior.

- Inputs (AppointmentCardProps):
- appt: { id, start_at, end_at, status, client_name?, notes?, title?,
        client? }
- size?: 'sm' | 'md' (default 'md') — Logical scale for typography via CSS
        variables. Layout remains container-driven.
- onClick?: (appt) => void — Legacy primary click. If onEdit/onUseTime
        exists, they take precedence.
- onUseTime?: (appt) => void — Primary action for QuickSchedule flows.
- onResolvePending?: (appt) => void — If status is past (pending), tapping
        triggers pending resolution.
- onEdit?, onCancel?, onDetails?: (appt) => void — Optional actions;
        Details shown for done/canceled.
- highlight?, editingActive?, pulse?, compact?, showNotes?, selected?
- showEditAction?: boolean — Controls edit icon visibility.
- showTime?: boolean; timeInline?: boolean — Time display options when
        used standalone.
- className?, style?, now?: Date — Optional styling and time reference for
        derived states.

- Behavior:

- Click priority: pending+onResolvePending → onEdit → onUseTime → onClick.
- Ongoing appointments block clicks.
- Left colored stripe and background computed via centralized status tokens.
- Client name rendered top-left; visit type under the status badge on the right.
- Notes clamped to 2 lines by default.

- Size and tokens:
- Global CSS tokens live in `src/styles/palette.css`
        (`--card-font-family`, `--card-name-size`, `--card-type-size`,
        `--card-text-size`, `--card-radius`, `--card-padding-*`).
- `size='sm'` applies local overrides to `--card-*-size` variables,
        reducing typography without affecting layout.

### Early finalize e `original_end_at`

Quando um agendamento é finalizado antes do horário previsto, o backend (ou um
PATCH de ajuste) pode encurtar o `end_at` para o horário real de fechamento. Sem
tratamento extra isso impede detectar que houve encerramento antecipado, pois
`end_at` deixa de representar o término planejado.

Para preservar a semântica:

1. O primeiro override que sinaliza estado final (`done` ou `canceled`) pode
   incluir `original_end_at`.
2. Se um override subsequente alterar `end_at` e ainda não existir
   `original_end_at`, armazenamos o valor anterior automaticamente em
   `overrides.ts`.
3. O `AppointmentCard` usa `original_end_at` (quando disponível) para:
    - Comparar `real_closed_at` vs término planejado (com margem de 30s) e
      decidir se exibe o pill “Finalizado às HH:MM”.
    - Renderizar a faixa de horário (TimeRangeLabel) com o término ORIGINAL
      mesmo após encurtamento.

Resultado: o usuário vê a janela planejada intacta e, adicionalmente, a hora
real de finalização quando o atendimento terminou antes do previsto.

Se no futuro precisarmos exibir também cancelamentos com lógica similar, basta
reutilizar `original_end_at` e ajustar a condicional do pill.

## ClientCardRow

High-level row wrapper combining the time block on the left and the
AppointmentCard on the right.

- Props: extends AppointmentCardProps, plus

- timeSize?: 'sm' | 'md' (default 'md')
- timeOrder?: 'start-top' | 'end-top'
- containerStyle?, cardContainerStyle?

- Behavior:
- Always renders `<TimeRangeLabel />` on the left.
- Forwards handlers to the inner AppointmentCard; time is hidden inside
        the card to avoid duplication.

## TimeRangeLabel

Utility to render start/end time as a compact block. Supports `order='end-top'`
to show the end time above the start when desired.

## Usage patterns

- Monthly/Day/Desktop lists should render using `ClientCardRow` to keep a
    single row pattern.
- Centralize pending resolution, edit, use-time, and details through the card props.
- Let the container control width; cards flex to fit. - Avoid extra nested grids that constrain the card.

## Accessibility

- Status colors follow centralized tokens with high contrast.
- Notes are truncated to 2 lines to reduce verbosity while keeping important
    context visible.

## Testing

- Unit tests validate pending click behavior, status badges, and details icon
    rendering for done/canceled.
- JSDOM warnings for `scrollTo` are expected and benign.

## Future extensions

- `ClientDayList` component to render an entire day’s appointments for reuse
    (Daily, QuickSchedule).
- Optional CSS class modifier for `size='sm'` instead of inline CSS var
    overrides.
- Remove details icon in favor of card-level details click when appropriate.
