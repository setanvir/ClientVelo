import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'dashboard_screen.dart';
import 'leads_screen.dart';
import 'campaigns_screen.dart';
import 'settings_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _selectedIndex = 0;

  static const List<Widget> _screens = [
    DashboardScreen(),
    LeadsScreen(),
    CampaignsScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        height: 68,
        elevation: 0,
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
            selectedIcon: const Icon(Icons.dashboard_rounded, color: AppColors.accentTeal),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline_rounded,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
            selectedIcon: const Icon(Icons.people_alt_rounded, color: AppColors.accentTeal),
            label: 'Leads',
          ),
          NavigationDestination(
            icon: Icon(Icons.campaign_outlined,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
            selectedIcon: const Icon(Icons.campaign_rounded, color: AppColors.accentTeal),
            label: 'Campaigns',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
            selectedIcon: const Icon(Icons.settings_rounded, color: AppColors.accentTeal),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
