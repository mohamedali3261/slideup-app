import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Trash2, Shield, Users, ArrowLeft, LogOut, 
  Crown, Calendar, Clock, MoreVertical, Search, Presentation,
  Eye, EyeOff, Globe, Key, Download, Settings, Activity,
  FileText, UserPlus, Edit, Ban, Check, X, RefreshCw,
  Bell, MessageCircle, Send, AlertTriangle, Info, AlertCircle,
  Layout, Star, Heart, CheckCircle, XCircle, Lightbulb, Sparkles
} from 'lucide-react';
import { dailyTips } from '@/data/dailyTips';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface UserData {
  id: number;
  username: string;
  plain_password: string | null;
  email: string | null;
  role: 'user' | 'admin';
  is_active: number;
  created_at: string;
  last_login: string | null;
  last_ip: string | null;
  os: string | null;
  browser: string | null;
  device_type: string | null;
  presentation_count: number;
  login_count: number;
}

interface PresentationData {
  id: string;
  user_id: number;
  username: string;
  title: string;
  slide_count: number;
  created_at: string;
  updated_at: string;
}

interface ActivityLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

interface LoginAttempt {
  id: number;
  username: string;
  success: number;
  ip_address: string;
  created_at: string;
}

interface EditorAction {
  id: number;
  user_id: number;
  username: string;
  presentation_id: string;
  action_type: string;
  action_details: string;
  created_at: string;
}

interface SlideChange {
  id: number;
  user_id: number;
  username: string;
  presentation_id: string;
  slide_id: string;
  change_type: string;
  element_id: string;
  element_type: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

interface TemplateUsage {
  id: number;
  user_id: number;
  username: string;
  template_id: string;
  template_name: string;
  action: string;
  presentation_id: string;
  created_at: string;
}

interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  target_user_id: number | null;
  created_by: number;
  created_by_username: string;
  read_count: number;
  created_at: string;
}

interface SupportTicket {
  id: number;
  user_id: number;
  username: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: number;
  ticket_id: number;
  user_id: number;
  username: string;
  message: string;
  is_admin: number;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  admins: number;
  activeUsers: number;
  totalPresentations: number;
  usersByDay: { date: string; count: number }[];
  usersByMonth: { month: string; count: number }[];
  mostActiveUsers: { username: string; presentation_count: number }[];
  recentLogins: { username: string; created_at: string; success: number }[];
  failedAttempts: number;
  openTickets: number;
  totalVisitors: number;
  visitorsToday: number;
}

const API_URL = '/api';

