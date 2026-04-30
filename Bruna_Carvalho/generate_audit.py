#!/usr/bin/env python
"""
Script para gerar JSON de auditoria de um cliente específico.
Uso: python generate_audit.py <client_id> [output_file]
"""
import json
import sys
import os
from datetime import datetime

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'clinic_project.settings')

import django
django.setup()

from apps.odonto.models import Procedure, DentalArcade, Tooth
from apps.clients.models import Client


def analyze_client(client_id):
    """Gera dados de auditoria para um cliente específico."""
    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        print(f"Erro: Cliente {client_id} não encontrado")
        return None

    arcades = DentalArcade.objects.filter(client=client)
    if not arcades.exists():
        print(f"Cliente {client_id} não tem arcadas")
        return None

    audit = {
        'audit_timestamp': datetime.utcnow().isoformat(),
        'client': {
            'id': client.id,
            'full_name': f"{client.first_name} {client.last_name}".strip(),
            'cpf': getattr(client, 'cpf', None),
            'email': getattr(client, 'email', None),
            'phone': getattr(client, 'phone', None),
            'date_of_birth': str(getattr(client, 'date_of_birth', None)),
            'created_at': client.created_at.isoformat() if client.created_at else None,
            'updated_at': client.updated_at.isoformat() if client.updated_at else None,
        },
        'arcades_summary': [],
    }

    for arcade in arcades:
        procs = Procedure.objects.filter(arcade=arcade)
        total = procs.count()
        status_dist = {}
        for p in procs:
            status_dist[p.status] = status_dist.get(p.status, 0) + 1

        started_filled = procs.exclude(started_at__isnull=True).count()
        started_null = procs.filter(started_at__isnull=True).count()
        completed_filled = procs.exclude(completed_at__isnull=True).count()
        completed_null = procs.filter(completed_at__isnull=True).count()

        general_procs = procs.filter(tooth__isnull=True).count()
        tooth_procs = procs.filter(tooth__isnull=False).count()

        anomalies = []
        for p in procs:
            if p.status == 'pending' and p.completed_at:
                anomalies.append({
                    'type': 'inconsistent_status',
                    'procedure_id': p.id,
                    'procedure_name': p.name,
                    'detail': 'status=pending but has completed_at',
                })

        audit['arcades_summary'].append({
            'arcade_id': arcade.id,
            'created_at': arcade.created_at.isoformat(),
            'updated_at': arcade.updated_at.isoformat(),
            'procedures_count': total,
            'status_distribution': status_dist,
            'started_at_filled': started_filled,
            'started_at_null': started_null,
            'completed_at_filled': completed_filled,
            'completed_at_null': completed_null,
            'tooth_procedures': tooth_procs,
            'general_procedures': general_procs,
            'anomalies_count': len(anomalies),
            'anomalies': anomalies[:5],  # Primeiras 5
        })

    return audit


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python generate_audit.py <client_id> [output_file]")
        sys.exit(1)

    client_id = int(sys.argv[1])
    output_file = sys.argv[2] if len(sys.argv) > 2 else f"audit_client_{client_id}.json"

    audit = analyze_client(client_id)
    if audit:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(audit, f, indent=2, ensure_ascii=False)
        print(f"✓ Auditoria salva em: {output_file}")
    else:
        sys.exit(1)
