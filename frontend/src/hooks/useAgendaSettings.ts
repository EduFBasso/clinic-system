import { useSyncExternalStore } from 'react';
import {
    getAgendaSettingsSnapshot,
    subscribeAgendaSettings,
} from '../utils/agendaSettings';

export function useAgendaSettings() {
    return useSyncExternalStore(
        subscribeAgendaSettings,
        getAgendaSettingsSnapshot,
        getAgendaSettingsSnapshot,
    );
}