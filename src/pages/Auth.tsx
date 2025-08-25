import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Music, User, Building2, Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    firstName: '',
    lastName: '',
    username: '',
    phoneNumber: '',
    dateOfBirth: '',
    streetAddress: '',
    city: '',
    postalCode: '',
    country: 'Deutschland',
    bio: '',
    role: 'user' as 'user' | 'artist' | 'promoter' | 'admin'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(formData.email, formData.password);
    
    if (error) {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: error.message === 'Invalid login credentials' 
          ? "Ungültige E-Mail oder Passwort." 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Erfolgreich angemeldet",
        description: "Willkommen zurück!",
      });
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.username) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Fehler",
        description: "Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Fehler",
        description: "Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(formData.email, formData.password, {
      display_name: `${formData.firstName} ${formData.lastName}`,
      first_name: formData.firstName,
      last_name: formData.lastName,
      username: formData.username,
      phone_number: formData.phoneNumber,
      date_of_birth: formData.dateOfBirth,
      street_address: formData.streetAddress,
      city: formData.city,
      postal_code: formData.postalCode,
      country: formData.country,
      bio: formData.bio,
      role: formData.role
    });
    
    if (error) {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: error.message === 'User already registered' 
          ? "Ein Benutzer mit dieser E-Mail existiert bereits." 
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registrierung erfolgreich",
        description: "Prüfen Sie Ihre E-Mails zur Bestätigung.",
      });
    }
    setIsLoading(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'artist': return <Music className="w-4 h-4" />;
      case 'promoter': return <Building2 className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'artist': return 'Erstelle und bewirb deine eigenen Events';
      case 'promoter': return 'Organisiere Events und verwalte Venues';
      case 'admin': return 'Vollzugriff auf alle Funktionen';
      default: return 'Entdecke und besuche Events in deiner Nähe';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Eventourismo</h1>
          <p className="text-muted-foreground">Deine Event-Community</p>
        </div>

        <Card className="border-border/50 shadow-card">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Anmelden
                </CardTitle>
                <CardDescription>
                  Melden Sie sich mit Ihren Zugangsdaten an
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      E-Mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Passwort
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="bg-input border-border pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Anmelden..." : "Anmelden"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Registrieren
                </CardTitle>
                <CardDescription>
                  Erstellen Sie Ihr Eventourismo-Konto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Personal Information */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Vorname *</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Max"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="bg-input border-border"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nachname *</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Mustermann"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="bg-input border-border"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">Benutzername *</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="max_mustermann"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      className="bg-input border-border"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      E-Mail
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="ihre@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Passwort
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Passwort bestätigen *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="bg-input border-border"
                      required
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Telefonnummer</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="+49 123 456789"
                        value={formData.phoneNumber}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Geburtsdatum</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">Straße und Hausnummer</Label>
                    <Input
                      id="streetAddress"
                      type="text"
                      placeholder="Musterstraße 123"
                      value={formData.streetAddress}
                      onChange={(e) => handleInputChange('streetAddress', e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">PLZ</Label>
                      <Input
                        id="postalCode"
                        type="text"
                        placeholder="12345"
                        value={formData.postalCode}
                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="city">Stadt</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Berlin"
                        value={formData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Land</Label>
                    <Select value={formData.country} onValueChange={(value) => handleInputChange('country', value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Deutschland">Deutschland</SelectItem>
                        <SelectItem value="Österreich">Österreich</SelectItem>
                        <SelectItem value="Schweiz">Schweiz</SelectItem>
                        <SelectItem value="Andere">Andere</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Über mich (optional)</Label>
                    <Textarea
                      id="bio"
                      placeholder="Erzählen Sie etwas über sich..."
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      className="bg-input border-border min-h-[80px]"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Konto-Typ wählen</Label>
                    <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            {getRoleIcon('user')}
                            <span>Event-Besucher</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="artist">
                          <div className="flex items-center gap-2">
                            {getRoleIcon('artist')}
                            <span>Künstler</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="promoter">
                          <div className="flex items-center gap-2">
                            {getRoleIcon('promoter')}
                            <span>Event-Veranstalter</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-xs">
                      {getRoleDescription(formData.role)}
                    </Badge>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Registrieren..." : "Registrieren"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;