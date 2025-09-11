// src/pages/Home.tsx
import React, { useEffect, useState } from 'react';

import Header from '../components/Header';
import Faixa from '../components/Faixa';
import NavBar from '../components/NavBar';
import MainContent from '../components/MainContent';
import Footer from '../components/Footer';
import styles from '../styles/pages/Home.module.css';
import ScheduleModal from '../components/ScheduleModal';
import MonthlyAgendaModal from '../components/MonthlyAgendaModal';
import WeeklyPreviewModal from '../components/WeeklyPreviewModal';
import type { ClientBasic } from '../types/ClientBasic';
import { API_BASE } from '../config/api';
import { isTokenExpired } from '../utils/jwt';
import type { Appointment } from '../hooks/useAppointments';

export default function Home() {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(
        null,
    );
    // Route-driven agenda modal states
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [monthlyOpen, setMonthlyOpen] = useState(false);
    const [weeklyOpen, setWeeklyOpen] = useState(false);
    const [routeClient, setRouteClient] = useState<ClientBasic | null>(null);
    const [routeDefaultDate, setRouteDefaultDate] = useState<Date | undefined>(
        undefined,
    );
    const [routeEditAppt, setRouteEditAppt] = useState<Appointment | null>(
        null,
    );
    const [routeInitialMonth, setRouteInitialMonth] = React.useState<
        Date | undefined
    >(undefined);
    const [routeInfoMessage, setRouteInfoMessage] = React.useState<
        string | undefined
    >(undefined);

    // Aux: carrega nome básico do cliente dado um ID (cache localStorage se possível)
    async function ensureClientBasic(id: number): Promise<ClientBasic> {
        const cached = localStorage.getItem(`client.name.${id}`);
        if (cached) {
            const [first_name, ...rest] = cached.split(' ');
            const last_name = rest.join(' ');
            return {
                id,
                first_name,
                last_name,
                phone: '',
                email: '',
            } as ClientBasic;
        }
        const token = localStorage.getItem('accessToken');
        if (isTokenExpired(token))
            return {
                id,
                first_name: 'Cliente',
                last_name: String(id),
                phone: '',
                email: '',
            } as ClientBasic;
        try {
            const res = await fetch(`${API_BASE}/register/clients/${id}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                const cb: ClientBasic = {
                    id: data.id,
                    first_name: data.first_name || 'Cliente',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    email: data.email || '',
                };
                try {
                    localStorage.setItem(
                        `client.name.${id}`,
                        `${cb.first_name} ${cb.last_name}`.trim(),
                    );
                } catch (e) {
                    /* noop */ void e;
                }
                return cb;
            }
        } catch (e) {
            /* noop */ void e;
        }
        return {
            id,
            first_name: 'Cliente',
            last_name: String(id),
            phone: '',
            email: '',
        } as ClientBasic;
    }

    // Seleciona o cliente via ?client=ID e abre modais conforme params (?new, ?edit, ?mode)
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            const cid = url.searchParams.get('client');
            const dateStr = url.searchParams.get('date'); // yyyy-mm-dd
            const isNew = url.searchParams.get('new') === '1';
            const editId = url.searchParams.get('edit');
            const mode = url.searchParams.get('mode');

            if (cid) setSelectedClientId(Number(cid));

            // Parse date if provided
            const parsedDate = dateStr
                ? new Date(dateStr + 'T00:00:00')
                : undefined;
            if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
                setRouteDefaultDate(parsedDate);
                setRouteInitialMonth(parsedDate);
            } else {
                setRouteDefaultDate(undefined);
                setRouteInitialMonth(undefined);
            }

            // Week mode: abre preview semanal simples
            if (mode === 'week') {
                setWeeklyOpen(true);
            }

            // Edit: abrir visão mensal do cliente para localizar/avaliar
            if (editId && cid) {
                ensureClientBasic(Number(cid)).then(c => {
                    setRouteClient(c);
                    setMonthlyOpen(true);
                });
                return; // prioriza edição
            }

            // New: abrir ScheduleModal já com cliente/data
            if (isNew && cid) {
                ensureClientBasic(Number(cid)).then(c => {
                    setRouteClient(c);
                    setScheduleOpen(true);
                });
                return;
            }

            // Se só houver client+date, abre visão mensal para inspecionar
            if (cid && dateStr) {
                ensureClientBasic(Number(cid)).then(c => {
                    setRouteClient(c);
                    setMonthlyOpen(true);
                });
            }
        } catch (e) {
            /* ignore */ void e;
        }
    }, []);

    // Mensagem ao voltar da Agenda sem cliente selecionado
    useEffect(() => {
        try {
            const msg = localStorage.getItem('agenda.promptSelectClient');
            if (msg) {
                alert(msg);
                localStorage.removeItem('agenda.promptSelectClient');
            }
        } catch (e) {
            /* ignore */ void e;
        }
    }, []);

    // Função para abrir o cadastro em nova janela
    const handleAddClient = () => {
        window.open(
            '/clients/new',
            '_blank',
            'width=800,height=700,top=80,left=120,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes',
        );
    };

    // Helpers
    function getReferenceDateForClient(clientId?: string | number): Date {
        if (!clientId) return new Date();
        try {
            const raw = localStorage.getItem(`schedule:lastDay:${clientId}`);
            if (raw) {
                const d = new Date(raw);
                if (!Number.isNaN(d.getTime())) return d;
            }
        } catch (e) {
            /* ignore */ void e;
        }
        return new Date();
    }
    function formatMonthLabel(date: Date): string {
        const label = date.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    // Abrir Schedule (criar/editar)
    const openSchedule = async (
        clientId: number,
        date?: Date,
        edit?: Appointment | null,
    ) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteDefaultDate(date ?? getReferenceDateForClient(clientId));
        setRouteEditAppt(edit ?? null);
        setScheduleOpen(true);
        setMonthlyOpen(false);
        setWeeklyOpen(false);
    };

    // Abrir Monthly
    const openMonthly = async (clientId: number, date?: Date) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteInitialMonth(date ?? getReferenceDateForClient(clientId));
        setRouteInfoMessage(undefined);
        setRouteEditAppt(null);
        setMonthlyOpen(true);
        setScheduleOpen(false);
        setWeeklyOpen(false);
    };

    // Novo: Editar via Menu Agenda quando não há compromisso
    const openEdit = async (clientId: number) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        const refDate = getReferenceDateForClient(clientId);
        setRouteInitialMonth(refDate);
        setRouteInfoMessage(
            `Nenhum compromisso agendado para este cliente em ${formatMonthLabel(
                refDate,
            )}.`,
        );
        setRouteEditAppt(null);
        setMonthlyOpen(true);
        setScheduleOpen(false);
        setWeeklyOpen(false);
    };

    // Event bridge: abrir edição direta do ScheduleModal a partir do Monthly
    useEffect(() => {
        function onOpenScheduleEdit(e: CustomEvent) {
            const det = (e && (e as CustomEvent).detail) || {};
            const c = det.client as ClientBasic | undefined;
            const d = det.date as Date | undefined;
            const a = det.appointment as Appointment | undefined;
            if (!c || !c.id) return;
            setRouteClient(c);
            setRouteDefaultDate(d);
            setRouteEditAppt(a ?? null);
            setScheduleOpen(true);
            setMonthlyOpen(false);
            setWeeklyOpen(false);
        }
        window.addEventListener(
            'openScheduleEdit',
            onOpenScheduleEdit as EventListener,
        );
        return () =>
            window.removeEventListener(
                'openScheduleEdit',
                onOpenScheduleEdit as EventListener,
            );
    }, []);

    // Abrir Weekly (pré-visualização semanal)
    const openWeekly = (date?: Date) => {
        void date; // reservado para futura referência de semana
        setRouteEditAppt(null);
        setWeeklyOpen(true);
        setScheduleOpen(false);
        setMonthlyOpen(false);
    };

    return (
        <div className={styles.container}>
            <Header />
            <Faixa />
            <NavBar
                openNewClientModal={handleAddClient}
                selectedClientId={selectedClientId ?? null}
                agendaOpeners={{
                    openSchedule,
                    openMonthly,
                    openWeekly,
                    openEdit,
                }}
            />
            <MainContent
                setSelectedClientId={setSelectedClientId}
                selectedClientId={selectedClientId}
            />
            {/* Route-driven Agenda modals */}
            {routeClient && (
                <ScheduleModal
                    open={scheduleOpen}
                    onClose={() => setScheduleOpen(false)}
                    client={routeClient}
                    defaultDate={routeDefaultDate}
                    editAppointment={routeEditAppt}
                />
            )}
            {routeClient && (
                <MonthlyAgendaModal
                    open={monthlyOpen}
                    onClose={() => setMonthlyOpen(false)}
                    client={routeClient}
                    initialMonth={routeInitialMonth}
                    infoMessage={routeInfoMessage}
                />
            )}
            <WeeklyPreviewModal
                open={weeklyOpen}
                onClose={() => setWeeklyOpen(false)}
            />
            <Footer />
        </div>
    );
}
