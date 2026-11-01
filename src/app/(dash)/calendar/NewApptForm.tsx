'use client';
import { NewApptWizard } from './NewApptWizard';
import type { useCalendar } from './useCalendar';
import type { Props } from './calUi';

/** The "New appointment" form shared by the calendar's sheet and the global sheet opened from the + button on any page. */
export function NewApptForm({ c, props, onCancel }: { c: ReturnType<typeof useCalendar>; props: Props; onCancel?: () => void }) {
  return <NewApptWizard c={c} props={props} onCancel={onCancel} />;
}
