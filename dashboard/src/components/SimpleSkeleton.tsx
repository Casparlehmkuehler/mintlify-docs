import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width = '100%', 
  height = '1rem' 
}) => (
  <div 
    className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    style={{ width, height }}
  />
)

export const DashboardCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border p-6">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Skeleton width="60%" height="1rem" className="mb-3" />
        <Skeleton width="40%" height="2rem" />
      </div>
      <Skeleton width="2.5rem" height="2.5rem" className="rounded-lg" />
    </div>
  </div>
)

export const TableRowSkeleton: React.FC = () => (
  <tr className="border-t border-gray-200 dark:border-dark-border">
    <td className="px-6 py-4">
      <Skeleton width="70%" height="1rem" className="mb-1" />
      <Skeleton width="40%" height="0.75rem" />
    </td>
    <td className="px-6 py-4">
      <Skeleton width="4rem" height="1.5rem" className="rounded-full" />
    </td>
    <td className="px-6 py-4 hidden md:table-cell">
      <Skeleton width="5rem" height="1rem" />
    </td>
    <td className="px-6 py-4 hidden lg:table-cell">
      <Skeleton width="3rem" height="1rem" />
    </td>
  </tr>
)