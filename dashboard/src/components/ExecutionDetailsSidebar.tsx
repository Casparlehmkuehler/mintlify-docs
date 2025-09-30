import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ExecutionDetails {
  id: string
  name?: string
  status: string
  created_at: string
  description: string
  amount?: number | null
  hardware_profile?: string
}

interface ExecutionDetailsSidebarProps {
  execution: ExecutionDetails | null
  onClose: () => void
}

const ExecutionDetailsSidebar: React.FC<ExecutionDetailsSidebarProps> = ({ execution, onClose }) => {
  const detailsPanelRef = useRef<HTMLDivElement>(null)

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`

  if (!execution) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={detailsPanelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="fixed top-0 right-0 bottom-0 z-[9999] w-full sm:w-[28rem] bg-white dark:bg-dark-card border-l border-gray-200 dark:border-dark-border overflow-y-auto"
        style={{ height: '100vh' }}
      >
        <div className="flex items-center justify-between p-6 pt-12 border-b border-gray-200 dark:border-dark-border">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
              {execution.name || 'Execution Details'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary">ID: {execution.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 dark:text-dark-text-secondary hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-accent/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Status</h3>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
              execution.status === 'completed' 
                ? 'bg-green-100 text-green-800 border-green-200'
                : execution.status === 'failed'
                ? 'bg-red-100 text-red-800 border-red-200'
                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
            }`}>
              <span className="capitalize">{execution.status}</span>
            </span>
          </div>

          {/* Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text mb-2">Execution Details</h3>
            <div className="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-dark-text-secondary">Description:</span>
                <span className="text-gray-900 dark:text-dark-text">{execution.description}</span>
              </div>
              {execution.amount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-dark-text-secondary">Execution Cost:</span>
                  <span className={`font-medium ${
                    execution.amount === null 
                      ? 'text-gray-400'
                      : execution.amount > 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                  }`}>
                    {execution.amount === null 
                      ? 'Free'
                      : execution.amount > 0
                        ? `+${formatCurrency(execution.amount)}`
                        : formatCurrency(Math.abs(execution.amount))
                    }
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-dark-text-secondary">Date:</span>
                <span className="text-gray-900 dark:text-dark-text">{new Date(execution.created_at).toLocaleDateString()}</span>
              </div>
              {execution.hardware_profile && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-dark-text-secondary">Hardware:</span>
                  <span className="text-gray-900 dark:text-dark-text">{execution.hardware_profile}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

export default ExecutionDetailsSidebar