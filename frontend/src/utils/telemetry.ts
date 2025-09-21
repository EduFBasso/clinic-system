// Minimal telemetry utility with progressive enhancement.
// Default: log in dev; no network. Can be enabled via window.__telemetryEndpoint or env flag.
// Usage example: track({ type: 'appointment_cancel_clicked', payload: { id } })

export type TelemetryEvent =
    // UI lifecycle
    | { type: 'modal_opened'; payload: { name: string } }
    | { type: 'modal_closed'; payload: { name: string } }
    // Weekly interactions
    | { type: 'weekly_day_selected'; payload: { iso: string } }
    // Appointments lifecycle
    | { type: 'appointment_cancel_clicked'; payload: { id: number } }
    | {
          type: 'appointment_cancel_succeeded';
          payload: { id: number; ms?: number };
      }
    | {
          type: 'appointment_cancel_failed';
          payload: { id: number; error?: string };
      }
    | { type: 'appointment_finalize_clicked'; payload: { id: number } }
    | {
          type: 'appointment_finalize_succeeded';
          payload: { id: number; ms?: number };
      }
    | {
          type: 'appointment_finalize_failed';
          payload: { id: number; error?: string };
      }
    | {
          type: 'appointment_card_clicked';
          payload: {
              id: number;
              status: 'scheduled' | 'done' | 'canceled' | 'ongoing' | 'past';
          };
      }
    | {
          type: 'appointment_entered_ongoing';
          payload: { id: number; start_at: string; client_id?: number };
      }
    | {
          type: 'appointment_created';
          payload: { id?: number | null; client_id: number; start_at: string };
      }
    | {
          type: 'appointment_updated';
          payload: { id: number; start_at: string };
      };

type TelemetryConfig = {
    endpoint?: string; // if provided, events are sent via sendBeacon/fetch
    enabled?: boolean; // allow forcing enable even in prod
};

declare global {
    interface Window {
        __telemetryConfig?: TelemetryConfig;
    }
}

function shouldSendNetwork(): string | undefined {
    try {
        const cfg = window.__telemetryConfig;
        if (cfg?.enabled && cfg.endpoint) return cfg.endpoint;
        // optionally enable by env var replace during build
        // Access env safely without depending on Node typings in browser bundle
        const p: unknown = typeof process !== 'undefined' ? process : undefined;
        const envEndpoint =
            p && typeof p === 'object' && 'env' in p
                ? (p as { env?: Record<string, unknown> }).env?.[
                      'VITE_TELEMETRY_ENDPOINT'
                  ]
                : undefined;
        if (envEndpoint) return String(envEndpoint);
    } catch {
        /* noop */
    }
    return undefined;
}

function sendNetwork(endpoint: string, e: TelemetryEvent) {
    try {
        const payload = JSON.stringify({
            t: Date.now(),
            e,
            url: typeof location !== 'undefined' ? location.pathname : '',
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        });
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(endpoint, blob);
        } else {
            fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: payload,
            }).catch(() => {});
        }
    } catch {
        /* noop */
    }
}

export function track(e: TelemetryEvent): void {
    const endpoint = shouldSendNetwork();
    if (endpoint) sendNetwork(endpoint, e);
    else if (
        typeof process !== 'undefined' &&
        process.env.NODE_ENV !== 'production'
    ) {
        try {
            console.debug('[telemetry]', e);
        } catch {
            /* noop */
        }
    }
}
