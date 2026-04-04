from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.clients.models import Client
from .models import AnamnesisField, AnamnesisResponse, AnamnesisPhoto
from .serializers import (
    AnamnesisFieldSerializer,
    AnamnesisResponseSerializer,
    AnamnesisPhotoSerializer,
    AnamnesisResponseBulkSerializer,
)


class AnamnesisFieldViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Returns the active anamnesis fields for the authenticated professional.
    GET /anamnesis/fields/           → all active fields for this professional
    GET /anamnesis/fields/?client=5  → same (client param ignored, kept for convenience)
    """
    serializer_class = AnamnesisFieldSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnamnesisField.objects.filter(
            professional=self.request.user,
            is_active=True,
        ).order_by('sector_order', 'order')


class AnamnesisResponseViewSet(viewsets.ModelViewSet):
    """
    CRUD for anamnesis responses.
    GET  /anamnesis/responses/?client=5  → all responses for a client
    POST /anamnesis/responses/bulk_save/ → upsert many responses at once
    """
    serializer_class = AnamnesisResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AnamnesisResponse.objects.filter(
            field__professional=self.request.user,
        ).select_related('field').prefetch_related('photos')

        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)

        return qs

    @action(detail=False, methods=['post'], url_path='bulk_save')
    def bulk_save(self, request):
        """
        Upserts all anamnesis responses for a client in one request.
        Body: { "client": <id>, "responses": [{"field": <id>, "value": "..."}, ...] }
        """
        serializer = AnamnesisResponseBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        client_id = serializer.validated_data['client']
        client = get_object_or_404(
            Client,
            pk=client_id,
            professional=request.user,
        )

        saved = []
        for item in serializer.validated_data['responses']:
            field: AnamnesisField = item['field']
            value: str = item['value']

            obj, _ = AnamnesisResponse.objects.update_or_create(
                client=client,
                field=field,
                defaults={
                    'field_label_snap': field.label,
                    'value': value,
                },
            )
            saved.append(obj)

        return Response(
            AnamnesisResponseSerializer(saved, many=True).data,
            status=status.HTTP_200_OK,
        )


class AnamnesisPhotoViewSet(viewsets.ModelViewSet):
    """
    Upload/delete photos attached to an anamnesis response.
    POST /anamnesis/photos/  multipart/form-data  { response: <id>, image: <file> }
    """
    serializer_class = AnamnesisPhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AnamnesisPhoto.objects.filter(
            response__field__professional=self.request.user,
        ).select_related('response')
