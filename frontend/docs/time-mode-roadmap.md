# Time Mode Roadmap (Local vs UTC)

Este documento descreve o plano de centralização e alternância entre exibição em
horário local (atual) e modo UTC futuro.

## Objetivos

-   Garantir consistência visual de horários em múltiplos dispositivos/fusos.
-   Reduzir discrepâncias de "ongoing" causadas por clock skew local.
-   Permitir futura opção de usuário: exibir todos os horários em UTC ou Local.
-   Centralizar formatação para remover duplicação de lógica.

## Estado Atual

-   `formatTime` / `formatRange` adicionados em `utils/timeFormat.ts`.
-   `AppointmentCard` já usa `formatTime` (pills + horários inline).
-   Clock UTC exibido no `NavBar` (ainda direto, será migrado para util no
    próximo passo).
-   Outras áreas usam `toLocaleTimeString` diretamente.

## Pontos de Formatação Restantes a Migrar

| Arquivo                                            | Uso                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `components/shared/TimeRangeLabel.tsx`             | Intervalo HH:MM – HH:MM                                                |
| `components/ClientCard.tsx`                        | Pelo menos 1 uso para logs/hover (linha ~1183 actual)                  |
| `components/clientCard/FutureAppointmentsList.tsx` | Horários futuros na lista                                              |
| `components/AppointmentDetailsModal.tsx`           | Início/Fim detalhe                                                     |
| `components/PendingActionsModal.tsx`               | Faixa e horário em mensagens                                           |
| `components/ScheduleEditorCore.tsx`                | Construção de labels de horários                                       |
| `utils/date.ts`                                    | Função redundante de HH:MM (avaliar remoção após migração)             |
| `NavBar.tsx`                                       | Exibição do relógio (passará a `formatTime(Date.now())` + tooltip UTC) |

## Abordagem de Migração

1. Migrar `TimeRangeLabel` para usar `formatRange`.
2. Substituir usos isolados (ClientCard, FutureAppointmentsList, DetailsModal,
   PendingActionsModal, ScheduleEditorCore) por `formatTime/formatRange`.
3. Revisar se `utils/date.ts` ainda é necessário; se não, remover ou delegar
   para `timeFormat`.
4. Adicionar modo global opcional.

## Modo Global (Futuro)

Implementação sugerida:

```ts
// utils/timeMode.ts
let cached: 'local' | 'utc' =
    (localStorage.getItem('timeMode') as any) === 'utc' ? 'utc' : 'local';
export function getTimeMode() {
    return cached;
}
export function setTimeMode(m: 'local' | 'utc') {
    cached = m;
    localStorage.setItem('timeMode', m);
    window.dispatchEvent(new Event('timeModeChanged'));
}
```

No `formatTime`:

-   Se `opts.mode` não fornecido, usar `getTimeMode()`.

Hook opcional:

```ts
export function useTimeMode() {
    const [mode, setModeState] = useState(getTimeMode());
    useEffect(() => {
        const h = () => setModeState(getTimeMode());
        window.addEventListener('timeModeChanged', h);
        return () => window.removeEventListener('timeModeChanged', h);
    }, []);
    return mode;
}
```

## Toggle UI (Opcional)

Adicionar item no menu Agenda: "Modo de Hora: Local / UTC".

-   Ao clicar, alterna `setTimeMode(next)`.
-   Re-render global via evento.

## Ajuste para Ongoing / Comparações

Para cálculo de `isOngoing` o backend fornece janelas em ISO. Comparações
continuam baseadas em `Date` (epoch ms), independente de modo de exibição. Sem
impacto funcional.

## Mitigação de Clock Skew

Etapas futuras (opcional):

1. Endpoint `GET /api/server-time` retornando `{"now":"2025-10-06T21:30:00Z"}`.
2. Calcular `clientNow - serverNow` no bootstrap e armazenar
   `window.__SERVER_DRIFT_MS`.
3. Expor helper `nowWithDrift()` para centralizar comparações.
4. Mostrar badge se drift absoluto > 2m.

## Testes a Criar/Ajustar

-   Snapshot de `TimeRangeLabel` usando modo local vs modo UTC mockado.
-   Teste de pill early finalize/cancel garantindo que formatTime não introduz
    segundos.
-   Teste de toggle `timeModeChanged` re-renderizando `AppointmentCard` com
    formato UTC.

## Riscos

-   Pequenos desvios em formatação se locale do usuário não for `pt-BR` (hoje
    fixo). Mitigado definindo locale explicitamente sempre.
-   Mistura temporária de componentes já migrados e não migrados (aceitável
    durante transição).

## Conclusão

Seguindo a ordem proposta a migração é incremental, sem regressões visuais, e
habilita rapidamente um modo UTC opt-in sem alterar lógica de negócio.
