import { CardText, PublicCard } from '@/app/b/[slug]/PublicCard';

export const metadata = { title: 'Manage your booking' };
export default function ManageIndex() {
  return (
    <PublicCard title="Manage your booking">
      <CardText>Open the link in your booking confirmation email to change or cancel your appointment. It is personal to your booking.</CardText>
    </PublicCard>
  );
}
