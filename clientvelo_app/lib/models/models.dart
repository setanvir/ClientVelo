import 'package:flutter/material.dart';

/// Theme provider for Dark/Light mode toggle
class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.light;

  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  void toggleTheme() {
    _themeMode =
        _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }

  void setDarkMode(bool dark) {
    _themeMode = dark ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }
}

/// Subscription tier for Free/Pro plan logic
enum SubscriptionTier { free, pro }

/// User model with tier info
class UserModel {
  final String id;
  final String name;
  final String email;
  final SubscriptionTier tier;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
    this.tier = SubscriptionTier.free,
  });

  bool get isPro => tier == SubscriptionTier.pro;

  /// Mock free user
  static const mockFreeUser = UserModel(
    id: 'usr_001',
    name: 'Tanvir Mohammed',
    email: 'tanvir@example.com',
    tier: SubscriptionTier.free,
  );

  /// Mock pro user
  static const mockProUser = UserModel(
    id: 'usr_002',
    name: 'Tanvir Pro',
    email: 'tanvir.pro@clientvelo.app',
    tier: SubscriptionTier.pro,
  );
}

/// Lead status in the pipeline
enum LeadStatus {
  discovered,
  enriched,
  qualified,
  drafted,
  approved,
  sent,
  replied,
  optedOut,
}

/// A single business lead
class Lead {
  final String id;
  final String businessName;
  final String category;
  final String city;
  final String? email;
  final String? phone;
  final String? website;
  final LeadStatus status;
  final DateTime createdAt;
  final double? qualificationScore;

  const Lead({
    required this.id,
    required this.businessName,
    required this.category,
    required this.city,
    this.email,
    this.phone,
    this.website,
    this.status = LeadStatus.discovered,
    required this.createdAt,
    this.qualificationScore,
  });
}

/// Campaign / outreach batch
class Campaign {
  final String id;
  final String name;
  final int totalLeads;
  final int sentCount;
  final int repliedCount;
  final int bouncedCount;
  final DateTime startedAt;
  final bool isActive;

  const Campaign({
    required this.id,
    required this.name,
    required this.totalLeads,
    required this.sentCount,
    required this.repliedCount,
    required this.bouncedCount,
    required this.startedAt,
    required this.isActive,
  });

  double get replyRate =>
      sentCount > 0 ? (repliedCount / sentCount) * 100 : 0;
  double get bounceRate =>
      sentCount > 0 ? (bouncedCount / sentCount) * 100 : 0;
}
