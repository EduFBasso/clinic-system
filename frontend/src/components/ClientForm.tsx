// frontend\src\components\ClientForm.tsx
import React, { useState } from 'react';
import useIsMobile from '../pages/hooks/useIsMobile';
import InputField from './FormElements/InputField';
import FootwearUsedField from './FormElements/FootwearUsedField';
import SockUsedField from './FormElements/SockUsedField';
import type { ClientData } from '../types/ClientData';
import styles from '../styles/pages/Client.module.css';
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

export default function ClientForm() {
    const [formData, setFormData] = useState<ClientData>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        cpf: '',
        address_street: '',
        address_number: '',
        city: '',
        state: '',
        postal_code: '',
        sport_activity: '',
        academic_activity: '',
        footwear_used: '',
        sock_used: '',
        takes_medication: '',
        had_surgery: '',
        is_pregnant: false,
        pain_sensitivity: '',
        clinical_history: '',
        plantar_view_left: '',
        plantar_view_right: '',
        dermatological_pathologies_left: '',
        dermatological_pathologies_right: '',
        nail_changes_left: '',
        nail_changes_right: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Cliente salvo:', formData);
        // Aqui entra a chamada à API futuramente
    };

    // Responsividade dinâmica: hook detecta mobile/tablet em tempo real (até 1024px = coluna única)
    const isMobile = useIsMobile(1024);

    if (isMobile) {
        return (
            <form onSubmit={handleSubmit} className={styles.clientForm}>
                <h2 className={styles.formTitle}>Cadastro de Cliente</h2>
                <div className={styles.formPanels}>
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
                            onChange={handleChange}
                            label={'Telefone'}
                        />
                        <InputField
                            name='email'
                            value={formData.email}
                            onChange={handleChange}
                            label={'E-mail'}
                        />
                        <InputField
                            label='CPF'
                            name='cpf'
                            value={formData.cpf}
                            onChange={handleChange}
                        />
                    </section>
                    <section>
                        <h3 className={styles.panelTitle}>Endereço</h3>
                        <InputField
                            name='address_street'
                            value={formData.address_street}
                            onChange={handleChange}
                            label={'Rua'}
                        />
                        <InputField
                            name='address_number'
                            value={formData.address_number}
                            onChange={handleChange}
                            label={'Número'}
                        />
                        <InputField
                            name='city'
                            value={formData.city}
                            onChange={handleChange}
                            label={'Cidade'}
                        />
                        <InputField
                            name='state'
                            value={formData.state}
                            onChange={handleChange}
                            label={'Estado'}
                        />
                        <InputField
                            name='postal_code'
                            value={formData.postal_code}
                            onChange={handleChange}
                            label={'CEP'}
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
                            onChange={handleChange}
                        />
                        <SockUsedField
                            value={formData.sock_used}
                            onChange={handleChange}
                        />
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
                </div>
                <div className={styles.formActions}>
                    <button type='submit' className={styles.submitButton}>
                        Salvar
                    </button>
                </div>
            </form>
        );
    }

    // Desktop/tablet: mantém painéis lado a lado
    return (
        <form onSubmit={handleSubmit} className={styles.clientForm}>
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
                            onChange={handleChange}
                            label={'Telefone'}
                        />
                        <InputField
                            name='email'
                            value={formData.email}
                            onChange={handleChange}
                            label={'E-mail'}
                        />
                        <InputField
                            label='CPF'
                            name='cpf'
                            value={formData.cpf}
                            onChange={handleChange}
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
                            onChange={handleChange}
                        />
                        <SockUsedField
                            value={formData.sock_used}
                            onChange={handleChange}
                        />
                    </section>
                </div>

                <div className={styles.rightPanel}>
                    <section>
                        <h3 className={styles.panelTitle}>Endereço</h3>
                        <InputField
                            name='address_street'
                            value={formData.address_street}
                            onChange={handleChange}
                            label={'Rua'}
                        />
                        <InputField
                            name='address_number'
                            value={formData.address_number}
                            onChange={handleChange}
                            label={'Número'}
                        />
                        <InputField
                            name='city'
                            value={formData.city}
                            onChange={handleChange}
                            label={'Cidade'}
                        />
                        <InputField
                            name='state'
                            value={formData.state}
                            onChange={handleChange}
                            label={'Estado'}
                        />
                        <InputField
                            name='postal_code'
                            value={formData.postal_code}
                            onChange={handleChange}
                            label={'CEP'}
                        />
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

                <div className={styles.rowPair}>
                    <div className={styles.colPair}>
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
                    </div>
                    <div className={styles.colPair}>
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
                                value={
                                    formData.dermatological_pathologies_right
                                }
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
                    </div>
                </div>
            </div>
            <div className={styles.formActions}>
                <button type='submit' className={styles.submitButton}>
                    Salvar
                </button>
            </div>
        </form>
    );
}
