import React from 'react';
import baseField from '../FormElements/FormElementsBase.module.css';

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
}

export default function SelectField({ label, children, ...props }: Props) {
    return (
        <div>
            <label className={baseField.formLabel}>{label}</label>
            <select {...props} className={baseField.formInput}>
                {children}
            </select>
        </div>
    );
}
