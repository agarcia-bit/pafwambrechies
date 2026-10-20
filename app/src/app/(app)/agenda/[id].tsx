import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';

import { DateTile } from '@/components/actu-visual';
import { DetailCard, DetailRow, DetailStatus, FullScreenDetail, Rise } from '@/components/full-screen-detail';
import { Button } from '@/components/ui/button';
import { LinkedText } from '@/components/ui/linked-text';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { addToCalendar } from '@/lib/calendar';
import { ACTU_HUES } from '@/lib/categories';
import { useEvenements } from '@/lib/data';
import { formatDayLong, venue } from '@/lib/format';
import { mapsUrl, openLink } from '@/lib/links';
import { mix } from '@/theme/colors';

// Hero in the event color (date tile and title), then the practical details on a white
// sheet and a big "add to my calendar" button.
export default function EvenementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useEvenements();
  const ev = events.data?.find((item) => item.id === Number(id));

  if (events.isPending || !ev) {
    return (
      <DetailStatus>
        {events.isPending ? (
          <LoadingState />
        ) : events.isError ? (
          <ErrorState onRetry={events.refetch} />
        ) : (
          <EmptyState title="Événement introuvable" message="Il est peut-être passé ou a été supprimé." />
        )}
      </DetailStatus>
    );
  }
  const place = venue(ev.lieu);

  return (
    <FullScreenDetail
      fadeOnly
      centered
      color={mix(ACTU_HUES['Événement'], '#000000', 0.15)}
      label="Événement"
      title={ev.titre}
      leading={<DateTile date={ev.date} large />}
      footer={
        Platform.OS !== 'web' ? (
          <Button title="Ajouter à mon agenda" icon="calendarAdd" onPress={() => addToCalendar(ev)} />
        ) : undefined
      }>
      <Rise>
        <DetailCard>
          <DetailRow icon="calendar" text={formatDayLong(ev.date)} />
          {!!ev.heure && <DetailRow icon="clock" text={ev.heure} />}
          {!!place && (
            <DetailRow icon="location" text={place} hint="Itinéraire" onPress={() => openLink(mapsUrl(place), { inApp: false })} />
          )}
        </DetailCard>
      </Rise>
      {!!ev.description && (
        <Rise order={1}>
          <LinkedText style={{ textAlign: 'center' }}>{ev.description}</LinkedText>
        </Rise>
      )}
    </FullScreenDetail>
  );
}
