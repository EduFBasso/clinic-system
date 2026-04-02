import React from 'react';
import { getDeviceId } from '../services/device';
import AppModal from './Modal';
import FinalizeAuditsModal from './FinalizeAuditsModal';
import { useSessionsList, useRevokeOtherSessions } from '../hooks/useSessions';
import {
    useFinalizeAudits,
    type FinalizeAudit,
} from '../hooks/useFinalizeAudits.ts';
import usePWAInstall from '../hooks/usePWAInstall';

interface AboutModalProps {
    open: boolean;
    onClose: () => void;
    buildCommit?: string;
    buildTime?: string;
    backendVersion?: string; // placeholder if provided externally later
}

// Small helper for formatting
function formatIso(iso: string) {
    try {
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', { hour12: false });
    } catch {
        return iso;
    }
}

export const AboutModal: React.FC<AboutModalProps> = ({
    open,
    onClose,
    buildCommit,
    buildTime,
    backendVersion,
}) => {
    const {
        sessions,
        loading: loadingSessions,
        error: sessionsError,
        refresh,
    } = useSessionsList({ open });
    // Timezone/offset UI removido para simplificação
    const {
        revoke,
        revokeSession,
        loading: revoking,
        error: revokeError,
        result: revokeResult,
    } = useRevokeOtherSessions();
    async function handleRevoke() {
        const r = await revoke();
        if (r && r.revoked >= 0) {
            refresh();
        }
    }

    const deviceId = React.useMemo(() => {
        try {
            return getDeviceId();
        } catch {
            return 'N/D';
        }
    }, []);
    const tz = React.useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/D';
        } catch {
            return 'N/D';
        }
    }, []);

    // Simple staff gate via localStorage profile
    const isStaff = React.useMemo(() => {
        try {
            const raw = localStorage.getItem('loggedProfessional');
            if (!raw) return false;
            const obj = JSON.parse(raw);
            return !!obj?.is_staff;
        } catch {
            return false;
        }
    }, []);

    // Audits: show last 72h by default for staff
    const defaultStart = React.useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        return d;
    }, []);
    const {
        audits,
        loading: loadingAudits,
        error: auditsError,
        refresh: refreshAudits,
    } = useFinalizeAudits({ open: open && isStaff, start: defaultStart });

    const [auditsModalOpen, setAuditsModalOpen] = React.useState(false);

    // PWA install controls (staff-only section)
    const { canInstall, promptInstall, isStandalone, isIOS, installOutcome } =
        usePWAInstall();
    // Install diagnostics (staff only)
    const [diag, setDiag] = React.useState<{
        secure: boolean;
        protocol: string;
        host: string;
        swSupported: boolean;
        swRegistered: boolean | null; // null while checking
        swControlled: boolean;
        hasManifestLink: boolean;
        manifestOk: boolean | null; // null while checking
    }>({
        secure: false,
        protocol: '',
        host: '',
        swSupported: false,
        swRegistered: null,
        swControlled: false,
        hasManifestLink: false,
        manifestOk: null,
    });
    const [showDiag, setShowDiag] = React.useState(false);

    React.useEffect(() => {
        if (!open || !isStaff) return;
        const secure = (() => {
            try {
                // isSecureContext is the canonical check
                return Boolean(
                    (window as unknown as { isSecureContext?: boolean })
                        .isSecureContext,
                );
            } catch {
                return false;
            }
        })();
        const protocol = (() => {
            try {
                return window.location.protocol;
            } catch {
                return '';
            }
        })();
        const host = (() => {
            try {
                return window.location.host;
            } catch {
                return '';
            }
        })();
        const swSupported = 'serviceWorker' in navigator;
        const swContainer: ServiceWorkerContainer | undefined = (
            navigator as Navigator & { serviceWorker?: ServiceWorkerContainer }
        ).serviceWorker;
        const swControlled = !!swContainer?.controller;
        const hasManifestLink = !!document.querySelector(
            'link[rel="manifest"]',
        );
        setDiag(prev => ({
            ...prev,
            secure,
            protocol,
            host,
            swSupported,
            swControlled,
            hasManifestLink,
            swRegistered: null,
            manifestOk: hasManifestLink ? null : false,
        }));
        // Fetch manifest quickly
        (async () => {
            let manifestOk: boolean = false;
            try {
                const link = document.querySelector(
                    'link[rel="manifest"]',
                ) as HTMLLinkElement | null;
                if (link?.href) {
                    const res = await fetch(link.href, { cache: 'no-store' });
                    manifestOk = res.ok;
                }
            } catch {
                manifestOk = false;
            }
            setDiag(prev => ({ ...prev, manifestOk }));
        })();
        // Check SW registrations
        (async () => {
            let swRegistered = false;
            try {
                if (swSupported && swContainer?.getRegistrations) {
                    const regs = await swContainer.getRegistrations();
                    swRegistered = Array.isArray(regs) && regs.length > 0;
                }
            } catch {
                swRegistered = false;
            }
            setDiag(prev => ({ ...prev, swRegistered }));
        })();
    }, [open, isStaff]);
    const [pin, setPin] = React.useState('');
    const requiredPin =
        (import.meta as unknown as { env: Record<string, string | undefined> })
            .env.VITE_INSTALL_PIN || '';
    const pinOk = !requiredPin || pin === String(requiredPin);

    return (
        <AppModal open={open} onClose={onClose}>
            <div style={{ padding: 8, maxWidth: 420 }}>
                <h3 style={{ marginTop: 0 }}>Sobre o Sistema</h3>
                <section style={{ marginBottom: 12 }}>
                    <strong>Versão / Build</strong>
                    <div style={{ fontSize: 13 }}>
                        Frontend commit: {buildCommit || 'N/D'}
                    </div>
                    <div style={{ fontSize: 13 }}>
                        Build time: {buildTime ? formatIso(buildTime) : 'N/D'}
                    </div>
                    <div style={{ fontSize: 13 }}>
                        Backend: {backendVersion || '—'}
                    </div>
                </section>
                <section style={{ marginBottom: 12 }}>
                    <strong>Dispositivo (referência)</strong>
                    <div style={{ fontSize: 13 }}>ID: {deviceId}</div>
                    <div style={{ fontSize: 13 }}>Timezone: {tz}</div>
                </section>
                <section style={{ marginBottom: 12 }}>
                    <strong>Sessões Ativas</strong>
                    {loadingSessions && (
                        <div style={{ fontSize: 13 }}>Carregando...</div>
                    )}
                    {sessionsError && (
                        <div style={{ fontSize: 13, color: 'crimson' }}>
                            Erro: {sessionsError}
                        </div>
                    )}
                    {!loadingSessions && !sessionsError && (
                        <div style={{ fontSize: 13 }}>
                            Total: {sessions.length}
                            <ul
                                style={{
                                    listStyle: 'none',
                                    paddingLeft: 0,
                                    margin: '4px 0',
                                }}
                            >
                                {sessions.slice(0, 5).map(s => (
                                    <li
                                        key={s.id}
                                        style={{
                                            background: s.is_current
                                                ? 'rgba(0,128,0,0.07)'
                                                : 'rgba(0,0,0,0.04)',
                                            padding: '4px 6px',
                                            borderRadius: 4,
                                            marginBottom: 4,
                                            fontSize: 12,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            <span>
                                                {s.device_id}
                                                {s.is_current && ' (esta)'}
                                            </span>
                                            {!s.is_current && (
                                                <button
                                                    style={{
                                                        fontSize: 10,
                                                        padding: '2px 4px',
                                                        cursor: revoking
                                                            ? 'wait'
                                                            : 'pointer',
                                                    }}
                                                    disabled={revoking}
                                                    onClick={async () => {
                                                        const r =
                                                            await revokeSession(
                                                                s.id,
                                                            );
                                                        if (r) refresh();
                                                    }}
                                                    title='Revogar esta sessão'
                                                >
                                                    Revogar
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ opacity: 0.75 }}>
                                            Último: {formatIso(s.last_seen)}
                                        </div>
                                        {(s.browser ||
                                            s.os ||
                                            s.device_type) && (
                                            <div style={{ opacity: 0.65 }}>
                                                {s.browser &&
                                                s.browser !== 'Unknown'
                                                    ? s.browser
                                                    : ''}
                                                {s.browser &&
                                                (s.os || s.device_type)
                                                    ? ' — '
                                                    : ''}
                                                {s.os || ''}
                                                {s.os && s.device_type
                                                    ? ' · '
                                                    : !s.os && s.device_type
                                                    ? ''
                                                    : ''}
                                                {s.device_type || ''}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {sessions.length > 5 && (
                                <div style={{ fontSize: 11, opacity: 0.7 }}>
                                    Exibindo 5 de {sessions.length}
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 6,
                                }}
                            >
                                <button
                                    onClick={() => refresh()}
                                    style={{ fontSize: 12 }}
                                >
                                    Atualizar
                                </button>
                                <button
                                    onClick={handleRevoke}
                                    style={{ fontSize: 12 }}
                                    disabled={revoking || sessions.length <= 1}
                                    title={
                                        sessions.length <= 1
                                            ? 'Nenhuma outra sessão para revogar'
                                            : ''
                                    }
                                >
                                    {revoking
                                        ? 'Revogando...'
                                        : 'Revogar outras'}
                                </button>
                            </div>
                            {(revokeError || revokeResult) && (
                                <div style={{ marginTop: 4, fontSize: 11 }}>
                                    {revokeError && (
                                        <span style={{ color: 'crimson' }}>
                                            Erro: {revokeError}
                                        </span>
                                    )}
                                    {revokeResult && !revokeError && (
                                        <span style={{ color: 'green' }}>
                                            {revokeResult.revoked === 0
                                                ? 'Nenhuma outra sessão ativa.'
                                                : `${revokeResult.revoked} sessão(ões) revogadas.`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>
                {isStaff && (
                    <section style={{ marginBottom: 12 }}>
                        <strong>Auditorias de Finalização (72h)</strong>
                        {loadingAudits && (
                            <div style={{ fontSize: 13 }}>Carregando...</div>
                        )}
                        {auditsError && (
                            <div style={{ fontSize: 13, color: 'crimson' }}>
                                Erro: {auditsError}
                            </div>
                        )}
                        {!loadingAudits && !auditsError && (
                            <div style={{ fontSize: 13 }}>
                                {audits.length === 0 ? (
                                    <div style={{ opacity: 0.7 }}>
                                        Nenhum evento nas últimas 72h.
                                    </div>
                                ) : (
                                    <ul
                                        style={{
                                            listStyle: 'none',
                                            paddingLeft: 0,
                                            margin: '4px 0',
                                        }}
                                    >
                                        {audits
                                            .slice(0, 15)
                                            .map((a: FinalizeAudit) => (
                                                <li
                                                    key={a.id}
                                                    style={{
                                                        background:
                                                            'rgba(0,0,0,0.04)',
                                                        padding: '4px 6px',
                                                        borderRadius: 4,
                                                        marginBottom: 4,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            gap: 6,
                                                            alignItems:
                                                                'baseline',
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        <span>
                                                            Appt #
                                                            {a.appointment_id}
                                                        </span>
                                                        <span
                                                            style={{
                                                                opacity: 0.7,
                                                            }}
                                                        >
                                                            Cliente #
                                                            {a.client_id}
                                                        </span>
                                                        <span
                                                            style={{
                                                                opacity: 0.7,
                                                            }}
                                                        >
                                                            {formatIso(
                                                                a.created_at,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{ opacity: 0.8 }}
                                                    >
                                                        Drift:{' '}
                                                        {a.drift_ms ?? '—'} ms ·
                                                        Ajustado:{' '}
                                                        {a.adjusted_times
                                                            ? 'sim'
                                                            : 'não'}{' '}
                                                        · Razão: {a.reason}
                                                    </div>
                                                    {a.device_id && (
                                                        <div
                                                            style={{
                                                                opacity: 0.65,
                                                            }}
                                                        >
                                                            Device:{' '}
                                                            {a.device_id}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                    </ul>
                                )}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => refreshAudits()}
                                        style={{ fontSize: 12 }}
                                    >
                                        Atualizar
                                    </button>
                                    <button
                                        onClick={() => setAuditsModalOpen(true)}
                                        style={{ fontSize: 12 }}
                                        title='Abrir auditoria detalhada'
                                    >
                                        Ver tudo
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
                {isStaff && (
                    <section style={{ marginBottom: 12 }}>
                        <strong>Instalar App</strong>
                        {isStandalone ? (
                            <div style={{ fontSize: 13, opacity: 0.8 }}>
                                Este dispositivo já está usando o modo app.
                            </div>
                        ) : isIOS ? (
                            <div style={{ fontSize: 13 }}>
                                Em iPhone/iPad, toque no botão Compartilhar e
                                selecione “Adicionar à Tela de Início”.
                            </div>
                        ) : (
                            <div style={{ fontSize: 13 }}>
                                {canInstall ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {requiredPin && (
                                            <input
                                                placeholder='PIN'
                                                value={pin}
                                                onChange={e =>
                                                    setPin(e.target.value)
                                                }
                                                style={{
                                                    fontSize: 12,
                                                    width: 80,
                                                    padding: '2px 4px',
                                                }}
                                                type='password'
                                            />
                                        )}
                                        <button
                                            onClick={async () => {
                                                if (!pinOk) return;
                                                await promptInstall();
                                            }}
                                            style={{ fontSize: 12 }}
                                            disabled={!pinOk}
                                            title={
                                                pinOk
                                                    ? 'Instalar aplicativo'
                                                    : 'Informe o PIN'
                                            }
                                        >
                                            Instalar
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ opacity: 0.8 }}>
                                        Instalação não disponível no momento.
                                        Abra no Chrome/Edge no dispositivo.
                                    </div>
                                )}
                                {installOutcome && (
                                    <div style={{ fontSize: 11, marginTop: 6 }}>
                                        {installOutcome === 'accepted'
                                            ? 'Instalação iniciada.'
                                            : 'Instalação cancelada.'}
                                    </div>
                                )}
                                {/* Diagnostics toggle */}
                                <div style={{ marginTop: 8 }}>
                                    <button
                                        style={{ fontSize: 11 }}
                                        onClick={() => setShowDiag(v => !v)}
                                    >
                                        {showDiag
                                            ? 'Ocultar diagnóstico'
                                            : 'Mostrar diagnóstico'}
                                    </button>
                                </div>
                                {showDiag && (
                                    <div
                                        style={{
                                            fontSize: 11,
                                            marginTop: 6,
                                            background: 'rgba(0,0,0,0.04)',
                                            padding: '6px 8px',
                                            borderRadius: 4,
                                        }}
                                    >
                                        <div>
                                            Protocolo: {diag.protocol} · Host:{' '}
                                            {diag.host}
                                        </div>
                                        <div>
                                            Contexto seguro:{' '}
                                            {String(diag.secure)}
                                        </div>
                                        <div>
                                            SW suportado:{' '}
                                            {String(diag.swSupported)} ·
                                            Registrado:{' '}
                                            {diag.swRegistered === null
                                                ? '...'
                                                : String(
                                                      diag.swRegistered,
                                                  )}{' '}
                                            · Controlado:{' '}
                                            {String(diag.swControlled)}
                                        </div>
                                        <div>
                                            Manifest link:{' '}
                                            {String(diag.hasManifestLink)} ·
                                            Carregado:{' '}
                                            {diag.manifestOk === null
                                                ? '...'
                                                : String(diag.manifestOk)}
                                        </div>
                                        <div>
                                            iOS: {String(isIOS)} · Standalone:{' '}
                                            {String(isStandalone)} ·
                                            beforeinstallprompt:{' '}
                                            {String(canInstall)}
                                        </div>
                                        {!isIOS &&
                                            !diag.secure &&
                                            !diag.host.startsWith(
                                                'localhost',
                                            ) && (
                                                <div style={{ marginTop: 6 }}>
                                                    Motivo provável: para
                                                    aparecer o botão de
                                                    instalação no
                                                    Android/Chrome, o site
                                                    precisa estar em HTTPS ou em
                                                    localhost. Em redes locais
                                                    (ex.: http://192.168.x.x) o
                                                    navegador não expõe o
                                                    prompt.
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
                {isStaff && (
                    <FinalizeAuditsModal
                        open={auditsModalOpen}
                        onClose={() => setAuditsModalOpen(false)}
                    />
                )}
                <div style={{ textAlign: 'right' }}>
                    <button onClick={onClose}>Fechar</button>
                </div>
            </div>
        </AppModal>
    );
};

export default AboutModal;
