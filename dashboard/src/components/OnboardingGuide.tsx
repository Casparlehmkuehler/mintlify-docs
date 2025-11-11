import React, { useState } from 'react'
import { ChevronRight, Check, Copy, ExternalLink, Download, Key } from 'lucide-react'
import { Link } from 'react-router-dom'

// VSCode icon component
const VSCodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
  </svg>
)

// Terminal/CLI icon component
const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="18" rx="2"/>
    <path d="m7 8 3 3-3 3"/>
    <path d="M13 17h6"/>
  </svg>
)

type OnboardingPath = 'none' | 'extension' | 'cli'

interface OnboardingGuideProps {
  hasApiKey: boolean
}

const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ hasApiKey }) => {
  const [selectedPath, setSelectedPath] = useState<OnboardingPath>('none')
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(commandId)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const toggleStep = (stepId: string) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId)
    } else {
      newCompleted.add(stepId)
    }
    setCompletedSteps(newCompleted)
  }

  if (selectedPath === 'none') {
    return (
      <div className="bg-white dark:bg-dark-bg rounded-xl p-8 border border-blue-200 dark:border-dark-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-2">Welcome to Lyceum Cloud!</h2>
            <p className="text-lg text-gray-600 dark:text-dark-text-secondary">Choose how you want to run your code in the cloud</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* VS Code Extension Option */}
            <button
              onClick={() => setSelectedPath('extension')}
              className="bg-white dark:bg-dark-card rounded-lg p-6 border-2 border-transparent hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-lg text-left group"
            >
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 dark:bg-dark-bg rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <VSCodeIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-2">VS Code Extension</h3>
                  <p className="text-gray-600 dark:text-dark-text-secondary mb-4">
                    Run code directly from VS Code with a single click. Perfect for developers who want seamless integration.
                  </p>
                  <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                    Get Started <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </div>
              </div>
            </button>

            {/* CLI Option */}
            <button
              onClick={() => setSelectedPath('cli')}
              className="bg-white dark:bg-dark-card rounded-lg p-6 border-2 border-transparent hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-lg text-left group"
            >
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gray-100 dark:bg-dark-card rounded-lg group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                  <TerminalIcon className="h-6 w-6 text-gray-700 dark:text-dark-text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-2">Command Line (CLI)</h3>
                  <p className="text-gray-600 dark:text-dark-text-secondary mb-4">
                    Use the Lyceum CLI from any terminal. Great for automation, CI/CD pipelines, and scripts.
                  </p>
                  <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                    Get Started <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-8 text-center">
            <div className="border-t border-gray-200 dark:border-dark-border pt-4">
              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-2">Need more help?</p>
              <a
                href="https://docs.lyceum.technology"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Visit our Documentation</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedPath === 'extension') {
    return (
      <div className="bg-white dark:bg-dark-card rounded-xl p-8 border border-gray-200 dark:border-dark-border">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">VS Code Extension Setup</h2>
            </div>
            <button
              onClick={() => setSelectedPath('none')}
              className="text-sm text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
            >
              ← Back to options
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 1: Install Extension */}
            <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <button
                  onClick={() => toggleStep('ext-1')}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                    completedSteps.has('ext-1')
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300'
                  } transition-colors`}
                >
                  {completedSteps.has('ext-1') && (
                    <Check className="w-3 h-3 text-white m-auto" />
                  )}
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2">1. Install the Extension</h3>
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                    Open VS Code and install the Lyceum extension from the marketplace
                  </p>
                  <div className="flex items-center space-x-3">
                    <a
                      href="vscode:extension/LyceumTechnology.lyceumcloud"
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 dark:bg-dark-bg text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>Open in VS Code</span>
                    </a>
                    <span className="text-sm text-gray-500 dark:text-dark-text-secondary">or search "Lyceum" in Extension Marketplace</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Authentication*/}
            <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <button
                  onClick={() => toggleStep('ext-2')}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                    completedSteps.has('ext-2')
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300'
                  } transition-colors`}
                >
                  {completedSteps.has('ext-2') && (
                    <Check className="w-3 h-3 text-white m-auto" />
                  )}
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2">2. Login in VS Code</h3>
                  <div className="bg-gray-50 dark:bg-dark-card rounded-md p-3 mb-3">
                    <p className="text-xs text-gray-600 dark:text-dark-text-secondary mb-2">In VS Code:</p>
                    <ol className="text-xs text-gray-700 dark:text-dark-text-secondary space-y-1">
                      <li>1. Press the cloud button in the top right corner. </li>
                      <li>2. Redirect to the Dashboard</li>
                      <li>3. You are all set up</li>
                    </ol>
                  </div>
                  {!hasApiKey && (
                    <Link
                      to="/api-keys"

                      className="inline-flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <Key className="h-4 w-4" />
                      <span>Create API Key</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Run Code */}
            <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <button
                  onClick={() => toggleStep('ext-3')}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                    completedSteps.has('ext-3')
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300'
                  } transition-colors`}
                >
                  {completedSteps.has('ext-3') && (
                    <Check className="w-3 h-3 text-white m-auto" />
                  )}
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-2">3. Run Your First Code</h3>
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-3">
                    Open any Python file and click the cloud icon in the editor toolbar
                  </p>
                  <div className="bg-gray-900 dark:bg-dark-bg text-gray-100 dark:text-dark-text p-3 rounded-md text-xs font-mono mb-3">
                    <div className="mb-2">
                      <span className="text-green-400"># example.py</span>
                    </div>
                    <div>import torch</div>
                    <div>print(f"CUDA available: &#123;torch.cuda.is_available()&#125;")</div>
                    <div>print(f"GPU count: &#123;torch.cuda.device_count()&#125;")</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center border-t border-gray-200 dark:border-dark-border pt-6">
            <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-2">Need more help?</p>
            <a
              href="https://docs.lyceum.technology"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Visit our Documentation</span>
            </a>
          </div>
        </div>
      </div>
    )
  }

  // CLI Path
  return (
    <div className="bg-white dark:bg-dark-bg rounded-xl p-8 border border-gray-200 dark:border-dark-border">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">CLI Setup</h2>
          </div>
          <button
            onClick={() => setSelectedPath('none')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to options
          </button>
        </div>

        <div className="space-y-4">
          {/* Step 1: Install CLI */}
          <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <button
                onClick={() => toggleStep('cli-1')}
                className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                  completedSteps.has('cli-1')
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300'
                } transition-colors`}
              >
                {completedSteps.has('cli-1') && (
                  <Check className="w-3 h-3 text-white m-auto" />
                )}
              </button>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-dark-text-secondary mb-2">1. Install the CLI</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Install the Lyceum CLI using pip (Python 3.8+ required)
                </p>
                <div className="bg-gray-900 rounded-md p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <code className="text-gray-100 dark:text-dark-text text-sm">pip install lyceum-cli</code>
                    <button
                      onClick={() => copyToClipboard('pip install lyceum-cli', 'install')}
                      className="text-gray-400 dark:text-dark-text-secondary hover:text-white dark:hover:text-dark-text transition-colors"
                    >
                      {copiedCommand === 'install' ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Configure API Key */}
          <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <button
                onClick={() => toggleStep('cli-2')}
                className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                  completedSteps.has('cli-2')
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300'
                } transition-colors`}
              >
                {completedSteps.has('cli-2') && (
                  <Check className="w-3 h-3 text-white m-auto" />
                )}
              </button>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-dark-text-secondary mb-2">2. Authenticate your Terminal</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Authenticate through your browser with a simple redirect.
                </p>
                <div className="space-y-2">
                  <div className="bg-gray-900 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-gray-100 dark:text-dark-text text-sm">lyceum auth login</code>
                      <button
                        onClick={() => copyToClipboard('lyceum auth login', 'config')}
                        className="text-gray-400 dark:text-dark-text-secondary hover:text-white dark:hover:text-dark-text transition-colors"
                      >
                        {copiedCommand === 'config' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {!hasApiKey && (
                  <Link
                    to="/api-keys"
                    className="inline-flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 mt-3"
                  >
                    <Key className="h-4 w-4" />
                    <span>Create API Key</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Run Code */}
          <div className="border border-gray-200 dark:border-dark-border rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <button
                onClick={() => toggleStep('cli-3')}
                className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 ${
                  completedSteps.has('cli-3')
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300'
                } transition-colors`}
              >
                {completedSteps.has('cli-3') && (
                  <Check className="w-3 h-3 text-white m-auto" />
                )}
              </button>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900  dark:text-dark-text-secondary mb-2">3. Run Your First Code</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Execute any Python file or Docker image with a simple command
                </p>
                <div className="space-y-2">
                  <div className="bg-gray-900 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-gray-100 dark:text-dark-text text-sm">lyceum python run ml_model.py --machine gpu</code>
                      <button
                        onClick={() => copyToClipboard('lyceum run example.py --gpu a100', 'run')}
                        className="text-gray-400 dark:text-dark-text-secondary hover:text-white dark:hover:text-dark-text transition-colors"
                      >
                        {copiedCommand === 'run' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-gray-100 dark:text-dark-text text-sm">lyceum docker run pytorch/pytorch:latest</code>
                      <button
                        onClick={() => copyToClipboard('lyceum docker run pytorch/pytorch:latest', 'docker')}
                        className="text-gray-400 dark:text-dark-text-secondary hover:text-white dark:hover:text-dark-text transition-colors"
                      >
                        {copiedCommand === 'docker' ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          
        </div>

        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">CLI Features:</h4>
          <ul className="text-xs text-green-800 dark:text-green-400 space-y-1">
            <li>Explore direct inferencing and batch processing functionality by using <code className="bg-green-100 dark:bg-green-800 px-1 rounded">--help</code> flag</li>
            <li>Specify hardware with <code className="bg-green-100 dark:bg-green-800 px-1 rounded">--machine "type"</code> (Defaults to "cpu")</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default OnboardingGuide