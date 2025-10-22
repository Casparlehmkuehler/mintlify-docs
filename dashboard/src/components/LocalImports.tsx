import React, { useState } from 'react'
import { Package, ChevronDown, ChevronUp } from 'lucide-react'

interface LocalImportsProps {
  imports: string[] | null | undefined
  maxDisplayed?: number
  size?: 'sm' | 'md'
  className?: string
}

const LocalImports: React.FC<LocalImportsProps> = ({ 
  imports, 
  maxDisplayed = 3, 
  size = 'md',
  className = '' 
}) => {
  const [showAll, setShowAll] = useState(false)
  
  if (!imports || imports.length === 0) {
    return (
      <div className={`flex items-center text-gray-400 dark:text-gray-500 ${className}`}>
        <Package className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
        <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'}`}>No imports</span>
      </div>
    )
  }

  const displayedImports = showAll ? imports : imports.slice(0, maxDisplayed)
  const hasMore = imports.length > maxDisplayed

  return (
    <div className={`${className}`}>
      <div className="flex items-start space-x-1">
        <Package className={`${size === 'sm' ? 'h-3 w-3 mt-0.5' : 'h-4 w-4 mt-0.5'} text-blue-500 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1">
            {displayedImports.map((pkg, index) => (
              <span
                key={index}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800`}
              >
                {pkg}
              </span>
            ))}
            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                +{imports.length - maxDisplayed} more
              </button>
            )}
            {hasMore && showAll && (
              <button
                onClick={() => setShowAll(false)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
              >
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </button>
            )}
          </div>
          {imports.length > 0 && (
            <div className={`mt-1 ${size === 'sm' ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
              {imports.length} {imports.length === 1 ? 'package' : 'packages'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LocalImports