import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type EditorAction = 
  | 'open_editor'
  | 'create_slide'
  | 'delete_slide'
  | 'duplicate_slide'
  | 'reorder_slides'
  | 'add_element'
  | 'add_elements'
  | 'delete_element'
  | 'edit_element'
  | 'change_background'
  | 'export_pptx'
  | 'export_pdf'
  | 'export_images'
  | 'start_presentation'
  | 'use_template'
  | 'import_pptx'
  | 'undo'
  | 'redo'
  | 'copy_element'
  | 'paste_element'
  | 'group_elements'
  | 'ungroup_elements'
  | 'change_slide_type'
  | 'update_title'
  | 'manual_save';

type SlideChangeType = 
  | 'add_element'
  | 'delete_element'
  | 'move_element'
  | 'resize_element'
  | 'edit_text'
  | 'change_style'
  | 'change_color'
  | 'change_font'
  | 'change_background'
  | 'add_image'
  | 'add_shape'
  | 'add_icon'
  | 'rotate_element';

export const useEditorTracking = () => {
  const { token } = useAuth();

  // Track general editor actions
  const trackAction = useCallback(async (
    actionType: EditorAction,
    presentationId?: string,
    details?: string
  ) => {
    if (!token) return;

    try {
      await fetch('/api/editor/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          presentationId,
          actionType,
          details
        })
      });
    } catch (error) {
      console.debug('Failed to track action:', error);
    }
  }, [token]);

  // Track detailed slide changes
  const trackSlideChange = useCallback(async (
    presentationId: string,
    slideId: string,
    changeType: SlideChangeType,
    elementId?: string,
    elementType?: string,
    oldValue?: any,
    newValue?: any
  ) => {
    if (!token) return;

    try {
      await fetch('/api/editor/slide-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          presentationId,
          slideId,
          changeType,
          elementId,
          elementType,
          oldValue,
          newValue
        })
      });
    } catch (error) {
      console.debug('Failed to track slide change:', error);
    }
  }, [token]);

  // Track template usage
  const trackTemplateUsage = useCallback(async (
    templateId: string,
    templateName: string,
    action: 'use' | 'apply' | 'customize',
    presentationId?: string
  ) => {
    if (!token) return;

    try {
      await fetch('/api/editor/template-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId,
          templateName,
          action,
          presentationId
        })
      });
    } catch (error) {
      console.debug('Failed to track template usage:', error);
    }
  }, [token]);

  return { trackAction, trackSlideChange, trackTemplateUsage };
};
