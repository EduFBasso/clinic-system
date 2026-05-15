import type { SelectedItem, Service, Product } from '../types/consulta';

interface UseConsultaItemsParams {
    selectedItems: SelectedItem[];
    setSelectedItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
}

interface UseConsultaItemsResult {
    addItem: (kind: 'service' | 'product', item: Service | Product) => void;
    removeItem: (key: string) => void;
    updateQty: (key: string, qty: number) => void;
    togglePaid: (key: string) => void;
    updatePaidAt: (key: string, date: string) => void;
    total: number;
}

export function useConsultaItems({
    selectedItems,
    setSelectedItems,
}: UseConsultaItemsParams): UseConsultaItemsResult {
    const todayISO = new Date().toISOString().slice(0, 10);

    function addItem(kind: 'service' | 'product', item: Service | Product) {
        const key = `${kind}-${item.id}`;
        const unit_price =
            kind === 'service'
                ? (item as Service).base_price
                : (item as Product).price;
        setSelectedItems(prev => {
            const existing = prev.find(i => i.key === key);
            if (existing) {
                return prev.map(i =>
                    i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
                );
            }
            return [
                ...prev,
                { key, kind, id: item.id, name: item.name, unit_price, quantity: 1, paid: false },
            ];
        });
    }

    function removeItem(key: string) {
        setSelectedItems(prev => prev.filter(i => i.key !== key));
    }

    function updateQty(key: string, qty: number) {
        if (qty < 1) return;
        setSelectedItems(prev =>
            prev.map(i => (i.key === key ? { ...i, quantity: qty } : i)),
        );
    }

    function togglePaid(key: string) {
        const targetItem = selectedItems.find(i => i.key === key);
        if (targetItem?.paid) {
            const shouldUnmark = window.confirm(
                'Remover a marcacao de pago deste item?',
            );
            if (!shouldUnmark) return;
        }
        setSelectedItems(prev =>
            prev.map(i =>
                i.key === key
                    ? { ...i, paid: !i.paid, paidAt: !i.paid ? todayISO : undefined }
                    : i,
            ),
        );
    }

    function updatePaidAt(key: string, date: string) {
        setSelectedItems(prev =>
            prev.map(i => (i.key === key ? { ...i, paidAt: date } : i)),
        );
    }

    const total = selectedItems.reduce(
        (sum, i) => sum + i.unit_price * i.quantity,
        0,
    );

    return { addItem, removeItem, updateQty, togglePaid, updatePaidAt, total };
}
