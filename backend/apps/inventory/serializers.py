from rest_framework import serializers
from .models import Supplier, Product, StockMove, Service, ServiceMaterial


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "professional")


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "professional")


class StockMoveSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMove
        fields = "__all__"
        read_only_fields = ("id", "created_at", "professional")


class ServiceMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceMaterial
        fields = "__all__"


class ServiceSerializer(serializers.ModelSerializer):
    materials = ServiceMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = Service
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at", "professional")
