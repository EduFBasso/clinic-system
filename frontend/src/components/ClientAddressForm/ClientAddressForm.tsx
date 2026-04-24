import React, { useCallback } from 'react';
import type { ClientData } from '../../types/ClientData';
import InputField from '../FormElements/InputField/InputField';
import SelectField from '../FormElements/SelectField/SelectField';
import { formatCep } from '../../utils/formatCpf';
import { BR_UFS } from '../../data/br-ufs';
import { useViaCep } from '../../hooks/useViaCep';
import styles from './ClientAddressForm.module.css';
import { useTheme } from '../../contexts/ThemeContext';

type ChangeHandler = (
    fieldOrEvent:
        | keyof ClientData
        | React.ChangeEvent<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >,
    value?: ClientData[keyof ClientData],
) => void;

interface Props {
    formData: ClientData;
    handleChange: ChangeHandler;
    isEdit?: boolean;
}

export default function ClientAddressForm({
    formData,
    handleChange,
    isEdit = false,
}: Props) {
    const { theme } = useTheme();

    const onFound = useCallback(
        (data: {
            address: string;
            neighborhood: string;
            city: string;
            state: string;
        }) => {
            handleChange('address', data.address);
            handleChange('neighborhood', data.neighborhood);
            handleChange('city', data.city);
            handleChange('state', data.state);
        },
        [handleChange],
    );

    const { status, lookup } = useViaCep(onFound);

    return (
        <div data-theme={theme} className={styles.wrapper}>
            <div className={styles.form}>
                <header className={styles.header}>
                    <span className={styles.eyebrow}>
                        {isEdit ? 'Editar / Apagar' : 'Cadastro'}
                    </span>
                    <h2 className={styles.title}>Endereço</h2>
                </header>

                <div className={styles.grid}>
                    <div className={styles.cepRow}>
                        <InputField
                            label='CEP'
                            name='postal_code'
                            value={formData.postal_code ?? ''}
                            onChange={e => {
                                const masked = formatCep(e.target.value);
                                handleChange('postal_code', masked);
                                lookup(masked);
                            }}
                            placeholder='00000-000'
                            autoComplete='postal-code'
                        />
                        {status === 'loading' && (
                            <span className={styles.cepStatus}>Buscando…</span>
                        )}
                        {status === 'not_found' && (
                            <span className={styles.cepStatusError}>
                                CEP não encontrado
                            </span>
                        )}
                        {status === 'error' && (
                            <span className={styles.cepStatusError}>
                                Sem conexão — preencha manualmente
                            </span>
                        )}
                    </div>

                    <InputField
                        label='Rua'
                        name='address'
                        value={formData.address ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Rua das Flores'
                        autoComplete='street-address'
                    />
                    <InputField
                        label='Número'
                        name='address_number'
                        value={formData.address_number ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: 123'
                    />
                    <InputField
                        label='Complemento'
                        name='address_complement'
                        value={formData.address_complement ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Apto 12, 2º andar'
                    />
                    <InputField
                        label='Bairro'
                        name='neighborhood'
                        value={formData.neighborhood ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Centro'
                    />
                    <SelectField
                        label='Estado'
                        name='state'
                        value={formData.state ?? ''}
                        onChange={e => handleChange(e)}
                        options={BR_UFS.map(uf => ({
                            value: uf.code,
                            label: `${uf.code} — ${uf.name}`,
                        }))}
                        placeholder='Selecione…'
                    />
                    <InputField
                        label='Cidade'
                        name='city'
                        value={formData.city ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Limeira'
                        autoComplete='address-level2'
                    />
                </div>
            </div>
        </div>
    );
}
