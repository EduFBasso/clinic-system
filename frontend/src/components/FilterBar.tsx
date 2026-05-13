import React from 'react';
import styles from '../styles/components/Main.module.css';

export type FilterMode = 'all' | 'pending' | 'today' | 'tomorrow' | 'ongoing';

export interface FilterBarProps {
    filter: string;
    filterMode: FilterMode;
    pendingCount: number;
    todayCount: number;
    tomorrowCount: number;
    ongoingCount: number;
    mobileFiltersOpen: boolean;
    mobileFiltersMenuStyle: React.CSSProperties;
    mobileFiltersButtonRef: React.RefObject<HTMLButtonElement | null>;
    onFilterChange: (value: string) => void;
    onFilterClear: () => void;
    onApplyFilterMode: (mode: FilterMode) => void;
    onOpenMobileFilters: (e: React.MouseEvent) => void;
    onCloseMobileFilters: () => void;
    onCloseMobileFiltersFromBackdrop: () => void;
}

// IMPORTANTE: definido fora de MainContent para que a referência da função seja estável.
// Se definido dentro, cada re-render de MainContent cria uma nova referência → React
// desmonta e remonta o FilterBar → input perde o foco a cada keystroke.
const FilterBar = React.memo(function FilterBar({
    filter,
    filterMode,
    pendingCount,
    todayCount,
    tomorrowCount,
    ongoingCount,
    mobileFiltersOpen,
    mobileFiltersMenuStyle,
    mobileFiltersButtonRef,
    onFilterChange,
    onFilterClear,
    onApplyFilterMode,
    onOpenMobileFilters,
    onCloseMobileFilters,
    onCloseMobileFiltersFromBackdrop,
}: FilterBarProps) {
    return (
        <div
            className={`${styles.filterContainer}${mobileFiltersOpen ? ` ${styles.filterContainerMenuOpen}` : ''}`}
        >
            <div className={styles.filterRow}>
                <div className={styles.filterInputWrapper}>
                    <input
                        id='client-filter'
                        type='text'
                        className={styles.filterInput}
                        placeholder='Digite o nome do cliente...'
                        value={filter}
                        onChange={e => onFilterChange(e.target.value)}
                    />
                    {filter && (
                        <button
                            type='button'
                            className={styles.filterClearBtn}
                            onClick={onFilterClear}
                            aria-label='Limpar filtro'
                            tabIndex={-1}
                        >
                            ×
                        </button>
                    )}
                </div>
                <div className={styles.filterActionsDesktop}>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'ongoing' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('ongoing')}
                        title='Filtrar clientes em atendimento agora'
                        style={ongoingCount === 0 ? { opacity: 0.5 } : undefined}
                    >
                        Em atendimento {ongoingCount > 0 ? `(${ongoingCount})` : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'pending' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('pending')}
                        title='Filtrar por compromissos pendentes'
                    >
                        {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'today' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('today')}
                        title='Filtrar compromissos de hoje'
                    >
                        Hoje {todayCount > 0 ? `(${todayCount})` : ''}
                    </button>
                    <button
                        className={`${styles.filterToggleBtn}${filterMode === 'tomorrow' ? ' ' + styles.filterToggleBtnActive : ''}`}
                        onClick={() => onApplyFilterMode('tomorrow')}
                        title='Filtrar compromissos de amanhã'
                    >
                        Amanhã {tomorrowCount > 0 ? `(${tomorrowCount})` : ''}
                    </button>
                </div>

                <div className={styles.filterActionsMobile}>
                    <button
                        ref={mobileFiltersButtonRef}
                        className={`${styles.filtersMenuButton}${filterMode !== 'all' ? ' ' + styles.filtersMenuButtonActive : pendingCount > 0 ? ' ' + styles.filtersMenuButtonPending : ''}`}
                        onClick={e => {
                            e.stopPropagation();
                            if (mobileFiltersOpen) {
                                onCloseMobileFilters();
                            } else {
                                onOpenMobileFilters(e);
                            }
                        }}
                        aria-expanded={mobileFiltersOpen}
                        aria-haspopup='menu'
                        title='Abrir filtros'
                    >
                        Filtros{pendingCount > 0 && filterMode !== 'pending' ? ` (${pendingCount})` : ''}
                    </button>

                    {mobileFiltersOpen && (
                        <button
                            type='button'
                            className={styles.filtersMenuBackdrop}
                            onClick={onCloseMobileFiltersFromBackdrop}
                            aria-label='Fechar filtros'
                        />
                    )}

                    {mobileFiltersOpen && (
                        <div
                            className={styles.filtersMenuPanel}
                            style={mobileFiltersMenuStyle}
                            role='menu'
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'all' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('all')}
                                role='menuitem'
                            >
                                Sem filtro
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'ongoing' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('ongoing')}
                                role='menuitem'
                            >
                                Em atendimento ({ongoingCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'pending' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('pending')}
                                role='menuitem'
                            >
                                Pendentes ({pendingCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'today' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('today')}
                                role='menuitem'
                            >
                                Hoje ({todayCount})
                            </button>
                            <button
                                className={`${styles.filtersMenuItem}${filterMode === 'tomorrow' ? ' ' + styles.filtersMenuItemActive : ''}`}
                                onClick={() => onApplyFilterMode('tomorrow')}
                                role='menuitem'
                            >
                                Amanhã ({tomorrowCount})
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default FilterBar;
