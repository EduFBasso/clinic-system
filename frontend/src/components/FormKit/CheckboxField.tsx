import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export default function CheckboxField({ label, ...props }: Props) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type='checkbox' {...props} />
            {label}
        </label>
    );
}
