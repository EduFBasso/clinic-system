// Utilities to build PIX static "copia e cola" EMV payload (BR Code)
// Minimal implementation following BACEN/FEBRABAN spec for static QR:
// Fields: 00, 01, 26 (00 subtag + 01 key + 02 description opt), 52, 53, 54, 58, 59, 60, 62 (05 txid), 63 (CRC)

function tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

// CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
function crc16ccitt(input: string): string {
    let crc = 0xffff;
    for (let i = 0; i < input.length; i++) {
        crc ^= input.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixCopiaColaOptions {
    key: string; // chave PIX (telefone, cpf/cnpj, email ou aleatória)
    amount?: number; // valor opcional
    merchantName?: string; // até 25 chars, será uppercased
    merchantCity?: string; // até 15 chars, uppercased
    description?: string; // opcional curta
    txid?: string; // até 25 chars
}

export function buildPixCopiaCola(opts: PixCopiaColaOptions): string {
    const {
        key,
        amount,
        merchantName = 'CLINICA',
        merchantCity = 'BRASIL',
        description,
        txid = 'ORCAMENTO',
    } = opts;

    const name = merchantName.toUpperCase().slice(0, 25) || 'CLINICA';
    const city = merchantCity.toUpperCase().slice(0, 15) || 'BRASIL';
    const amt = typeof amount === 'number' && amount > 0 ? amount : undefined;

    // Merchant Account Information - GUI do PIX + chave + descrição opcional
    const gui = tlv('00', 'br.gov.bcb.pix');
    const kv = tlv('01', key);
    const desc =
        description && description.trim()
            ? tlv('02', description.trim().slice(0, 25))
            : '';
    const mai = tlv('26', `${gui}${kv}${desc}`);

    const payloadWithoutCRC =
        tlv('00', '01') + // Payload Format Indicator
        tlv('01', '12') + // Point of Initiation Method (static)
        mai +
        tlv('52', '0000') + // Merchant Category Code (default)
        tlv('53', '986') + // BRL
        (amt ? tlv('54', amt.toFixed(2)) : '') +
        tlv('58', 'BR') +
        tlv('59', name) +
        tlv('60', city) +
        tlv('62', tlv('05', txid.slice(0, 25))) +
        '6304'; // CRC placeholder

    const crc = crc16ccitt(payloadWithoutCRC);
    return payloadWithoutCRC + crc;
}
