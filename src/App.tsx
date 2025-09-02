import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";

import MapPage from "./pages/MapPage";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import BandProfile from "./pages/BandProfile";
import EventCreate from "./pages/EventCreate";
import Search from "./pages/Search";
import Favorites from "./pages/Favorites";
import MyEvents from "./pages/MyEvents";
import BottomNavigation from "./components/BottomNavigation";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { useSeedEvents } from "./hooks/useSeedEvents";
import { useEventNotifications } from "./hooks/useEventNotifications";
import { useVenueIngestion } from "./hooks/useVenueIngestion";

const App = () => {
  // Seed sample events on app start
  useSeedEvents();
  
  // Initialize event notifications
  useEventNotifications();
  
  // Ingest venues on app start
  useVenueIngestion();

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <div className="relative">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        } />
        <Route path="/search" element={
          <ProtectedRoute>
            <Search />
          </ProtectedRoute>
        } />
        <Route path="/create" element={
          <ProtectedRoute>
            <div className="p-4 pb-20">Event erstellen ist nun auf der Hauptkarte verfügbar</div>
          </ProtectedRoute>
        } />
        <Route path="/favorites" element={
          <ProtectedRoute>
            <Favorites />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/my-events" element={
          <ProtectedRoute>
            <MyEvents />
          </ProtectedRoute>
        } />
        <Route path="/band/:slug" element={
          <ProtectedRoute>
            <BandProfile />
          </ProtectedRoute>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNavigation />
      </div>
    </TooltipProvider>
  );
};

export default App;
