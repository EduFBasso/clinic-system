import { useEffect, useState } from 'react';

// Detecta de forma leve se há câmera disponível.
// Estratégia: navigator.mediaDevices?.enumerateDevices + filtro por videoinput.
// Fallback rápido: se API indisponível assume false.
export default function useHasCamera() {
    const [hasCamera, setHasCamera] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function detect() {
            try {
                if (
                    !navigator.mediaDevices ||
                    !navigator.mediaDevices.enumerateDevices
                ) {
                    if (!cancelled) setHasCamera(false);
                    return;
                }
                const devices = await navigator.mediaDevices.enumerateDevices();
                const video = devices.some(d => d.kind === 'videoinput');
                if (!cancelled) setHasCamera(video);
            } catch {
                if (!cancelled) setHasCamera(false);
            }
        }
        detect();
        return () => {
            cancelled = true;
        };
    }, []);

    return hasCamera; // null = em detecção
}
