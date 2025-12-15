import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from './ui';

interface Photo {
  id: string;
  file_name: string;
  file_path: string;
  photo_type: string;
  caption?: string;
  is_primary: boolean;
  url: string;
}

interface PhotoGalleryProps {
  propertyId: string;
  photos: Photo[];
  onPhotosChange: () => void;
  editable?: boolean;
}

const PHOTO_TYPES = [
  { value: 'exterior', label: 'Exterior' },
  { value: 'interior', label: 'Interior' },
  { value: 'aerial', label: 'Aerial' },
  { value: 'loading_dock', label: 'Loading Dock' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

export default function PhotoGallery({ propertyId, photos, onPhotosChange, editable = true }: PhotoGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoType, setPhotoType] = useState('exterior');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      // Upload each file
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Please select image files only');
          continue;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError('Photos must be less than 10MB');
          continue;
        }

        await api.uploadPhoto(
          propertyId,
          file,
          photoType,
          undefined,
          photos.length === 0 // First photo is primary
        );
      }

      onPhotosChange();
    } catch (err: any) {
      setError(err.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      await api.setPrimaryPhoto(photoId);
      onPhotosChange();
    } catch (err: any) {
      setError(err.message || 'Failed to set primary photo');
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await api.deletePhoto(photoId);
      onPhotosChange();
      setSelectedPhoto(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete photo');
    }
  };

  const primaryPhoto = photos.find(p => p.is_primary) || photos[0];
  const otherPhotos = photos.filter(p => p.id !== primaryPhoto?.id);

  return (
    <div className="space-y-4">
      {/* Header with upload button */}
      {editable && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Photos</h3>
          <div className="flex items-center gap-2">
            <select
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {PHOTO_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="sm"
            >
              {uploading ? 'Uploading...' : 'Add Photos'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-2 text-gray-500">No photos yet</p>
          {editable && (
            <p className="text-sm text-gray-400 mt-1">Click "Add Photos" to upload property images</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary photo (larger) */}
          {primaryPhoto && (
            <div
              className="md:col-span-2 relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100"
              onClick={() => setSelectedPhoto(primaryPhoto)}
            >
              <img
                src={primaryPhoto.url}
                alt={primaryPhoto.caption || 'Property photo'}
                className="w-full h-64 md:h-96 object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className="bg-primary-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </span>
              </div>
              <div className="absolute top-2 right-2">
                <span className="bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-1 rounded capitalize">
                  {primaryPhoto.photo_type.replace('_', ' ')}
                </span>
              </div>
              {editable && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(primaryPhoto.id); }}
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Other photos */}
          {otherPhotos.map(photo => (
            <div
              key={photo.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Property photo'}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2">
                <span className="bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-1 rounded capitalize">
                  {photo.photo_type.replace('_', ' ')}
                </span>
              </div>
              {editable && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(photo.id); }}
                    className="bg-primary-600 text-white text-xs px-2 py-1 rounded hover:bg-primary-700"
                  >
                    Set Primary
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                    className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setSelectedPhoto(null)}
          >
            &times;
          </button>
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.caption || 'Property photo'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedPhoto.caption && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded">
              {selectedPhoto.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
