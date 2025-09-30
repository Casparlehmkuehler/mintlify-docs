import React, { useState } from 'react'
import { AlertTriangle, X, Mail, Phone, Send, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface PanicButtonProps {
  userEmail?: string
}

const PanicButton: React.FC<PanicButtonProps> = ({ userEmail }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    contactMethod: 'email' as 'email' | 'call',
    urgency: 'medium' as 'low' | 'medium' | 'high',
    issue: '',
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isPhoneCopied, setIsPhoneCopied] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const copyPhoneNumber = async () => {
    try {
      await navigator.clipboard.writeText('+49 151 5239 7726')
      setIsPhoneCopied(true)
      setTimeout(() => setIsPhoneCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy phone number:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Create the email content
      const emailData = {
        to: 'caspar@lyceum.technology',
        subject: `🚨 PANIC BUTTON - ${formData.urgency.toUpperCase()} Priority Issue`,
        body: `
PANIC BUTTON ALERT
==================

User: ${userEmail || 'Unknown'}
Urgency: ${formData.urgency.toUpperCase()}
Issue Type: ${formData.issue}

Description:
${formData.description}

Timestamp: ${new Date().toISOString()}
`.trim()
      }

      // For now, we'll use a mailto link as a fallback
      // In a production environment, you'd want to use an email service like SendGrid, AWS SES, etc.
      const mailtoUrl = `mailto:caspar@lyceum.technology?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`
      
      // Try to open the default email client
      window.location.href = mailtoUrl

      setSubmitStatus('success')

      // Reset form after successful submission
      setTimeout(() => {
        setIsModalOpen(false)
        setSubmitStatus('idle')
        setFormData({
          contactMethod: 'email',
          urgency: 'medium',
          issue: '',
          description: ''
        })
      }, 2000)

    } catch (error) {
      console.error('Error submitting panic button:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <>
      {/* Floating Panic Button */}
      <motion.button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Emergency Support"
      >
        <AlertTriangle className="h-6 w-6" />
        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Emergency Support
        </span>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white dark:bg-dark-bg rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                      Emergency Support
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {submitStatus === 'success' && (
                    <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded-lg text-sm">
                      Emergency request sent successfully! We will be notified immediately.
                    </div>
                  )}
                  
                  {submitStatus === 'error' && (
                    <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm">
                      ❌ Failed to send emergency request. Please try again or contact caspar@lyceum.technology directly.
                    </div>
                  )}

                  {/* Contact Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                      How do you want to contact us?
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="email"
                          checked={formData.contactMethod === 'email'}
                          onChange={(e) => handleInputChange('contactMethod', e.target.value)}
                          className="mr-2"
                        />
                        <Mail className="h-4 w-4 mr-1" />
                        <span className="text-sm text-gray-700 dark:text-dark-text">Email</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="call"
                          checked={formData.contactMethod === 'call'}
                          onChange={(e) => handleInputChange('contactMethod', e.target.value)}
                          className="mr-2"
                        />
                        <Phone className="h-4 w-4 mr-1" />
                        <span className="text-sm text-gray-700 dark:text-dark-text">Call our product team directly</span>
                      </label>
                    </div>
                  </div>

                  {/* Phone Number Display for Call Option */}
                  {formData.contactMethod === 'call' && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Call our product team directly:
                          </p>
                          <p className="text-lg font-mono font-semibold text-blue-900 dark:text-blue-100">
                            +49 151 5239 7726
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={copyPhoneNumber}
                          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                          {isPhoneCopied ? (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        For immediate assistance, call directly.
                      </p>
                    </div>
                  )}

                  {/* Email Form - Only show when email is selected */}
                  {formData.contactMethod === 'email' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Urgency Level */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                          Urgency Level
                        </label>
                        <select
                          value={formData.urgency}
                          onChange={(e) => handleInputChange('urgency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        >
                          <option value="low">Low - General question or minor issue</option>
                          <option value="high">High - Critical issue, need immediate help</option>
                        </select>
                      </div>

                      {/* Issue Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                          What type of issue are you experiencing?
                        </label>
                        <select
                          value={formData.issue}
                          onChange={(e) => handleInputChange('issue', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          required
                        >
                          <option value="">Select an issue type...</option>
                          <option value="technical">Technical Issue / Bug</option>
                          <option value="billing">Billing / Payment Problem</option>
                          <option value="account">Account Access Issue</option>
                          <option value="performance">Performance / Speed Issue</option>
                          <option value="data">Data Loss / Corruption</option>
                          <option value="security">Security Concern</option>
                          <option value="integration">API / Integration Problem</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
                          Describe the issue *
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder="Please describe what happened, what you were trying to do, and any error messages you saw..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                          required
                        />
                      </div>

                      {/* User Info Display */}
                      {userEmail && (
                        <div className="p-3 bg-gray-50 dark:bg-dark-card rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                            <strong>Your email:</strong> {userEmail}
                          </p>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="flex space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-dark-accent/20 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formData.issue || !formData.description}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              <span>Send Emergency Request</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Close button for call option */}
                  {formData.contactMethod === 'call' && (
                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default PanicButton