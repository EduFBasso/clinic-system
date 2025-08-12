// Importa hooks do React para gerenciar estado e efeitos colaterais
import { useEffect, useState } from 'react';

// Define o tipo dos dados básicos do profissional que serão recebidos do backend
export interface ProfessionalBasic {
    id: number;
    first_name: string;
    last_name: string;
    register_number: string;
    email: string;
}

// Hook customizado para buscar profissionais do backend
export function useProfessionals() {
    // Estado para armazenar a lista de profissionais
    const [professionals, setProfessionals] = useState<ProfessionalBasic[]>([]);

    // Estado para indicar se está carregando
    const [loading, setLoading] = useState(false);

    // Estado para armazenar erros
    const [error, setError] = useState<string | null>(null);

    // useEffect executa o código ao montar o componente
    useEffect(() => {
        setLoading(true); // Inicia o carregamento
        // Faz uma requisição GET para o endpoint do backend
        fetch('/register/professionals-basic/')
            .then(res => {
                // Se a resposta não for OK, lança erro
                if (!res.ok) throw new Error('Erro ao buscar profissionais');
                // Converte a resposta para JSON
                return res.json();
            })
            .then(data => {
                // Atualiza o estado com os dados recebidos
                setProfessionals(data);
                setLoading(false); // Finaliza o carregamento
            })
            .catch(err => {
                // Em caso de erro, salva a mensagem de erro
                setError(err.message);
                setLoading(false); // Finaliza o carregamento
            });
    }, []); // Executa apenas uma vez ao montar

    // Retorna os dados, status de carregamento e erro para o componente que usar o hook
    return { professionals, loading, error };
}
