// frontend\src\components\ClientFormDesktop.tsx
import React from 'react';
import useHasCamera from '../hooks/useHasCamera';
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
    // Recebe URL existente (se disponível) para pré-visualização
    initialPhotoUrl?: string | null;
    onPhotoSelected?: (file: File | null) => void;
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
    initialPhotoUrl,
    onPhotoSelected,
}: Props) {
    const { names: cityNames, loading: citiesLoading } = useCitiesByUF(
        formData.state,
    );
    // Foto
    const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
    const fileRef = React.useRef<HTMLInputElement | null>(null);
    React.useEffect(() => {
        if (!photoPreview && initialPhotoUrl) {
            setPhotoPreview(initialPhotoUrl);
        }
    }, [initialPhotoUrl, photoPreview]);
    const hasCamera = useHasCamera();
    const [showCapture, setShowCapture] = React.useState(false);
    const [captureError, setCaptureError] = React.useState<string | null>(null);
    const [loadingStream, setLoadingStream] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    React.useEffect(() => {
        if (!showCapture) return; // somente quando abre
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
                    'Não foi possível acessar a câmera. Verifique permissões ou use localhost.',
                );
            }
        })();
        return () => {
            active = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [showCapture]);
    const onPickPhoto = () => {
        // Se ainda detectando (null) tentamos abrir a câmera para forçar getUserMedia e possível prompt.
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
    async function compressImage(file: File): Promise<File> {
        // Compressão simples client-side usando canvas (sem libs externas)
        return new Promise(resolve => {
            try {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 900; // limite máximo (px)
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        const ratio = Math.min(maxDim / width, maxDim / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(file);
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        blob => {
                            if (!blob) return resolve(file);
                            const qFile = new File(
                                [blob],
                                file.name.replace(
                                    /\.(png|jpg|jpeg|webp|heic|heif)$/i,
                                    '.jpg',
                                ),
                                {
                                    type: 'image/jpeg',
                                    lastModified: Date.now(),
                                },
                            );
                            resolve(qFile);
                        },
                        'image/jpeg',
                        0.82,
                    );
                };
                img.onerror = () => resolve(file);
                img.src = URL.createObjectURL(file);
            } catch {
                resolve(file);
            }
        });
    }
    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const compressed = await compressImage(f);
        const url = URL.createObjectURL(compressed);
        setPhotoPreview(url);
        try {
            onPhotoSelected?.(compressed);
        } catch {
            /* noop */
        }
    };
    return (
        <form
            onSubmit={handleSubmit}
            ref={formRef}
            className={styles.clientForm}
            style={{ background: 'var(--color-bg)', minHeight: '100%' }}
        >
            <h2 className={styles.formTitle}>Cadastro de Cliente</h2>
            <div className={styles.formPanels}>
                {/* Pares de campos alinhados por linha */}
                <div className={styles.leftPanel}>
                    <section>
                        <h3 className={styles.panelTitle}>Dados Pessoais</h3>
                        {/* Foto do cliente (desktop) */}
                        <div style={{ marginBottom: 16 }}>
                            <label
                                style={{ display: 'block', marginBottom: 6 }}
                            >
                                Foto (opcional)
                            </label>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
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
                                        <span
                                            style={{
                                                fontSize: 12,
                                                opacity: 0.6,
                                            }}
                                        >
                                            Sem foto
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 6,
                                    }}
                                >
                                    <button
                                        type='button'
                                        onClick={onPickPhoto}
                                        style={{ fontSize: 12 }}
                                    >
                                        Selecionar foto
                                    </button>
                                    {photoPreview && (
                                        <button
                                            type='button'
                                            onClick={() => {
                                                setPhotoPreview(null);
                                                onPhotoSelected?.(null);
                                            }}
                                            style={{
                                                fontSize: 11,
                                                opacity: 0.7,
                                            }}
                                        >
                                            Remover
                                        </button>
                                    )}
                                </div>
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
                                            padding: 20,
                                            backdropFilter: 'blur(2px)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: '#1d1d1f',
                                                padding: 16,
                                                borderRadius: 14,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'stretch',
                                                gap: 14,
                                                width: 'min(760px, 92vw)',
                                                maxHeight: '88vh',
                                                boxShadow:
                                                    '0 8px 32px rgba(0,0,0,0.45)',
                                                position: 'relative',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <h3
                                                    style={{
                                                        margin: 0,
                                                        fontSize: '1rem',
                                                        color: '#f5f5f5',
                                                    }}
                                                >
                                                    Captura da Câmera
                                                </h3>
                                                <button
                                                    type='button'
                                                    onClick={cancelCapture}
                                                    style={{
                                                        background:
                                                            'transparent',
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
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {captureError ? (
                                                    <div
                                                        style={{
                                                            color: '#f87171',
                                                            fontSize: 14,
                                                            textAlign: 'center',
                                                            padding: '1rem',
                                                        }}
                                                    >
                                                        {captureError}
                                                        <br />
                                                        {window.location
                                                            .hostname !==
                                                            'localhost' && (
                                                            <span
                                                                style={{
                                                                    display:
                                                                        'block',
                                                                    marginTop: 8,
                                                                    opacity: 0.8,
                                                                }}
                                                            >
                                                                Acesse via{' '}
                                                                <code>
                                                                    http://localhost:5173
                                                                </code>{' '}
                                                                para permissões
                                                                mais simples.
                                                            </span>
                                                        )}
                                                        <button
                                                            type='button'
                                                            style={{
                                                                marginTop: 12,
                                                            }}
                                                            onClick={() => {
                                                                setShowCapture(
                                                                    false,
                                                                );
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
                                                                maxHeight:
                                                                    '60vh',
                                                                background:
                                                                    '#000',
                                                                borderRadius: 10,
                                                                objectFit:
                                                                    'contain',
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
                                                                    display:
                                                                        'flex',
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
                                                                        fontSize: 14,
                                                                    }}
                                                                >
                                                                    Abrindo
                                                                    câmera...
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
                                                        gap: 12,
                                                        flexWrap: 'wrap',
                                                        justifyContent:
                                                            'flex-end',
                                                    }}
                                                >
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setShowCapture(
                                                                false,
                                                            );
                                                            fileRef.current?.click();
                                                        }}
                                                        style={{
                                                            padding:
                                                                '0.55rem 0.9rem',
                                                        }}
                                                    >
                                                        Arquivo...
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={cancelCapture}
                                                        style={{
                                                            padding:
                                                                '0.55rem 0.9rem',
                                                        }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={takeSnapshot}
                                                        disabled={loadingStream}
                                                        style={{
                                                            padding:
                                                                '0.55rem 0.9rem',
                                                            background:
                                                                '#2563eb',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: 6,
                                                            opacity:
                                                                loadingStream
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
                                                    fontSize: 11,
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
                            name='date_of_birth'
                            value={formData.date_of_birth || ''}
                            onChange={e => {
                                let v = e.target.value.replace(/[^0-9]/g, '');
                                if (v.length > 8) v = v.slice(0, 8);
                                // dd/mm/YYYY
                                if (v.length >= 5) {
                                    v = `${v.slice(0, 2)}/${v.slice(
                                        2,
                                        4,
                                    )}/${v.slice(4)}`;
                                } else if (v.length >= 3) {
                                    v = `${v.slice(0, 2)}/${v.slice(2)}`;
                                }
                                setFormData(prev => ({
                                    ...prev,
                                    date_of_birth: v,
                                }));
                            }}
                            label={'Data de Nascimento'}
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
                    <section style={{ marginBottom: 25 }}>
                        <h3 className={styles.panelTitle}>Endereço</h3>
                        <InputField
                            name='address'
                            value={formData.address}
                            onChange={handleChange}
                            label={'Rua'}
                        />
                        <InputField
                            name='address_number'
                            value={formData.address_number || ''}
                            onChange={e => {
                                const digits = e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 10);
                                setFormData(prev => ({
                                    ...prev,
                                    address_number: digits,
                                }));
                            }}
                            label={'Número'}
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
                        {/* Espaço extra interno para igualar altura ao cartão Dados Pessoais (ajuste fino) */}
                        <div style={{ height: 7 }} />
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
