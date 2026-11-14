import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class LeadStatusChip extends StatelessWidget {
  final LeadStatus status;

  const LeadStatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color, bgColor) = switch (status) {
      LeadStatus.discovered => ('New', AppColors.info, AppColors.info.withValues(alpha: 0.1)),
      LeadStatus.enriched => ('Enriched', const Color(0xFF8B5CF6), const Color(0xFF8B5CF6).withValues(alpha: 0.1)),
      LeadStatus.qualified => ('Qualified', AppColors.warning, AppColors.warning.withValues(alpha: 0.1)),
      LeadStatus.drafted => ('Drafted', const Color(0xFF6366F1), const Color(0xFF6366F1).withValues(alpha: 0.1)),
      LeadStatus.approved => ('Approved', AppColors.accentTeal, AppColors.accentTeal.withValues(alpha: 0.1)),
      LeadStatus.sent => ('Sent', AppColors.success, AppColors.success.withValues(alpha: 0.1)),
      LeadStatus.replied => ('Replied', AppColors.success, AppColors.success.withValues(alpha: 0.15)),
      LeadStatus.optedOut => ('Opted Out', AppColors.error, AppColors.error.withValues(alpha: 0.1)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
