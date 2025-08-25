import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Mail,
  Check,
  X,
  Clock,
  Users,
  Music
} from 'lucide-react';

interface BandInvitationsProps {
  onUpdate?: () => void;
}

const BandInvitations: React.FC<BandInvitationsProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('band_invitations')
        .select(`
          *,
          bands (
            id,
            name,
            bio,
            city,
            avatar_url
          ),
          inviter:inviter_id (
            display_name,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .not('expires_at', 'lt', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [user]);

  const handleInvitationResponse = async (invitationId: string, status: 'accepted' | 'declined') => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return;

      // Update invitation status
      const { error: updateError } = await supabase
        .from('band_invitations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // If accepted, add to band members
      if (status === 'accepted') {
        const { error: memberError } = await supabase
          .from('band_members')
          .insert({
            band_id: invitation.band_id,
            artist_id: user!.id,
            role: invitation.invited_role || 'member',
            instruments: invitation.invited_instruments || [],
            is_active: true
          });

        if (memberError) throw memberError;
      }

      toast({
        title: status === 'accepted' ? "Einladung angenommen" : "Einladung abgelehnt",
        description: status === 'accepted' 
          ? `Du bist jetzt Mitglied von ${invitation.bands.name}!`
          : `Einladung von ${invitation.bands.name} abgelehnt.`,
      });

      // Remove from local state
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      onUpdate?.();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      toast({
        title: "Fehler",
        description: "Die Antwort konnte nicht versendet werden.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Band-Einladungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Band-Einladungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Keine offenen Band-Einladungen</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Band-Einladungen ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                {invitation.bands.avatar_url ? (
                  <img
                    src={invitation.bands.avatar_url}
                    alt={invitation.bands.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <Users className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{invitation.bands.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Einladung von {invitation.inviter?.display_name || 
                    `${invitation.inviter?.first_name} ${invitation.inviter?.last_name}`}
                </p>
                {invitation.bands.city && (
                  <p className="text-xs text-muted-foreground">{invitation.bands.city}</p>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(invitation.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>

            {invitation.bands.bio && (
              <p className="text-sm text-muted-foreground">{invitation.bands.bio}</p>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {invitation.invited_role === 'member' ? 'Mitglied' : 
                 invitation.invited_role === 'manager' ? 'Manager' : invitation.invited_role}
              </Badge>
              {invitation.invited_instruments && invitation.invited_instruments.length > 0 && (
                <div className="flex gap-1">
                  {invitation.invited_instruments.slice(0, 3).map((instrument: string) => (
                    <Badge key={instrument} variant="secondary" className="text-xs">
                      {instrument}
                    </Badge>
                  ))}
                  {invitation.invited_instruments.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{invitation.invited_instruments.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {invitation.message && (
              <div className="bg-muted/50 rounded p-3 text-sm">
                <p className="font-medium mb-1">Nachricht:</p>
                <p className="text-muted-foreground">{invitation.message}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleInvitationResponse(invitation.id, 'accepted')}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Annehmen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleInvitationResponse(invitation.id, 'declined')}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-1" />
                Ablehnen
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BandInvitations;