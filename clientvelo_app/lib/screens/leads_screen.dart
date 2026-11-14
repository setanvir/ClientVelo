import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../models/models.dart';
import '../models/mock_data.dart';
import '../widgets/lead_status_chip.dart';

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  String _searchQuery = '';
  LeadStatus? _filterStatus;

  List<Lead> get _filteredLeads {
    return MockData.leads.where((lead) {
      final matchesSearch = _searchQuery.isEmpty ||
          lead.businessName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          lead.category.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          lead.city.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesFilter = _filterStatus == null || lead.status == _filterStatus;
      return matchesSearch && matchesFilter;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppColors.darkCard : AppColors.cardWhite;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.border;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Lead Discovery',
                    style: GoogleFonts.inter(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${MockData.leads.length} leads discovered across all niches',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Search Bar
                  TextField(
                    onChanged: (v) => setState(() => _searchQuery = v),
                    decoration: InputDecoration(
                      hintText: 'Search leads by name, niche, city...',
                      prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () => setState(() => _searchQuery = ''),
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All', null, isDark),
                        _buildFilterChip('New', LeadStatus.discovered, isDark),
                        _buildFilterChip('Enriched', LeadStatus.enriched, isDark),
                        _buildFilterChip('Qualified', LeadStatus.qualified, isDark),
                        _buildFilterChip('Sent', LeadStatus.sent, isDark),
                        _buildFilterChip('Replied', LeadStatus.replied, isDark),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),

            // Lead List
            Expanded(
              child: _filteredLeads.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.search_off_rounded,
                            size: 48,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No leads found',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: _filteredLeads.length,
                      itemBuilder: (context, index) {
                        final lead = _filteredLeads[index];
                        return _buildLeadCard(lead, cardColor, borderColor, isDark);
                      },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🔍 Discovery engine will connect to backend API in Phase 2'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        backgroundColor: AppColors.accentTeal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.radar_rounded),
        label: Text('Discover', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildFilterChip(String label, LeadStatus? status, bool isDark) {
    final isSelected = _filterStatus == status;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => setState(() => _filterStatus = status),
        selectedColor: AppColors.accentTeal.withValues(alpha: 0.15),
        checkmarkColor: AppColors.accentTeal,
        labelStyle: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          color: isSelected
              ? AppColors.accentTeal
              : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        side: BorderSide(
          color: isSelected
              ? AppColors.accentTeal
              : (isDark ? AppColors.darkBorder : AppColors.border),
        ),
      ),
    );
  }

  Widget _buildLeadCard(Lead lead, Color cardColor, Color borderColor, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _showLeadDetail(lead),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.accentTeal.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        lead.businessName[0],
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accentTeal,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lead.businessName,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${lead.category} · ${lead.city}',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  LeadStatusChip(status: lead.status),
                ],
              ),
              if (lead.email != null || lead.phone != null) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 12,
                  children: [
                    if (lead.email != null)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.email_outlined, size: 14,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Text(lead.email!, style: GoogleFonts.inter(fontSize: 11,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
                        ],
                      ),
                    if (lead.phone != null)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.phone_outlined, size: 14,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Text(lead.phone!, style: GoogleFonts.inter(fontSize: 11,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
                        ],
                      ),
                  ],
                ),
              ],
              if (lead.qualificationScore != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: lead.qualificationScore! / 100,
                          backgroundColor: isDark ? AppColors.darkBorder : AppColors.border,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            lead.qualificationScore! >= 80
                                ? AppColors.success
                                : lead.qualificationScore! >= 60
                                    ? AppColors.warning
                                    : AppColors.error,
                          ),
                          minHeight: 4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${lead.qualificationScore!.toInt()}%',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showLeadDetail(Lead lead) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.4,
          maxChildSize: 0.85,
          expand: false,
          builder: (context, scrollController) => SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkBorder : AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.accentTeal.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Center(
                        child: Text(
                          lead.businessName[0],
                          style: GoogleFonts.inter(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentTeal,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lead.businessName,
                              style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700)),
                          Text('${lead.category} · ${lead.city}',
                              style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    LeadStatusChip(status: lead.status),
                  ],
                ),
                const SizedBox(height: 24),
                _detailRow(Icons.email_outlined, 'Email', lead.email ?? 'Not found', isDark),
                _detailRow(Icons.phone_outlined, 'Phone', lead.phone ?? 'Not found', isDark),
                _detailRow(Icons.language, 'Website', lead.website ?? 'Not found', isDark),
                _detailRow(Icons.score, 'Score', '${lead.qualificationScore?.toInt() ?? 'N/A'}%', isDark),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.send_rounded),
                    label: const Text('Start Outreach'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(IconData icon, String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.accentTeal),
          const SizedBox(width: 12),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary)),
          const Spacer(),
          Flexible(
            child: Text(value,
                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}
