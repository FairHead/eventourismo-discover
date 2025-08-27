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
import BottomNavigation from "./components/BottomNavigation";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const App = () => (
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
            <div className="p-4 pb-20">Favoriten (coming soon)</div>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
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

export default App;
