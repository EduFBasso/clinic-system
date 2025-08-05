// frontend\src\components\FormElements\SectionTitle.tsx
import React from 'react';
import styles from './SectionTitle.module.css';

interface SectionTitleProps {
    children: React.ReactNode;
    className?: string;
}

export default function SectionTitle({
    children,
    className,
}: SectionTitleProps) {
    return (
        <div
            className={
                className
                    ? `${styles.sectionTitle} ${className}`
                    : styles.sectionTitle
            }
        >
            {children}
        </div>
    );
}
