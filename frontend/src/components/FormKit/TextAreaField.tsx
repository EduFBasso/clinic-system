import React from 'react';
import baseField from '../FormElements/FormElementsBase.module.css';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
}

export default function TextAreaField({ label, ...props }: Props) {
    return (
        <div>
            <label className={baseField.formLabel}>{label}</label>
            <textarea {...props} className={baseField.formInput} />
        </div>
    );
}
