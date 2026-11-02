import { redirect } from 'next/navigation';

// New sales start from the Sales page.
export default function NewSale() {
  redirect('/sales');
}
