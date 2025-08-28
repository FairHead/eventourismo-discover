import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MyEventsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card 
      className="border-border hover:shadow-md transition-shadow cursor-pointer" 
      onClick={() => navigate('/my-events')}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <div>
              <h3 className="font-semibold text-lg">Meine Events</h3>
              <p className="text-sm text-muted-foreground">Verwalten Sie Ihre erstellten und besuchten Events</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

export default MyEventsSection;