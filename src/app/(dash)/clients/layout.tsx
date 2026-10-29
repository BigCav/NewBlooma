import { SubNav } from '@/components/SubNav';

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubNav title="Clients" items={[{ href: '/clients', label: 'All clients' }, { href: '/clients/forms', label: 'Client forms' }]}>
      {children}
    </SubNav>
  );
}
