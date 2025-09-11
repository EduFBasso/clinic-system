export function useAvailability(
    _date: Date,
    _professionalId: number,
    _duration = 60,
    _buffer = 30,
) {
    void _date;
    void _professionalId;
    void _duration;
    void _buffer; // evita no-unused-vars
    return { slots: [] as string[], loading: false };
}
