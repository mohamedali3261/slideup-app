import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Limits {
  max_presentations: number;
  max_slides: number;
  max_elements_per_slide: number;
  max_exports_per_day: number;
  max_templates_per_user: number;
  max_file_size_mb: number;
  max_storage_mb: number;
  rate_limit_per_minute: number;
  inactivity_timeout: number;
  allowed_file_types: string[];
  allowed_export_formats: string[];
  enable_animations: boolean;
  allow_custom_templates: boolean;
  export_quality: string;
}

interface Usage {
  presentations: number;
  exports_today: number;
  templates: number;
  storage_used_mb: number;
}

interface LimitsData {
  limits: Limits;
  usage: Usage;
}

interface CheckResult {
  allowed: boolean;
  current?: number;
  max?: number;
  message?: string;
  quality?: string;
}

export const useLimits = () => {
  const [limitsData, setLimitsData] = useState<LimitsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuth();
  const { toast } = useToast();

  const fetchLimits = useCallback(async () => {
    if (!token) return;
    
    try {
      const res = await fetch('/api/limits', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLimitsData(data);
      }
    } catch (error) {
      console.error('Failed to fetch limits:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const checkLimit = useCallback(async (
    action: string, 
    data?: Record<string, any>
  ): Promise<CheckResult> => {
    if (!token) return { allowed: false, message: 'Not authenticated' };
    
    try {
      const res = await fetch('/api/check-limit', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, data })
      });
      
      if (res.status === 429) {
        toast({
          title: 'تم تجاوز حد الطلبات',
          description: 'انتظر قليلاً ثم حاول مرة أخرى',
          variant: 'destructive'
        });
        return { allowed: false, message: 'Rate limit exceeded' };
      }
      
      const result = await res.json();
      
      if (!result.allowed && result.message) {
        toast({
          title: 'تم الوصول للحد الأقصى',
          description: result.message,
          variant: 'destructive'
        });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to check limit:', error);
      return { allowed: true }; // Allow on error to not block user
    }
  }, [token, toast]);

  // Convenience methods
  const canCreatePresentation = useCallback(() => 
    checkLimit('create_presentation'), [checkLimit]);
  
  const canAddSlide = useCallback((presentationId: string) => 
    checkLimit('add_slide', { presentationId }), [checkLimit]);
  
  const canAddElement = useCallback((currentElements: number) => 
    checkLimit('add_element', { currentElements }), [checkLimit]);
  
  const canExport = useCallback((format: string) => 
    checkLimit('export', { format }), [checkLimit]);
  
  const canSaveTemplate = useCallback(() => 
    checkLimit('save_template'), [checkLimit]);
  
  const canUploadFile = useCallback((filename: string, size: number) => 
    checkLimit('upload_file', { filename, size }), [checkLimit]);
  
  const canUseAnimation = useCallback(() => 
    checkLimit('use_animation'), [checkLimit]);

  // Quick checks without API call (using cached data)
  const quickCheck = {
    isAnimationEnabled: () => limitsData?.limits.enable_animations ?? true,
    isCustomTemplatesAllowed: () => limitsData?.limits.allow_custom_templates ?? true,
    getExportQuality: () => limitsData?.limits.export_quality ?? 'high',
    getAllowedFileTypes: () => limitsData?.limits.allowed_file_types ?? [],
    getAllowedExportFormats: () => limitsData?.limits.allowed_export_formats ?? [],
    getInactivityTimeout: () => limitsData?.limits.inactivity_timeout ?? 30,
    getMaxFileSize: () => limitsData?.limits.max_file_size_mb ?? 5,
  };

  return {
    limits: limitsData?.limits,
    usage: limitsData?.usage,
    isLoading,
    refetch: fetchLimits,
    checkLimit,
    canCreatePresentation,
    canAddSlide,
    canAddElement,
    canExport,
    canSaveTemplate,
    canUploadFile,
    canUseAnimation,
    quickCheck,
  };
};
