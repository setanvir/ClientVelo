import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final cardColor = isDark ? AppColors.darkCard : AppColors.cardWhite;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.border;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Settings',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Configure your ClientVelo engine',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 28),

              // Profile Section
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderColor),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.accentTeal, Color(0xFF0D9488)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Center(
                        child: Text('TM', style: TextStyle(
                          color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            UserModel.mockFreeUser.name,
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            UserModel.mockFreeUser.email,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.accentTeal.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'FREE',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accentTeal,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Settings Groups
              _sectionLabel('Appearance', isDark),
              _settingsCard([
                _settingsTile(
                  Icons.dark_mode_rounded,
                  'Dark Mode',
                  'Switch between light and dark themes',
                  isDark,
                  trailing: Switch(
                    value: isDark,
                    onChanged: (_) => themeProvider.toggleTheme(),
                    activeColor: AppColors.accentTeal,
                  ),
                ),
              ], cardColor, borderColor),
              const SizedBox(height: 16),

              _sectionLabel('Backend Connection', isDark),
              _settingsCard([
                _settingsTile(
                  Icons.dns_rounded,
                  'API Server URL',
                  'http://127.0.0.1:3000',
                  isDark,
                  trailing: Icon(Icons.chevron_right, color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                ),
                const Divider(height: 1),
                _settingsTile(
                  Icons.sync_rounded,
                  'Auto-Sync',
                  'Sync data when connected',
                  isDark,
                  trailing: Switch(
                    value: true,
                    onChanged: (_) {},
                    activeColor: AppColors.accentTeal,
                  ),
                ),
                const Divider(height: 1),
                _settingsTile(
                  Icons.storage_rounded,
                  'Local Cache',
                  'SQLite/Hive offline storage',
                  isDark,
                  trailing: Text(
                    'Phase 2',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ], cardColor, borderColor),
              const SizedBox(height: 16),

              _sectionLabel('Outreach Configuration', isDark),
              _settingsCard([
                _settingsTile(
                  Icons.email_rounded,
                  'SMTP Configuration',
                  'Set your email sending credentials',
                  isDark,
                  trailing: Icon(Icons.chevron_right, color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                ),
                const Divider(height: 1),
                _settingsTile(
                  Icons.schedule_rounded,
                  'Send Window',
                  '9:00 AM – 5:00 PM (Mon–Fri)',
                  isDark,
                  trailing: Icon(Icons.chevron_right, color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                ),
                const Divider(height: 1),
                _settingsTile(
                  Icons.speed_rounded,
                  'Daily Limit',
                  '15 emails / day (Free Plan)',
                  isDark,
                  trailing: Icon(Icons.chevron_right, color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                ),
              ], cardColor, borderColor),
              const SizedBox(height: 16),

              _sectionLabel('Subscription', isDark),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primaryNavy, Color(0xFF1E293B)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.rocket_launch_rounded, color: AppColors.accentTeal, size: 24),
                        const SizedBox(width: 10),
                        Text(
                          'Upgrade to Pro',
                          style: GoogleFonts.inter(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Unlock unlimited leads, priority queues, advanced filtering, and remove daily send limits.',
                      style: GoogleFonts.inter(fontSize: 13, color: Colors.white60, height: 1.5),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentTeal,
                        foregroundColor: AppColors.primaryNavy,
                      ),
                      child: Text('View Pro Plans', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // App Info
              Center(
                child: Column(
                  children: [
                    Text(
                      'ClientVelo v1.0.0',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Made with ❤️ by Tanvir',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(String text, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
        ),
      ),
    );
  }

  Widget _settingsCard(List<Widget> children, Color cardColor, Color borderColor) {
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(children: children),
    );
  }

  Widget _settingsTile(IconData icon, String title, String subtitle, bool isDark, {Widget? trailing}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.accentTeal.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppColors.accentTeal, size: 18),
      ),
      title: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: GoogleFonts.inter(
          fontSize: 12,
          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
        ),
      ),
      trailing: trailing,
    );
  }
}
