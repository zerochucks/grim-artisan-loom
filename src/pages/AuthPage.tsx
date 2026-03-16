import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (showReset) {
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('RESET LINK DISPATCHED. CHECK YOUR INBOX.');
        setShowReset(false);
      }
      return;
    }

    const { error } = isLogin ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else if (!isLogin) {
      toast.success('ACCOUNT FORGED. CHECK EMAIL TO CONFIRM.');
    } else {
      navigate('/generator');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl text-primary tracking-wider">
            PIXEL FORGE
          </h1>
          <p className="text-sm text-muted-foreground font-body tracking-wide">
            GRIMDARK ASSET GENERATOR
          </p>
          <div className="w-16 h-px bg-primary mx-auto mt-4" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-border bg-card p-6 space-y-4">
            <h2 className="font-display text-sm text-foreground tracking-widest">
              {showReset ? '// RESET PASSWORD' : isLogin ? '// ENTER THE FORGE' : '// FORGE NEW ACCOUNT'}
            </h2>

            <div className="space-y-3">
              <Input
                type="email"
                placeholder="smith@darkforge.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-body text-sm"
              />
              {!showReset && (
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-body text-sm"
                />
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full font-display text-xs tracking-widest"
            >
              {loading
                ? 'FORGING...'
                : showReset
                ? 'DISPATCH RESET'
                : isLogin
                ? 'ENTER THE FORGE'
                : 'CREATE ACCOUNT'}
            </Button>

            <div className="flex justify-between text-xs">
              {!showReset && (
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-muted-foreground hover:text-accent transition-colors"
                >
                  Forgot password?
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowReset(false);
                  setIsLogin(!isLogin);
                }}
                className="text-muted-foreground hover:text-accent transition-colors ml-auto"
              >
                {isLogin ? 'Create account' : 'Already forged?'}
              </button>
            </div>
          </div>
        </form>

        {/* Tagline */}
        <p className="text-center text-xs text-muted-foreground">
          Craft grimdark pixel art for your 2D games.
          <br />
          Stoneshard · Darkest Dungeon · Blasphemous
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
