import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedImage: File) => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (imageSrc: string, pixelCrop: CropArea, rotation: number = 0): Promise<File> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'cropped-avatar.jpg', { type: 'image/jpeg' });
        resolve(file);
      }
    }, 'image/jpeg', 0.9);
  });
};

const ImageCropper: React.FC<ImageCropperProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete
}) => {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropCompleteCallback = useCallback(
    (croppedArea: any, croppedAreaPixels: CropArea) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      setProcessing(true);
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
      toast({
        title: "Crop-Fehler",
        description: "Das Bild konnte nicht zugeschnitten werden.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Profilbild zuschneiden</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Cropper */}
          <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={setZoom}
              cropShape="round"
              showGrid={false}
            />
          </div>

          {/* Zoom Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Zoom</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                  disabled={zoom <= 1}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Rotation Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Rotation</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((prev) => prev - 90)}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((prev) => prev + 90)}
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Slider
              value={[rotation]}
              onValueChange={(value) => setRotation(value[0])}
              min={-180}
              max={180}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={processing}>
            {processing ? 'Wird bearbeitet...' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;