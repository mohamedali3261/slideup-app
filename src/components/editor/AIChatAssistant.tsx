import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { SlideTemplate } from '@/data/templates';
import { MessageCircle, X, Send, Sparkles, Copy, Check, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  currentSlide?: SlideTemplate;
  presentationTitle?: string;
  onInsertText?: (text: string) => void;
  onGeneratePresentation?: (slides: SlideTemplate[], title: string) => void;
}

const GEMINI_API_KEY = 'AIzaSyCcV87i03k0oPL0RKjsInIR857KXXm5f40';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const AIChatAssistant = ({ currentSlide, presentationTitle, onInsertText, onGeneratePresentation }: AIChatAssistantProps) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const t = useCallback((ar: string, en: string) => language === 'ar' ? ar : en, [language]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const getSystemPrompt = () => {
    const slideInfo = currentSlide ? `
Current slide type: ${currentSlide.type}
Current slide title: ${currentSlide.title}
${currentSlide.content ? `Current content: ${currentSlide.content.join(', ')}` : ''}
` : '';

    return `You are a helpful presentation assistant for SlideUP. Help users create compelling presentation content.
${presentationTitle ? `Presentation title: ${presentationTitle}` : ''}
${slideInfo}

Guidelines:
- Provide concise, professional content suitable for presentations
- Use bullet points when appropriate
- Keep responses focused and actionable
- If asked for slide content, provide ready-to-use text
- Respond in the same language the user writes in
- Be creative but professional
- NEVER use quotation marks or asterisks in your responses
- Write plain text without any special formatting characters`;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isGenerating) return;

    const userInput = input.trim();
    
    // Check if it's a presentation generation request
    if (isPresentationRequest(userInput) && onGeneratePresentation) {
      setInput('');
      // Extract topic from the message - remove command words
      let topic = userInput;
      const removeWords = [
        'اعملي', 'اعمل', 'انشئ', 'انشئي', 'عرض عن', 'عرض تقديمي عن', 
        'تمبلت', 'قالب', 'لي', 'ل',
        'create', 'generate', 'make', 'presentation about', 'template', 'about',
        '🎨'
      ];
      removeWords.forEach(word => {
        topic = topic.replace(new RegExp(word, 'gi'), '');
      });
      topic = topic.trim();
      
      await generatePresentation(topic || userInput);
      return;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const prompt = getSystemPrompt() + '\n\nUser: ' + userMessage.content;
      
      // Retry logic for overloaded model
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any;
      
      while (attempts < maxAttempts) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          const rawResponse = response.text || t('عذراً، حدث خطأ', 'Sorry, an error occurred');
          
          // Clean response from quotes and special formatting
          const aiResponse = rawResponse
            .replace(/\*\*/g, '')
            .replace(/["""''`]/g, '')
            .replace(/^\s*[-•]\s*/gm, '• ')
            .trim();

          const assistantMessage: Message = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, assistantMessage]);
          return; // Success, exit
        } catch (err: any) {
          lastError = err;
          attempts++;
          
          // If overloaded, wait and retry
          if (err.message?.includes('overloaded') || err.message?.includes('503')) {
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
              continue;
            }
          }
          throw err; // Other errors, don't retry
        }
      }
      
      throw lastError;
    } catch (error: any) {
      console.error('AI Chat error:', error);
      
      // Parse error message for better UX
      let errorText = error.message || 'Connection failed';
      
      if (errorText.includes('quota') || errorText.includes('Quota')) {
        errorText = t(
          'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.',
          'Quota exceeded. Please try again in a minute.'
        );
      } else if (errorText.includes('overloaded') || errorText.includes('503')) {
        errorText = t(
          'الخادم مشغول حالياً. حاول مرة أخرى.',
          'Server is busy. Please try again.'
        );
      }
      
      // Show error message in chat
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${errorText}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(t('تم النسخ!', 'Copied!'));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertText = (text: string) => {
    if (onInsertText) {
      onInsertText(text);
      toast.success(t('تم إدراج النص!', 'Text inserted!'));
    }
  };

  const quickPrompts = [
    { ar: 'اعملي عرض عن', en: 'Create presentation about' },
    { ar: 'اكتب مقدمة للعرض', en: 'Write an introduction' },
    { ar: 'اقترح نقاط رئيسية', en: 'Suggest key points' },
    { ar: 'اكتب خاتمة', en: 'Write a conclusion' },
  ];

  // Generate full presentation
  const generatePresentation = async (topic: string) => {
    if (!onGeneratePresentation || isGenerating) return;
    
    setIsGenerating(true);
    
    const genMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: language === 'ar' 
        ? `إنشاء عرض عن: ${topic}`
        : `Creating presentation about: ${topic}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, genMessage]);

    try {
      const prompt = `أنت مصمم عروض تقديمية محترف عالمي. أنشئ عرض تقديمي مبهر واحترافي عن: "${topic}"

المطلوب:
1. حلل الموضوع "${topic}" جيداً وافهم طبيعته ومجاله
2. اختر theme لوني احترافي يناسب المجال:
   - مطاعم/طعام: ألوان دافئة (برتقالي، أحمر داكن، بني)
   - تكنولوجيا: أزرق داكن، بنفسجي، سماوي
   - صحة/طب: أخضر، أزرق فاتح، أبيض
   - تعليم: أزرق، أخضر زيتي
   - أعمال/شركات: كحلي، رمادي، ذهبي
   - سياحة/سفر: تركواز، برتقالي، أزرق سماوي
   - رياضة: أحمر، أسود، برتقالي
   - فن/إبداع: بنفسجي، وردي، تركواز

3. لكل شريحة اختر أيقونة Lucide مناسبة من القائمة التالية (استخدم الاسم بالإنجليزية فقط):
   - طعام/مطاعم: Pizza, Coffee, UtensilsCrossed, Wine, Apple, Cake
   - أعمال: Briefcase, Building, Building2, DollarSign, Users, Globe, TrendingUp
   - تكنولوجيا: Laptop, Monitor, Smartphone, Cpu, Database, Server, Wifi, Cloud, Code
   - تعليم: BookOpen, GraduationCap, Library, Lightbulb, Brain, Award, Trophy
   - صحة: Activity, Heart, Pill, Stethoscope, Thermometer
   - سفر: Plane, Car, MapPin, Map, Compass, Navigation
   - تسوق: ShoppingCart, ShoppingBag, Package, Gift, Tag, Store, Truck
   - عام: Star, Zap, Flame, Sparkles, Crown, Target, Check, CheckCircle, ArrowRight
   - اجتماعي: User, UserPlus, Heart, ThumbsUp, MessageCircle, Share2, Send
   - رسوم بيانية: BarChart, PieChart, TrendingUp, TrendingDown

4. اكتب محتوى احترافي وجذاب خاص بـ "${topic}"

أنواع الشرائح:
- "cover": غلاف (عنوان + عنوان فرعي + أيقونة رئيسية)
- "content": محتوى (عنوان + نقاط مع أيقونات)
- "section": فاصل قسم
- "stats": إحصائيات (أرقام مع تسميات)
- "features": مميزات (3-4 مميزات مع أيقونات)
- "quote": اقتباس ملهم
- "thankyou": شكر وتواصل

الألوان المطلوبة لكل شريحة:
- backgroundColor: لون الخلفية الأساسي
- gradientColor: لون ثاني للتدرج (اختياري)
- textColor: لون النص الرئيسي
- accentColor: لون مميز للأيقونات والزخارف

أرجع JSON فقط:
[
  {
    "type": "cover",
    "title": "عنوان جذاب",
    "subtitle": "وصف مختصر",
    "icon": "Pizza",
    "backgroundColor": "#1a1a2e",
    "gradientColor": "#16213e",
    "textColor": "#ffffff",
    "accentColor": "#e94560"
  },
  {
    "type": "features",
    "title": "مميزاتنا",
    "features": [
      {"icon": "Star", "title": "جودة عالية", "desc": "وصف قصير"},
      {"icon": "Zap", "title": "سرعة", "desc": "وصف قصير"},
      {"icon": "Crown", "title": "تميز", "desc": "وصف قصير"}
    ],
    "backgroundColor": "#ffffff",
    "textColor": "#1a1a2e",
    "accentColor": "#e94560"
  },
  {
    "type": "stats",
    "title": "إنجازاتنا",
    "stats": [
      {"value": "500+", "label": "عميل", "icon": "Users"},
      {"value": "98%", "label": "رضا", "icon": "Star"},
      {"value": "24/7", "label": "دعم", "icon": "MessageCircle"}
    ],
    "backgroundColor": "#1a1a2e",
    "textColor": "#ffffff",
    "accentColor": "#e94560"
  },
  {
    "type": "content",
    "title": "خدماتنا",
    "content": [
      {"icon": "Check", "text": "نقطة أولى"},
      {"icon": "Check", "text": "نقطة ثانية"}
    ],
    "backgroundColor": "#ffffff",
    "textColor": "#1a1a2e"
  }
]

مهم جداً:
- المحتوى خاص بـ "${topic}" فقط
- استخدم نفس لغة الموضوع
- استخدم أسماء أيقونات Lucide بالإنجليزية فقط (مثل: Star, Users, Check, Pizza)
- 6-8 شرائح متنوعة
- أرجع JSON فقط`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }
      
      const slidesData = JSON.parse(jsonMatch[0]);
      
      // Helper function to generate decorative elements based on slide type
      const generateDecorations = (slideType: string, bgColor: string, txtColor: string, index: number) => {
        const decorations: any[] = [];
        const accentColor = txtColor + '20';
        const accentColor2 = txtColor + '10';
        
        switch (slideType) {
          case 'cover':
            // Large circle decoration
            decorations.push({
              id: `deco-${Date.now()}-${index}-c1`,
              type: 'shape',
              x: -100,
              y: -100,
              width: 400,
              height: 400,
              shapeType: 'circle',
              backgroundColor: accentColor,
              zIndex: 0,
            });
            // Small circles
            decorations.push({
              id: `deco-${Date.now()}-${index}-c2`,
              type: 'shape',
              x: 750,
              y: 350,
              width: 150,
              height: 150,
              shapeType: 'circle',
              backgroundColor: accentColor2,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-c3`,
              type: 'shape',
              x: 850,
              y: 50,
              width: 80,
              height: 80,
              shapeType: 'circle',
              backgroundColor: txtColor + '15',
              zIndex: 0,
            });
            // Bottom line
            decorations.push({
              id: `deco-${Date.now()}-${index}-l1`,
              type: 'shape',
              x: 280,
              y: 350,
              width: 400,
              height: 4,
              shapeType: 'rectangle',
              backgroundColor: txtColor,
              zIndex: 0,
            });
            break;
            
          case 'content':
            // Side accent bar
            decorations.push({
              id: `deco-${Date.now()}-${index}-bar`,
              type: 'shape',
              x: 0,
              y: 0,
              width: 8,
              height: 540,
              shapeType: 'rectangle',
              backgroundColor: txtColor,
              zIndex: 0,
            });
            // Corner decoration
            decorations.push({
              id: `deco-${Date.now()}-${index}-corner`,
              type: 'shape',
              x: 860,
              y: 440,
              width: 100,
              height: 100,
              shapeType: 'circle',
              backgroundColor: accentColor2,
              zIndex: 0,
            });
            break;
            
          case 'section':
            // Large background shape
            decorations.push({
              id: `deco-${Date.now()}-${index}-bg`,
              type: 'shape',
              x: 0,
              y: 0,
              width: 350,
              height: 540,
              shapeType: 'rectangle',
              backgroundColor: txtColor + '12',
              zIndex: 0,
            });
            // Circles
            decorations.push({
              id: `deco-${Date.now()}-${index}-c1`,
              type: 'shape',
              x: 280,
              y: 200,
              width: 200,
              height: 200,
              shapeType: 'circle',
              backgroundColor: accentColor,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-c2`,
              type: 'shape',
              x: 800,
              y: 400,
              width: 120,
              height: 120,
              shapeType: 'circle',
              backgroundColor: accentColor2,
              zIndex: 0,
            });
            break;
            
          case 'stats':
            // Bottom wave-like shapes
            decorations.push({
              id: `deco-${Date.now()}-${index}-w1`,
              type: 'shape',
              x: 0,
              y: 480,
              width: 960,
              height: 60,
              shapeType: 'rectangle',
              backgroundColor: txtColor + '08',
              zIndex: 0,
            });
            // Accent circles for each stat
            [120, 360, 600, 840].forEach((x, i) => {
              decorations.push({
                id: `deco-${Date.now()}-${index}-stat${i}`,
                type: 'shape',
                x: x - 40,
                y: 140,
                width: 80,
                height: 80,
                shapeType: 'circle',
                backgroundColor: accentColor,
                zIndex: 0,
              });
            });
            break;
            
          case 'features':
            // Grid dots decoration
            for (let row = 0; row < 3; row++) {
              for (let col = 0; col < 3; col++) {
                decorations.push({
                  id: `deco-${Date.now()}-${index}-dot${row}${col}`,
                  type: 'shape',
                  x: 850 + (col * 25),
                  y: 30 + (row * 25),
                  width: 8,
                  height: 8,
                  shapeType: 'circle',
                  backgroundColor: txtColor + '30',
                  zIndex: 0,
                });
              }
            }
            // Feature boxes background
            decorations.push({
              id: `deco-${Date.now()}-${index}-box1`,
              type: 'shape',
              x: 40,
              y: 130,
              width: 280,
              height: 180,
              shapeType: 'rectangle',
              backgroundColor: accentColor2,
              borderRadius: 16,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-box2`,
              type: 'shape',
              x: 340,
              y: 130,
              width: 280,
              height: 180,
              shapeType: 'rectangle',
              backgroundColor: accentColor2,
              borderRadius: 16,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-box3`,
              type: 'shape',
              x: 640,
              y: 130,
              width: 280,
              height: 180,
              shapeType: 'rectangle',
              backgroundColor: accentColor2,
              borderRadius: 16,
              zIndex: 0,
            });
            break;
            
          case 'quote':
            // Large quote mark
            decorations.push({
              id: `deco-${Date.now()}-${index}-quote`,
              type: 'text',
              x: 60,
              y: 80,
              width: 150,
              height: 150,
              content: '"',
              fontSize: 200,
              fontWeight: 'bold',
              color: txtColor + '15',
              zIndex: 0,
            });
            // Side bar
            decorations.push({
              id: `deco-${Date.now()}-${index}-bar`,
              type: 'shape',
              x: 60,
              y: 200,
              width: 6,
              height: 200,
              shapeType: 'rectangle',
              backgroundColor: txtColor,
              zIndex: 0,
            });
            break;
            
          case 'thankyou':
            // Multiple decorative circles
            decorations.push({
              id: `deco-${Date.now()}-${index}-c1`,
              type: 'shape',
              x: 700,
              y: -50,
              width: 300,
              height: 300,
              shapeType: 'circle',
              backgroundColor: accentColor,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-c2`,
              type: 'shape',
              x: -80,
              y: 350,
              width: 200,
              height: 200,
              shapeType: 'circle',
              backgroundColor: accentColor2,
              zIndex: 0,
            });
            decorations.push({
              id: `deco-${Date.now()}-${index}-c3`,
              type: 'shape',
              x: 100,
              y: 50,
              width: 60,
              height: 60,
              shapeType: 'circle',
              backgroundColor: txtColor + '15',
              zIndex: 0,
            });
            // Decorative line
            decorations.push({
              id: `deco-${Date.now()}-${index}-line`,
              type: 'shape',
              x: 330,
              y: 320,
              width: 300,
              height: 4,
              shapeType: 'rectangle',
              backgroundColor: txtColor,
              zIndex: 0,
            });
            break;
        }
        
        return decorations;
      };
      
      // Convert to SlideTemplate format with editable elements
      const slides: SlideTemplate[] = slidesData.map((slide: any, index: number) => {
        const bgColor = slide.backgroundColor || '#ffffff';
        const txtColor = slide.textColor || '#1f2937';
        const elements: any[] = [];
        let elementId = 0;
        
        // Add title as editable text element
        if (slide.title) {
          const iscover = slide.type === 'cover' || slide.type === 'thankyou';
          elements.push({
            id: `el-${Date.now()}-${index}-${elementId++}`,
            type: 'text',
            x: iscover ? 80 : 60,
            y: iscover ? 180 : 40,
            width: iscover ? 800 : 840,
            height: iscover ? 80 : 60,
            content: slide.title,
            fontSize: iscover ? 48 : 36,
            fontWeight: 'bold',
            textAlign: iscover ? 'center' : 'left',
            color: txtColor,
          });
        }
        
        // Add main icon for cover/section slides
        if (slide.icon && (slide.type === 'cover' || slide.type === 'section' || slide.type === 'thankyou')) {
          elements.push({
            id: `el-${Date.now()}-${index}-${elementId++}`,
            type: 'icon',
            x: slide.type === 'cover' ? 430 : 420,
            y: slide.type === 'cover' ? 100 : 150,
            width: 80,
            height: 80,
            iconConfig: {
              name: slide.icon,
              color: slide.accentColor || txtColor,
              size: 64,
              strokeWidth: 2,
            },
          });
        }
        
        // Add subtitle as editable text element
        if (slide.subtitle) {
          const iscover = slide.type === 'cover' || slide.type === 'thankyou';
          elements.push({
            id: `el-${Date.now()}-${index}-${elementId++}`,
            type: 'text',
            x: iscover ? 80 : 60,
            y: iscover ? 280 : 110,
            width: iscover ? 800 : 840,
            height: 40,
            content: slide.subtitle,
            fontSize: iscover ? 24 : 18,
            fontWeight: 'normal',
            textAlign: iscover ? 'center' : 'left',
            color: txtColor + 'cc',
          });
        }
        
        // Handle features type with icons
        if (slide.type === 'features' && slide.features && Array.isArray(slide.features)) {
          const featureWidth = 280;
          const startX = 50;
          const gap = 20;
          slide.features.slice(0, 3).forEach((feature: any, i: number) => {
            const x = startX + (i * (featureWidth + gap));
            // Feature box background
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'shape',
              x: x,
              y: 130,
              width: featureWidth,
              height: 200,
              shapeType: 'rectangle',
              backgroundColor: (slide.accentColor || txtColor) + '12',
              borderRadius: 16,
              zIndex: 1,
            });
            // Feature icon (SVG)
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'icon',
              x: x + (featureWidth / 2) - 25,
              y: 150,
              width: 50,
              height: 50,
              iconConfig: {
                name: feature.icon || 'Star',
                color: slide.accentColor || txtColor,
                size: 40,
                strokeWidth: 2,
              },
              zIndex: 2,
            });
            // Feature title
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'text',
              x: x + 10,
              y: 210,
              width: featureWidth - 20,
              height: 35,
              content: feature.title || '',
              fontSize: 20,
              fontWeight: 'bold',
              textAlign: 'center',
              color: txtColor,
              zIndex: 2,
            });
            // Feature description
            if (feature.desc) {
              elements.push({
                id: `el-${Date.now()}-${index}-${elementId++}`,
                type: 'text',
                x: x + 10,
                y: 250,
                width: featureWidth - 20,
                height: 60,
                content: feature.desc,
                fontSize: 14,
                textAlign: 'center',
                color: txtColor + 'aa',
                zIndex: 2,
              });
            }
          });
        }
        
        // Handle stats type with icons
        else if (slide.type === 'stats' && slide.stats && Array.isArray(slide.stats)) {
          const statCount = Math.min(slide.stats.length, 4);
          const statWidth = 200;
          const totalWidth = statCount * statWidth;
          const startX = (960 - totalWidth) / 2;
          slide.stats.slice(0, 4).forEach((stat: any, i: number) => {
            const x = startX + (i * statWidth);
            // Stat icon (SVG)
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'icon',
              x: x + (statWidth / 2) - 22,
              y: 140,
              width: 44,
              height: 44,
              iconConfig: {
                name: stat.icon || 'BarChart',
                color: slide.accentColor || txtColor,
                size: 36,
                strokeWidth: 2,
              },
            });
            // Stat value
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'text',
              x: x,
              y: 200,
              width: statWidth,
              height: 60,
              content: stat.value || '0',
              fontSize: 48,
              fontWeight: 'bold',
              textAlign: 'center',
              color: txtColor,
            });
            // Stat label
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'text',
              x: x,
              y: 270,
              width: statWidth,
              height: 30,
              content: stat.label || '',
              fontSize: 16,
              textAlign: 'center',
              color: txtColor + 'aa',
            });
          });
        }
        
        // Handle content type with icons
        else if (slide.content && Array.isArray(slide.content)) {
          const startY = slide.subtitle ? 160 : 120;
          slide.content.forEach((item: any, i: number) => {
            const isObject = typeof item === 'object';
            const iconName = isObject ? (item.icon || 'Check') : 'Check';
            const text = isObject ? item.text : item;
            
            // Icon (SVG)
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'icon',
              x: 60,
              y: startY + (i * 55),
              width: 28,
              height: 28,
              iconConfig: {
                name: iconName,
                color: slide.accentColor || txtColor,
                size: 24,
                strokeWidth: 2,
              },
            });
            // Text
            elements.push({
              id: `el-${Date.now()}-${index}-${elementId++}`,
              type: 'text',
              x: 100,
              y: startY + (i * 55),
              width: 800,
              height: 40,
              content: text,
              fontSize: 20,
              fontWeight: 'normal',
              textAlign: 'left',
              color: txtColor,
            });
          });
        }
        
        // Add gradient overlay shape if gradientColor exists
        if (slide.gradientColor) {
          elements.unshift({
            id: `el-${Date.now()}-${index}-grad`,
            type: 'shape',
            x: 0,
            y: 0,
            width: 960,
            height: 540,
            shapeType: 'rectangle',
            backgroundColor: slide.gradientColor + '40',
            zIndex: 0,
          });
        }
        
        // Add decorative elements based on slide type
        const accentColor = slide.accentColor || txtColor;
        const decorations = generateDecorations(slide.type, bgColor, accentColor, index);
        
        return {
          id: `slide-${Date.now()}-${index}`,
          type: slide.type || 'content',
          title: slide.title || `Slide ${index + 1}`,
          subtitle: slide.subtitle,
          content: slide.content,
          backgroundColor: bgColor,
          textColor: txtColor,
          elements: [...decorations, ...elements],
        };
      });

      const presentationTitle = slides[0]?.title || topic;
      
      onGeneratePresentation(slides, presentationTitle);
      
      const successMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: language === 'ar' 
          ? `✅ تم إنشاء عرض "${presentationTitle}" بنجاح!\n\n📊 ${slides.length} شرائح احترافية\n🎨 تصميم مبهر مع أيقونات SVG\n✏️ جميع العناصر قابلة للتعديل`
          : `✅ Created "${presentationTitle}" successfully!\n\n📊 ${slides.length} professional slides\n🎨 Stunning design with SVG icons\n✏️ All elements are editable`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);
      toast.success(t('تم إنشاء العرض!', 'Presentation created!'));
      
    } catch (error: any) {
      console.error('Generate presentation error:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${t('فشل إنشاء العرض. حاول مرة أخرى.', 'Failed to generate. Please try again.')}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if message is a presentation request
  const isPresentationRequest = (text: string) => {
    const keywords = ['اعمل', 'اعملي', 'انشئ', 'create', 'generate', 'make', 'عرض عن', 'presentation about', 'template', 'تمبلت', 'قالب'];
    return keywords.some(kw => text.toLowerCase().includes(kw));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        title={t('مساعد الذكاء الاصطناعي', 'AI Assistant')}
      >
        <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
      </button>
    );
  }

  return (
    <div 
      className={`fixed z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${
        isMinimized 
          ? 'bottom-6 right-6 w-72 h-14' 
          : 'bottom-6 right-6 w-96 h-[500px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-violet-500 to-purple-600 rounded-t-2xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-sm">
            {t('مساعد AI', 'AI Assistant')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/40 hover:scrollbar-thumb-primary/60 scrollbar-track-muted/20">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-violet-500" />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {t('كيف يمكنني مساعدتك في العرض؟', 'How can I help with your presentation?')}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(language === 'ar' ? prompt.ar : prompt.en)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-full transition-colors text-gray-700 dark:text-gray-300"
                    >
                      {language === 'ar' ? prompt.ar : prompt.en}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-violet-500 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('نسخ', 'Copy')}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-500" />
                          )}
                        </button>
                        {onInsertText && (
                          <button
                            onClick={() => handleInsertText(msg.content)}
                            className="px-2 py-0.5 text-xs bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded transition-colors"
                          >
                            {t('إدراج', 'Insert')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading || isGenerating ? (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                  {isGenerating && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('جاري إنشاء العرض...', 'Generating presentation...')}
                    </span>
                  )}
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('اكتب رسالتك...', 'Type your message...')}
                className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:text-white max-h-24"
                rows={1}
                disabled={isLoading || isGenerating}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isGenerating}
                size="icon"
                className="h-10 w-10 rounded-xl bg-violet-500 hover:bg-violet-600 text-white shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChatAssistant;
