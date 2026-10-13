import AuthForm from '@/components/AuthForm';
import { signUp } from '../auth-actions';
export const metadata = { title: 'Create account' };
export default function Page() { return <AuthForm action={signUp} mode="up" />; }
