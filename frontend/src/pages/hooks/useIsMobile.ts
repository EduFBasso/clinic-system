import { useState, useEffect } from 'react';

// Hook para detectar se é mobile de forma dinâmica
export default function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
    );

    useEffect(() => {
        function handleResize() {
            setIsMobile(window.innerWidth <= breakpoint);
        }
        window.addEventListener('resize', handleResize);
        // Atualiza no mount
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
}
