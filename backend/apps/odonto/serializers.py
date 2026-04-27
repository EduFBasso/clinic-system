from rest_framework import serializers

from apps.clients.models import Client
from .models import DentalArcade, Tooth, Surface, Procedure


class ProcedureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Procedure
        fields = [
            'id',
            'arcade',
            'tooth',
            'surface',
            'external_item_id',
            'code',
            'name',
            'status',
            'region_raw',
            'faces_raw',
            'started_at',
            'completed_at',
            'patient_amount',
            'paid_amount',
            'duration_minutes',
            'notes',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SurfaceSerializer(serializers.ModelSerializer):
    procedures = ProcedureSerializer(many=True, read_only=True)

    class Meta:
        model = Surface
        fields = [
            'id',
            'tooth',
            'code',
            'label',
            'created_at',
            'updated_at',
            'procedures',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'procedures']


class ToothSerializer(serializers.ModelSerializer):
    surfaces = SurfaceSerializer(many=True, read_only=True)

    class Meta:
        model = Tooth
        fields = [
            'id',
            'arcade',
            'sequence',
            'international_number',
            'external_arcade_row_id',
            'observations',
            'anomalies_bitmap',
            'created_at',
            'updated_at',
            'surfaces',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'surfaces']


class DentalArcadeListSerializer(serializers.ModelSerializer):
    pending_procedures = serializers.SerializerMethodField()
    completed_procedures = serializers.SerializerMethodField()

    class Meta:
        model = DentalArcade
        fields = [
            'id',
            'client',
            'external_treatment_id',
            'status',
            'started_at',
            'completed_at',
            'pending_procedures',
            'completed_procedures',
            'updated_at',
        ]

    def get_pending_procedures(self, obj: DentalArcade) -> int:
        return obj.procedures.filter(status=Procedure.Status.PENDING).count()

    def get_completed_procedures(self, obj: DentalArcade) -> int:
        return obj.procedures.filter(status=Procedure.Status.COMPLETED).count()


class DentalArcadeDetailSerializer(serializers.ModelSerializer):
    teeth = ToothSerializer(many=True, read_only=True)

    class Meta:
        model = DentalArcade
        fields = [
            'id',
            'client',
            'external_treatment_id',
            'status',
            'started_at',
            'completed_at',
            'notes',
            'created_at',
            'updated_at',
            'teeth',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'teeth']


class DentalArcadeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DentalArcade
        fields = [
            'id',
            'client',
            'external_treatment_id',
            'status',
            'started_at',
            'completed_at',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_client(self, value: Client) -> Client:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or value.professional_id != user.id:
            raise serializers.ValidationError(
                'Cliente nao pertence ao profissional autenticado.',
            )
        return value


class ProcedureBulkStatusSerializer(serializers.Serializer):
    procedure_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    status = serializers.ChoiceField(choices=Procedure.Status.choices)
    completed_at = serializers.DateField(required=False, allow_null=True)
