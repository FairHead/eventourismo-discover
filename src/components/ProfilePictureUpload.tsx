import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ImageCropper from './ImageCropper';

interface ProfilePictureUploadProps {
  currentAvatarUrl?: string;
  displayName?: string;
  onAvatarUpdate: (url: string) => void;
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  currentAvatarUrl,
  displayName,
  onAvatarUpdate
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    if (!user) return;

    try {
      setUploading(true);

      // Create unique filename
      const fileExt = 'jpg'; // Always use jpg for consistency
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split('/').pop();
        if (oldPath && oldPath !== 'avatar.svg') {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      
      toast({
        title: "Profilbild aktualisiert",
        description: "Ihr Profilbild wurde erfolgreich hochgeladen.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Upload-Fehler",
        description: "Das Profilbild konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCroppedImage = async (croppedFile: File) => {
    await uploadAvatar(croppedFile);
    setShowCropper(false);
    setSelectedImage('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Datei zu groß",
          description: "Bitte wählen Sie eine Datei unter 5MB.",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie eine Bilddatei.",
          variant: "destructive",
        });
        return;
      }

      // Create temporary URL for cropping
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      setShowCropper(true);
    }
    
    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const getInitials = () => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <>
      <div className="relative group">
        <Avatar className="w-20 h-20">
          <AvatarImage src={currentAvatarUrl} alt="Profilbild" />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-lg font-semibold">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        <Button
          size="sm"
          variant="secondary"
          className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={triggerFileSelect}
          disabled={uploading}
        >
          {uploading ? (
            <Upload className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
        </Button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />
      </div>

      <ImageCropper
        isOpen={showCropper}
        onClose={() => {
          setShowCropper(false);
          setSelectedImage('');
          if (selectedImage) {
            URL.revokeObjectURL(selectedImage);
          }
        }}
        imageSrc={selectedImage}
        onCropComplete={handleCroppedImage}
      />
    </>
  );
};

export default ProfilePictureUpload;