import React from 'react';
import InputField from './FormElements/InputField';
import type { ClientData } from '../types/ClientData';
import styles from '../styles/pages/Client.module.css';
import ConditionalRadioField from './FormElements/ConditionalRadioField';
import FootwearUsedField from './FormElements/FootwearUsedField';
import SockUsedField from './FormElements/SockUsedField';
import BooleanRadioField from './FormElements/BooleanRadioField';
import PainSensitivityField from './FormElements/PainSensitivityField';
import MedicalHistoryField from './FormElements/MedicalHistoryField';
import PlantarViewLeft from './FormElements/PlantarViewLeft';
import PlantarViewRight from './FormElements/PlantarViewRight';
import DermatologicalPathologiesLeft from './FormElements/DermatologicalPathologiesLeft';
import DermatologicalPathologiesRight from './FormElements/DermatologicalPathologiesRight';
import NailChangesLeft from './FormElements/NailChangesLeft';
import NailChangesRight from './FormElements/NailChangesRight';
import DeformitiesLeft from './FormElements/DeformitiesLeft';
import DeformitiesRight from './FormElements/DeformitiesRight';
import { formatCep } from '../utils/formatCep';
import { formatPhone } from '../utils/formatPhone';
import SensitivityTest from './FormElements/SensitivityTest';

interface Props {
    formData: ClientData;
    handleChange: (
        field: keyof ClientData,
        value: ClientData[keyof ClientData],
    ) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleCancel: () => void;
    handleDelete: () => void;
    isEdit?: boolean;
}

