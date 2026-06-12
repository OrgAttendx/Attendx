import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, SectionList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';

interface SessionRecord {
  session_id: number;
  start_time: string | null;
  status: string | null;
  marked_at: string | null;
}

interface SectionData {
  title: string;
  data: SessionRecord[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown date';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByMonth(records: SessionRecord[]): SectionData[] {
  const map: Record<string, SessionRecord[]> = {};
  records.forEach((r) => {
    const key = getMonthKey(r.start_time);
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return Object.entries(map).map(([title, data]) => ({ title, data }));
}

export default function ClassDetailsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useAuthStore();
  const router = useRouter();

  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user?.user_id) return;
    fetchAttendance();
  }, [id]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/student/classes/${id}/attendance`, {
        params: { student_id: user?.user_id },
      });
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed Stats ──
  const total = records.length;
  const present = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT' || !r.status).length;
  const rate = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';

  const sections = groupByMonth(records);

  const getStatusColor = (status: string | null) => {
    if (status === 'PRESENT' || status === 'LATE') return '#16A34A';
    return '#DC2626';
  };

  const getStatusBg = (status: string | null) => {
    if (status === 'PRESENT' || status === 'LATE') return '#DCFCE7';
    return '#FEE2E2';
  };

  const getStatusLabel = (status: string | null) => {
    if (status === 'PRESENT') return 'Present';
    if (status === 'LATE') return 'Late';
    return 'Absent';
  };

  const renderSession = ({ item }: { item: SessionRecord }) => (
    <View style={styles.sessionRow}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionDate}>{formatDate(item.start_time)}</Text>
        {item.marked_at ? (
          <Text style={styles.sessionTime}>Marked at {formatTime(item.marked_at)}</Text>
        ) : (
          <Text style={styles.sessionTime}>No record</Text>
        )}
      </View>
      <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
        <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
          {getStatusLabel(item.status)}
        </Text>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name="calendar-outline" size={14} color="#8F9BB3" />
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading attendance...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back + Title */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#6C63FF" />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle} numberOfLines={1}>{name || 'Class Details'}</Text>
          <Text style={styles.screenSubtitle}>Attendance Details</Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statCardFull]}>
          <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="layers-outline" size={18} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
          </View>
          <Text style={[styles.statValue, { color: '#16A34A' }]}>{present}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFF1F2' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
          </View>
          <Text style={[styles.statValue, { color: '#DC2626' }]}>{absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F5F3FF' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="trending-up-outline" size={18} color="#6C63FF" />
          </View>
          <Text style={[styles.statValue, { color: '#6C63FF' }]}>{rate}%</Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>
      </View>

      {/* Session History */}
      <View style={styles.historyHeader}>
        <Ionicons name="time-outline" size={16} color="#6C63FF" />
        <Text style={styles.historyTitle}>Session History</Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-outline" size={48} color="#8F9BB3" />
          <Text style={styles.emptyTitle}>No Sessions Yet</Text>
          <Text style={styles.emptyText}>
            Your attendance history will appear here once sessions have been conducted.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.session_id.toString()}
          renderItem={renderSession}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F5F9' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8F9BB3' },

  // ── TOP HEADER ──
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EAE9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleBlock: { flex: 1 },
  screenTitle: { fontSize: 18, fontWeight: '800', color: '#222B45' },
  screenSubtitle: { fontSize: 12, color: '#8F9BB3', marginTop: 2 },

  // ── STATS GRID ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    width: '47%',
    shadowColor: '#8F9BB3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  statCardFull: { width: '100%' },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 26, fontWeight: '800', color: '#222B45' },
  statLabel: { fontSize: 12, color: '#8F9BB3', fontWeight: '500', marginTop: 2 },

  // ── HISTORY HEADER ──
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 6,
  },
  historyTitle: { fontSize: 16, fontWeight: '700', color: '#222B45' },

  // ── SECTION HEADER ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 6,
    marginTop: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8F9BB3',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  listContainer: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── SESSION ROW ──
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#8F9BB3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 14, fontWeight: '600', color: '#222B45' },
  sessionTime: { fontSize: 12, color: '#8F9BB3', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  // ── EMPTY ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#222B45', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8F9BB3', textAlign: 'center', lineHeight: 22 },
});
