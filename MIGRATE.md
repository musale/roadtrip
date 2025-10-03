# RoadTrip Migration Guide: Vanilla JS → React + Vite + TailwindCSS

## How to Use This Guide

- [ ] **Progress Tracking**: Check off items as you complete them using `- [x]`
- [ ] **Sequential Order**: Follow phases in order, but items within a phase can be done in parallel
- [ ] **Sub-tasks**: Complete all sub-items before marking the parent item as done
- [ ] **Testing**: Test each component as you build it before moving to the next
- [ ] **Commits**: Make frequent commits after completing each major item
- [ ] **Branches**: Consider creating feature branches for each phase
- [ ] **Rollback**: Keep the original `src/` directory until migration is complete

---

## Phase 1: Project Setup & Build System

### Initial Setup

- [ ] Initialize new Vite + React project structure
  - [x] Run `npm create vite@latest roadtrip-react -- --template react`
  - [ ] Move new project files to root or create parallel structure
  - [ ] Update `.gitignore` for Node.js/React project

### Dependencies Installation

- [ ] Install core dependencies
  - [ ] `npm install react react-dom`
  - [ ] `npm install maplibre-gl`
  - [ ] `npm install -D @vitejs/plugin-react`
  - [ ] `npm install -D vite`

### TailwindCSS Setup

- [ ] Install and configure TailwindCSS
  - [ ] `npm install -D tailwindcss postcss autoprefixer`
  - [ ] `npx tailwindcss init -p`
  - [ ] Configure `tailwind.config.js` with custom theme
  - [ ] Add Tailwind directives to CSS entry point
  - [ ] Test Tailwind classes are working

### PWA Configuration

- [ ] Install and configure PWA plugin
  - [ ] `npm install -D vite-plugin-pwa`
  - [ ] Configure `vite.config.js` with PWA settings
  - [ ] Create/copy PWA manifest and icons
  - [ ] Test PWA installation works

### Development Environment

- [ ] Configure development server
  - [ ] Set up proper HTTPS for geolocation testing
  - [ ] Configure mobile device testing
  - [ ] Test hot module replacement works

---

## Phase 2: Core Data Layer Migration

### TripRecorder Hook

- [ ] Create `src/hooks/useTripRecorder.js`
  - [ ] Convert TripRecorder class to React hook
  - [ ] Implement trip start/stop functionality
  - [ ] Add GPS coordinate collection logic
  - [ ] Include distance calculation (Haversine formula)
  - [ ] Add speed calculation with smoothing
  - [ ] Implement trip statistics calculation
  - [ ] Test hook with mock GPS data

### Geolocation Hook

- [ ] Create `src/hooks/useGeolocation.js`
  - [ ] Wrap navigator.geolocation API
  - [ ] Handle permission requests
  - [ ] Implement error handling
  - [ ] Add accuracy filtering (>50m rejection)
  - [ ] Test with real device GPS

### Local Storage Hook

- [ ] Create `src/hooks/useLocalStorage.js`
  - [ ] Implement trip data persistence
  - [ ] Add trip history management
  - [ ] Include data export utilities (GPX/GeoJSON)
  - [ ] Test data persistence across sessions

### Wake Lock Hook

- [ ] Create `src/hooks/useWakeLock.js`
  - [ ] Implement screen wake lock during recording
  - [ ] Handle wake lock release on trip stop
  - [ ] Add error handling for unsupported browsers
  - [ ] Test wake lock functionality

---

## Phase 3: Core Components

### App Container

- [ ] Create `src/App.jsx`
  - [ ] Set up main application structure
  - [ ] Implement mode switching logic (camera/map)
  - [ ] Add global state management context
  - [ ] Test basic app renders and mode switching works

### Context Provider

- [ ] Create `src/context/AppContext.jsx`
  - [ ] Define global state structure
  - [ ] Implement context provider
  - [ ] Add state update functions
  - [ ] Test context provides state to components

### LiveHUD Component

- [ ] Create `src/components/LiveHUD.jsx`
  - [ ] Convert canvas-based HUD to React component
  - [ ] Implement high-DPI canvas setup
  - [ ] Add 60fps animation loop with useEffect
  - [ ] Include real-time statistics rendering
  - [ ] Add accessibility attributes
  - [ ] Test HUD renders stats correctly

### MapView Component

- [ ] Create `src/components/MapView.jsx`
  - [ ] Integrate MapLibre GL with React
  - [ ] Implement map initialization
  - [ ] Add real-time track rendering
  - [ ] Include current position marker
  - [ ] Add follow mode functionality
  - [ ] Implement fit-to-bounds feature
  - [ ] Add canvas fallback for offline mode
  - [ ] Test map renders and updates with GPS data

### CameraView Component

- [ ] Create `src/components/CameraView.jsx`
  - [ ] Implement camera feed access
  - [ ] Add camera permission handling
  - [ ] Include fallback for no camera
  - [ ] Test camera feed displays correctly

---

## Phase 4: UI Components

### StatusBar Component

- [ ] Create `src/components/StatusBar.jsx`
  - [ ] Implement recording status indicator
  - [ ] Add GPS status display
  - [ ] Include storage indicator
  - [ ] Add mode indicator badge
  - [ ] Style with TailwindCSS
  - [ ] Test all status indicators work

### ControlBar Component

- [ ] Create `src/components/ControlBar.jsx`
  - [ ] Create record start/stop button
  - [ ] Add mode toggle button
  - [ ] Include fit button (map mode only)
  - [ ] Add settings button
  - [ ] Style with TailwindCSS
  - [ ] Test all controls function correctly

### Button Components