export default function ClientFormMobile({
    formData,
    handleChange,
    handleSubmit,
    handleCancel,
    handleDelete,
    isEdit = false,
}: Props) {
    // Handler intermediário para radio fields (string)
    const handleRadioChange = (name: keyof ClientData) => (value: string) => {
        handleChange(name, value);
    };
    // Handler intermediário para boolean fields
    const handleBooleanChange =
        (name: keyof ClientData) => (value: boolean) => {
            handleChange(name, value);
        };

    return (
        <form onSubmit={handleSubmit} className={styles.clientForm}>
            <h2 className={styles.formTitle}>Cadastro de Cliente</h2>
            <section>
                <h3 className={styles.panelTitle}>Dados Pessoais</h3>
                <InputField
                    name='first_name'
                    value={formData.first_name}
                    onChange={e => handleChange('first_name', e.target.value)}
                    label={'Nome'}
                />
                <InputField
                    name='last_name'
                    value={formData.last_name}
                    onChange={e => handleChange('last_name', e.target.value)}
                    label={'Sobrenome'}
                />
                <InputField
                    name='phone'
                    value={formData.phone}
                    onChange={e => {
                        const masked = formatPhone(e.target.value);
                        handleChange('phone', masked);
                    }}
                    label={'Telefone'}
                />
                <InputField
                    name='email'
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    label={'E-mail'}
                />
                <InputField
                    label='Profissão'
                    name='profession'
                    value={formData.profession}
                    onChange={e => handleChange('profession', e.target.value)}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>Endereço</h3>
                <InputField
                    name='address'
                    value={formData.address}
                    onChange={e => handleChange('address', e.target.value)}
                    label={'Rua / Av., nº'}
                />
                <InputField
                    name='neighborhood'
                    value={formData.neighborhood}
                    onChange={e => handleChange('neighborhood', e.target.value)}
                    label={'Bairro'}
                />
                <InputField
                    name='city'
                    value={formData.city}
                    onChange={e => handleChange('city', e.target.value)}
                    label={'Cidade'}
                />
                <InputField
                    name='state'
                    value={formData.state}
                    onChange={e => handleChange('state', e.target.value)}
                    label={'Estado'}
                />
                <InputField
                    name='postal_code'
                    value={formData.postal_code}
                    onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        const masked = formatCep(raw);
                        handleChange('postal_code', masked);
                    }}
                    label={'CEP'}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>Atividades e Calçados</h3>
                <ConditionalRadioField
                    label='Pratica esportes?'
                    value={formData.sport_activity}
                    onChange={handleRadioChange('sport_activity')}
                />
                <ConditionalRadioField
                    label='Pratica academia?'
                    value={formData.academic_activity}
                    onChange={handleRadioChange('academic_activity')}
                />
                <FootwearUsedField
                    value={formData.footwear_used}
                    onChange={handleRadioChange('footwear_used')}
                />
                <SockUsedField
                    value={formData.sock_used}
                    onChange={handleRadioChange('sock_used')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>Anamnese</h3>
                <ConditionalRadioField
                    label='Toma medicação?'
                    value={formData.takes_medication}
                    onChange={handleRadioChange('takes_medication')}
                />
                <ConditionalRadioField
                    label='Já fez cirurgia?'
                    value={formData.had_surgery}
                    onChange={handleRadioChange('had_surgery')}
                />
                <BooleanRadioField
                    label='Está grávida?'
                    value={formData.is_pregnant ?? null}
                    onChange={handleBooleanChange('is_pregnant')}
                />
                <PainSensitivityField
                    value={formData.pain_sensitivity}
                    onChange={handleRadioChange('pain_sensitivity')}
                />
                <MedicalHistoryField
                    value={formData.clinical_history}
                    onChange={handleRadioChange('clinical_history')}
                />
            </section>
            <h2 className={styles.centeredTitle}>Avaliação dos Pés</h2>
            <section>
                <h3 className={styles.panelTitle}>
                    Vista plantar (pé esquerdo)
                </h3>
                <PlantarViewLeft
                    value={formData.plantar_view_left}
                    onChange={handleRadioChange('plantar_view_left')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Vista plantar (pé direito)
                </h3>
                <PlantarViewRight
                    value={formData.plantar_view_right}
                    onChange={handleRadioChange('plantar_view_right')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Patologias dermatológicas (pé esquerdo)
                </h3>
                <DermatologicalPathologiesLeft
                    value={formData.dermatological_pathologies_left}
                    onChange={handleRadioChange(
                        'dermatological_pathologies_left',
                    )}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Patologias dermatológicas (pé direito)
                </h3>
                <DermatologicalPathologiesRight
                    value={formData.dermatological_pathologies_right}
                    onChange={handleRadioChange(
                        'dermatological_pathologies_right',
                    )}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Alterações ungueais (pé esquerdo)
                </h3>
                <NailChangesLeft
                    value={formData.nail_changes_left}
                    onChange={handleRadioChange('nail_changes_left')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Alterações ungueais (pé direito)
                </h3>
                <NailChangesRight
                    value={formData.nail_changes_right}
                    onChange={handleRadioChange('nail_changes_right')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Deformidades (pé esquerdo)
                </h3>
                <DeformitiesLeft
                    value={formData.deformities_left}
                    onChange={handleRadioChange('deformities_left')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>Deformidades (pé direito)</h3>
                <DeformitiesRight
                    value={formData.deformities_right}
                    onChange={handleRadioChange('deformities_right')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>Teste de Sensibilidade</h3>
                <SensitivityTest
                    value={formData.sensitivity_test}
                    onChange={handleRadioChange('sensitivity_test')}
                />
            </section>
            <section>
                <h3 className={styles.panelTitle}>
                    Outros procedimentos / Observações
                </h3>
                <textarea
                    name='other_procedures'
                    value={formData.other_procedures}
                    onChange={e =>
                        handleChange('other_procedures', e.target.value)
                    }
                    rows={4}
                    style={{
                        width: '100%',
                        resize: 'vertical',
                        marginTop: 4,
                        background: 'var(--color-bg-section)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        fontSize: '0.95rem',
                        color: 'var(--color-text)',
                        padding: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    placeholder='Descreva outros procedimentos realizados ou observações...'
                />
            </section>
            <div
                className='formActions'
                style={{
                    position: 'fixed',
                    left: 0,
                    bottom: 0,
                    width: '100%',
                    background: 'rgba(255,255,255,0.98)',
                    boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
                    zIndex: 9999,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '1rem',
                    padding: '1rem 0.5rem',
                }}
            >
                <button
                    className='btn-save'
                    type='submit'
                    style={{
                        minWidth: 120,
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        background: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.75rem 1.5rem',
                        boxShadow: '0 2px 8px rgba(25,118,210,0.08)',
                        cursor: 'pointer',
                    }}
                >
                    Salvar
                </button>
                <button
                    className='btn-cancel'
                    type='button'
                    onClick={handleCancel}
                    style={{
                        minWidth: 120,
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        background: '#fff',
                        color: '#1976d2',
                        border: '2px solid #1976d2',
                        borderRadius: 6,
                        padding: '0.75rem 1.5rem',
                        boxShadow: '0 2px 8px rgba(25,118,210,0.08)',
                        cursor: 'pointer',
                    }}
                >
                    Cancelar
                </button>
                {isEdit && (
                    <button
                        className='btn-delete'
                        type='button'
                        onClick={handleDelete}
                        style={{
                            minWidth: 120,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            background: '#d32f2f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.75rem 1.5rem',
                            boxShadow: '0 2px 8px rgba(211,47,47,0.08)',
                            cursor: 'pointer',
                        }}
                    >
                        Apagar
                    </button>
                )}
            </div>
        </form>
    );
}
