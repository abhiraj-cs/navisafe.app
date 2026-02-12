'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, User, Navigation, Eye, EyeOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { loginAsUser, loginAsAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = loginAsAdmin(username, password);
    if (success) {
      toast({
        title: 'Login Successful',
        description: 'Welcome, Admin!',
      });
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid username or password.',
      });
    }
  };
  
  const handleUserLogin = () => {
    loginAsUser();
    toast({
      title: 'Login Successful',
      description: 'Welcome!',
    });
    router.push('/');
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen dark-water-animation">
      <div className="absolute top-6 right-6 flex items-center gap-2 text-slate-200">
        <Navigation className="h-7 w-7 text-blue-400" />
        <h1 className="text-xl font-bold">NaviSafe</h1>
      </div>

      <Tabs defaultValue="user" className="w-full max-w-sm">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user">User</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="user">
           <Card className="border-t-0 rounded-t-none bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <User className="h-12 w-12 text-blue-600" />
                </div>
              <CardTitle>User Login</CardTitle>
              <CardDescription>Login as a standard user to plan routes and contribute data.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleUserLogin} className="w-full">
                Login as User
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="admin">
          <Card className="border-t-0 rounded-t-none bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Shield className="h-12 w-12 text-blue-600" />
                </div>
              <CardTitle>Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                     <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="sr-only">Toggle password visibility</span>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Login
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
