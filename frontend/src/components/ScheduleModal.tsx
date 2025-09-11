// Stub temporário: Agenda no backend; frontend apenas UI.
// Mantém assinatura para não quebrar Home/NavBar.

type Props = {
    open: boolean;
    onClose: () => void;
    defaultDate?: Date;
    editAppointment?: unknown | null;
    client?: unknown;
};

export default function ScheduleModal(props: Props) {
    void props; // evita no-unused-vars
    return null;
}
