import '../models/models.dart';

/// Mock data for Phase 1 UI demonstration
class MockData {
  static final List<Lead> leads = [
    Lead(
      id: 'ld_001',
      businessName: 'Aruba Royal Car Rental',
      category: 'Car Rental',
      city: 'Oranjestad, Aruba',
      email: 'contact@arubaroyal.com',
      phone: '+297 582 1234',
      website: 'http://www.arubaroyal.com',
      status: LeadStatus.qualified,
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
      qualificationScore: 85,
    ),
    Lead(
      id: 'ld_002',
      businessName: 'Sunset Wheels Aruba',
      category: 'Car Rental',
      city: 'Noord, Aruba',
      phone: '+297 583 4455',
      status: LeadStatus.discovered,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      qualificationScore: 62,
    ),
    Lead(
      id: 'ld_003',
      businessName: 'Budget Rent a Car',
      category: 'Car Rental',
      city: 'Oranjestad, Aruba',
      email: 'info@budgetaruba.com',
      phone: '+297 582 8600',
      website: 'http://www.budgetaruba.com',
      status: LeadStatus.sent,
      createdAt: DateTime.now().subtract(const Duration(days: 5)),
      qualificationScore: 91,
    ),
    Lead(
      id: 'ld_004',
      businessName: 'Top Drive Aruba',
      category: 'Car Rental',
      city: 'Oranjestad, Aruba',
      phone: '+297 587 1729',
      website: 'https://www.arubatopdrive.com',
      status: LeadStatus.enriched,
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
      qualificationScore: 78,
    ),
    Lead(
      id: 'ld_005',
      businessName: 'Hertz Aruba',
      category: 'Car Rental',
      city: 'Oranjestad, Aruba',
      email: 'reservations@hertzaruba.com',
      phone: '+297 582 1845',
      website: 'https://www.hertzaruba.com',
      status: LeadStatus.replied,
      createdAt: DateTime.now().subtract(const Duration(days: 7)),
      qualificationScore: 95,
    ),
    Lead(
      id: 'ld_006',
      businessName: 'Dhaka Dental Care',
      category: 'Dentist',
      city: 'Dhaka, Bangladesh',
      email: 'info@dhakadentalcare.com',
      phone: '+880 1712 345678',
      website: 'https://dhakadentalcare.com',
      status: LeadStatus.drafted,
      createdAt: DateTime.now().subtract(const Duration(days: 4)),
      qualificationScore: 88,
    ),
    Lead(
      id: 'ld_007',
      businessName: 'Miami Auto Wash',
      category: 'Auto Service',
      city: 'Miami, FL',
      email: 'hello@miamiauto.com',
      status: LeadStatus.approved,
      createdAt: DateTime.now().subtract(const Duration(days: 6)),
      qualificationScore: 72,
    ),
    Lead(
      id: 'ld_008',
      businessName: "Jay's Car Rental",
      category: 'Car Rental',
      city: 'Noord, Aruba',
      phone: '+297 583 2223',
      website: 'http://www.jayscarrentalaruba.com',
      status: LeadStatus.discovered,
      createdAt: DateTime.now().subtract(const Duration(hours: 12)),
      qualificationScore: 55,
    ),
  ];

  static final List<Campaign> campaigns = [
    Campaign(
      id: 'cmp_001',
      name: 'Aruba Car Rentals – Nov 2026',
      totalLeads: 10,
      sentCount: 6,
      repliedCount: 2,
      bouncedCount: 1,
      startedAt: DateTime.now().subtract(const Duration(days: 3)),
      isActive: true,
    ),
    Campaign(
      id: 'cmp_002',
      name: 'Dhaka Dentists Outreach',
      totalLeads: 25,
      sentCount: 20,
      repliedCount: 5,
      bouncedCount: 3,
      startedAt: DateTime.now().subtract(const Duration(days: 10)),
      isActive: false,
    ),
    Campaign(
      id: 'cmp_003',
      name: 'Miami Auto Services Q4',
      totalLeads: 15,
      sentCount: 0,
      repliedCount: 0,
      bouncedCount: 0,
      startedAt: DateTime.now(),
      isActive: true,
    ),
  ];

  // Dashboard stats
  static const int totalLeads = 48;
  static const int emailsSent = 26;
  static const int replies = 7;
  static const int activeCampaigns = 2;
  static const double replyRate = 26.9;
  static const double bounceRate = 4.2;
}