- [ ] Create reusable button components
  - [ ] `src/components/ui/Button.jsx` - Base button
  - [ ] `src/components/ui/IconButton.jsx` - Icon button
  - [ ] Add proper touch targets (44px minimum)
  - [ ] Include loading and disabled states
  - [ ] Style with TailwindCSS variants

---

## Phase 5: Styling Migration

### TailwindCSS Theme Configuration

- [ ] Update `tailwind.config.js`
  - [ ] Add custom colors (recording red, primary blue, etc.)
  - [ ] Configure custom spacing and sizes
  - [ ] Add mobile-first breakpoints
  - [ ] Define custom animations
  - [ ] Add dynamic viewport height utilities

### Component Styling

- [ ] Convert CSS classes to TailwindCSS
  - [ ] App layout and positioning
  - [ ] Background layer styling
  - [ ] HUD overlay styling
  - [ ] Control layer styling
  - [ ] Button states and interactions
  - [ ] Responsive design breakpoints

### Mode-Specific Styling

- [ ] Implement mode-based styling
  - [ ] Camera mode layout
  - [ ] Map mode layout
  - [ ] Mode transition animations
  - [ ] Hidden/visible element toggles

---

## Phase 6: Integration & State Management

### Component Integration

- [ ] Connect all components in App.jsx
  - [ ] Wire up TripRecorder hook to UI
  - [ ] Connect LiveHUD to trip statistics
  - [ ] Link MapView to GPS coordinates
  - [ ] Connect ControlBar to recording actions

### Event Flow Setup

- [ ] Implement proper data flow
  - [ ] GPS data → TripRecorder → UI updates
  - [ ] Control actions → State updates → UI feedback
  - [ ] Mode switching → Component visibility
  - [ ] Recording state → All component updates

### Error Handling

- [ ] Add comprehensive error handling
  - [ ] GPS/location errors
  - [ ] Camera access errors
  - [ ] Map loading errors
  - [ ] Storage errors
  - [ ] Network errors for map tiles

---

## Phase 7: Testing & Quality Assurance

### Unit Testing Setup

- [ ] Configure testing framework
  - [ ] Install Vitest and React Testing Library
  - [ ] Configure test environment
  - [ ] Set up mock utilities

### Component Testing

- [ ] Write tests for core components
  - [ ] TripRecorder hook tests
  - [ ] LiveHUD component tests
  - [ ] MapView component tests
  - [ ] UI component tests

### Integration Testing

- [ ] Test complete user flows
  - [ ] Start/stop recording flow
  - [ ] Mode switching flow
  - [ ] GPS data collection flow
  - [ ] Export functionality flow

### Mobile Testing

- [ ] Test on actual mobile devices
  - [ ] GPS functionality
  - [ ] Touch interactions
  - [ ] Performance on mobile
  - [ ] PWA installation
  - [ ] Offline functionality

---

## Phase 8: Performance Optimization

### Bundle Optimization

- [ ] Optimize build output
  - [ ] Configure code splitting
  - [ ] Optimize asset loading
  - [ ] Minimize bundle size
  - [ ] Test build performance

### Runtime Optimization

- [ ] Optimize component performance
  - [ ] Add React.memo where appropriate
  - [ ] Optimize re-render patterns
  - [ ] Minimize canvas redraws
  - [ ] Optimize map rendering

### Mobile Performance

- [ ] Optimize for mobile devices
  - [ ] Battery usage optimization
  - [ ] Memory usage optimization
  - [ ] GPS polling optimization
  - [ ] Smooth 60fps animations

---

## Phase 9: PWA Features & Deployment

### PWA Completion

- [ ] Finalize PWA setup
  - [ ] Test offline functionality
  - [ ] Verify service worker registration
  - [ ] Test PWA installation flow
  - [ ] Validate manifest configuration

### Data Migration

- [ ] Handle existing user data
  - [ ] Migrate localStorage trip data
  - [ ] Preserve user settings
  - [ ] Test data backward compatibility

### Deployment Preparation

- [ ] Prepare for deployment
  - [ ] Configure build scripts
  - [ ] Set up environment variables
  - [ ] Optimize production build
  - [ ] Test production build locally

---

## Phase 10: Final Testing & Documentation

### Comprehensive Testing

- [ ] Final end-to-end testing
  - [ ] All user flows work correctly
  - [ ] GPS recording accuracy
  - [ ] Export functionality works
  - [ ] Cross-browser compatibility
  - [ ] Mobile device compatibility

### Documentation Updates

- [ ] Update project documentation
  - [ ] Update README.md for React project
  - [ ] Document new component architecture
  - [ ] Update build and deployment instructions
  - [ ] Document migration changes

### Cleanup

- [ ] Clean up migration artifacts
  - [ ] Remove old vanilla JS files
  - [ ] Clean up unused dependencies
  - [ ] Remove migration-specific code
  - [ ] Final code review and cleanup

---

## Migration Complete ✅

- [ ] **All phases completed**
- [ ] **Original functionality preserved**
- [ ] **New React architecture implemented**
- [ ] **TailwindCSS styling applied**
- [ ] **PWA features working**
- [ ] **Performance optimized**
- [ ] **Documentation updated**

---

## Notes Section

Use this space to track issues, decisions, and important notes during migration:

```
[Date] - [Note]
Example: Oct 3, 2025 - Decided to use Zustand instead of Context for state management due to performance
```

---

## Rollback Plan

If migration needs to be rolled back:

1. Keep original `src/` directory until migration is complete
2. Maintain original build process until new one is verified
3. Test both versions in parallel during migration
4. Have deployment rollback strategy ready
