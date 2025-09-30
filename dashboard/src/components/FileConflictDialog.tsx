import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, File, Folder, Clock, HardDrive } from 'lucide-react'

export interface ConflictFile {
  name: string
  size: number
  lastModified?: string
  isFolder?: boolean
}

export interface FileConflictDialogProps {
  isOpen: boolean
  conflictingFiles: ConflictFile[]
  onResolve: (resolution: 'replace' | 'keep' | 'cancel') => void
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleString()
}

const FileConflictDialog: React.FC<FileConflictDialogProps> = ({
  isOpen,
  conflictingFiles,
  onResolve
}) => {
  if (!isOpen) return null

  const singleFile = conflictingFiles.length === 1
  const firstFile = conflictingFiles[0]

  return (
    <div className="fixed inset-0 z-[10004] overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" />
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full relative z-[10005]"
        >
          <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 sm:mx-0 sm:h-10 sm:w-10">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-text">
                  {singleFile ? 'File Already Exists' : `${conflictingFiles.length} Files Already Exist`}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary break-words">
                    {singleFile 
                      ? (
                        <>
                          A file with the name{' '}
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded break-all">
                            {firstFile.name}
                          </span>
                          {' '}already exists. What would you like to do?
                        </>
                      )
                      : `${conflictingFiles.length} files you're trying to upload already exist. What would you like to do?`
                    }
                  </p>
                  
                  {/* File Details */}
                  <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                    {conflictingFiles.map((file, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-dark-accent/20 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {file.isFolder ? (
                              <Folder className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                            ) : (
                              <File className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 2rem)' }}>
                            <div className="text-sm font-medium text-gray-900 dark:text-dark-text font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" 
                                 style={{ 
                                   wordBreak: 'break-all', 
                                   overflowWrap: 'anywhere',
                                   whiteSpace: 'pre-wrap',
                                   maxWidth: '100%'
                                 }} 
                                 title={file.name}>
                              {file.name}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center text-xs text-gray-500 dark:text-dark-text-secondary">
                                <HardDrive className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span>{formatFileSize(file.size)}</span>
                              </div>
                              {file.lastModified && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-dark-text-secondary">
                                  <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span>{formatDate(file.lastModified)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-dark-accent/10 px-4 py-3 sm:px-6 space-y-2 sm:space-y-0 sm:flex sm:flex-row-reverse sm:space-x-reverse sm:space-x-3">
            <button
              type="button"
              onClick={() => onResolve('replace')}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              Replace {singleFile ? 'File' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => onResolve('keep')}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
            >
              Keep Both
            </button>
            <button
              type="button"
              onClick={() => onResolve('cancel')}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-dark-border shadow-sm px-4 py-2 bg-white dark:bg-dark-card text-base font-medium text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-accent/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default FileConflictDialog