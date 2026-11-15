import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../models/mock_data.dart';

class CampaignsScreen extends StatelessWidget {
  const CampaignsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
                'Campaign Tracker',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Monitor your outreach campaign performance',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 24),

              // Summary Bar
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primaryNavy, Color(0xFF1E293B)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _summaryItem('Active', '${MockData.campaigns.where((c) => c.isActive).length}', Icons.play_circle_fill_rounded),
                    Container(width: 1, height: 40, color: Colors.white24),
                    _summaryItem('Total Sent', '${MockData.emailsSent}', Icons.send_rounded),
                    Container(width: 1, height: 40, color: Colors.white24),
                    _summaryItem('Reply Rate', '${MockData.replyRate}%', Icons.trending_up_rounded),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Campaign List
              ...MockData.campaigns.map((campaign) => Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: cardColor,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: borderColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title Row
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: campaign.isActive
                                    ? AppColors.success
                                    : AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                campaign.name,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: campaign.isActive
                                    ? AppColors.success.withValues(alpha: 0.1)
                                    : (isDark ? AppColors.darkBorder : AppColors.border).withValues(alpha: 0.5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                campaign.isActive ? 'Active' : 'Completed',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: campaign.isActive
                                      ? AppColors.success
                                      : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Progress Bar
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: campaign.totalLeads > 0
                                ? campaign.sentCount / campaign.totalLeads
                                : 0,
                            backgroundColor: isDark ? AppColors.darkBorder : AppColors.border,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accentTeal),
                            minHeight: 6,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${campaign.sentCount}/${campaign.totalLeads} emails sent',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Stats Row
                        Row(
                          children: [
                            _statBadge(Icons.reply_rounded, '${campaign.repliedCount} replies',
                                AppColors.success, isDark),
                            const SizedBox(width: 12),
                            _statBadge(Icons.error_outline, '${campaign.bouncedCount} bounced',
                                AppColors.error, isDark),
                            const SizedBox(width: 12),
                            _statBadge(Icons.percent, '${campaign.replyRate.toStringAsFixed(1)}% rate',
                                AppColors.info, isDark),
                          ],
                        ),
                      ],
                    ),
                  )),

              // New Campaign Button
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('📧 Campaign creation connects to backend in Phase 2'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.add_rounded),
                  label: Text('New Campaign', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.accentTeal,
                    side: const BorderSide(color: AppColors.accentTeal),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: AppColors.accentTeal, size: 22),
        const SizedBox(height: 6),
        Text(
          value,
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
        ),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 11, color: Colors.white60),
        ),
      ],
    );
  }

  Widget _statBadge(IconData icon, String text, Color color, bool isDark) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          text,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}
