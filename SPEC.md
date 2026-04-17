# Route Designer - Google Maps App

## Project Overview
- **Type**: Single HTML file web app
- **Purpose**: Design routes using Google Maps Directions API with multi-waypoint support
- **Target Users**: Logistics managers, delivery planners

## UI/UX Specification

### Layout Structure
- **Header**: App title + API key configuration
- **Main**: Two-column layout (form left, routes list right)
- **Map**: Full-width map section below

### Visual Design
- **Colors**: 
  - Primary: `#1a73e8` (Google Blue)
  - Background: `#f8f9fa`
  - Cards: `#ffffff`
  - Text: `#202124`
  - Accent: `#34a853` (green)
- **Typography**: System fonts, 16px base

### Components
1. **API Key Input**: Text field + save button + status indicator
2. **Route Form**:
   - Unit name (text)
   - Date picker
   - Origin (text input with autocomplete)
   - Destination (text input with autocomplete)
   - Additional waypoints (dynamic add/remove)
   - Calculate button
3. **Route Result**: Shows distance, duration, legs breakdown
4. **Saved Routes List**: Grouped by unit/date

## Functionality Specification

### Core Features
1. **API Key Management**: Save to localStorage
2. **Google Places Autocomplete**: For origin/destination/waypoints
3. **Route Calculation**: Multiple waypoints, distance/time per leg + total
4. **Local Storage**: Save routes with all details
5. **Route List**: View all saved routes

### API Integration
- Google Maps JavaScript API
- DirectionsService for route calculation
- Places Autocomplete for address search

## Acceptance Criteria
1. API key saves and persists
2. Autocomplete addresses from Google Places
3. Multiple waypoints support (up to 25)
4. Total distance/time calculated from all legs
5. Routes save to local storage
6. Display itinerary with all stops