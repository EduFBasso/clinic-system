// import React from 'react';

type Props = {
    open: boolean;
    onClose: () => void;
    client?: { id: number; first_name?: string; last_name?: string } | null;
    initialDate?: Date;
};

export default function WeeklyPreviewModal(_props: Props) {
    void _props; // evita no-unused-vars
    return null;
}
