import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react';
import { ShapefileService } from '../../services/shapefileService';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { LoadingSpinner } from '../UI/LoadingSpinner';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  plotsCount?: number;
  error?: string;
  importId?: string;
}

export const EnhancedShapefileUpload: React.FC = () => {
  const { user } = useSupabaseAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;

    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(),
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Process each file
    for (const [index, file] of acceptedFiles.entries()) {
      const fileId = newFiles[index].id;
      
      try {
        // Validate file
        const validation = ShapefileService.validateFile(file);
        if (!validation.isValid) {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: 'error', error: validation.errors.join(', ') }
              : f
          ));
          continue;
        }

        // Update progress
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, progress: 50, status: 'processing' } : f
        ));

        // Upload and process
        const result = await ShapefileService.uploadShapefile(file, user.id);
        
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { 
                ...f, 
                status: 'completed', 
                progress: 100,
                importId: result.importId,
                plotsCount: parseInt(result.message.match(/\d+/)?.[0] || '0')
              }
            : f
        ));

      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { 
                ...f, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Upload failed'
              }
            : f
        ));
      }
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false)
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <LoadingSpinner size="sm" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadTemplate = () => {
    // Create a sample shapefile template
    const templateData = {
      instructions: 'Sample shapefile structure for land plots',
      required_files: ['.shp', '.shx', '.dbf', '.prj'],
      sample_attributes: {
        PLOT_CODE: 'Unique plot identifier',
        LAND_USE: 'Residential/Commercial/Agricultural/Industrial',
        OWNER: 'Owner name',
        AREA_SQM: 'Area in square meters',
        PRICE_USD: 'Price in USD'
      }
    };

    const blob = new Blob([JSON.stringify(templateData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shapefile_template_guide.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Shapefile Upload</h2>
            <p className="text-gray-600 mt-2">
              Upload shapefile packages (.zip) containing land plot boundaries and attributes
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Download Template Guide</span>
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive || dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Drop your shapefile here' : 'Upload Shapefile Package'}
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop your ZIP file here, or click to browse
          </p>
          <div className="text-sm text-gray-500">
            <p>Supported format: ZIP files containing .shp, .shx, .dbf, and .prj files</p>
            <p>Maximum file size: 50MB</p>
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Shapefile Requirements</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">Required Files:</h4>
            <ul className="space-y-1">
              <li>• .shp - Geometry data</li>
              <li>• .shx - Shape index</li>
              <li>• .dbf - Attribute data</li>
              <li>• .prj - Projection info</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Recommended Attributes:</h4>
            <ul className="space-y-1">
              <li>• PLOT_CODE - Unique identifier</li>
              <li>• LAND_USE - Usage type</li>
              <li>• OWNER - Owner name</li>
              <li>• AREA_SQM - Area in sq meters</li>
              <li>• PRICE_USD - Price in USD</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload History */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Upload Progress</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div key={file.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {file.status === 'completed' && file.plotsCount && (
                      <span className="text-sm text-green-600 font-medium">
                        {file.plotsCount} plots imported
                      </span>
                    )}
                    {file.status === 'error' && file.error && (
                      <span className="text-sm text-red-600 max-w-xs truncate">
                        {file.error}
                      </span>
                    )}
                    {getStatusIcon(file.status)}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>
                        {file.status === 'uploading' ? 'Uploading...' : 'Processing shapefile...'}
                      </span>
                      <span>{file.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};