const translations = {
  en: {
    dashboard: 'Dashboard', editor: 'Editor', totalUsers: 'Total Users', admins: 'Admins',
    users: 'Users', usersManagement: 'Users', manageAllUsers: 'Manage all registered users',
    search: 'Search...', admin: 'Admin', user: 'User', registered: 'Registered',
    lastLogin: 'Last login', neverLoggedIn: 'Never logged in', makeUser: 'Make User',
    makeAdmin: 'Make Admin', deleteUser: 'Delete User', deleteUserConfirm: 'Delete User',
    deleteUserDesc: 'Are you sure you want to delete user', cannotUndo: 'This action cannot be undone.',
    cancel: 'Cancel', delete: 'Delete', noUsers: 'No users found', password: 'Password',
    showPassword: 'Show Password', hidePassword: 'Hide Password', addUser: 'Add User',
    username: 'Username', email: 'Email', role: 'Role', save: 'Save', active: 'Active',
    inactive: 'Inactive', activate: 'Activate', deactivate: 'Deactivate', editUser: 'Edit User',
    presentations: 'Presentations', title: 'Title', slides: 'Slides', owner: 'Owner',
    createdAt: 'Created', updatedAt: 'Updated', deletePresentation: 'Delete Presentation',
    noPresentations: 'No presentations found', activityLogs: 'Activity Logs', action: 'Action',
    actions: 'Actions', status: 'Status', confirmDelete: 'Confirm Delete', deleteUserWarning: 'This action cannot be undone.',
    details: 'Details', ipAddress: 'IP Address', time: 'Time', noLogs: 'No logs found',
    loginAttempts: 'Login Attempts', success: 'Success', failed: 'Failed', settings: 'Settings',
    siteName: 'Site Name', allowRegistration: 'Allow Registration', welcomeMessage: 'Welcome Message',
    saveSettings: 'Save Settings', statistics: 'Statistics', newUsersToday: 'New Users Today',
    failedLogins24h: 'Failed Logins (24h)', mostActive: 'Most Active Users', recentActivity: 'Recent Activity',
    exportUsers: 'Export Users', refresh: 'Refresh', transfer: 'Transfer', transferTo: 'Transfer to',
    totalVisitors: 'Total Visitors', visitorsToday: 'Visitors Today',
    changePassword: 'Change Password', newPassword: 'New Password', editorActions: 'Editor Actions',
    slideChanges: 'Slide Changes', templateUsage: 'Template Usage', changeType: 'Change Type',
    elementType: 'Element Type', oldValue: 'Old Value', newValue: 'New Value', templateName: 'Template Name',
    noChanges: 'No changes found', noTemplates: 'No template usage found',
    notifications: 'Notifications', supportTickets: 'Support Tickets', openTickets: 'Open Tickets',
    communityTemplates: 'Community Templates', pendingTemplates: 'Pending', approvedTemplates: 'Approved',
    rejectedTemplates: 'Rejected', approveTemplate: 'Approve', rejectTemplate: 'Reject',
    templateAuthor: 'Author', templateDownloads: 'Downloads', templateLikes: 'Likes',
    makeFeatured: 'Make Featured', removeFeatured: 'Remove Featured', noTemplatesFound: 'No templates found',
    sendNotification: 'Send Notification', notificationTitle: 'Title', notificationContent: 'Content',
    notificationType: 'Type', info: 'Info', warning: 'Warning', urgent: 'Urgent',
    targetUser: 'Target User', allUsers: 'All Users', send: 'Send', ticketStatus: 'Status',
    new: 'New', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
    priority: 'Priority', low: 'Low', medium: 'Medium', high: 'High', reply: 'Reply',
    noTickets: 'No tickets found', viewTicket: 'View Ticket', closeTicket: 'Close Ticket',
    dailyTips: 'Daily Tips & Features', selectTip: 'Select a tip or feature',
    // Settings
    generalSettings: 'General Settings', securitySettings: 'Security Settings', 
    appearanceSettings: 'Appearance', maintenanceSettings: 'Maintenance',
    siteDescription: 'Site Description', maxPresentationsPerUser: 'Max Presentations per User',
    maxSlidesPerPresentation: 'Max Slides per Presentation', sessionTimeout: 'Session Timeout (days)',
    maxLoginAttempts: 'Max Login Attempts', lockoutDuration: 'Lockout Duration (minutes)',
    requireEmailVerification: 'Require Email Verification', primaryColor: 'Primary Color',
    enableDarkMode: 'Enable Dark Mode', logoUrl: 'Logo URL', maintenanceMode: 'Maintenance Mode',
    maintenanceMessage: 'Maintenance Message', backupDatabase: 'Backup Database',
    clearOldLogs: 'Clear Old Logs', logsRetentionDays: 'Logs Retention (days)',
    unlimited: 'Unlimited', minutes: 'minutes', days: 'days', enabled: 'Enabled', disabled: 'Disabled',
    dangerZone: 'Danger Zone', resetAllSettings: 'Reset All Settings', exportSettings: 'Export Settings',
    importSettings: 'Import Settings', lastBackup: 'Last Backup', never: 'Never',
    settingsSaved: 'Settings saved successfully', backupCreated: 'Backup created successfully',
    logsCleared: 'Old logs cleared successfully',
    // Usage Limits
    usageLimits: 'Usage Limits', filesStorage: 'Files & Storage', exportLimits: 'Export Limits',
    templateLimits: 'Template Limits', editorLimits: 'Editor Limits', rateLimits: 'Rate & Time Limits',
    maxFileSize: 'Max File Size (MB)', maxStorage: 'Max Storage per User (MB)',
    allowedFileTypes: 'Allowed File Types', maxExportsPerDay: 'Max Exports per Day',
    allowedExportFormats: 'Allowed Export Formats', exportQuality: 'Export Quality',
    maxTemplates: 'Max Templates per User', allowCustomTemplates: 'Allow Custom Templates',
    maxElementsPerSlide: 'Max Elements per Slide', enableAnimations: 'Enable Animations',
    rateLimitPerMinute: 'Rate Limit (requests/min)', inactivityTimeout: 'Inactivity Timeout (min)',
    qualityHigh: 'High', qualityMedium: 'Medium', qualityLow: 'Low',
  },
  ar: {
    dashboard: 'لوحة التحكم', editor: 'المحرر', totalUsers: 'إجمالي المستخدمين', admins: 'المسؤولين',
    users: 'المستخدمين', usersManagement: 'المستخدمين', manageAllUsers: 'إدارة جميع المستخدمين المسجلين',
    search: 'بحث...', admin: 'مسؤول', user: 'مستخدم', registered: 'تاريخ التسجيل',
    lastLogin: 'آخر دخول', neverLoggedIn: 'لم يسجل دخول', makeUser: 'تحويل لمستخدم',
    makeAdmin: 'تحويل لمسؤول', deleteUser: 'حذف المستخدم', deleteUserConfirm: 'حذف المستخدم',
    deleteUserDesc: 'هل أنت متأكد من حذف المستخدم', cannotUndo: 'لا يمكن التراجع عن هذا الإجراء.',
    cancel: 'إلغاء', delete: 'حذف', noUsers: 'لا يوجد مستخدمين', password: 'كلمة المرور',
    showPassword: 'إظهار كلمة المرور', hidePassword: 'إخفاء كلمة المرور', addUser: 'إضافة مستخدم',
    username: 'اسم المستخدم', email: 'البريد الإلكتروني', role: 'الصلاحية', save: 'حفظ',
    active: 'نشط', inactive: 'معطل', activate: 'تفعيل', deactivate: 'تعطيل', editUser: 'تعديل المستخدم',
    presentations: 'العروض التقديمية', title: 'العنوان', slides: 'الشرائح', owner: 'المالك',
    createdAt: 'تاريخ الإنشاء', updatedAt: 'آخر تحديث', deletePresentation: 'حذف العرض',
    noPresentations: 'لا يوجد عروض', activityLogs: 'سجل النشاط', action: 'الإجراء',
    actions: 'الإجراءات', status: 'الحالة', confirmDelete: 'تأكيد الحذف', deleteUserWarning: 'هذا الإجراء لا يمكن التراجع عنه.',
    details: 'التفاصيل', ipAddress: 'عنوان IP', time: 'الوقت', noLogs: 'لا يوجد سجلات',
    loginAttempts: 'محاولات الدخول', success: 'ناجح', failed: 'فاشل', settings: 'الإعدادات',
    siteName: 'اسم الموقع', allowRegistration: 'السماح بالتسجيل', welcomeMessage: 'رسالة الترحيب',
    saveSettings: 'حفظ الإعدادات', statistics: 'الإحصائيات', newUsersToday: 'مستخدمين جدد اليوم',
    failedLogins24h: 'محاولات فاشلة (24 ساعة)', mostActive: 'الأكثر نشاطاً', recentActivity: 'النشاط الأخير',
    exportUsers: 'تصدير المستخدمين', refresh: 'تحديث', transfer: 'نقل', transferTo: 'نقل إلى',
    totalVisitors: 'إجمالي الزوار', visitorsToday: 'زوار اليوم',
    changePassword: 'تغيير كلمة المرور', newPassword: 'كلمة المرور الجديدة', editorActions: 'أنشطة المحرر',
    slideChanges: 'تغييرات الشرائح', templateUsage: 'استخدام القوالب', changeType: 'نوع التغيير',
    elementType: 'نوع العنصر', oldValue: 'القيمة القديمة', newValue: 'القيمة الجديدة', templateName: 'اسم القالب',
    noChanges: 'لا يوجد تغييرات', noTemplates: 'لا يوجد استخدام للقوالب',
    notifications: 'الإشعارات', supportTickets: 'تذاكر الدعم', openTickets: 'التذاكر المفتوحة',
    communityTemplates: 'قوالب المجتمع', pendingTemplates: 'قيد المراجعة', approvedTemplates: 'موافق عليها',
    rejectedTemplates: 'مرفوضة', approveTemplate: 'موافقة', rejectTemplate: 'رفض',
    templateAuthor: 'المؤلف', templateDownloads: 'التحميلات', templateLikes: 'الإعجابات',
    makeFeatured: 'تمييز', removeFeatured: 'إلغاء التمييز', noTemplatesFound: 'لا توجد قوالب',
    sendNotification: 'إرسال إشعار', notificationTitle: 'العنوان', notificationContent: 'المحتوى',
    notificationType: 'النوع', info: 'معلومات', warning: 'تحذير', urgent: 'عاجل',
    targetUser: 'المستخدم المستهدف', allUsers: 'كل المستخدمين', send: 'إرسال', ticketStatus: 'الحالة',
    new: 'جديدة', in_progress: 'قيد المراجعة', resolved: 'تم الحل', closed: 'مغلقة',
    priority: 'الأولوية', low: 'منخفضة', medium: 'متوسطة', high: 'عالية', reply: 'رد',
    noTickets: 'لا يوجد تذاكر', viewTicket: 'عرض التذكرة', closeTicket: 'إغلاق التذكرة',
    dailyTips: 'النصائح والميزات اليومية', selectTip: 'اختر نصيحة أو ميزة',
    // Settings
    generalSettings: 'الإعدادات العامة', securitySettings: 'إعدادات الأمان',
    appearanceSettings: 'المظهر', maintenanceSettings: 'الصيانة',
    siteDescription: 'وصف الموقع', maxPresentationsPerUser: 'الحد الأقصى للعروض لكل مستخدم',
    maxSlidesPerPresentation: 'الحد الأقصى للشرائح لكل عرض', sessionTimeout: 'مدة الجلسة (أيام)',
    maxLoginAttempts: 'الحد الأقصى لمحاولات الدخول', lockoutDuration: 'مدة الحظر (دقائق)',
    requireEmailVerification: 'تفعيل التحقق من البريد', primaryColor: 'اللون الرئيسي',
    enableDarkMode: 'تفعيل الوضع الداكن', logoUrl: 'رابط الشعار', maintenanceMode: 'وضع الصيانة',
    maintenanceMessage: 'رسالة الصيانة', backupDatabase: 'نسخ احتياطي للقاعدة',
    clearOldLogs: 'حذف السجلات القديمة', logsRetentionDays: 'مدة الاحتفاظ بالسجلات (أيام)',
    unlimited: 'غير محدود', minutes: 'دقائق', days: 'أيام', enabled: 'مفعل', disabled: 'معطل',
    dangerZone: 'منطقة الخطر', resetAllSettings: 'إعادة تعيين الإعدادات', exportSettings: 'تصدير الإعدادات',
    importSettings: 'استيراد الإعدادات', lastBackup: 'آخر نسخة احتياطية', never: 'أبداً',
    settingsSaved: 'تم حفظ الإعدادات بنجاح', backupCreated: 'تم إنشاء النسخة الاحتياطية',
    logsCleared: 'تم حذف السجلات القديمة بنجاح',
    // Usage Limits
    usageLimits: 'حدود الاستخدام', filesStorage: 'الملفات والتخزين', exportLimits: 'حدود التصدير',
    templateLimits: 'حدود القوالب', editorLimits: 'حدود المحرر', rateLimits: 'حدود الوقت والطلبات',
    maxFileSize: 'الحد الأقصى لحجم الملف (MB)', maxStorage: 'الحد الأقصى للتخزين لكل مستخدم (MB)',
    allowedFileTypes: 'أنواع الملفات المسموحة', maxExportsPerDay: 'الحد الأقصى للتصدير يومياً',
    allowedExportFormats: 'صيغ التصدير المسموحة', exportQuality: 'جودة التصدير',
    maxTemplates: 'الحد الأقصى للقوالب لكل مستخدم', allowCustomTemplates: 'السماح بالقوالب المخصصة',
    maxElementsPerSlide: 'الحد الأقصى للعناصر في الشريحة', enableAnimations: 'تفعيل الأنيميشن',
    rateLimitPerMinute: 'حد الطلبات (طلب/دقيقة)', inactivityTimeout: 'مهلة عدم النشاط (دقيقة)',
    qualityHigh: 'عالية', qualityMedium: 'متوسطة', qualityLow: 'منخفضة',
  }
};

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [editorActions, setEditorActions] = useState<EditorAction[]>([]);
  const [slideChanges, setSlideChanges] = useState<SlideChange[]>([]);
  const [templateUsage, setTemplateUsage] = useState<TemplateUsage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<any[]>([]);
  const [templateFilter, setTemplateFilter] = useState('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState('users');
  
  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', email: '', role: 'user' });
  const [editPassword, setEditPassword] = useState('');
  const [newNotification, setNewNotification] = useState({ title: '', content: '', type: 'info', targetUserId: 'all' });
  const [ticketReply, setTicketReply] = useState('');
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});
  
  const { user, token, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const t = translations[language as keyof typeof translations] || translations.ar;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'admin') { navigate('/editor'); return; }
    loadAllData();
  }, [user]);

  useEffect(() => {
    if (token) fetchCommunityTemplates();
  }, [templateFilter]);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([fetchUsers(), fetchStats(), fetchPresentations(), fetchLogs(), fetchLoginAttempts(), fetchEditorActions(), fetchSlideChanges(), fetchTemplateUsage(), fetchSettings(), fetchNotifications(), fetchTickets(), fetchCommunityTemplates()]);
    setIsLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchPresentations = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/presentations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPresentations(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLogs(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchLoginAttempts = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/login-attempts`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLoginAttempts(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchEditorActions = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/editor-actions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEditorActions(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchSlideChanges = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/slide-changes`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSlideChanges(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTemplateUsage = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/template-usage`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTemplateUsage(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setNotifications(await res.json());
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch notifications:', res.status, errorData);
      }
    } catch (e) { 
      console.error('Error fetching notifications:', e); 
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTickets(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchCommunityTemplates = async () => {
    try {
      const params = templateFilter !== 'all' ? `?status=${templateFilter}` : '';
      const res = await fetch(`${API_URL}/admin/community-templates${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCommunityTemplates(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTicketDetail = async (ticketId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/tickets/${ticketId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data.ticket);
        setTicketReplies(data.replies);
      }
    } catch (e) { console.error(e); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSettings(await res.json());
    } catch (e) { console.error(e); }
  };

  const addUser = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم الإضافة' : 'Added' });
        setAddUserOpen(false);
        setNewUser({ username: '', password: '', email: '', role: 'user' });
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: err.error, variant: 'destructive' });
      }
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const updateUser = async (userId: number, updates: any) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم التحديث' : 'Updated' });
        fetchUsers();
      }
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const deleteUser = async (userId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم الحذف بنجاح' : 'User deleted successfully' });
        // Refresh the users list
        await fetchUsers();
      } else {
        toast({ 
          title: language === 'ar' ? 'فشل الحذف' : 'Delete failed', 
          description: data.error || 'Unknown error',
          variant: 'destructive' 
        });
      }
    } catch (e) { 
      console.error('Error deleting user:', e);
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' }); 
    }
  };

  const deletePresentation = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/presentations/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
        fetchPresentations();
      }
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const saveSettings = async (settingsToSave?: Record<string, string>, sectionKey?: string) => {
    if (sectionKey) {
      setSavingStates(prev => ({ ...prev, [sectionKey]: true }));
      setSavedStates(prev => ({ ...prev, [sectionKey]: false }));
    }
    
    try {
      const res = await fetch(`${API_URL}/admin/settings`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave || settings)
      });
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully' });
        if (sectionKey) {
          setSavedStates(prev => ({ ...prev, [sectionKey]: true }));
          setTimeout(() => {
            setSavedStates(prev => ({ ...prev, [sectionKey]: false }));
          }, 2000);
        }
      }
    } catch (e) { 
      toast({ title: 'Error', variant: 'destructive' }); 
    } finally {
      if (sectionKey) {
        setSavingStates(prev => ({ ...prev, [sectionKey]: false }));
      }
    }
  };

  const exportUsers = () => {
    window.open(`${API_URL}/admin/export/users?token=${token}`, '_blank');
  };

  const sendNotification = async () => {
    if (!newNotification.title || !newNotification.content) return;
    try {
      const res = await fetch(`${API_URL}/admin/notifications`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newNotification,
          target_user_id: newNotification.targetUserId && newNotification.targetUserId !== 'all' ? parseInt(newNotification.targetUserId) : null
        })
      });
      if (res.ok) {
        toast({ title: language === 'ar' ? 'تم الإرسال' : 'Sent' });
        setNewNotification({ title: '', content: '', type: 'info', targetUserId: 'all' });
        fetchNotifications();
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to send notification:', res.status, errorData);
        toast({ title: language === 'ar' ? 'فشل الإرسال' : 'Failed to send', description: errorData.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) { 
      console.error('Error sending notification:', e);
      toast({ title: 'Error', variant: 'destructive' }); 
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await fetch(`${API_URL}/admin/notifications/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) { console.error(e); }
  };

  const updateTicketStatus = async (ticketId: number, status: string) => {
    try {
      await fetch(`${API_URL}/admin/tickets/${ticketId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      toast({ title: language === 'ar' ? 'تم التحديث' : 'Updated' });
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const replyToTicket = async () => {
    if (!ticketReply || !selectedTicket) return;
    try {
      await fetch(`${API_URL}/admin/tickets/${selectedTicket.id}/reply`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: ticketReply })
      });
      toast({ title: language === 'ar' ? 'تم الإرسال' : 'Sent' });
      setTicketReply('');
      fetchTicketDetail(selectedTicket.id);
      fetchTickets();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  // Community Templates Management
  const updateTemplateStatus = async (templateId: number, status: string) => {
    try {
      await fetch(`${API_URL}/admin/community-templates/${templateId}/status`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      toast({ title: language === 'ar' ? 'تم التحديث' : 'Updated' });
      fetchCommunityTemplates();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const toggleTemplateFeatured = async (templateId: number, isFeatured: boolean) => {
    try {
      await fetch(`${API_URL}/admin/community-templates/${templateId}/featured`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !isFeatured })
      });
      toast({ title: language === 'ar' ? 'تم التحديث' : 'Updated' });
      fetchCommunityTemplates();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const deleteCommunityTemplate = async (templateId: number) => {
    try {
      await fetch(`${API_URL}/admin/community-templates/${templateId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
      fetchCommunityTemplates();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t.neverLoggedIn;
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Presentation className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-xl font-bold text-white">SlideUP</span>
              </Link>
              <div className="h-6 w-px bg-slate-700" />
              <h1 className="text-lg font-medium text-slate-300">{t.dashboard}</h1>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="admin" />
              <Button variant="ghost" size="sm" onClick={loadAllData} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Link to="/editor">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
                  <ArrowLeft className={`w-4 h-4 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />{t.editor}
                </Button>
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-slate-300">{user?.username}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-white hover:bg-slate-800">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.totalUsers}</p><p className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.admins}</p><p className="text-2xl font-bold text-white">{stats?.admins || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-amber-400" /></div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.presentations}</p><p className="text-2xl font-bold text-white">{stats?.totalPresentations || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-violet-500/10 flex items-center justify-center"><FileText className="w-5 h-5 text-violet-400" /></div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.totalVisitors}</p><p className="text-2xl font-bold text-white">{stats?.totalVisitors || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Globe className="w-5 h-5 text-cyan-400" /></div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.failedLogins24h}</p><p className="text-2xl font-bold text-white">{stats?.failedAttempts || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-red-500/10 flex items-center justify-center"><Ban className="w-5 h-5 text-red-400" /></div>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm mb-1">{t.openTickets}</p><p className="text-2xl font-bold text-white">{stats?.openTickets || 0}</p></div>
              <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-emerald-400" /></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="bg-slate-800 border border-slate-700 p-1 flex-wrap">
              <TabsTrigger value="users" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><Users className="w-4 h-4 mr-2" />{t.users}</TabsTrigger>
              <TabsTrigger value="presentations" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><FileText className="w-4 h-4 mr-2" />{t.presentations}</TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><Layout className="w-4 h-4 mr-2" />{t.communityTemplates}</TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><Activity className="w-4 h-4 mr-2" />{t.activityLogs}</TabsTrigger>
              <TabsTrigger value="notifications" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><Bell className="w-4 h-4 mr-2" />{t.notifications}</TabsTrigger>
              <TabsTrigger value="support" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><MessageCircle className="w-4 h-4 mr-2" />{t.supportTickets}</TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700 text-slate-400 data-[state=active]:text-white"><Settings className="w-4 h-4 mr-2" />{t.settings}</TabsTrigger>
            </TabsList>
          </div>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t.usersManagement}</h2>
                  <p className="text-slate-400 text-sm">{t.manageAllUsers}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500`} />
                    <Input placeholder={t.search} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-56 ${language === 'ar' ? 'pr-10' : 'pl-10'} bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 rounded-lg h-9 text-sm`} />
                  </div>
                  <Button onClick={exportUsers} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-9">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-9">
                        <UserPlus className="w-4 h-4 mr-2" />{t.addUser}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-600">
                      <DialogHeader><DialogTitle className="text-white">{t.addUser}</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div><Label className="text-slate-300">{t.username}</Label><Input value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
                        <div><Label className="text-slate-300">{t.password}</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
                        <div><Label className="text-slate-300">{t.email}</Label><Input value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="bg-slate-700 border-slate-600 text-white mt-1" /></div>
                        <div><Label className="text-slate-300">{t.role}</Label>
                          <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="user">{t.user}</SelectItem><SelectItem value="admin">{t.admin}</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter><Button onClick={addUser} className="bg-blue-600 hover:bg-blue-700">{t.save}</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 bg-slate-700/30 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <div className="col-span-3">{t.username}</div>
                <div className="col-span-2">{language === 'ar' ? 'الجهاز' : 'Device'}</div>
                <div className="col-span-2">{language === 'ar' ? 'الإحصائيات' : 'Stats'}</div>
                <div className="col-span-2">{t.password}</div>
                <div className="col-span-2">{t.role}</div>
                <div className="col-span-1"></div>
              </div>

              {/* Users List */}
              <div className="divide-y divide-slate-700/50">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-5 py-4 hover:bg-slate-700/20 transition-colors items-center">
                    {/* User Info */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-300'}`}>
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{u.username}</span>
                          {!u.is_active && <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">{t.inactive}</span>}
                        </div>
                        {u.email && <p className="text-slate-500 text-xs">{u.email}</p>}
                        {u.last_ip && <p className="text-slate-600 text-[10px] flex items-center gap-1"><Globe className="w-3 h-3" />{u.last_ip}</p>}
                      </div>
                    </div>
                    
                    {/* Device Info */}
                    <div className="col-span-2">
                      {u.os && u.os !== 'Unknown' ? (
                        <div className="space-y-0.5">
                          <p className="text-slate-400 text-xs">{u.os} • {u.browser}</p>
                          <p className="text-slate-500 text-[10px]">{u.device_type}</p>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </div>
                    
                    {/* Stats */}
                    <div className="col-span-2">
                      <div className="space-y-0.5">
                        <p className="text-slate-400 text-xs">{u.presentation_count || 0} {language === 'ar' ? 'عرض' : 'presentations'}</p>
                        <p className="text-slate-500 text-[10px]">{u.login_count || 0} {language === 'ar' ? 'دخول' : 'logins'}</p>
                      </div>
                    </div>
                    
                    {/* Password */}
                    <div className="col-span-2 flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <code className="text-amber-400 text-sm bg-amber-500/10 px-2 py-1 rounded flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          {language === 'ar' ? 'مشفر' : 'Encrypted'}
                        </code>
                      ) : (
                        <>
                          <code className="text-slate-400 text-sm bg-slate-700/50 px-2 py-1 rounded">
                            {showPasswords[u.id] ? (u.plain_password || '---') : '••••••'}
                          </code>
                          <button onClick={() => setShowPasswords(p => ({...p, [u.id]: !p[u.id]}))} className="text-slate-500 hover:text-slate-300">
                            {showPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Role */}
                    <div className="col-span-2">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                          <Crown className="w-3 h-3" />{t.admin}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-slate-600/50 text-slate-400 rounded-full">{t.user}</span>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-1 flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700" disabled={u.id === user?.id}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem onClick={() => { setEditingUser(u); setEditPassword(''); setEditUserOpen(true); }} className="text-slate-300 focus:text-white focus:bg-slate-700"><Edit className="w-4 h-4 mr-2" />{t.editUser}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateUser(u.id, { is_active: !u.is_active })} className="text-slate-300 focus:text-white focus:bg-slate-700">{u.is_active ? <><Ban className="w-4 h-4 mr-2" />{t.deactivate}</> : <><Check className="w-4 h-4 mr-2" />{t.activate}</>}</DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-400 focus:text-red-400 focus:bg-red-500/10"><Trash2 className="w-4 h-4 mr-2" />{t.deleteUser}</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-800 border-slate-700">
                              <AlertDialogHeader><AlertDialogTitle className="text-white">{t.deleteUserConfirm}</AlertDialogTitle><AlertDialogDescription className="text-slate-400">{t.deleteUserDesc} "{u.username}"? {t.cannotUndo}</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel className="bg-slate-700 text-white border-slate-700 hover:bg-white/20">{t.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => deleteUser(u.id)} className="bg-red-500 hover:bg-red-600">{t.delete}</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">{t.noUsers}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Presentations Tab */}
          <TabsContent value="presentations">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.presentations}</h2></div>
              <div className="divide-y divide-slate-700">
                {presentations.map((p) => (
                  <div key={p.id} className="p-4 hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center"><FileText className="w-6 h-6 text-white" /></div>
                      <div>
                        <p className="font-medium text-white">{p.title}</p>
                        <div className="flex items-center gap-4 mt-1 text-slate-500 text-sm">
                          <span>{t.owner}: {p.username}</span>
                          <span>{t.slides}: {p.slide_count}</span>
                          <span>{formatDate(p.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        onClick={() => navigate(`/editor?id=${p.id}`)}
                        title={language === 'ar' ? 'عرض' : 'View'}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-800 border-slate-700">
                          <AlertDialogHeader><AlertDialogTitle className="text-white">{t.deletePresentation}</AlertDialogTitle><AlertDialogDescription className="text-slate-400">{t.cannotUndo}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel className="bg-slate-700 text-white border-slate-700">{t.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => deletePresentation(p.id)} className="bg-red-500 hover:bg-red-600">{t.delete}</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {presentations.length === 0 && <div className="p-12 text-center"><FileText className="w-12 h-12 text-white/20 mx-auto mb-4" /><p className="text-slate-500">{t.noPresentations}</p></div>}
              </div>
            </div>
          </TabsContent>

          {/* Community Templates Tab */}
          <TabsContent value="templates">
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{t.communityTemplates}</h2>
                  <p className="text-slate-400 text-sm">{language === 'ar' ? 'إدارة القوالب المرفوعة من المستخدمين' : 'Manage user-uploaded templates'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={templateFilter} 
                    onChange={(e) => setTemplateFilter(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">{language === 'ar' ? 'الكل' : 'All'}</option>
                    <option value="pending">{t.pendingTemplates}</option>
                    <option value="approved">{t.approvedTemplates}</option>
                    <option value="rejected">{t.rejectedTemplates}</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={fetchCommunityTemplates}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {communityTemplates.length === 0 ? (
                <div className="p-12 text-center text-slate-400">{t.noTemplatesFound}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{t.templateName}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{t.templateAuthor}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{language === 'ar' ? 'التصنيف' : 'Category'}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">{t.templateDownloads}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">{t.templateLikes}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">{t.status}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {communityTemplates.map((template: any) => (
                        <tr key={template.id} className="hover:bg-slate-700/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-8 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded flex items-center justify-center text-lg font-bold text-purple-300">
                                {template.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-medium text-white flex items-center gap-2">
                                  {template.name}
                                  {template.is_featured === 1 && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                                </div>
                                <div className="text-xs text-slate-400">{template.slide_count} {language === 'ar' ? 'شريحة' : 'slides'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{template.author_username || template.username}</td>
                          <td className="px-4 py-3 text-slate-300">{template.category}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="flex items-center justify-center gap-1 text-slate-300">
                              <Download className="w-3 h-3" /> {template.downloads}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="flex items-center justify-center gap-1 text-slate-300">
                              <Heart className="w-3 h-3" /> {template.likes || template.like_count || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {template.status === 'approved' && (
                              <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />{t.approvedTemplates}</Badge>
                            )}
                            {template.status === 'pending' && (
                              <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />{t.pendingTemplates}</Badge>
                            )}
                            {template.status === 'rejected' && (
                              <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />{t.rejectedTemplates}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {template.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-500/10" onClick={() => updateTemplateStatus(template.id, 'approved')}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => updateTemplateStatus(template.id, 'rejected')}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {template.status === 'approved' && (
                                <Button size="sm" variant="ghost" className={template.is_featured ? "text-yellow-400" : "text-slate-400"} onClick={() => toggleTemplateFeatured(template.id, template.is_featured)}>
                                  <Star className={`w-4 h-4 ${template.is_featured ? 'fill-yellow-400' : ''}`} />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-800 border-slate-700">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-white">{t.confirmDelete}</AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-400">{t.deleteUserWarning}</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">{t.cancel}</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteCommunityTemplate(template.id)}>{t.delete}</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <div className="space-y-6">
              {/* First Row - Activity Logs, Login Attempts, Editor Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Logs */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.activityLogs}</h2></div>
                  <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{log.username}</p>
                            <p className="text-slate-400 text-sm">{log.action} {log.details && `- ${log.details}`}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-500 text-xs">{formatDateTime(log.created_at)}</p>
                            {log.ip_address && <p className="text-white/30 text-xs">{log.ip_address}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {logs.length === 0 && <div className="p-8 text-center text-slate-500">{t.noLogs}</div>}
                  </div>
                </div>
                {/* Login Attempts */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.loginAttempts}</h2></div>
                  <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                    {loginAttempts.map((attempt) => (
                      <div key={attempt.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${attempt.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            {attempt.success ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-red-400" />}
                          </div>
                          <div>
                            <p className="text-white font-medium">{attempt.username}</p>
                            <p className="text-slate-500 text-xs">{attempt.ip_address}</p>
                          </div>
                        </div>
                        <p className="text-slate-500 text-xs">{formatDateTime(attempt.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Editor Actions */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.editorActions}</h2></div>
                  <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                    {editorActions.map((action) => (
                      <div key={action.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{action.username}</p>
                            <p className="text-slate-400 text-sm">{action.action_type} {action.action_details && `- ${action.action_details}`}</p>
                          </div>
                          <p className="text-slate-500 text-xs">{formatDateTime(action.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {editorActions.length === 0 && <div className="p-8 text-center text-slate-500">{t.noLogs}</div>}
                  </div>
                </div>
              </div>

              {/* Second Row - Slide Changes and Template Usage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Slide Changes */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.slideChanges}</h2></div>
                  <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                    {slideChanges.map((change) => (
                      <div key={change.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{change.username}</p>
                            <p className="text-slate-400 text-sm">
                              <span className="text-violet-400">{change.change_type}</span>
                              {change.element_type && <span className="text-slate-500"> • {change.element_type}</span>}
                            </p>
                            {change.new_value && (
                              <p className="text-slate-500 text-xs mt-1 truncate max-w-xs">
                                {(() => { try { return JSON.stringify(JSON.parse(change.new_value)).slice(0, 50); } catch { return change.new_value.slice(0, 50); } })()}...
                              </p>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs">{formatDateTime(change.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {slideChanges.length === 0 && <div className="p-8 text-center text-slate-500">{t.noChanges}</div>}
                  </div>
                </div>
                {/* Template Usage */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.templateUsage}</h2></div>
                  <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                    {templateUsage.map((template) => (
                      <div key={template.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{template.username}</p>
                            <p className="text-slate-400 text-sm">
                              <span className="text-amber-400">{template.action}</span>
                              {template.template_name && <span className="text-slate-500"> • {template.template_name}</span>}
                            </p>
                          </div>
                          <p className="text-slate-500 text-xs">{formatDateTime(template.created_at)}</p>
                        </div>
                      </div>
                    ))}
                    {templateUsage.length === 0 && <div className="p-8 text-center text-slate-500">{t.noTemplates}</div>}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Send Notification */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  {t.sendNotification}
                </h2>
                <div className="space-y-4">
                  {/* Daily Tips Selector */}
                  <div>
                    <Label className="text-slate-300 flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      {t.dailyTips}
                    </Label>
                    <Select 
                      value="" 
                      onValueChange={(value) => {
                        const tip = dailyTips.find(t => t.id.toString() === value);
                        if (tip) {
                          setNewNotification({
                            ...newNotification,
                            title: language === 'ar' ? tip.title_ar : tip.title_en,
                            content: language === 'ar' ? tip.content_ar : tip.content_en,
                            type: 'info'
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-white hover:border-amber-500/50 transition-all">
                        <SelectValue placeholder={t.selectTip} />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {dailyTips.map((tip) => (
                          <SelectItem key={tip.id} value={tip.id.toString()}>
                            <div className="flex items-start gap-2 py-1">
                              {tip.type === 'tip' ? (
                                <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">
                                  {language === 'ar' ? tip.title_ar : tip.title_en}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {language === 'ar' ? tip.content_ar : tip.content_en}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-lg -z-10" />
                    <div className="space-y-4 p-4 border border-slate-700/50 rounded-lg">
                      <div>
                        <Label className="text-slate-300">{t.notificationTitle}</Label>
                        <Input 
                          value={newNotification.title} 
                          onChange={e => setNewNotification({...newNotification, title: e.target.value})} 
                          className="bg-slate-800/50 border-slate-700 text-white mt-1" 
                          placeholder="مثال: 💡 نصيحة اليوم"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-300">{t.notificationContent}</Label>
                        <Textarea 
                          value={newNotification.content} 
                          onChange={e => setNewNotification({...newNotification, content: e.target.value})} 
                          className="bg-slate-800/50 border-slate-700 text-white mt-1 min-h-24" 
                          placeholder="اكتب محتوى الإشعار هنا..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">{t.notificationType}</Label>
                      <Select value={newNotification.type} onValueChange={v => setNewNotification({...newNotification, type: v})}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info"><div className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-400" />{t.info}</div></SelectItem>
                          <SelectItem value="warning"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" />{t.warning}</div></SelectItem>
                          <SelectItem value="success"><div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" />Success</div></SelectItem>
                          <SelectItem value="urgent"><div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-400" />{t.urgent}</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300">{t.targetUser}</Label>
                      <Select value={newNotification.targetUserId} onValueChange={v => setNewNotification({...newNotification, targetUserId: v})}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white mt-1"><SelectValue placeholder={t.allUsers} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {t.allUsers}
                            </div>
                          </SelectItem>
                          {users.filter(u => u.role !== 'admin').map(u => (
                            <SelectItem key={u.id} value={u.id.toString()}>{u.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={sendNotification} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/20">
                    <Send className="w-4 h-4 mr-2" />{t.send}
                  </Button>
                </div>
              </div>
              {/* Sent Notifications */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.notifications}</h2></div>
                <div className="divide-y divide-slate-700 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                  {notifications.map(n => (
                    <div key={n.id} className="p-4 hover:bg-slate-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {n.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                            {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                            {n.type === 'success' && <Check className="w-4 h-4 text-green-400" />}
                            {n.type === 'urgent' && <AlertCircle className="w-4 h-4 text-red-400" />}
                            <span className="font-medium text-white">{n.title}</span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">{n.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                            <span>{formatDateTime(n.created_at)}</span>
                            <span>{n.target_user_id ? `→ User #${n.target_user_id}` : t.allUsers}</span>
                            <span>{n.read_count} read</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteNotification(n.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && <div className="p-8 text-center text-slate-500">{t.noLogs}</div>}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Support Tickets Tab */}
          <TabsContent value="support">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tickets List */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700"><h2 className="text-xl font-bold text-white">{t.supportTickets}</h2></div>
                <div className="divide-y divide-slate-700 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                  {tickets.map(ticket => (
                    <div key={ticket.id} onClick={() => fetchTicketDetail(ticket.id)} className={`p-4 hover:bg-slate-800/50 cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-slate-700' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{ticket.title}</span>
                            <Badge className={ticket.status === 'new' ? 'bg-blue-500/20 text-blue-400' : ticket.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : ticket.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                              {t[ticket.status as keyof typeof t]}
                            </Badge>
                          </div>
                          <p className="text-slate-400 text-sm mt-1 truncate">{ticket.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-slate-500 text-xs">
                            <span>{ticket.username}</span>
                            <span className={ticket.priority === 'urgent' ? 'text-red-400' : ticket.priority === 'high' ? 'text-amber-400' : ''}>{t[ticket.priority as keyof typeof t]}</span>
                            <span>{formatDateTime(ticket.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && <div className="p-8 text-center text-slate-500">{t.noTickets}</div>}
                </div>
              </div>
              {/* Ticket Detail */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                {selectedTicket ? (
                  <>
                    <div className="p-6 border-b border-slate-700">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-white">{selectedTicket.title}</h2>
                          <p className="text-slate-400 text-sm mt-1">{selectedTicket.username} • {formatDateTime(selectedTicket.created_at)}</p>
                        </div>
                        <Select value={selectedTicket.status} onValueChange={v => updateTicketStatus(selectedTicket.id, v)}>
                          <SelectTrigger className="w-32 bg-slate-800/50 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">{t.new}</SelectItem>
                            <SelectItem value="in_progress">{t.in_progress}</SelectItem>
                            <SelectItem value="resolved">{t.resolved}</SelectItem>
                            <SelectItem value="closed">{t.closed}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-800/50 border-b border-slate-700">
                      <p className="text-slate-300">{selectedTicket.description}</p>
                    </div>
                    <div className="p-4 space-y-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
                      {ticketReplies.map(reply => (
                        <div key={reply.id} className={`p-3 rounded-xl ${reply.is_admin ? 'bg-violet-500/10 mr-8' : 'bg-slate-800/50 ml-8'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${reply.is_admin ? 'text-violet-400' : 'text-slate-400'}`}>{reply.username}</span>
                            <span className="text-white/30 text-xs">{formatDateTime(reply.created_at)}</span>
                          </div>
                          <p className="text-slate-300 text-sm">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                    {selectedTicket.status !== 'closed' && (
                      <div className="p-4 border-t border-slate-700 flex gap-2">
                        <Input value={ticketReply} onChange={e => setTicketReply(e.target.value)} placeholder={t.reply + '...'} className="bg-slate-800/50 border-slate-700 text-white" onKeyDown={e => e.key === 'Enter' && replyToTicket()} />
                        <Button onClick={replyToTicket} className="bg-violet-600 hover:bg-violet-700"><Send className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t.viewTicket}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* General Settings */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.generalSettings}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.siteName}</Label>
                    <Input value={settings.site_name || ''} onChange={(e) => setSettings({...settings, site_name: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.welcomeMessage} (AR)</Label>
                    <Input value={settings.welcome_message || ''} onChange={(e) => setSettings({...settings, welcome_message: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.welcomeMessage} (EN)</Label>
                    <Input value={settings.welcome_message_en || ''} onChange={(e) => setSettings({...settings, welcome_message_en: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <Label className="text-slate-300 text-sm">{t.allowRegistration}</Label>
                    <Switch checked={settings.allow_registration !== 'false'} onCheckedChange={(checked) => setSettings({...settings, allow_registration: checked ? 'true' : 'false'})} />
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(59,130,246,0.5)] active:shadow-[0_0_0.2em_rgba(59,130,246,0.5)]">
                    <button 
                      onClick={() => saveSettings({ site_name: settings.site_name, welcome_message: settings.welcome_message, welcome_message_en: settings.welcome_message_en, allow_registration: settings.allow_registration }, 'general')} 
                      disabled={savingStates.general}
                      className="w-full h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.general ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.general ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.general ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.general ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Presentations & Slides Limits */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-violet-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.usageLimits}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxPresentationsPerUser}</Label>
                    <Input type="number" value={settings.max_presentations || '0'} onChange={(e) => setSettings({...settings, max_presentations: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    <p className="text-slate-500 text-[10px] mt-0.5">0 = {t.unlimited}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxSlidesPerPresentation}</Label>
                    <Input type="number" value={settings.max_slides || '0'} onChange={(e) => setSettings({...settings, max_slides: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxElementsPerSlide}</Label>
                    <Input type="number" value={settings.max_elements_per_slide || '0'} onChange={(e) => setSettings({...settings, max_elements_per_slide: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-violet-400 to-purple-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(139,92,246,0.5)] active:shadow-[0_0_0.2em_rgba(139,92,246,0.5)]">
                    <button 
                      onClick={() => saveSettings({ max_presentations: settings.max_presentations, max_slides: settings.max_slides, max_elements_per_slide: settings.max_elements_per_slide }, 'usage')} 
                      disabled={savingStates.usage}
                      className="w-full h-9 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.usage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.usage ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.usage ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.usage ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Files & Storage Limits */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.filesStorage}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxFileSize}</Label>
                    <Input type="number" value={settings.max_file_size_mb || '5'} onChange={(e) => setSettings({...settings, max_file_size_mb: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxStorage}</Label>
                    <Input type="number" value={settings.max_storage_mb || '0'} onChange={(e) => setSettings({...settings, max_storage_mb: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    <p className="text-slate-500 text-[10px] mt-0.5">0 = {t.unlimited}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.allowedFileTypes}</Label>
                    <Input value={settings.allowed_file_types || 'jpg,jpeg,png,gif,svg,webp'} onChange={(e) => setSettings({...settings, allowed_file_types: e.target.value})} placeholder="jpg,png,gif,svg" className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-emerald-400 to-green-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(16,185,129,0.5)] active:shadow-[0_0_0.2em_rgba(16,185,129,0.5)]">
                    <button 
                      onClick={() => saveSettings({ max_file_size_mb: settings.max_file_size_mb, max_storage_mb: settings.max_storage_mb, allowed_file_types: settings.allowed_file_types }, 'files')} 
                      disabled={savingStates.files}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.files ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.files ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.files ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.files ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Export Limits */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Presentation className="w-4 h-4 text-amber-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.exportLimits}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxExportsPerDay}</Label>
                    <Input type="number" value={settings.max_exports_per_day || '0'} onChange={(e) => setSettings({...settings, max_exports_per_day: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    <p className="text-slate-500 text-[10px] mt-0.5">0 = {t.unlimited}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.allowedExportFormats}</Label>
                    <Input value={settings.allowed_export_formats || 'pdf,pptx,png,jpg'} onChange={(e) => setSettings({...settings, allowed_export_formats: e.target.value})} placeholder="pdf,pptx,png,jpg" className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.exportQuality}</Label>
                    <Select value={settings.export_quality || 'high'} onValueChange={(v) => setSettings({...settings, export_quality: v})}>
                      <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">{t.qualityHigh}</SelectItem>
                        <SelectItem value="medium">{t.qualityMedium}</SelectItem>
                        <SelectItem value="low">{t.qualityLow}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-amber-400 to-orange-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(245,158,11,0.5)] active:shadow-[0_0_0.2em_rgba(245,158,11,0.5)]">
                    <button 
                      onClick={() => saveSettings({ max_exports_per_day: settings.max_exports_per_day, allowed_export_formats: settings.allowed_export_formats, export_quality: settings.export_quality }, 'export')} 
                      disabled={savingStates.export}
                      className="w-full h-9 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.export ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.export ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.export ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.export ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Template Limits */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-pink-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.templateLimits}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.maxTemplates}</Label>
                    <Input type="number" value={settings.max_templates_per_user || '0'} onChange={(e) => setSettings({...settings, max_templates_per_user: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    <p className="text-slate-500 text-[10px] mt-0.5">0 = {t.unlimited}</p>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <Label className="text-slate-300 text-sm">{t.allowCustomTemplates}</Label>
                    <Switch checked={settings.allow_custom_templates !== 'false'} onCheckedChange={(checked) => setSettings({...settings, allow_custom_templates: checked ? 'true' : 'false'})} />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <Label className="text-slate-300 text-sm">{language === 'ar' ? 'السماح برفع قوالب المجتمع' : 'Allow Community Templates'}</Label>
                    <Switch checked={settings.allow_community_templates !== 'false'} onCheckedChange={(checked) => setSettings({...settings, allow_community_templates: checked ? 'true' : 'false'})} />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <Label className="text-slate-300 text-sm">{language === 'ar' ? 'موافقة الإدارة على القوالب' : 'Require Template Approval'}</Label>
                    <Switch checked={settings.require_template_approval !== 'false'} onCheckedChange={(checked) => setSettings({...settings, require_template_approval: checked ? 'true' : 'false'})} />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg">
                    <Label className="text-slate-300 text-sm">{t.enableAnimations}</Label>
                    <Switch checked={settings.enable_animations !== 'false'} onCheckedChange={(checked) => setSettings({...settings, enable_animations: checked ? 'true' : 'false'})} />
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-pink-400 to-rose-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(236,72,153,0.5)] active:shadow-[0_0_0.2em_rgba(236,72,153,0.5)]">
                    <button 
                      onClick={() => saveSettings({ max_templates_per_user: settings.max_templates_per_user, allow_custom_templates: settings.allow_custom_templates, allow_community_templates: settings.allow_community_templates, require_template_approval: settings.require_template_approval, enable_animations: settings.enable_animations }, 'templates')} 
                      disabled={savingStates.templates}
                      className="w-full h-9 bg-pink-600 hover:bg-pink-700 disabled:bg-pink-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.templates ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.templates ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.templates ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.templates ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Rate & Time Limits */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-red-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.rateLimits}</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-slate-400 text-xs">{t.rateLimitPerMinute}</Label>
                    <Input type="number" value={settings.rate_limit_per_minute || '60'} onChange={(e) => setSettings({...settings, rate_limit_per_minute: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    <p className="text-slate-500 text-[10px] mt-0.5">0 = {t.unlimited}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.inactivityTimeout}</Label>
                    <Input type="number" value={settings.inactivity_timeout || '30'} onChange={(e) => setSettings({...settings, inactivity_timeout: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">{t.sessionTimeout}</Label>
                    <Input type="number" value={settings.session_timeout || '7'} onChange={(e) => setSettings({...settings, session_timeout: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                  </div>
                  <div className="relative w-full mt-2 p-[3px] bg-gradient-to-r from-red-400 to-red-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(239,68,68,0.5)] active:shadow-[0_0_0.2em_rgba(239,68,68,0.5)]">
                    <button 
                      onClick={() => saveSettings({ rate_limit_per_minute: settings.rate_limit_per_minute, inactivity_timeout: settings.inactivity_timeout, session_timeout: settings.session_timeout }, 'rate')} 
                      disabled={savingStates.rate}
                      className="w-full h-9 bg-red-600 hover:bg-red-700 disabled:bg-red-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.rate ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.rate ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.rate ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.rate ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>

              {/* Maintenance */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden lg:col-span-2 xl:col-span-3">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-white">{t.maintenanceSettings}</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <Label className="text-slate-300 text-sm">{t.maintenanceMode}</Label>
                        <p className="text-slate-500 text-xs">{language === 'ar' ? 'إيقاف الموقع مؤقتاً' : 'Temporarily disable site'}</p>
                      </div>
                      <Switch checked={settings.maintenance_mode === 'true'} onCheckedChange={(checked) => setSettings({...settings, maintenance_mode: checked ? 'true' : 'false'})} />
                    </div>
                    <div>
                      <Label className="text-slate-400 text-xs">{t.logsRetentionDays}</Label>
                      <Input type="number" value={settings.logs_retention || '30'} onChange={(e) => setSettings({...settings, logs_retention: e.target.value})} className="bg-slate-700/50 border-slate-600 text-white mt-1 h-9 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { window.open(`${API_URL}/admin/backup?token=${token}`, '_blank'); toast({ title: t.backupCreated }); }} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 h-9">
                        <Download className="w-3 h-3 mr-1" />{t.backupDatabase}
                      </Button>
                      <Button variant="outline" size="sm" onClick={async () => { await fetch(`${API_URL}/admin/clear-logs`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); toast({ title: t.logsCleared }); loadAllData(); }} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 h-9">
                        <Trash2 className="w-3 h-3 mr-1" />{t.clearOldLogs}
                      </Button>
                    </div>
                  </div>
                  <div className="relative w-full mt-4 p-[3px] bg-gradient-to-r from-slate-400 to-slate-600 rounded-xl transition-all duration-400 hover:shadow-[0_0_1.2em_rgba(100,116,139,0.5)] active:shadow-[0_0_0.2em_rgba(100,116,139,0.5)]">
                    <button 
                      onClick={() => saveSettings({ maintenance_mode: settings.maintenance_mode, logs_retention: settings.logs_retention }, 'maintenance')} 
                      disabled={savingStates.maintenance}
                      className="w-full h-9 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-[10px] text-sm font-medium cursor-pointer shadow-[2px_2px_3px_rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
                    >
                      {savingStates.maintenance ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : savedStates.maintenance ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {savingStates.maintenance ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : savedStates.maintenance ? (language === 'ar' ? 'تم الحفظ' : 'Saved') : t.save}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader><DialogTitle className="text-white">{t.editUser}: {editingUser?.username}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-slate-300">{t.newPassword}</Label><Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave empty to keep current" className="bg-slate-800/50 border-slate-700 text-white" /></div>
              <div><Label className="text-slate-300">{t.email}</Label><Input value={editingUser?.email || ''} onChange={(e) => setEditingUser(editingUser ? {...editingUser, email: e.target.value} : null)} className="bg-slate-800/50 border-slate-700 text-white" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => { if (editingUser) { const updates: any = { email: editingUser.email }; if (editPassword) updates.password = editPassword; updateUser(editingUser.id, updates); setEditUserOpen(false); } }} className="bg-violet-600 hover:bg-violet-700">{t.save}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;
