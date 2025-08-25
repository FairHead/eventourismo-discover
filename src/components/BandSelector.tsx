import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useBand } from '@/contexts/BandContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, User, LogOut } from 'lucide-react';

const BandSelector: React.FC = () => {
  const { user } = useAuth();
  const { activeBand, userBands, setActiveBand, isLoadingBands } = useBand();

  if (isLoadingBands) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-muted h-10 w-10"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Aktiver Kontext
        </h3>
        {activeBand && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveBand(null)}
            className="text-xs"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Als Künstler
          </Button>
        )}
      </div>

      {/* Current Context Display */}
      <div className="p-3 border rounded-lg bg-muted/30">
        {activeBand ? (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={activeBand.avatar_url} alt={activeBand.name} />
              <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                {getInitials(activeBand.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{activeBand.name}</p>
              <p className="text-xs text-muted-foreground">
                {activeBand.city && activeBand.country && `${activeBand.city}, ${activeBand.country}`}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">Band</Badge>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm">Persönlicher Account</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="outline" className="text-xs">Künstler</Badge>
          </div>
        )}
      </div>

      {/* Band List */}
      {userBands.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Zu Band wechseln:</p>
          <div className="space-y-1">
            {userBands.map((band) => (
              <Button
                key={band.id}
                variant={activeBand?.id === band.id ? "default" : "ghost"}
                className="w-full justify-start h-auto p-2"
                onClick={() => setActiveBand(band)}
                disabled={activeBand?.id === band.id}
              >
                <Avatar className="w-6 h-6 mr-2">
                  <AvatarImage src={band.avatar_url} alt={band.name} />
                  <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                    {getInitials(band.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">{band.name}</p>
                  {band.city && (
                    <p className="text-xs text-muted-foreground truncate">
                      {band.city}
                    </p>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BandSelector;