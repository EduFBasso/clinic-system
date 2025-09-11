# backend\apps\register\serializers_clients.py
from rest_framework import serializers
from .models import Client
import unicodedata, re

# Helpers de normalização (UF/CEP)
def _strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))

_UF_MAP = {
    'ac':'AC','al':'AL','ap':'AP','am':'AM','ba':'BA','ce':'CE','df':'DF','es':'ES','go':'GO','ma':'MA',
    'mt':'MT','ms':'MS','mg':'MG','pa':'PA','pb':'PB','pr':'PR','pe':'PE','pi':'PI','rj':'RJ','rn':'RN',
    'rs':'RS','ro':'RO','rr':'RR','sc':'SC','se':'SE','sp':'SP','to':'TO',
    'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE','distrito federal':'DF',
    'espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT','mato grosso do sul':'MS',
    'minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI',
    'rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO',
    'roraima':'RR','santa catarina':'SC','sergipe':'SE','sao paulo':'SP','são paulo':'SP','tocantins':'TO',
}

def _normalize_uf(value: str) -> str:
    raw = (value or '').strip()
    if not raw:
        return ''
    if len(raw) == 2 and raw.upper() in _UF_MAP.values():
        return raw.upper()
    key = _strip_accents(raw).lower()
    key = re.sub(r'\s+', ' ', key).strip()
    if key in _UF_MAP:
        return _UF_MAP[key]
    raise serializers.ValidationError("Estado inválido. Use a sigla (ex.: SP) ou o nome completo do estado.")

def _normalize_cep(value: str) -> str:
    raw = (value or '').strip()
    if not raw:
        return ''
    digits = re.sub(r'\D+', '', raw)
    if len(digits) == 8:
        return digits
    raise serializers.ValidationError("CEP inválido. Use 8 dígitos (ex.: 13480460).")

class ClientSerializer(serializers.ModelSerializer):
    takes_medication = serializers.CharField(required=False, allow_blank=True, max_length=255)
    had_surgery = serializers.CharField(required=False, allow_blank=True, max_length=255)
    is_pregnant = serializers.BooleanField(required=False)
    professional = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            "email": {"required": False, "allow_null": True, "allow_blank": True},
            # Telefone obrigatório e único (modelo aplica unique)
            "phone": {"required": True, "allow_null": False, "allow_blank": False},
            "profession": {"required": False, "allow_null": True, "allow_blank": True},
            "city": {"required": False, "allow_null": True, "allow_blank": True},
            "state": {"required": False, "allow_null": True, "allow_blank": True},
            "postal_code": {"required": False, "allow_null": True, "allow_blank": True},
            "address": {"required": False, "allow_null": True, "allow_blank": True},
            "neighborhood": {"required": False, "allow_null": True, "allow_blank": True},
            "medication_details": {"required": False, "allow_null": True, "allow_blank": True},
            "surgery_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pregnancy_details": {"required": False, "allow_null": True, "allow_blank": True},
            "pain_sensitivity": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_used": {"required": False, "allow_null": True, "allow_blank": True},
            "footwear_other": {"required": False, "allow_null": True, "allow_blank": True},
            "sock_used": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history": {"required": False, "allow_null": True, "allow_blank": True},
            "clinical_history_other": {"required": False, "allow_null": True, "allow_blank": True},
            "professional_procedures": {"required": False, "allow_null": True, "allow_blank": True},
            # Continua com o restante dos campos clínicos…
        }

    # Normalizações e validações leves
    def validate_first_name(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Nome é obrigatório")
        return v

    def validate_last_name(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Sobrenome é obrigatório")
        return v

    def validate_email(self, value):
        if value is None:
            return None
        v = value.strip()
        return v.lower() if v else None

    def validate_phone(self, value):
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError("Telefone é obrigatório")
        # Normaliza para apenas dígitos; aceita 10 (fixo) ou 11 (celular) no BR
        digits = ''.join(ch for ch in v if ch.isdigit())
        if len(digits) not in (10, 11):
            raise serializers.ValidationError(
                "Telefone inválido. Use DDD + número (10 ou 11 dígitos)."
            )
        return digits

    # cpf removido; profissão agora é um texto opcional
    # Normalizações adicionais
    def validate_state(self, value: str) -> str:
        if value in (None, ''):
            return ''
        return _normalize_uf(value)

    def validate_postal_code(self, value: str) -> str:
        if value in (None, ''):
            return ''
        return _normalize_cep(value)


class ClientBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id', 'first_name', 'last_name', 'phone', 'email',
            'address', 'neighborhood', 'city', 'state'
        ]
