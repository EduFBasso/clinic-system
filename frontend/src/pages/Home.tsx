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
    const [routeInitialMonth, setRouteInitialMonth] = useState<
        Date | undefined
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
                } catch {
                    /* noop */
                }
                return cb;
            }
        } catch {
            /* noop */
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
        } catch {
            // ignore
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
        } catch {
            // ignore
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

    // Aberturas diretas dos modais da Agenda (novo fluxo vindo do NavBar)
    const openSchedule = async (
        clientId: number,
        date?: Date,
        edit?: Appointment | null,
    ) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteDefaultDate(date);
        setRouteEditAppt(edit ?? null);
        setScheduleOpen(true);
        setMonthlyOpen(false);
        setWeeklyOpen(false);
    };

    const openMonthly = async (clientId: number, date?: Date) => {
        const c = await ensureClientBasic(clientId);
        setRouteClient(c);
        setRouteInitialMonth(date);
        setRouteEditAppt(null);
        setMonthlyOpen(true);
        setScheduleOpen(false);
        setWeeklyOpen(false);
    };

    const openWeekly = (_date?: Date) => {
        void _date;
        // WeeklyPreviewModal atual não usa data; reservado para evolução
        setRouteEditAppt(null);
        setWeeklyOpen(true);
        setScheduleOpen(false);
        setMonthlyOpen(false);
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

    return (
        <div className={styles.container}>
            <Header />
            <Faixa />
            <NavBar
                openNewClientModal={handleAddClient}
                selectedClientId={selectedClientId}
                agendaOpeners={{
                    openSchedule,
                    openMonthly,
                    openWeekly,
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
