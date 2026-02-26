import { getHistoryById } from '@/lib/history';
import { notFound } from 'next/navigation';
import HistoryDetailClient from './ClientView';

type Props = {
    params: Promise<{ id: string }>
}

export default async function HistoryDetailPage({ params }: Props) {
    const { id } = await params;
    const item = getHistoryById(id);

    if (!item) {
        notFound();
    }

    return <HistoryDetailClient item={item} />;
}
