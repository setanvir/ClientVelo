# ClientVelo App – Flutter Frontend

A cross-platform Flutter client for the ClientVelo Lead Generation & Automated Outreach platform.

## Phase 1 – Project Setup, UI Structure & Navigation

### What's Implemented
- ✅ Flutter project initialization with cross-platform support (Android, iOS, Windows, macOS, Web)
- ✅ **Dashboard Overview** screen with stat cards, recent leads, and plan badge
- ✅ **Lead Discovery List** screen with search, filter chips, detail bottom sheet, and qualification scores
- ✅ **Campaign Tracker** screen with progress bars, reply/bounce stats, and summary header
- ✅ **Settings** screen with theme toggle, backend config, SMTP settings, and Pro Plan upgrade card
- ✅ Bottom Navigation Bar with 4 tabs (Dashboard, Leads, Campaigns, Settings)
- ✅ Dark/Light Mode theming using Provider state management
- ✅ Data models for Lead, Campaign, UserModel with Free/Pro tier logic
- ✅ Mock data structures for UI demonstration
- ✅ ClientVelo Slate design system (Navy #0F172A, Teal #14B8A6)

### Tech Stack
- **Framework:** Flutter (Dart)
- **State Management:** Provider
- **Design:** Material 3 + Google Fonts + Custom theme
- **Architecture:** Feature-based folder structure (screens, models, widgets, theme)

### How to Run
```bash
cd clientvelo_app
flutter pub get
flutter run -d chrome    # Web
flutter run -d windows   # Windows Desktop
flutter run               # Default device
```

## Project Structure
```
lib/
├── main.dart                  # App entry point with Provider
├── theme/
│   └── app_theme.dart         # Light/Dark themes, brand colors
├── models/
│   ├── models.dart            # Lead, Campaign, UserModel, ThemeProvider
│   └── mock_data.dart         # Mock leads & campaigns for Phase 1
├── screens/
│   ├── home_shell.dart        # Bottom navigation shell
│   ├── dashboard_screen.dart  # Overview with stats & recent leads
│   ├── leads_screen.dart      # Discovery list with search & filters
│   ├── campaigns_screen.dart  # Campaign tracker with metrics
│   └── settings_screen.dart   # App settings & Pro upgrade
└── widgets/
    ├── stat_card.dart         # Reusable stat metric card
    └── lead_status_chip.dart  # Status badge widget
```
