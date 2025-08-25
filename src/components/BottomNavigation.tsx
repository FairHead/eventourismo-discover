import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Map, 
  Heart, 
  User, 
  Plus,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BottomNavigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Map, label: 'Karte' },
    { path: '/search', icon: Search, label: 'Suchen' },
    { path: '/create', icon: Plus, label: 'Erstellen' },
    { path: '/favorites', icon: Heart, label: 'Favoriten' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          
          return (
            <Link key={path} to={path} className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex-col gap-1 h-auto p-2 w-full text-xs transition-all duration-200",
                  isActive && "text-primary bg-primary/10"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isActive && "scale-110 text-primary"
                )} />
                <span className={cn(
                  "text-xs transition-all duration-200",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;