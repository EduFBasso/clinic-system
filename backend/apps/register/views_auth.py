from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate


@csrf_exempt
@api_view(['POST'])
def login_professional(request):
    email = request.data.get('email')
    password = request.data.get('password')
    user = authenticate(username=email, password=password)

    if user:
        return Response({
            'id': user.id,  # type: ignore[union-attr]
            'first_name': user.first_name,  # type: ignore[union-attr]
            'last_name': user.last_name,  # type: ignore[union-attr]
            'register_number': user.register_number,  # type: ignore[union-attr]
            'specialty': user.specialty  # type: ignore[union-attr]
        })

    return Response({'error': 'Credenciais inválidas'}, status=401)
