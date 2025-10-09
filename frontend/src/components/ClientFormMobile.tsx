import React from 'react';
import useHasCamera from '../hooks/useHasCamera';
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
import { BR_UFS } from '../data/br-ufs';
import { useCitiesByUF } from '../hooks/useCitiesByUF';

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
    onPhotoSelected?: (file: File | null) => void;
    initialPhotoUrl?: string | null;
}

export default function ClientFormMobile({
    formData,
    handleChange,
    handleSubmit,
    handleCancel,
    handleDelete,
    isEdit = false,
    onPhotoSelected,
    initialPhotoUrl,
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

    const { names: cityNames, loading: citiesLoading } = useCitiesByUF(
        formData.state,
    );
    const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
    // Hidrata preview inicial se edição e há foto existente
    React.useEffect(() => {
        if (isEdit && !photoPreview && initialPhotoUrl) {
            setPhotoPreview(initialPhotoUrl);
        }
    }, [isEdit, initialPhotoUrl, photoPreview]);
    const fileRef = React.useRef<HTMLInputElement | null>(null);
    const hasCamera = useHasCamera();
    const [showCapture, setShowCapture] = React.useState(false);
    const [captureError, setCaptureError] = React.useState<string | null>(null);
    const [loadingStream, setLoadingStream] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    React.useEffect(() => {
        if (!showCapture) return;
        let active = true;
        (async () => {
            try {
                setCaptureError(null);
                setLoadingStream(true);
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                });
                if (!active) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => {});
                }
                setLoadingStream(false);
            } catch {
                setLoadingStream(false);
                setCaptureError(
                    'Não foi possível acessar a câmera. Permissão negada ou origem não segura.',
                );
            }
        })();
        return () => {
            active = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [showCapture]);
    const onPickPhoto = () => {
        if (hasCamera === true || hasCamera === null) {
            setShowCapture(true);
        } else {
            fileRef.current?.click();
        }
    };
    const takeSnapshot = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
            blob => {
                if (!blob) return;
                const file = new File([blob], 'captured.jpg', {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                });
                const url = URL.createObjectURL(file);
                setPhotoPreview(url);
                onPhotoSelected?.(file);
                setShowCapture(false);
            },
            'image/jpeg',
            0.85,
        );
    };
    const cancelCapture = () => {
        setShowCapture(false);
        setCaptureError(null);
        setLoadingStream(false);
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        setPhotoPreview(url);
        try {
            onPhotoSelected?.(f);
        } catch {
            /* noop */
        }
    };
    return (
        <form
            onSubmit={handleSubmit}
            className={styles.clientForm}
            style={{ background: 'var(--color-bg)', minHeight: '100%' }}
        >
            <h2 className={styles.formTitle}>Cadastro de Cliente</h2>
            <section>
                <h3 className={styles.panelTitle}>Dados Pessoais</h3>
                {/* Foto do cliente (opcional) */}
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 6 }}>
                        Foto (opcional)
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                background: '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                display: 'grid',
                                placeItems: 'center',
                                overflow: 'hidden',
                            }}
                        >
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt='Foto do cliente'
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                />
                            ) : (
                                <span style={{ fontSize: 12, opacity: 0.6 }}>
                                    Sem foto
                                </span>
                            )}
                        </div>
                        <button
                            type='button'
                            onClick={onPickPhoto}
                            style={{ fontSize: 12 }}
                        >
                            Selecionar foto
                        </button>
                        <input
                            ref={fileRef}
                            type='file'
                            accept='image/*'
                            capture='environment'
                            onChange={onFileChange}
                            style={{ display: 'none' }}
                        />
                        {showCapture && (
                            <div
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.85)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 2147483000,
                                    padding: 14,
                                }}
                            >
                                <div
                                    style={{
                                        background: '#1d1d1f',
                                        padding: 12,
                                        borderRadius: 12,
                                        width: 'min(520px, 94vw)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        gap: 12,
                                        maxHeight: '90vh',
                                        boxShadow:
                                            '0 8px 32px rgba(0,0,0,0.45)',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <h3
                                            style={{
                                                margin: 0,
                                                fontSize: '0.95rem',
                                                color: '#f5f5f5',
                                            }}
                                        >
                                            Captura da Câmera
                                        </h3>
                                        <button
                                            type='button'
                                            onClick={cancelCapture}
                                            style={{
                                                background: 'transparent',
                                                color: '#bbb',
                                                border: 'none',
                                                fontSize: 22,
                                                lineHeight: 1,
                                                cursor: 'pointer',
                                                padding: '2px 6px',
                                                borderRadius: 6,
                                            }}
                                            aria-label='Fechar captura'
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {captureError ? (
                                            <div
                                                style={{
                                                    color: '#f87171',
                                                    fontSize: 13,
                                                    textAlign: 'center',
                                                    padding: '0.75rem',
                                                }}
                                            >
                                                {captureError}
                                                <br />
                                                {window.location.hostname !==
                                                    'localhost' && (
                                                    <span
                                                        style={{
                                                            display: 'block',
                                                            marginTop: 6,
                                                            opacity: 0.85,
                                                        }}
                                                    >
                                                        Prefira{' '}
                                                        <code>localhost</code>{' '}
                                                        para ter acesso
                                                        facilitado à câmera.
                                                    </span>
                                                )}
                                                <button
                                                    type='button'
                                                    style={{ marginTop: 10 }}
                                                    onClick={() => {
                                                        setShowCapture(false);
                                                        fileRef.current?.click();
                                                    }}
                                                >
                                                    Usar arquivo
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <video
                                                    ref={videoRef}
                                                    style={{
                                                        width: '100%',
                                                        maxHeight: '55vh',
                                                        background: '#000',
                                                        borderRadius: 10,
                                                        objectFit: 'contain',
                                                        boxShadow:
                                                            '0 0 0 1px #333',
                                                    }}
                                                    playsInline
                                                    muted
                                                    autoPlay
                                                />
                                                {loadingStream && (
                                                    <div
                                                        style={{
                                                            position:
                                                                'absolute',
                                                            inset: 0,
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            justifyContent:
                                                                'center',
                                                            background:
                                                                'rgba(0,0,0,0.4)',
                                                            borderRadius: 10,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                color: '#e5e7eb',
                                                                fontSize: 13,
                                                            }}
                                                        >
                                                            Abrindo câmera...
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {!captureError && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: 10,
                                                flexWrap: 'wrap',
                                                justifyContent: 'flex-end',
                                            }}
                                        >
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setShowCapture(false);
                                                    fileRef.current?.click();
                                                }}
                                                style={{
                                                    padding: '0.5rem 0.85rem',
                                                }}
                                            >
                                                Arquivo...
                                            </button>
                                            <button
                                                type='button'
                                                onClick={cancelCapture}
                                                style={{
                                                    padding: '0.5rem 0.85rem',
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type='button'
                                                onClick={takeSnapshot}
                                                disabled={loadingStream}
                                                style={{
                                                    padding: '0.5rem 0.85rem',
                                                    background: '#2563eb',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    opacity: loadingStream
                                                        ? 0.6
                                                        : 1,
                                                }}
                                            >
                                                Capturar
                                            </button>
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            fontSize: 10.5,
                                            opacity: 0.55,
                                            textAlign: 'right',
                                        }}
                                    >
                                        {hasCamera === null
                                            ? 'Detectando câmera...'
                                            : hasCamera
                                            ? 'Câmera detectada'
                                            : 'Nenhuma câmera listada'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
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
                {/* Data de Nascimento (dd/mm/YYYY) */}
                <InputField
                    name='date_of_birth'
                    value={formData.date_of_birth || ''}
                    onChange={e => {
                        let v = e.target.value.replace(/[^0-9]/g, '');
                        if (v.length > 8) v = v.slice(0, 8);
                        // Formata incrementalmente dd/mm/YYYY
                        if (v.length >= 5) {
                            v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(
                                4,
                            )}`;
                        } else if (v.length >= 3) {
                            v = `${v.slice(0, 2)}/${v.slice(2)}`;
                        }
                        handleChange('date_of_birth', v);
                    }}
                    label={'Data de Nascimento'}
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
                    label={'Rua'}
                />
                <InputField
                    name='address_number'
                    value={formData.address_number || ''}
                    onChange={e => {
                        const digits = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 10);
                        handleChange('address_number', digits);
                    }}
                    label={'Número'}
                />
                {/* CEP imediatamente abaixo da Rua */}
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
                <InputField
                    name='neighborhood'
                    value={formData.neighborhood}
                    onChange={e => handleChange('neighborhood', e.target.value)}
                    label={'Bairro'}
                />
                {/* Spacer ajustado: +3px para aumentar respiro entre Bairro e Estado */}
                <div style={{ height: 7 }} />
                {/* Estado (UF) antes de Cidade */}
                <div className={styles.formRow} style={{ marginBottom: 15 }}>
                    <label
                        htmlFor='state'
                        style={{ display: 'block', marginBottom: 8 }}
                    >
                        Estado (UF)
                    </label>
                    <select
                        id='state'
                        name='state'
                        value={formData.state}
                        onChange={e => {
                            handleChange('state', e.target.value);
                            handleChange('city', '');
                        }}
                        style={{
                            width: '100%',
                            background: 'var(--color-primary-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4,
                            padding: '10px 8px 13px', // +1px extra bottom
                            color: 'var(--color-text)',
                            marginBottom: 0,
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
                {/* Cidade dependente */}
                <div className={styles.formRow}>
                    <label
                        htmlFor='city'
                        style={{ display: 'block', marginBottom: 8 }}
                    >
                        Cidade
                    </label>
                    <select
                        id='city'
                        name='city'
                        disabled={!formData.state || citiesLoading}
                        value={formData.city}
                        onChange={e => handleChange('city', e.target.value)}
                        style={{
                            width: '100%',
                            background: 'var(--color-primary-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4,
                            padding: '10px 8px 13px', // match updated state select height (+1px)
                            color: 'var(--color-text)',
                        }}
                    >
                        {!formData.state ? (
                            <option value=''>
                                Selecione o estado primeiro
                            </option>
                        ) : citiesLoading ? (
                            <option value=''>Carregando cidades…</option>
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
                    textPlaceholder='Descrição do(s) medicamento(s)'
                />
                <ConditionalRadioField
                    label='Já fez cirurgia?'
                    value={formData.had_surgery}
                    onChange={handleRadioChange('had_surgery')}
                    textPlaceholder='Descrição da cirurgia'
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
