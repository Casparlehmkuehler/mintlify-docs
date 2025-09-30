# Lyceum Dashboard

A responsive web dashboard for monitoring runs, managing billing, and configuring API keys for the Lyceum cloud execution platform.

## Features

### ✨ Navigation
- **Expandable Sidebar**: Toggles between collapsed (icons only) and expanded (with labels) states
- **Mobile-Responsive**: Transforms into a slide-out drawer on mobile devices
- **Active State Highlighting**: Current page is highlighted with darker background
- **Smooth Animations**: Powered by Framer Motion for fluid transitions

### 📊 Dashboard Pages
1. **Dashboard Home**: Overview with quick stats and recent activity
2. **Runs**: Horizontal scrollable run cards with detailed side panel
3. **Billing**: Credit balance, transaction history, and usage summary
4. **API Keys**: Create, view, and manage API keys with visibility controls
5. **Settings**: Profile, notifications, appearance, and security settings

### 🏃 Runs Page Features
- **Horizontal Card Layout**: Scrollable run cards showing status, duration, and description
- **Detailed Side Panel**: Slides in from right showing full run details, logs, and configuration
- **Mobile Responsive**: Cards stack vertically on small screens
- **Status Indicators**: Visual icons and colors for different run states (running, completed, failed, paused)

### 📱 Mobile Responsiveness
- Navigation collapses into a drawer menu on mobile
- Run cards stack vertically on smaller screens
- Details panel becomes full-screen on mobile devices
- Touch-friendly interactions throughout

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **React Router** for navigation
- **Lucide React** for icons

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx          # Main dashboard layout
│   ├── Sidebar.tsx           # Navigation sidebar
│   └── pages/
│       ├── DashboardHome.tsx  # Home page with overview
│       ├── RunsPage.tsx       # Runs management with details panel
│       ├── BillingPage.tsx    # Billing and credits
│       ├── ApiKeysPage.tsx    # API key management
│       └── SettingsPage.tsx   # User settings
├── App.tsx                    # Main app component
├── main.tsx                   # App entry point
└── index.css                  # Global styles
```

## Design System

### Colors
- **Background**: Light gray (`bg-gray-100`) for sidebar
- **Text**: Black (`text-black`) for primary text
- **Active State**: Darker gray (`bg-gray-200`) for active navigation items
- **Status Colors**: Green (success), Blue (running), Red (failed), Yellow (paused)

### Layout
- **Sidebar**: 4rem collapsed, 16rem expanded
- **Transitions**: 300ms ease-in-out for smooth animations
- **Details Panel**: 30-40% screen width on desktop, full screen on mobile

## Future Enhancements

- Real API integration
- Dark mode support
- Advanced filtering and search
- Real-time updates via WebSocket
- Export functionality
- Advanced settings and preferences

## Contributing

This is a framework implementation. To integrate with real data:

1. Replace mock data with API calls
2. Add authentication and authorization
3. Implement real-time updates
4. Add error handling and loading states
5. Configure environment variables for API endpoints