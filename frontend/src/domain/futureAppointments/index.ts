// Domain barrel for Future Appointments related hooks/components/services
// Centralizes exports to decouple feature consumers from file structure.

export { useFutureAppointments } from '../../hooks/useFutureAppointments';
export { useClientFutureAppointments } from '../../hooks/useClientFutureAppointments';
export { default as FutureAppointmentsList } from '../../components/clientCard/FutureAppointmentsList';
export { fetchFutureAppointments } from '../../services/appointments';
