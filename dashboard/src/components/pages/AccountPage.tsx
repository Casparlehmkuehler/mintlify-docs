import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserCircle, Mail, Calendar, Key } from 'lucide-react'

const AccountPage: React.FC = () => {
  const { user } = useAuth()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-5 px-6">
      <div className="border-b border-gray-200 dark:border-dark-border pb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">Account</h1>
        <p className="mt-1 text-gray-600 dark:text-dark-text-secondary">Manage your account information and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center">
                  <UserCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Lyceum Cloud User</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    <Mail className="inline w-4 h-4 mr-1" />
                    Email
                  </label>
                  <p className="text-sm text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-card p-2 rounded-md">
                    {user?.email || 'N/A'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Member Since
                  </label>
                  <p className="text-sm text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-card p-2 rounded-md">
                    {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    <Key className="inline w-4 h-4 mr-1" />
                    User ID
                  </label>
                  <p className="text-sm text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-card p-2 rounded-md font-mono">
                    {user?.id || 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-1">
                    Authentication Provider
                  </label>
                  <p className="text-sm text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-card p-2 rounded-md capitalize">
                    {user?.app_metadata?.provider || 'Email'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Stats */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Account Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Email Verified</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user?.email_confirmed_at ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                }`}>
                  {user?.email_confirmed_at ? 'Verified' : 'Unverified'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Account Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-dark-text-secondary">Last Sign In</span>
                <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
                  {user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-card p-6 rounded-lg border border-gray-200 dark:border-dark-border">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 rounded-md transition-colors">
                Update Profile
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 rounded-md transition-colors">
                Change Password
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-accent/20 rounded-md transition-colors">
                Download Account Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountPage