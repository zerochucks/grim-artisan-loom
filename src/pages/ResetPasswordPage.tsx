import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('PASSWORD REFORGED SUCCESSFULLY.');
      navigate('/generator');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl text-primary tracking-wider">REFORGE PASSWORD</h1>
          <div className="w-16 h-px bg-primary mx-auto mt-4" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-sm text-foreground tracking-widest">// SET NEW PASSWORD</h2>
            <Input
              type="password"
              placeholder="New password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-muted border-border text-foreground font-body text-sm"
            />
            <Button type="submit" disabled={loading} className="w-full font-display text-xs tracking-widest">
              {loading ? 'REFORGING...' : 'SET NEW PASSWORD'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
