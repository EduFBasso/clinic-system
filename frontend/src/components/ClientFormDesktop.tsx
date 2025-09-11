// frontend\src\components\ClientFormDesktop.tsx
import React from 'react';
import InputField from './FormElements/InputField';
import FootwearUsedField from './FormElements/FootwearUsedField';
import SockUsedField from './FormElements/SockUsedField';
import ConditionalRadioField from './FormElements/ConditionalRadioField';
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
import SensitivityTest from './FormElements/SensitivityTest';
import type { ClientData } from '../types/ClientData';
import { formatCep } from '../utils/formatCep';
import { formatPhone } from '../utils/formatPhone';
import styles from '../styles/pages/Client.module.css';
import { BR_UFS } from '../data/br-ufs';
import { useCitiesByUF } from '../hooks/useCitiesByUF';

interface Props {
    formData: ClientData;
    setFormData: React.Dispatch<React.SetStateAction<ClientData>>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    handleCancel: () => void;
    handleDelete: () => void;
    isEdit?: boolean; // Optional prop to indicate if this is an edit form
    onQuickSubmit?: () => void;
    formRef?: React.Ref<HTMLFormElement>;
}

export default function ClientFormDesktop({
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    handleCancel,
    handleDelete,
    isEdit,
    onQuickSubmit,
    formRef,
}: Props) {
    const { names: cityNames, loading: citiesLoading } = useCitiesByUF(
        formData.state,
    );
    return (
        <form
            onSubmit={handleSubmit}
            ref={formRef}
            className={styles.clientForm}
        >
            <h2 className={styles.formTitle}>Cadastro de Cliente</h2>
            <div className={styles.formPanels}>
                {/* Pares de campos alinhados por linha */}
                <div className={styles.leftPanel}>
                    <section>
                        <h3 className={styles.panelTitle}>Dados Pessoais</h3>
                        <InputField
                            name='first_name'
                            value={formData.first_name}
                            onChange={handleChange}
                            label={'Nome'}
                        />
                        <InputField
                            name='last_name'
                            value={formData.last_name}
                            onChange={handleChange}
                            label={'Sobrenome'}
                        />
                        <InputField
                            name='phone'
                            value={formData.phone}
                            onChange={e => {
                                const masked = formatPhone(e.target.value);
                                setFormData(prev => ({
                                    ...prev,
                                    phone: masked,
                                }));
                            }}
                            label={'Telefone'}
                        />
                        <InputField
                            name='email'
                            value={formData.email}
                            onChange={e => {
                                setFormData(prev => ({
                                    ...prev,
                                    email: e.target.value,
                                }));
                            }}
                            label={'E-mail'}
                        />
                        <InputField
                            label='Profissão'
                            name='profession'
                            value={formData.profession}
                            onChange={e =>
                                setFormData(prev => ({
                                    ...prev,
                                    profession: e.target.value,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Atividades e Calçados
                        </h3>
                        <ConditionalRadioField
                            label='Pratica esportes?'
                            value={formData.sport_activity}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    sport_activity: val,
                                }))
                            }
                        />
                        <ConditionalRadioField
                            label='Pratica academia?'
                            value={formData.academic_activity}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    academic_activity: val,
                                }))
                            }
                        />
                        <FootwearUsedField
                            value={formData.footwear_used}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    footwear_used: val,
                                }))
                            }
                        />
                        <SockUsedField
                            value={formData.sock_used}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    sock_used: val,
                                }))
                            }
                        />
                    </section>
                </div>
                <div className={styles.rightPanel}>
                    <section style={{ marginBottom: 32 }}>
                        <h3 className={styles.panelTitle}>Endereço</h3>
                        <InputField
                            name='address'
                            value={formData.address}
                            onChange={handleChange}
                            label={'Rua / Av., nº'}
                        />
                        {/* CEP imediatamente abaixo da Rua */}
                        <InputField
                            label='CEP'
                            name='postal_code'
                            value={formData.postal_code}
                            onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '');
                                const masked = formatCep(raw);
                                setFormData(prev => ({
                                    ...prev,
                                    postal_code: masked,
                                }));
                            }}
                        />
                        <InputField
                            name='neighborhood'
                            value={formData.neighborhood}
                            onChange={handleChange}
                            label={'Bairro'}
                        />
                        {/* Spacer ajustado: +3px para aumentar respiro entre Bairro e Estado */}
                        <div style={{ height: 5 }} />
                        {/* Estado (UF) antes de Cidade */}
                        <div
                            className={styles.formRow}
                            style={{ marginBottom: 13 }}
                        >
                            <label
                                htmlFor='state'
                                style={{ display: 'block', marginBottom: 4 }}
                            >
                                Estado (UF)
                            </label>
                            <select
                                id='state'
                                name='state'
                                value={formData.state}
                                onChange={e =>
                                    setFormData(prev => ({
                                        ...prev,
                                        state: e.target.value,
                                        city: '', // reset city on state change
                                    }))
                                }
                                style={{
                                    width: '100%',
                                    background: 'var(--color-primary-light)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 4,
                                    padding: '10px 8px 13px', // +1px extra height
                                    color: 'var(--color-text)',
                                }}
                            >
                                <option value=''>Selecione</option>
                                {BR_UFS.map(uf => (
                                    <option key={uf.code} value={uf.code}>
                                        {uf.name} ({uf.code})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* Cidade dependente do UF selecionado */}
                        <div className={styles.formRow}>
                            <label
                                htmlFor='city'
                                style={{ display: 'block', marginBottom: 4 }}
                            >
                                Cidade
                            </label>
                            <select
                                id='city'
                                name='city'
                                disabled={!formData.state || citiesLoading}
                                value={formData.city}
                                onChange={e =>
                                    setFormData(prev => ({
                                        ...prev,
                                        city: e.target.value,
                                    }))
                                }
                                style={{
                                    width: '100%',
                                    background: 'var(--color-primary-light)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 4,
                                    padding: '10px 8px 13px', // sync with state select height (+1px)
                                    color: 'var(--color-text)',
                                }}
                            >
                                {!formData.state ? (
                                    <option value=''>
                                        Selecione o estado primeiro
                                    </option>
                                ) : citiesLoading ? (
                                    <option value=''>
                                        Carregando cidades…
                                    </option>
                                ) : (
                                    <>
                                        <option value=''>Selecione</option>
                                        {cityNames.map(name => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                        {/* state already rendered above */}
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>Anamnese</h3>
                        <ConditionalRadioField
                            label='Toma medicação?'
                            value={formData.takes_medication}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    takes_medication: val,
                                }))
                            }
                            textPlaceholder='Descrição do(s) medicamento(s)'
                        />
                        <ConditionalRadioField
                            label='Já fez cirurgia?'
                            value={formData.had_surgery}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    had_surgery: val,
                                }))
                            }
                            textPlaceholder='Descrição da cirurgia'
                        />
                        <BooleanRadioField
                            label='Está grávida?'
                            value={formData.is_pregnant ?? null}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    is_pregnant: val,
                                }))
                            }
                        />
                        <PainSensitivityField
                            value={formData.pain_sensitivity}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    pain_sensitivity: val,
                                }))
                            }
                        />
                        <MedicalHistoryField
                            value={formData.clinical_history}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    clinical_history: val,
                                }))
                            }
                        />
                    </section>
                </div>
            </div>
            <h2 className={styles.centeredTitle}>Avaliação dos Pés</h2>
            <div className={styles.formPanels}>
                <div className={styles.leftPanel}>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Vista plantar (pé esquerdo)
                        </h3>
                        <PlantarViewLeft
                            value={formData.plantar_view_left}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    plantar_view_left: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Patologias dermatológicas (pé esquerdo)
                        </h3>
                        <DermatologicalPathologiesLeft
                            value={formData.dermatological_pathologies_left}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    dermatological_pathologies_left: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Alterações ungueais (pé esquerdo)
                        </h3>
                        <NailChangesLeft
                            value={formData.nail_changes_left}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    nail_changes_left: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Deformidades (pé esquerdo)
                        </h3>
                        <DeformitiesLeft
                            value={formData.deformities_left}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    deformities_left: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Outros procedimentos / Observações
                        </h3>
                        <textarea
                            name='other_procedures'
                            value={formData.other_procedures ?? ''}
                            onChange={e =>
                                setFormData(prev => ({
                                    ...prev,
                                    other_procedures: e.target.value ?? '',
                                }))
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
                            }}
                            placeholder='Descreva outros procedimentos realizados ou observações...'
                        />
                    </section>
                </div>
                <div className={styles.rightPanel}>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Vista plantar (pé direito)
                        </h3>
                        <PlantarViewRight
                            value={formData.plantar_view_right}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    plantar_view_right: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Patologias dermatológicas (pé direito)
                        </h3>
                        <DermatologicalPathologiesRight
                            value={formData.dermatological_pathologies_right}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    dermatological_pathologies_right: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Alterações ungueais (pé direito)
                        </h3>
                        <NailChangesRight
                            value={formData.nail_changes_right}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    nail_changes_right: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Deformidades (pé direito)
                        </h3>
                        <DeformitiesRight
                            value={formData.deformities_right}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    deformities_right: val,
                                }))
                            }
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>
                            Teste de Sensibilidade
                        </h3>
                        <SensitivityTest
                            value={formData.sensitivity_test}
                            onChange={val =>
                                setFormData(prev => ({
                                    ...prev,
                                    sensitivity_test: val,
                                }))
                            }
                        />
                    </section>
                </div>
            </div>
            <div className={styles.formActions}>
                {!isEdit && (
                    <button
                        className={styles['btn-save']}
                        type='submit'
                        onMouseDown={onQuickSubmit}
                        title='Ctrl+Enter'
                    >
                        Salvar e novo
                    </button>
                )}
                <button className={styles['btn-save']} type='submit'>
                    Salvar
                </button>
                <button
                    className={styles['btn-cancel']}
                    type='button'
                    onClick={handleCancel}
                >
                    Cancelar
                </button>

                {isEdit && (
                    <button
                        className={styles['btn-delete']}
                        type='button'
                        onClick={handleDelete}
                    >
                        Apagar
                    </button>
                )}
            </div>
        </form>
    );
}
