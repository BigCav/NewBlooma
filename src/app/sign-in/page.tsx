import AuthForm from '@/components/AuthForm';
import { signIn } from '../auth-actions';
export const metadata = { title: 'Sign in' };
export default function Page() { return <AuthForm action={signIn} mode="in" />; }
