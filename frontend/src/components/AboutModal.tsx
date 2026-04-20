import React from 'react';
import AppModal from './Modal';
import { coalesceVersion, fetchServerVersion } from '../hooks/useAppVersion';

interface AboutModalProps {
    open: boolean;
    onClose: () => void;
    buildCommit?: string;
    buildTime?: string;
    backendVersion?: string;
}

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
    const [resolvedBackendVersion, setResolvedBackendVersion] =
        React.useState<string | null>(backendVersion ?? null);

    React.useEffect(() => {
        if (!open) return;
        if (backendVersion) {
            setResolvedBackendVersion(backendVersion);
            return;
        }

        let cancelled = false;

        void (async () => {
            const serverVersion = coalesceVersion(await fetchServerVersion());
            if (!cancelled) {
                setResolvedBackendVersion(serverVersion);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, backendVersion]);

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
                        Backend: {resolvedBackendVersion || 'N/D'}
                    </div>
                </section>
                <div style={{ textAlign: 'right' }}>
                    <button onClick={onClose}>Fechar</button>
                </div>
            </div>
        </AppModal>
    );
};

export default AboutModal;
