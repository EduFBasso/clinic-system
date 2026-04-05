import type { ClientData } from '../../types/ClientData';
import InputField from '../FormElements/InputField/InputField';
import SelectField from '../FormElements/SelectField/SelectField';
import { formatPhone } from '../../utils/formatPhone';
import { formatCpf, formatCnpj, formatRg } from '../../utils/formatCpf';
import styles from './ClientPersonalDataForm.module.css';

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
    feedback?: { type: 'error'; message: string } | null;
    isEdit?: boolean;
}

/** Convert dd/mm/YYYY or YYYY-MM-DD to YYYY-MM-DD for <input type="date"> */
function toInputDate(dob: string | undefined): string {
    if (!dob) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
    const [d, m, y] = dob.split('/');
    if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return '';
}

export default function ClientPersonalDataForm({
    formData,
    handleChange,
    feedback,
    isEdit = false,
}: Props) {
    return (
        <div data-theme='blue' className={styles.wrapper}>
            <div className={styles.form}>
                <header className={styles.header}>
                    <span className={styles.eyebrow}>
                        {isEdit ? 'Editar / Apagar' : 'Cadastro'}
                    </span>
                    <h2 className={styles.title}>Dados Pessoais</h2>
                </header>

                {feedback?.type === 'error' && (
                    <p role='alert' className={styles.errorBanner}>
                        {feedback.message}
                    </p>
                )}

                <div className={styles.grid}>
                    <InputField
                        label='Nome'
                        name='first_name'
                        value={formData.first_name}
                        onChange={e => handleChange(e)}
                        required
                        placeholder='Nome'
                        autoComplete='given-name'
                    />
                    <InputField
                        label='Sobrenome'
                        name='last_name'
                        value={formData.last_name}
                        onChange={e => handleChange(e)}
                        required
                        placeholder='Sobrenome'
                        autoComplete='family-name'
                    />
                    <SelectField
                        label='Sexo'
                        name='sex'
                        value={formData.sex ?? ''}
                        onChange={e => handleChange(e)}
                        options={[
                            { value: 'masculino', label: 'Masculino' },
                            { value: 'feminino', label: 'Feminino' },
                            { value: 'outro', label: 'Outro' },
                            {
                                value: 'nao_informado',
                                label: 'Prefiro não informar',
                            },
                        ]}
                        placeholder='Selecione…'
                    />
                    <InputField
                        label='Telefone'
                        name='phone'
                        value={formData.phone}
                        onChange={e =>
                            handleChange('phone', formatPhone(e.target.value))
                        }
                        required
                        type='tel'
                        placeholder='(11) 99999-9999'
                        autoComplete='tel'
                    />
                    <InputField
                        label='E-mail'
                        name='email'
                        value={formData.email}
                        onChange={e => handleChange(e)}
                        type='email'
                        placeholder='email@exemplo.com'
                        autoComplete='email'
                    />
                    <InputField
                        label='Nascimento'
                        name='date_of_birth'
                        value={toInputDate(formData.date_of_birth)}
                        onChange={e => {
                            const iso = e.target.value;
                            const [y, m, d] = iso.split('-');
                            const dob = iso ? `${d}/${m}/${y}` : '';
                            handleChange('date_of_birth', dob);
                        }}
                        type='date'
                    />
                    <InputField
                        label='Profissão'
                        name='profession'
                        value={formData.profession}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Professora, Maratonista'
                    />
                    <InputField
                        label='RG'
                        name='rg'
                        value={formData.rg ?? ''}
                        onChange={e =>
                            handleChange('rg', formatRg(e.target.value))
                        }
                        placeholder='00.000.000-0'
                    />
                    <SelectField
                        label='Tipo de documento'
                        name='document_type'
                        value={formData.document_type ?? ''}
                        onChange={e => handleChange(e)}
                        options={[
                            { value: 'cpf', label: 'CPF' },
                            { value: 'cnpj', label: 'CNPJ' },
                        ]}
                        placeholder='Selecione…'
                    />
                    <InputField
                        label='Número do documento'
                        name='document_number'
                        value={formData.document_number ?? ''}
                        onChange={e => {
                            const fmt =
                                formData.document_type === 'cnpj'
                                    ? formatCnpj
                                    : formatCpf;
                            handleChange(
                                'document_number',
                                fmt(e.target.value),
                            );
                        }}
                        placeholder={
                            formData.document_type === 'cnpj'
                                ? '00.000.000/0000-00'
                                : '000.000.000-00'
                        }
                    />
                    <SelectField
                        label='Estado civil'
                        name='marital_status'
                        value={formData.marital_status ?? ''}
                        onChange={e => handleChange(e)}
                        options={[
                            { value: 'solteiro', label: 'Solteiro(a)' },
                            { value: 'casado', label: 'Casado(a)' },
                            { value: 'divorciado', label: 'Divorciado(a)' },
                            { value: 'viuvo', label: 'Viúvo(a)' },
                            { value: 'uniao_estavel', label: 'União estável' },
                        ]}
                        placeholder='Selecione…'
                    />
                    <InputField
                        label='Nacionalidade'
                        name='nationality'
                        value={formData.nationality ?? ''}
                        onChange={e => handleChange(e)}
                        placeholder='Ex: Brasileira'
                        autoComplete='country-name'
                    />
                </div>
            </div>
        </div>
    );
}
