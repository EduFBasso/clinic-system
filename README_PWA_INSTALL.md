# Instalação do App (PWA) — Passo a Passo de Domingo

Este guia descreve como publicar e instalar o "app" da clínica (PWA) em um domingo pré-agendado. Inclui controle por PIN, instruções para Android e iOS, testes rápidos e rollback.

## Pré-requisitos (até sábado)

1. Revisar alterações em ambiente de Preview (Vercel):
   - Trava de navegação com alterações não salvas (cadastro/edição de cliente).
   - Modal Sobre com seção "Instalar App" (staff-only).
   - Instalação em Android/Chrome no ambiente de Preview.
2. Configurar variável no Vercel (Production):
   - `VITE_INSTALL_PIN` — PIN numérico (4–6 dígitos) para autorizar instalação.
   - Opcional: definir apenas em Production para controlar a janela de instalação de domingo.
3. Confirmar backend online (Render) e CORS ok.
4. Validar login e modais no dispositivo que será usado na clínica.

## Janela de Domingo (execução)

1. Publicar em Production (Vercel):
   - Realizar o deploy da branch `main` (a build de produção só libera nessa branch).
   - Aguardar o domínio de produção ficar online.
2. No(s) dispositivo(s) da clínica:
   - Abrir o sistema no navegador (usar Chrome/Edge no Android; Safari no iOS).
   - Ir em Sobre → seção "Instalar App".
   - Digitar o PIN.
   - Android/desktop: pressionar "Instalar" (o navegador mostrará o diálogo).
   - iOS: seguir instrução "Compartilhar → Adicionar à Tela de Início" (não há diálogo nativo).
3. Testes rápidos (no app):
   - Login.
   - Abrir/fechar Agenda Mensal.
   - Criar/editar cliente (interromper navegação -> verificar alerta de alterações não salvas).
   - Finalizar agendamento e verificar auditorias (se aplicável).

## Após instalação

- Se quiser restringir novas instalações, remova o `VITE_INSTALL_PIN` ou altere o PIN.
- As atualizações do app são aplicadas automaticamente ao reabrir; se a UI parecer desatualizada, feche e abra novamente. Em último caso, use o navegador para recarregar.

## Instruções por plataforma

### Android (Chrome/Edge)

- O botão "Instalar" aparece quando o navegador libera o prompt.
- Caso não apareça:
  - Verifique se está no domínio de produção (https).\*
  - Interaja com a página (navegação/modal) e reabra Sobre.
  - No menu do navegador, procure "Adicionar à tela inicial".

### iOS (Safari)

- iOS não exibe o diálogo de instalação.
- Use o Safari → botão Compartilhar → "Adicionar à Tela de Início".

## Solução de problemas

- "Instalação não disponível no momento":
  - Abra no Chrome (Android) ou Safari (iOS) no domínio de produção.
  - Garanta conexão https e que a página não esteja em modo privado.
- App sem atualização:
  - Feche e reabra. Se persistir, recarregue a página pelo navegador.
- Botão Instalar desabilitado:
  - Confira o PIN.
  - Verifique se o usuário é Staff (is_staff = true).

## Rollback

- Se algo inesperado ocorrer, volte para a versão anterior no Vercel (Revert deployment) e refaça os testes em Preview.

---

# Próximos upgrades possíveis (sem migrar de plataforma)

Com o PWA, dá para evoluir sem reescrever do zero:

1. Câmera (captura de foto no cadastro):

   - Frontend: usar `MediaDevices.getUserMedia` ou `<input type="file" accept="image/*" capture>` para câmera.
   - Backend: adicionar campo de imagem ao `Client` (ex.: `photo = ImageField`), endpoint para upload (multipart) e servir via URL.
   - UI: botão "Adicionar foto" no formulário e exibir foto no modal de detalhes do cliente.
   - Observações: tratar permissão do navegador; em iOS/Safari, o fluxo via `<input type="file">` é mais estável.

2. Mensagens de agendamento (SMS/WhatsApp)

   - Backend: endpoints para enviar/registrar mensagem, com feature flags em `ProfessionalSettings` (já existe `confirm_message_enabled` / `template`).
   - Frontend: toggle em Sobre/Configurações do profissional para habilitar/desabilitar.
   - Integração: serviço (Twilio, Zenvia, WhatsApp API oficial) ou envio local com confirmação manual.

3. Teclado flutuante (mobile) e UX

   - Já mitigamos travas e saltos. Podemos adicionar ajustes finos quando inputs estiverem focados (classe `keyboardOpen`, offsets no iOS) e rolagem assistida.

4. Notificações push (opcional)

   - Requer backend com Web Push (VAPID) e consentimento do usuário. No iOS Safari moderno, funciona com limitações.

5. Controle de instalação
   - PIN atual já restringe a operação. Para força extra, podemos emitir um token de instalação pelo backend válido apenas na janela de domingo.

Se quiser, eu crio os itens 1 (foto do cliente) e 2 (mensagens) em branches dedicadas, com migração Django e telas no frontend, mantendo tudo incremental.
