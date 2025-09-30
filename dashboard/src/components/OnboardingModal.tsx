import React from 'react'
import { X } from 'lucide-react'
import OnboardingGuide from './OnboardingGuide'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  hasApiKey: boolean
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, hasApiKey }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-6xl bg-white rounded-xl shadow-xl">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Content */}
          <div className="max-h-[80vh] overflow-y-auto">
            <OnboardingGuide hasApiKey={hasApiKey} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingModal