import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SignupPage() {
  return (
    // The form column is viewport-locked on desktop, so main owns the scroll
    // (m-auto centers the card when there is room and scrolls without clipping
    // when the form is taller than the viewport).
    <main className="bg-muted/40 flex flex-1 flex-col overflow-y-auto p-6">
      <Card className="m-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Signup provisions your first company — you start as its owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" />
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
