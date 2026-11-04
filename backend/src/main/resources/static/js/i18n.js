// @ts-nocheck
/**
 * TouristAI — Internationalization & Multilingual System (i18n)
 * Production-ready multilingual engine supporting 26 languages + Intelligent Auto Detect.
 * Covers 13 Indian languages + 13 International languages with native scripts, RTL support, and Unicode fallbacks.
 */

const I18N_STORAGE_KEY = 'tourist_app_language';

const SUPPORTED_LANGUAGES = [
    { code: 'auto', name: 'Auto Detect', nativeName: 'தானியங்கு / Auto Detect', category: 'all', dir: 'ltr', speechCode: 'en-US', flag: '⚡' },
    // 13 Indian Languages
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', category: 'indian', dir: 'ltr', speechCode: 'ta-IN', flag: '🇮🇳' },
    { code: 'en', name: 'English', nativeName: 'English', category: 'indian', dir: 'ltr', speechCode: 'en-US', flag: '🌐' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', category: 'indian', dir: 'ltr', speechCode: 'hi-IN', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', category: 'indian', dir: 'ltr', speechCode: 'ml-IN', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', category: 'indian', dir: 'ltr', speechCode: 'te-IN', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', category: 'indian', dir: 'ltr', speechCode: 'kn-IN', flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', category: 'indian', dir: 'ltr', speechCode: 'bn-IN', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', category: 'indian', dir: 'ltr', speechCode: 'mr-IN', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', category: 'indian', dir: 'ltr', speechCode: 'gu-IN', flag: '🇮🇳' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', category: 'indian', dir: 'ltr', speechCode: 'pa-IN', flag: '🇮🇳' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', category: 'indian', dir: 'rtl', speechCode: 'ur-IN', flag: '🇮🇳' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', category: 'indian', dir: 'ltr', speechCode: 'or-IN', flag: '🇮🇳' },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', category: 'indian', dir: 'ltr', speechCode: 'as-IN', flag: '🇮🇳' },
    // 13 International Languages
    { code: 'fr', name: 'French', nativeName: 'Français', category: 'intl', dir: 'ltr', speechCode: 'fr-FR', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', category: 'intl', dir: 'ltr', speechCode: 'es-ES', flag: '🇪🇸' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', category: 'intl', dir: 'ltr', speechCode: 'de-DE', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', category: 'intl', dir: 'ltr', speechCode: 'it-IT', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', category: 'intl', dir: 'ltr', speechCode: 'pt-PT', flag: '🇵🇹' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', category: 'intl', dir: 'rtl', speechCode: 'ar-SA', flag: '🇸🇦' },
    { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文', category: 'intl', dir: 'ltr', speechCode: 'zh-CN', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', category: 'intl', dir: 'ltr', speechCode: 'ja-JP', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', category: 'intl', dir: 'ltr', speechCode: 'ko-KR', flag: '🇰🇷' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', category: 'intl', dir: 'ltr', speechCode: 'ru-RU', flag: '🇷🇺' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', category: 'intl', dir: 'ltr', speechCode: 'id-ID', flag: '🇮🇩' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', category: 'intl', dir: 'ltr', speechCode: 'th-TH', flag: '🇹🇭' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', category: 'intl', dir: 'ltr', speechCode: 'vi-VN', flag: '🇻🇳' }
];

const TRANSLATIONS = {
    en: {
        nav_home: 'Home',
        nav_chatbot: 'AI Guide',
        nav_destinations: 'Destinations',
        nav_planner: 'Plan Trip',
        nav_dashboard: 'Dashboard',
        nav_login: 'Sign In',
        nav_register: 'Start Free',
        nav_logout: 'Sign Out',
        nav_lang: 'Language',
        nav_select_lang: 'Select Language',
        chat_title: 'TouristAI Travel Companion',
        chat_subtitle: 'Intelligent Multilingual Journey Planner',
        chat_welcome_title: 'Where would you like to travel next?',
        chat_welcome_desc: 'Ask for personalized itineraries, route directions, cost estimates, or local cuisine recommendations in any language.',
        chat_input_placeholder: 'Ask anything about travel, budgets, transit routes or itineraries…',
        chat_send: 'Send',
        chat_mic_start: 'Speak your question',
        chat_mic_listening: 'Listening… speak now',
        chat_mic_stop: 'Stop listening',
        chat_listen: 'Listen',
        chat_stop: 'Stop',
        chat_copy: 'Copy',
        chat_copied: 'Copied!',
        chat_retry: 'Retry',
        chat_share: 'Share',
        chat_plan_btn: 'Plan Full Trip',
        chat_view_dest: 'View Destination Details',
        chat_thinking: 'TouristAI is crafting your travel plan',
        chat_prompt_1: '🏔️ Plan a 3-day trip from Chennai to Ooty for 2 people under ₹8,000',
        chat_prompt_2: '🌴 Best hidden beaches and backwaters in Kerala',
        chat_prompt_3: '⛷️ 3-Day Manali itinerary for adventure lovers with budget',
        chat_prompt_4: '🏖️ Best budget beach stay options in Goa for couples',
        chat_prompt_5: '🚂 How to reach Ooty by train from Chennai or Bangalore?',
        dest_hero_tag: 'Curated Destinations',
        dest_hero_title: 'Explore India & Beyond',
        dest_hero_desc: 'Discover handpicked destinations, hidden waterfalls, tranquil hill stations, and heritage monuments.',
        dest_search_placeholder: 'Search destination, state, landmark, or category…',
        dest_cat_all: 'All',
        dest_cat_hill: 'Hill Station',
        dest_cat_beach: 'Beach',
        dest_cat_heritage: 'Heritage',
        dest_cat_nature: 'Nature',
        dest_cat_spiritual: 'Spiritual',
        dest_filter_budget: 'Budget',
        dest_filter_duration: 'Duration',
        dest_filter_sort: 'Sort By',
        dest_load_more: 'Load More Destinations',
        dest_satellite_view: 'Satellite View',
        dest_empty_title: 'No destinations match your criteria',
        dest_empty_desc: 'Try adjusting your search terms or filters to discover more wonders.',
        dest_reset_filters: 'Reset All Filters',
        dest_plan_trip: 'Plan Trip Here',
        dest_view_details: 'Explore Destination',
        planner_title: 'AI Travel Itinerary Builder',
        planner_subtitle: 'Craft comprehensive day-by-day travel schedules customized to your budget, style, and travel party.',
        planner_dest_label: 'Destination',
        planner_dest_placeholder: 'e.g. Ooty, Manali, Kerala, Munnar, Goa',
        planner_start_date: 'Start Date',
        planner_end_date: 'End Date',
        planner_days_label: 'Duration (Days)',
        planner_travelers_label: 'Travelers',
        planner_budget_label: 'Budget Tier',
        planner_budget_economy: 'Budget Friendly',
        planner_budget_moderate: 'Moderate / Balanced',
        planner_budget_luxury: 'Luxury / Premium',
        planner_currency_label: 'Currency',
        planner_interests_label: 'Travel Interests',
        planner_generate_btn: 'Generate AI Itinerary',
        planner_generating: 'Crafting Your Journey…',
        planner_save_btn: 'Save Itinerary',
        planner_saved_btn: 'Saved to Dashboard',
        planner_print_btn: 'Export / Print',
        planner_budget_breakdown: 'Estimated Budget Breakdown',
        planner_lodging: 'Accommodation',
        planner_transit: 'Transport & Transit',
        planner_food: 'Food & Dining',
        planner_activities: 'Sightseeing & Entry Tickets',
        planner_contingency: 'Contingency Buffer (10%)',
        planner_total_cost: 'Total Estimated Cost',
        planner_cost_per_person: 'Cost per Person',
        planner_add_stop: 'Add Custom Stop',
        planner_remove_stop: 'Remove Stop',
        planner_travel_tips: 'Essential Travel Tips',
        dash_title: 'Traveler Dashboard',
        dash_welcome: 'Welcome back',
        dash_tab_saved: 'Saved Itineraries',
        dash_tab_favorites: 'Favorite Places',
        dash_tab_history: 'Chat History',
        dash_tab_profile: 'Profile Settings',
        dash_no_saved: 'No saved itineraries yet. Create one with our AI planner!',
        dash_no_favorites: 'No favorite destinations saved yet.',
        dash_view_plan: 'View Plan',
        dash_delete: 'Delete',
        auth_login_title: 'Welcome Back',
        auth_login_desc: 'Sign in to access your saved trips and personalized travel itineraries.',
        auth_register_title: 'Begin Your Journey',
        auth_register_desc: 'Create your account to unlock AI travel planning across 26 languages.',
        auth_email: 'Email Address',
        auth_password: 'Password',
        auth_name: 'Full Name',
        auth_sign_in_btn: 'Sign In',
        auth_sign_up_btn: 'Create Account',
        auth_no_account: "Don't have an account? Sign up",
        auth_have_account: 'Already have an account? Sign in',
        lang_modal_title: 'Select Application Language',
        lang_search_placeholder: 'Search language (e.g. Tamil, French, हिंदी)…',
        lang_tab_all: 'All (26)',
        lang_tab_indian: 'Indian Languages',
        lang_tab_intl: 'International',
        lang_auto_detect_label: '⚡ Auto Detect Language',
        lang_auto_detect_desc: 'Automatically adapts to whatever language or dialect you write in (Tamil, Hindi, Tanglish, etc.).',
        footer_desc: 'Your AI travel companion for discovering hidden gems, crafting bespoke itineraries, and navigating destinations worldwide.',
        footer_rights: 'All rights reserved.'
    },
    ta: {
        nav_home: 'முகப்பு',
        nav_chatbot: 'AI வழிகாட்டி',
        nav_destinations: 'சுற்றுலா இடங்கள்',
        nav_planner: 'பயணத் திட்டம்',
        nav_dashboard: 'டாஷ்போர்டு',
        nav_login: 'உள்நுழைக',
        nav_register: 'தொடங்குக',
        nav_logout: 'வெளியேறு',
        nav_lang: 'மொழி',
        nav_select_lang: 'மொழியைத் தேர்ந்தெடுக்கவும்',
        chat_title: 'TouristAI பயண வழிகாட்டி',
        chat_subtitle: 'அறிவார்ந்த பன்மொழி பயணத் திட்டமிடுபவர்',
        chat_welcome_title: 'அடுத்து எங்கு பயணம் செய்ய விரும்புகிறீர்கள்?',
        chat_welcome_desc: 'ஊட்டி, கொடைக்கானல், கேரளா போன்ற இடங்களுக்கு செலவு மதிப்பீடு, ரயில் வழிகள் மற்றும் முழு திட்டங்களை தமிழில் கேளுங்கள்.',
        chat_input_placeholder: 'ஊட்டிக்கு 3 நாள் trip plan பண்ணு... எதையும் கேளுங்கள்',
        chat_send: 'அனுப்பு',
        chat_mic_start: 'குரல் மூலம் பேசுங்கள்',
        chat_mic_listening: 'கேட்கிறது… இப்போது பேசுங்கள்',
        chat_mic_stop: 'நிறுத்து',
        chat_listen: 'கேட்க',
        chat_stop: 'நிறுத்து',
        chat_copy: 'நகலெடு',
        chat_copied: 'நகலெடுக்கப்பட்டது!',
        chat_retry: 'மீண்டும் முயற்சி',
        chat_share: 'பகிர்',
        chat_plan_btn: 'முழு பயணத் திட்டம் உருவாக்கு',
        chat_view_dest: 'இடத்தின் விவரங்களைப் பார்',
        chat_thinking: 'TouristAI பயணத் திட்டத்தை உருவாக்குகிறது',
        chat_prompt_1: '🏔️ 4 பேருக்கு ₹15,000 budget-ல ஊட்டிக்கு 3 days trip plan பண்ணு',
        chat_prompt_2: '🌴 கேரளாவின் சிறந்த மறைந்திருக்கும் கடற்கரைகள் மற்றும் படகு இல்லங்கள்',
        chat_prompt_3: '⛷️ மணாலிக்கு 3 நாள் சாகச பயண திட்டம் மற்றும் செலவு விவரம்',
        chat_prompt_4: '🏖️ கோவாவில் பட்ஜெட் தங்கும் இடங்கள்',
        chat_prompt_5: '🚂 சென்னையிலிருந்து ஊட்டிக்கு ரயில் மற்றும் டாய் டிரெயின் வழிகள்',
        dest_hero_tag: 'சிறப்பு இடங்கள்',
        dest_hero_title: 'இந்தியாவின் அழகை ஆராயுங்கள்',
        dest_hero_desc: 'மலை வாசஸ்தலங்கள், நீர்வீழ்ச்சிகள், கடற்கரைகள் மற்றும் பாரம்பரிய இடங்களை கண்டறியுங்கள்.',
        dest_search_placeholder: 'இடம், மாநிலம் அல்லது சிறப்பம்சத்தை தேடுங்கள்...',
        dest_cat_all: 'அனைத்தும்',
        dest_cat_hill: 'மலை வாசஸ்தலம்',
        dest_cat_beach: 'கடற்கரை',
        dest_cat_heritage: 'பாரம்பரியம்',
        dest_cat_nature: 'இயற்கை',
        dest_cat_spiritual: 'ஆன்மீகம்',
        dest_filter_budget: 'பட்ஜெட்',
        dest_filter_duration: 'நாட்கள்',
        dest_filter_sort: 'வரிசைப்படுத்து',
        dest_load_more: 'மேலும் இடங்களைக் காட்டு',
        dest_satellite_view: 'செயற்கைக்கோள் வரைபடம்',
        dest_empty_title: 'எந்த இடமும் கிடைக்கவில்லை',
        dest_empty_desc: 'வேறு தேடல் சொல்லை உள்ளிடவும்.',
        dest_reset_filters: 'அனைத்து வடிகட்டிகளையும் மீட்டமை',
        dest_plan_trip: 'இங்கே பயணத் திட்டம் போடு',
        dest_view_details: 'விவரங்களைப் பார்',
        planner_title: 'AI பயணத் திட்டமிடுபவர்',
        planner_subtitle: 'உங்கள் பட்ஜெட் மற்றும் விருப்பங்களுக்கு ஏற்ப துல்லியமான நாள் வாரியான பயண அட்டவணையை உருவாக்குங்கள்.',
        planner_dest_label: 'செல்லும் இடம்',
        planner_dest_placeholder: 'எ.கா: ஊட்டி, கொடைக்கானல், கேரளா, மூணார்',
        planner_start_date: 'தொடக்க தேதி',
        planner_end_date: 'முடிவு தேதி',
        planner_days_label: 'நாட்கள்',
        planner_travelers_label: 'பயணிகள் எண்ணிக்கை',
        planner_budget_label: 'பட்ஜெட் வகை',
        planner_budget_economy: 'குறைந்த பட்ஜெட்',
        planner_budget_moderate: 'மிதமான பட்ஜெட்',
        planner_budget_luxury: 'சொகுசு பயணம்',
        planner_currency_label: 'நாணயம்',
        planner_interests_label: 'பயண ஆர்வங்கள்',
        planner_generate_btn: 'AI பயணத் திட்டத்தை உருவாக்கு',
        planner_generating: 'பயணத் திட்டம் தயாராகிறது…',
        planner_save_btn: 'சேமி',
        planner_saved_btn: 'சேமிக்கப்பட்டது',
        planner_print_btn: 'அச்சிடு / PDF',
        planner_budget_breakdown: 'மதிப்பிடப்பட்ட செலவு விவரம்',
        planner_lodging: 'தங்குமிடம்',
        planner_transit: 'போக்குவரத்து & பயண கட்டணம்',
        planner_food: 'உணவு & சிற்றுண்டி',
        planner_activities: 'சுற்றுலா நுழைவு கட்டணங்கள்',
        planner_contingency: 'கூடுதல் இருப்பு (10%)',
        planner_total_cost: 'மொத்த மதிப்பிடப்பட்ட செலவு',
        planner_cost_per_person: 'ஒரு நபருக்கான செலவு',
        planner_add_stop: 'புதிய இடத்தை சேர்',
        planner_remove_stop: 'நீக்கு',
        planner_travel_tips: 'முக்கிய பயணக் குறிப்புகள்',
        dash_title: 'பயணி டாஷ்போர்டு',
        dash_welcome: 'மீண்டும் நல்வரவு',
        dash_tab_saved: 'சேமிக்கப்பட்ட திட்டங்கள்',
        dash_tab_favorites: 'விருப்பமான இடங்கள்',
        dash_tab_history: 'உரையாடல் வரலாறு',
        dash_tab_profile: 'சுயவிவரம்',
        dash_no_saved: 'சேமிக்கப்பட்ட பயணத் திட்டங்கள் எதுவும் இல்லை.',
        dash_no_favorites: 'விருப்பமான இடங்கள் எதுவும் இல்லை.',
        dash_view_plan: 'திட்டத்தைப் பார்',
        dash_delete: 'நீக்கு',
        auth_login_title: 'மீண்டும் வருக',
        auth_login_desc: 'உங்கள் சேமிக்கப்பட்ட பயணங்களை அணுக உள்நுழையவும்.',
        auth_register_title: 'உங்கள் பயணத்தைத் தொடங்குங்கள்',
        auth_register_desc: '26 மொழிகளில் AI பயண திட்டங்களை அனுபவிக்க கணக்கை உருவாக்குங்கள்.',
        auth_email: 'மின்னஞ்சல் முகவரி',
        auth_password: 'கடவுச்சொல்',
        auth_name: 'முழு பெயர்',
        auth_sign_in_btn: 'உள்நுழைக',
        auth_sign_up_btn: 'பதிவு செய்க',
        auth_no_account: 'கணக்கு இல்லையா? பதிவு செய்க',
        auth_have_account: 'ஏற்கனவே கணக்கு உள்ளதா? உள்நுழைக',
        lang_modal_title: 'மொழியைத் தேர்ந்தெடுக்கவும்',
        lang_search_placeholder: 'மொழியைத் தேடுங்கள் (எ.கா: Tamil, Hindi)...',
        lang_tab_all: 'அனைத்தும் (26)',
        lang_tab_indian: 'இந்திய மொழிகள்',
        lang_tab_intl: 'சர்வதேச மொழிகள்',
        lang_auto_detect_label: '⚡ தானியங்கு மொழி கண்டறிதல்',
        lang_auto_detect_desc: 'நீங்கள் எழுதும் மொழியை தானாகவே கண்டறிந்து (தமிழ், Tanglish, English) பதிலளிக்கும்.',
        footer_desc: 'புதிய இடங்களை கண்டறியவும், பயண திட்டங்களை உருவாக்கவும் உங்கள் AI சுற்றுலா வழிகாட்டி.',
        footer_rights: 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.'
    },
    hi: {
        nav_home: 'होम',
        nav_chatbot: 'AI गाइड',
        nav_destinations: 'गंतव्य स्थल',
        nav_planner: 'यात्रा योजना',
        nav_dashboard: 'डैशबोर्ड',
        nav_login: 'साइन इन',
        nav_register: 'शुरू करें',
        nav_logout: 'लॉग आउट',
        nav_lang: 'भाषा',
        nav_select_lang: 'भाषा चुनें',
        chat_title: 'TouristAI यात्रा साथी',
        chat_subtitle: 'बुद्धिमान बहुभाषी यात्रा योजनाकार',
        chat_welcome_title: 'आप आगे कहाँ यात्रा करना चाहते हैं?',
        chat_welcome_desc: 'किसी भी भाषा में व्यक्तिगत यात्रा कार्यक्रम, बजट अनुमान या दर्शनीय स्थलों के बारे में पूछें।',
        chat_input_placeholder: 'ऊटी के लिए 3 दिन की यात्रा की योजना बनाएं... कुछ भी पूछें',
        chat_send: 'भेजें',
        chat_mic_start: 'बोलकर पूछें',
        chat_mic_listening: 'सुन रहा है... अब बोलें',
        chat_mic_stop: 'रोकें',
        chat_listen: 'सुनें',
        chat_stop: 'रोकें',
        chat_copy: 'कॉपी करें',
        chat_copied: 'कॉपी किया गया!',
        chat_retry: 'पुनः प्रयास',
        chat_share: 'साझा करें',
        chat_plan_btn: 'पूरी यात्रा योजना बनाएं',
        chat_view_dest: 'गंतव्य विवरण देखें',
        chat_thinking: 'TouristAI आपकी यात्रा योजना बना रहा है',
        chat_prompt_1: '🏔️ 4 लोगों के लिए ₹15,000 बजट में ऊटी की 3 दिवसीय यात्रा योजना बनाएं',
        chat_prompt_2: '🌴 केरल के सबसे अच्छे छिपे हुए समुद्र तट और बैकवाटर्स',
        chat_prompt_3: '⛷️ मनाली के लिए बजट सहित 3 दिवसीय साहसिक यात्रा कार्यक्रम',
        chat_prompt_4: '🏖️ जोड़ों के लिए गोवा में बजट समुद्र तट रिसॉर्ट्स',
        chat_prompt_5: '🚂 चेन्नई या बैंगलोर से ट्रेन द्वारा ऊटी कैसे पहुंचे?',
        dest_hero_tag: 'प्रमुख गंतव्य',
        dest_hero_title: 'भारत और दुनिया की खोज करें',
        dest_hero_desc: 'पहाड़ी स्टेशनों, प्राचीन समुद्र तटों और ऐतिहासिक स्थलों की खोज करें।',
        dest_search_placeholder: 'गंतव्य, राज्य या आकर्षण खोजें...',
        dest_cat_all: 'सभी',
        dest_cat_hill: 'हिल स्टेशन',
        dest_cat_beach: 'समुद्र तट',
        dest_cat_heritage: 'विरासत',
        dest_cat_nature: 'प्रकृति',
        dest_cat_spiritual: 'धार्मिक',
        dest_filter_budget: 'बजट',
        dest_filter_duration: 'अवधि',
        dest_filter_sort: 'क्रमबद्ध करें',
        dest_load_more: 'और गंतव्य लोड करें',
        dest_satellite_view: 'सैटेलाइट मानचित्र',
        dest_empty_title: 'कोई गंतव्य नहीं मिला',
        dest_empty_desc: 'कृपया अन्य खोज शब्द आजमाएं।',
        dest_reset_filters: 'सभी फ़िल्टर रीसेट करें',
        dest_plan_trip: 'यहाँ योजना बनाएं',
        dest_view_details: 'विवरण देखें',
        planner_title: 'AI यात्रा योजनाकार',
        planner_subtitle: 'अपने बजट और रुचि के अनुसार दिन-प्रतिदिन यात्रा कार्यक्रम तैयार करें।',
        planner_dest_label: 'गंतव्य',
        planner_dest_placeholder: 'उदा. मनाली, ऊटी, गोवा, मुन्नार',
        planner_start_date: 'प्रारंभ तिथि',
        planner_end_date: 'समाप्ति तिथि',
        planner_days_label: 'दिन',
        planner_travelers_label: 'यात्री',
        planner_budget_label: 'बजट स्तर',
        planner_budget_economy: 'किफायती / बजट',
        planner_budget_moderate: 'मध्यम / संतुलित',
        planner_budget_luxury: 'लक्ज़री / प्रीमियम',
        planner_currency_label: 'मुद्रा',
        planner_interests_label: 'रुचियां',
        planner_generate_btn: 'AI यात्रा कार्यक्रम तैयार करें',
        planner_generating: 'तैयार किया जा रहा है...',
        planner_save_btn: 'सहेजें',
        planner_saved_btn: 'सहेजा गया',
        planner_print_btn: 'प्रिंट / पीडीएफ',
        planner_budget_breakdown: 'अनुमानित बजट विवरण',
        planner_lodging: 'आवास / होटल',
        planner_transit: 'परिवहन और यात्रा',
        planner_food: 'भोजन और खानपान',
        planner_activities: 'दर्शनीय स्थल और टिकट',
        planner_contingency: 'अतिरिक्त बफर (10%)',
        planner_total_cost: 'कुल अनुमानित लागत',
        planner_cost_per_person: 'प्रति व्यक्ति लागत',
        planner_add_stop: 'नया स्टॉप जोड़ें',
        planner_remove_stop: 'हटाएं',
        planner_travel_tips: 'महत्वपूर्ण यात्रा सुझाव',
        dash_title: 'यात्री डैशबोर्ड',
        dash_welcome: 'वापसी पर स्वागत है',
        dash_tab_saved: 'सहेजे गए कार्यक्रम',
        dash_tab_favorites: 'पसंदीदा स्थान',
        dash_tab_history: 'चैट इतिहास',
        dash_tab_profile: 'प्रोफ़ाइल',
        dash_no_saved: 'कोई यात्रा कार्यक्रम सहेजा नहीं गया है।',
        dash_no_favorites: 'कोई पसंदीदा स्थान नहीं है।',
        dash_view_plan: 'योजना देखें',
        dash_delete: 'हटाएं',
        auth_login_title: 'स्वागत है',
        auth_login_desc: 'अपनी यात्रा योजनाओं तक पहुँचने के लिए साइन इन करें।',
        auth_register_title: 'अपनी यात्रा शुरू करें',
        auth_register_desc: '26 भाषाओं में AI यात्रा योजनाओं का अनुभव करने के लिए खाता बनाएं।',
        auth_email: 'ईमेल पता',
        auth_password: 'पासवर्ड',
        auth_name: 'पूरा नाम',
        auth_sign_in_btn: 'साइन इन करें',
        auth_sign_up_btn: 'खाता बनाएं',
        auth_no_account: 'खाता नहीं है? साइन अप करें',
        auth_have_account: 'पहले से खाता है? साइन इन करें',
        lang_modal_title: 'भाषा चुनें',
        lang_search_placeholder: 'भाषा खोजें (उदा. हिन्दी, Tamil, French)...',
        lang_tab_all: 'सभी (26)',
        lang_tab_indian: 'भारतीय भाषाएं',
        lang_tab_intl: 'अंतर्राष्ट्रीय भाषाएं',
        lang_auto_detect_label: '⚡ स्वचालित भाषा पहचान',
        lang_auto_detect_desc: 'आपकी लिखी भाषा को पहचानकर उसी भाषा में उत्तर देगा।',
        footer_desc: 'शानदार यात्राओं और गंतव्यों की खोज के लिए आपका AI यात्रा साथी।',
        footer_rights: 'सर्वाधिकार सुरक्षित।'
    },
    ml: {
        nav_home: 'ഹോം',
        nav_chatbot: 'AI ഗൈഡ്',
        nav_destinations: 'സ്ഥലങ്ങൾ',
        nav_planner: 'യാത്രാ പ്ലാൻ',
        nav_dashboard: 'ഡാഷ്‌ബോർഡ്',
        nav_login: 'ലോഗിൻ',
        nav_register: 'തുടങ്ങുക',
        nav_logout: 'ലോഗ്ഔട്ട്',
        nav_lang: 'ഭാഷ',
        nav_select_lang: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
        chat_title: 'TouristAI യാത്രാ സഹായി',
        chat_subtitle: 'ബുദ്ധിമാനായ യാത്രാ പ്ലാനർ',
        chat_welcome_title: 'നിങ്ങൾ എങ്ങോട്ടാണ് യാത്ര ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?',
        chat_welcome_desc: 'മലയാളത്തിലോ മറ്റ് ഭാഷകളിലോ യാത്രാ പദ്ധതികൾ, റൂട്ടുകൾ, ബജറ്റ് എന്നിവ ചോദിക്കൂ.',
        chat_input_placeholder: 'ഊട്ടിയിലേക്ക് 3 ദിവസത്തെ യാത്ര പ്ലാൻ ചെയ്യൂ...',
        chat_send: 'അയക്കുക',
        chat_mic_start: 'സംസാരിക്കുക',
        chat_mic_listening: 'കേൾക്കുന്നു… ഇപ്പോൾ സംസാരിക്കൂ',
        chat_mic_stop: 'നിർത്തുക',
        chat_listen: 'കേൾക്കുക',
        chat_stop: 'നിർത്തുക',
        chat_copy: 'പകർത്തുക',
        chat_copied: 'പകർത്തി!',
        chat_retry: 'വീണ്ടും ശ്രമിക്കുക',
        chat_share: 'പങ്കുവെക്കുക',
        chat_plan_btn: 'പൂർണ്ണ പ്ലാൻ ഉണ്ടാക്കുക',
        chat_view_dest: 'വിശദാംശങ്ങൾ കാണുക',
        chat_thinking: 'പ്ലാൻ തയ്യാറാക്കുന്നു...',
        dest_hero_title: 'യാത്രാ കേന്ദ്രങ്ങൾ കണ്ടെത്തൂ',
        dest_search_placeholder: 'സ്ഥലം തിരയുക...',
        planner_title: 'AI യാത്രാ പ്ലാനർ',
        planner_generate_btn: 'യാത്രാ പ്ലാൻ ഉണ്ടാക്കുക',
        lang_modal_title: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
        lang_tab_all: 'എല്ലാം (26)',
        lang_tab_indian: 'ഇന്ത്യൻ ഭാഷകൾ',
        lang_tab_intl: 'അന്താരാഷ്ട്രം',
        lang_auto_detect_label: '⚡ സ്വയം കണ്ടെത്തൽ',
        lang_auto_detect_desc: 'നിങ്ങൾ ടൈപ്പ് ചെയ്യുന്ന ഭാഷ തിരിച്ചറിയുന്നു.'
    },
    te: {
        nav_home: 'హోమ్',
        nav_chatbot: 'AI గైడ్',
        nav_destinations: 'ప్రదేశాలు',
        nav_planner: 'ట్రిప్ ప్లానర్',
        nav_dashboard: 'డాష్‌బోర్డ్',
        nav_login: 'లాగిన్',
        nav_register: 'ప్రారంభించండి',
        nav_logout: 'లాగ్అవుట్',
        nav_lang: 'భాష',
        nav_select_lang: 'భాషను ఎంచుకోండి',
        chat_title: 'TouristAI ట్రావెల్ గైడ్',
        chat_subtitle: 'తెలివైన పర్యాటక ప్లానర్',
        chat_welcome_title: 'మీరు ఎక్కడికి ప్రయాణించాలనుకుంటున్నారు?',
        chat_welcome_desc: 'ఊటీ, కేరళ, మనాలి వంటి ప్రదేశాల పర్యటన ప్రణాళికలు మరియు బడ్జెట్ అడగండి.',
        chat_input_placeholder: 'ఊటీకి మూడు రోజుల ట్రిప్ ప్లాన్ చేయి...',
        chat_send: 'పంపు',
        chat_mic_start: 'మాట్లాడండి',
        chat_mic_listening: 'వింటోంది... ఇప్పుడు మాట్లాడండి',
        chat_mic_stop: 'ఆపు',
        chat_listen: 'వినండి',
        chat_stop: 'ఆపు',
        chat_copy: 'కాపీ',
        chat_copied: 'కాపీ చేయబడింది!',
        chat_retry: 'మళ్లీ ప్రయత్నించండి',
        chat_share: 'షేర్ చేయండి',
        chat_plan_btn: 'పూర్తి ట్రిప్ ప్లాన్ చేయండి',
        chat_view_dest: 'వివరాలు చూడండి',
        chat_thinking: 'ప్లాన్ సిద్ధం చేస్తోంది...',
        dest_hero_title: 'అందమైన ప్రదేశాలను అన్వేషించండి',
        dest_search_placeholder: 'ప్రదేశాన్ని శోధించండి...',
        planner_title: 'AI ట్రిప్ ప్లానర్',
        planner_generate_btn: 'ప్లాన్ రూపొందించండి',
        lang_modal_title: 'భాషను ఎంచుకోండి',
        lang_tab_all: 'అన్నీ (26)',
        lang_tab_indian: 'భారతీయ భాషలు',
        lang_tab_intl: 'అంతర్జాతీయ భాషలు',
        lang_auto_detect_label: '⚡ ఆటో డిటెక్ట్',
        lang_auto_detect_desc: 'మీరు రాసే భాషను స్వయంచాలకంగా గుర్తిస్తుంది.'
    },
    kn: {
        nav_home: 'ಮುಖಪುಟ',
        nav_chatbot: 'AI ಗೈಡ್',
        nav_destinations: 'ಪ್ರವಾಸಿ ತಾಣಗಳು',
        nav_planner: 'ಪ್ರವಾಸ ಯೋಜನೆ',
        nav_dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
        nav_login: 'ಲಾಗಿನ್',
        nav_register: 'ಪ್ರಾರಂಭಿಸಿ',
        nav_logout: 'ಲಾಗ್ ಔಟ್',
        nav_lang: 'ಭಾಷೆ',
        nav_select_lang: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
        chat_title: 'TouristAI ಪ್ರವಾಸ ಸಹಾಯಕ',
        chat_subtitle: 'ಬುದ್ಧಿವಂತ ಪ್ರವಾಸ ಯೋಜಕ',
        chat_welcome_title: 'ನೀವು ಎಲ್ಲಿಗೆ ಪ್ರಯಾಣಿಸಲು ಬಯಸುತ್ತೀರಿ?',
        chat_welcome_desc: 'ಪ್ರವಾಸದ ಯೋಜನೆ, ಬಜೆಟ್ ಮತ್ತು ಮಾರ್ಗಗಳ ಬಗ್ಗೆ ಯಾವುದೇ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ.',
        chat_input_placeholder: 'ಊಟಿಗೆ 3 ದಿನಗಳ ಪ್ರವಾಸ ಯೋಜನೆಯನ್ನು ರಚಿಸಿ...',
        chat_send: 'ಕಳುಹಿಸು',
        chat_mic_start: 'ಮಾತನಾಡಿ',
        chat_mic_listening: 'ಕೇಳುತ್ತಿದೆ... ಈಗ ಮಾತನಾಡಿ',
        chat_mic_stop: 'ನಿಲ್ಲಿಸಿ',
        chat_listen: 'ಕೇಳಿ',
        chat_stop: 'ನಿಲ್ಲಿಸಿ',
        chat_copy: 'ನಕಲಿಸಿ',
        chat_copied: 'ನಕಲಿಸಲಾಗಿದೆ!',
        chat_retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
        chat_share: 'ಹಂಚಿಕೊಳ್ಳಿ',
        dest_hero_title: 'ಸುಂದರ ತಾಣಗಳನ್ನು ಅನ್ವೇಷಿಸಿ',
        planner_title: 'AI ಪ್ರವಾಸ ಯೋಜಕ',
        planner_generate_btn: 'ಯೋಜನೆ ರಚಿಸಿ',
        lang_modal_title: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
        lang_tab_all: 'ಎಲ್ಲವೂ (26)',
        lang_tab_indian: 'ಭಾರತೀಯ ಭಾಷೆಗಳು',
        lang_tab_intl: 'ಅಂತಾರಾಷ್ಟ್ರೀಯ',
        lang_auto_detect_label: '⚡ ಸ್ವಯಂ ಪತ್ತೆ',
        lang_auto_detect_desc: 'ನೀವು ಬರೆಯುವ ಭಾಷೆಯನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಗುರುತಿಸುತ್ತದೆ.'
    },
    bn: {
        nav_home: 'হোম',
        nav_chatbot: 'এআই গাইড',
        nav_destinations: 'গন্তব্যস্থল',
        nav_planner: 'ভ্রমণ পরিকল্পনা',
        nav_dashboard: 'ড্যাশবোর্ড',
        nav_login: 'সাইন ইন',
        nav_register: 'শুরু করুন',
        nav_logout: 'লগআউট',
        nav_lang: 'ভাষা',
        nav_select_lang: 'ভাষা নির্বাচন করুন',
        chat_title: 'TouristAI ভ্রমণ সঙ্গী',
        chat_subtitle: 'বুদ্ধিমান বহুভাষিক ভ্রমণ পরিকল্পনাকারী',
        chat_welcome_title: 'আপনি কোথায় ভ্রমণ করতে চান?',
        chat_welcome_desc: 'যেকোনো ভাষায় কাস্টম ভ্রমণ পরিকল্পনা, বাজেট ও রুটের তথ্য জানুন।',
        chat_input_placeholder: 'ভ্রমণ ও বাজেট সম্পর্কে যেকোনো প্রশ্ন করুন...',
        chat_send: 'পাঠান',
        chat_mic_start: 'ভয়েস ইনপুট',
        chat_mic_listening: 'শুনছি… এখন বলুন',
        chat_mic_stop: 'থামুন',
        chat_listen: 'শুনুন',
        chat_stop: 'থামুন',
        chat_copy: 'কপি',
        chat_copied: 'কপি হয়েছে!',
        dest_hero_title: 'ভারত ও বিশ্বের অপরূপ সৌন্দর্য অন্বেষণ করুন',
        planner_title: 'এআই ভ্রমণ পরিকল্পনাকারী',
        planner_generate_btn: 'পরিকল্পনা তৈরি করুন',
        lang_modal_title: 'ভাষা নির্বাচন করুন',
        lang_tab_all: 'সব (২৬)',
        lang_tab_indian: 'ভারতীয় ভাষাসমূহ',
        lang_tab_intl: 'আন্তর্জাতিক ভাষাসমূহ',
        lang_auto_detect_label: '⚡ স্বয়ংক্রিয় ভাষা শনাক্তকরণ',
        lang_auto_detect_desc: 'আপনার লেখার ভাষা স্বয়ংক্রিয়ভাবে শনাক্ত করে।'
    },
    mr: {
        nav_home: 'मुख्यपृष्ठ',
        nav_chatbot: 'AI मार्गदर्शक',
        nav_destinations: 'पर्यटन स्थळे',
        nav_planner: 'प्रवास नियोजन',
        nav_dashboard: 'डॅशबोर्ड',
        nav_login: 'साइन इन',
        nav_register: 'सुरू करा',
        nav_logout: 'लॉग आऊट',
        nav_lang: 'भाषा',
        nav_select_lang: 'भाषा निवडा',
        chat_title: 'TouristAI प्रवास साथीदार',
        chat_subtitle: 'स्मार्ट प्रवास नियोजक',
        chat_welcome_title: 'तुम्हाला कुठे प्रवास करायचा आहे?',
        chat_welcome_desc: 'कोणत्याही भाषेत बजेट, प्रवासाचे मार्ग आणि योजना विचारा.',
        chat_input_placeholder: 'ऊटीसाठी 3 दिवसांची सहल प्लॅन करा...',
        chat_send: 'पाठवा',
        chat_mic_start: 'बोला',
        chat_mic_listening: 'ऐकत आहे… आता बोला',
        chat_listen: 'ऐका',
        chat_stop: 'थांबवा',
        chat_copy: 'कॉपी करा',
        dest_hero_title: 'नवीन स्थळांचा शोध घ्या',
        planner_title: 'AI सहल नियोजक',
        planner_generate_btn: 'योजना तयार करा',
        lang_modal_title: 'भाषा निवडा',
        lang_tab_all: 'सर्व (२६)',
        lang_tab_indian: 'भारतीय भाषा',
        lang_tab_intl: 'आंतरराष्ट्रीय भाषा',
        lang_auto_detect_label: '⚡ स्वयंचलित भाषा ओळख'
    },
    gu: {
        nav_home: 'હોમ',
        nav_chatbot: 'AI ગાઇડ',
        nav_destinations: 'સ્થળો',
        nav_planner: 'પ્રવાસ આયોજન',
        nav_dashboard: 'ડેશબોર્ડ',
        nav_login: 'સાઇન ઇન',
        nav_register: 'શરૂ કરો',
        nav_logout: 'લૉગ આઉટ',
        nav_lang: 'ભાષા',
        nav_select_lang: 'ભાષા પસંદ કરો',
        chat_title: 'TouristAI પ્રવાસ સાથી',
        chat_subtitle: 'બહુભાષી પ્રવાસ આયોજક',
        chat_welcome_title: 'તમે ક્યાં પ્રવાસ કરવા માંગો છો?',
        chat_welcome_desc: 'કોઈપણ ભાષામાં કસ્ટમ પ્રવાસ કાર્યક્રમ અને બજેટ વિશે પૂછો.',
        chat_input_placeholder: 'તમારા પ્રવાસ વિશે કંઈપણ પૂછો...',
        chat_send: 'મોકલો',
        chat_mic_start: 'બોલો',
        chat_listen: 'સાંભળો',
        chat_stop: 'અટકાવો',
        dest_hero_title: 'નવા સ્થળો શોધો',
        planner_title: 'AI પ્રવાસ આયોજક',
        planner_generate_btn: 'પ્લાન બનાવો',
        lang_modal_title: 'ભાષા પસંદ કરો',
        lang_tab_all: 'બધા (26)',
        lang_tab_indian: 'ભારતીય ભાષાઓ',
        lang_tab_intl: 'આંતરરાષ્ટ્રીય ભાષાઓ',
        lang_auto_detect_label: '⚡ આપમેળે ભાષા ઓળખો'
    },
    pa: {
        nav_home: 'ਮੁੱਖ ਸਫ਼ਾ',
        nav_chatbot: 'AI ਗਾਈਡ',
        nav_destinations: 'ਸੈਰ-ਸਪਾਟਾ ਸਥਾਨ',
        nav_planner: 'ਯਾਤਰਾ ਯੋਜਨਾ',
        nav_dashboard: 'ਡੈਸ਼ਬੋਰਡ',
        nav_login: 'ਸਾਈਨ ਇਨ',
        nav_register: 'ਸ਼ੁਰੂ ਕਰੋ',
        nav_logout: 'ਲਾਗ ਆਊਟ',
        nav_lang: 'ਭਾਸ਼ਾ',
        nav_select_lang: 'ਭਾਸ਼ਾ ਚੁਣੋ',
        chat_title: 'TouristAI ਯਾਤਰਾ ਸਾਥੀ',
        chat_welcome_title: 'ਤੁਸੀਂ ਕਿੱਥੇ ਯਾਤਰਾ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?',
        chat_input_placeholder: 'ਆਪਣੀ ਯਾਤਰਾ ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ...',
        chat_send: 'ਭੇਜੋ',
        chat_listen: 'ਸੁਣੋ',
        chat_stop: 'ਰੋਕੋ',
        dest_hero_title: 'ਸੁੰਦਰ ਸਥਾਨਾਂ ਦੀ ਖੋਜ ਕਰੋ',
        planner_title: 'AI ਯਾਤਰਾ ਯੋਜਨਾਕਾਰ',
        planner_generate_btn: 'ਯੋਜਨਾ ਬਣਾਓ',
        lang_modal_title: 'ਭਾਸ਼ਾ ਚੁਣੋ',
        lang_tab_all: 'ਸਭ (26)',
        lang_tab_indian: 'ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ',
        lang_tab_intl: 'ਅੰਤਰਰਾਸ਼ਟਰੀ ਭਾਸ਼ਾਵਾਂ',
        lang_auto_detect_label: '⚡ ਸਵੈਚਾਲਤ ਪਛਾਣ'
    },
    ur: {
        nav_home: 'ہوم',
        nav_chatbot: 'AI گائیڈ',
        nav_destinations: 'مقامات',
        nav_planner: 'سفر کا منصوبہ',
        nav_dashboard: 'ڈیش بورڈ',
        nav_login: 'سائن ان',
        nav_register: 'شروع کریں',
        nav_logout: 'لاگ آؤٹ',
        nav_lang: 'زبان',
        nav_select_lang: 'زبان منتخب کریں',
        chat_title: 'TouristAI سفری رہنما',
        chat_subtitle: 'ذہین کثیر لسانی ٹریول پلانر',
        chat_welcome_title: 'آپ اگلا سفر کہاں کرنا چاہتے ہیں؟',
        chat_welcome_desc: 'کسی بھی زبان میں اپنے سفر کے بجٹ، راستوں اور تفصیلی منصوبے کے بارے میں دریافت کریں۔',
        chat_input_placeholder: 'اپنے سفر کے بارے میں کچھ بھی پوچھیں...',
        chat_send: 'بھیجیں',
        chat_mic_start: 'بول کر پوچھیں',
        chat_listen: 'سنیں',
        chat_stop: 'روکیں',
        chat_copy: 'کاپی کریں',
        chat_copied: 'کاپی ہو گیا!',
        dest_hero_title: 'خوبصورت مقامات کی سیر کریں',
        planner_title: 'AI ٹریول پلانر',
        planner_generate_btn: 'منصوبہ بنائیں',
        lang_modal_title: 'زبان منتخب کریں',
        lang_tab_all: 'تمام (26)',
        lang_tab_indian: 'ہندوستانی زبانیں',
        lang_tab_intl: 'بین الاقوامی زبانیں',
        lang_auto_detect_label: '⚡ خودکار زبان کی شناخت'
    },
    or: {
        nav_home: 'ମୂଳପୃଷ୍ଠା',
        nav_chatbot: 'AI ଗାଇଡ୍',
        nav_destinations: 'ସ୍ଥାନଗୁଡ଼ିକ',
        nav_planner: 'ଯାତ୍ରା ଯୋଜନା',
        nav_dashboard: 'ଡ୍ୟାସବୋର୍ଡ',
        nav_login: 'ସାଇନ୍ ଇନ୍',
        nav_register: 'ଆରମ୍ଭ କରନ୍ତୁ',
        nav_logout: 'ଲଗ୍ ଆଉଟ୍',
        nav_lang: 'ଭାଷା',
        nav_select_lang: 'ଭାଷା ଚୟନ କରନ୍ତୁ',
        chat_title: 'TouristAI ଯାତ୍ରା ସାଥୀ',
        chat_welcome_title: 'ଆପଣ କେଉଁଠାକୁ ଯାତ୍ରା କରିବାକୁ ଚାହାଁନ୍ତି?',
        chat_input_placeholder: 'ଆପଣଙ୍କ ଯାତ୍ରା ବିଷୟରେ ଯାହା ଇଚ୍ଛା ପଚାରନ୍ତୁ...',
        chat_send: 'ପଠାନ୍ତୁ',
        chat_listen: 'ଶୁଣନ୍ତୁ',
        chat_stop: 'ବନ୍ଦ କରନ୍ତୁ',
        dest_hero_title: 'ସୁନ୍ଦର ସ୍ଥାନଗୁଡ଼ିକୁ ଆବିଷ୍କାର କରନ୍ତୁ',
        planner_title: 'AI ଯାତ୍ରା ଯୋଜନାକାରୀ',
        planner_generate_btn: 'ଯୋଜନା ପ୍ରସ୍ତୁତ କରନ୍ତୁ',
        lang_modal_title: 'ଭାଷା ଚୟନ କରନ୍ତୁ',
        lang_tab_all: 'ସମସ୍ତ (26)',
        lang_tab_indian: 'ଭାରତୀୟ ଭାଷା',
        lang_tab_intl: 'ଆନ୍ତର୍ଜାତୀୟ ଭାଷା',
        lang_auto_detect_label: '⚡ ସ୍ୱୟଂଚାଳିତ ଭାଷା ଚିହ୍ନଟ'
    },
    as: {
        nav_home: 'গৃহপৃষ্ঠা',
        nav_chatbot: 'AI গাইড',
        nav_destinations: 'ভ্ৰমণস্থলী',
        nav_planner: 'ভ্ৰমণ পৰিকল্পনা',
        nav_dashboard: 'ডেশ্ববৰ্ড',
        nav_login: 'ছাইন ইন',
        nav_register: 'আৰম্ভ কৰক',
        nav_logout: 'লগ আউট',
        nav_lang: 'ভাষা',
        nav_select_lang: 'ভাষা বাছক',
        chat_title: 'TouristAI ভ্ৰমণ সঙ্গী',
        chat_welcome_title: 'আপুনি ক’লৈ ভ্ৰমণ কৰিব বিচাৰে?',
        chat_input_placeholder: 'আপোনাৰ ভ্ৰমণৰ বিষয়ে যিকোনো কথা সোধক...',
        chat_send: 'পঠিয়াওক',
        chat_listen: 'শুনক',
        chat_stop: 'বন্ধ কৰক',
        dest_hero_title: 'নতুন ঠাই অন্বেষণ কৰক',
        planner_title: 'AI ভ্ৰমণ পৰিকল্পনাকাৰী',
        planner_generate_btn: 'পৰিকল্পনা প্ৰস্তুত কৰক',
        lang_modal_title: 'ভাষা নিৰ্বাচন কৰক',
        lang_tab_all: 'সকলো (২৬)',
        lang_tab_indian: 'ভাৰতীয় ভাষাসমূহ',
        lang_tab_intl: 'আন্তঃৰাষ্ট্ৰীয় ভাষাসমূহ',
        lang_auto_detect_label: '⚡ স্বয়ংক্ৰিয় ভাষা চিনাক্তকৰণ'
    },
    fr: {
        nav_home: 'Accueil',
        nav_chatbot: 'Guide IA',
        nav_destinations: 'Destinations',
        nav_planner: 'Planifier Voyage',
        nav_dashboard: 'Tableau de bord',
        nav_login: 'Connexion',
        nav_register: 'Commencer',
        nav_logout: 'Déconnexion',
        nav_lang: 'Langue',
        nav_select_lang: 'Choisir la langue',
        chat_title: 'Compagnon de Voyage TouristAI',
        chat_subtitle: 'Planificateur d’itinéraires intelligent et multilingue',
        chat_welcome_title: 'Où souhaitez-vous voyager ?',
        chat_welcome_desc: 'Demandez des itinéraires sur mesure, des estimations de budget et des conseils locaux.',
        chat_input_placeholder: 'Posez vos questions sur votre prochain voyage…',
        chat_send: 'Envoyer',
        chat_mic_start: 'Parler',
        chat_mic_listening: 'Écoute en cours… parlez maintenant',
        chat_listen: 'Écouter',
        chat_stop: 'Arrêter',
        chat_copy: 'Copier',
        chat_copied: 'Copié !',
        chat_retry: 'Réessayer',
        chat_share: 'Partager',
        dest_hero_title: 'Explorez l’Inde et le Monde',
        dest_search_placeholder: 'Rechercher une destination, un lieu…',
        planner_title: 'Générateur d’itinéraires IA',
        planner_generate_btn: 'Générer l’itinéraire IA',
        lang_modal_title: 'Sélectionner la langue',
        lang_tab_all: 'Toutes (26)',
        lang_tab_indian: 'Langues indiennes',
        lang_tab_intl: 'International',
        lang_auto_detect_label: '⚡ Détection automatique',
        lang_auto_detect_desc: 'Détecte automatiquement votre langue de saisie.'
    },
    es: {
        nav_home: 'Inicio',
        nav_chatbot: 'Guía IA',
        nav_destinations: 'Destinos',
        nav_planner: 'Planificar Viaje',
        nav_dashboard: 'Panel',
        nav_login: 'Iniciar Sesión',
        nav_register: 'Comenzar',
        nav_logout: 'Cerrar Sesión',
        nav_lang: 'Idioma',
        nav_select_lang: 'Seleccionar idioma',
        chat_title: 'Compañero de Viaje TouristAI',
        chat_subtitle: 'Planificador de viajes inteligente y multilingüe',
        chat_welcome_title: '¿A dónde te gustaría viajar?',
        chat_welcome_desc: 'Pide itinerarios personalizados, presupuestos y recomendaciones en cualquier idioma.',
        chat_input_placeholder: 'Pregunta lo que desees sobre tu viaje…',
        chat_send: 'Enviar',
        chat_mic_start: 'Hablar',
        chat_mic_listening: 'Escuchando… habla ahora',
        chat_listen: 'Escuchar',
        chat_stop: 'Detener',
        chat_copy: 'Copiar',
        chat_copied: '¡Copiado!',
        dest_hero_title: 'Explora la India y el Mundo',
        dest_search_placeholder: 'Buscar destino, monumento o región…',
        planner_title: 'Creador de Itinerarios IA',
        planner_generate_btn: 'Generar Itinerario IA',
        lang_modal_title: 'Seleccionar idioma',
        lang_tab_all: 'Todos (26)',
        lang_tab_indian: 'Idiomas de la India',
        lang_tab_intl: 'Internacional',
        lang_auto_detect_label: '⚡ Detección automática'
    },
    de: {
        nav_home: 'Startseite',
        nav_chatbot: 'KI-Reiseführer',
        nav_destinations: 'Reiseziele',
        nav_planner: 'Reise Planen',
        nav_dashboard: 'Dashboard',
        nav_login: 'Anmelden',
        nav_register: 'Registrieren',
        nav_logout: 'Abmelden',
        nav_lang: 'Sprache',
        nav_select_lang: 'Sprache wählen',
        chat_title: 'TouristAI Reisebegleiter',
        chat_welcome_title: 'Wohin möchten Sie reisen?',
        chat_input_placeholder: 'Fragen Sie alles über Ihre Reise…',
        chat_send: 'Senden',
        chat_listen: 'Anhören',
        chat_stop: 'Stopp',
        dest_hero_title: 'Entdecken Sie faszinierende Reiseziele',
        planner_title: 'KI-Reiseplaner',
        planner_generate_btn: 'Reiseplan erstellen',
        lang_modal_title: 'Sprache auswählen',
        lang_tab_all: 'Alle (26)',
        lang_tab_indian: 'Indische Sprachen',
        lang_tab_intl: 'International',
        lang_auto_detect_label: '⚡ Automatische Erkennung'
    },
    it: {
        nav_home: 'Home',
        nav_chatbot: 'Guida IA',
        nav_destinations: 'Destinazioni',
        nav_planner: 'Pianifica Viaggio',
        nav_dashboard: 'Dashboard',
        nav_login: 'Accedi',
        nav_register: 'Inizia Ora',
        nav_logout: 'Esci',
        nav_lang: 'Lingua',
        nav_select_lang: 'Seleziona Lingua',
        chat_title: 'TouristAI Compagno di Viaggio',
        chat_welcome_title: 'Dove vorresti viaggiare?',
        chat_input_placeholder: 'Chiedi qualsiasi cosa sul tuo viaggio…',
        chat_send: 'Invia',
        chat_listen: 'Ascolta',
        chat_stop: 'Ferma',
        dest_hero_title: 'Esplora Destinazioni Straordinarie',
        planner_title: 'Pianificatore Itinerari IA',
        planner_generate_btn: 'Genera Itinerario',
        lang_modal_title: 'Seleziona Lingua',
        lang_tab_all: 'Tutte (26)',
        lang_tab_indian: 'Lingue Indiane',
        lang_tab_intl: 'Internazionale',
        lang_auto_detect_label: '⚡ Rilevamento Automatico'
    },
    pt: {
        nav_home: 'Início',
        nav_chatbot: 'Guia IA',
        nav_destinations: 'Destinos',
        nav_planner: 'Planejar Viagem',
        nav_dashboard: 'Painel',
        nav_login: 'Entrar',
        nav_register: 'Começar',
        nav_logout: 'Sair',
        nav_lang: 'Idioma',
        nav_select_lang: 'Selecionar Idioma',
        chat_title: 'TouristAI Companheiro de Viagem',
        chat_welcome_title: 'Para onde você quer viajar?',
        chat_input_placeholder: 'Pergunte qualquer coisa sobre sua viagem…',
        chat_send: 'Enviar',
        chat_listen: 'Ouvir',
        chat_stop: 'Parar',
        dest_hero_title: 'Explore Destinos Fascinantes',
        planner_title: 'Planejador de Viagens IA',
        planner_generate_btn: 'Gerar Roteiro',
        lang_modal_title: 'Selecionar Idioma',
        lang_tab_all: 'Todos (26)',
        lang_tab_indian: 'Idiomas Indianos',
        lang_tab_intl: 'Internacional',
        lang_auto_detect_label: '⚡ Detecção Automática'
    },
    ar: {
        nav_home: 'الرئيسية',
        nav_chatbot: 'مرشد الذكاء الاصطناعي',
        nav_destinations: 'الوجهات',
        nav_planner: 'تخطيط الرحلة',
        nav_dashboard: 'لوحة التحكم',
        nav_login: 'تسجيل الدخول',
        nav_register: 'ابدأ مجاناً',
        nav_logout: 'تسجيل الخروج',
        nav_lang: 'اللغة',
        nav_select_lang: 'اختر اللغة',
        chat_title: 'TouristAI رفيق السفر الذكي',
        chat_subtitle: 'مخطط رحلات ذكي متعدد اللغات',
        chat_welcome_title: 'إلى أين ترغب في السفر؟',
        chat_welcome_desc: 'احصل على جداول رحلات مخصصة وتقديرات الميزانية باللغة العربية.',
        chat_input_placeholder: 'اسأل عن أي شيء يخص رحلتك وميزانيتك...',
        chat_send: 'إرسال',
        chat_mic_start: 'تحدث الآن',
        chat_listen: 'استمع',
        chat_stop: 'إيقاف',
        chat_copy: 'نسخ',
        chat_copied: 'تم النسخ!',
        dest_hero_title: 'استكشف أجمل الوجهات السياحية',
        planner_title: 'مخطط الرحلات بالذكاء الاصطناعي',
        planner_generate_btn: 'إنشاء خطة الرحلة',
        lang_modal_title: 'اختر اللغة',
        lang_tab_all: 'الكل (26)',
        lang_tab_indian: 'اللغات الهندية',
        lang_tab_intl: 'الدولية',
        lang_auto_detect_label: '⚡ التعرف التلقائي على اللغة'
    },
    zh: {
        nav_home: '首页',
        nav_chatbot: 'AI 导游',
        nav_destinations: '目的地',
        nav_planner: '行程规划',
        nav_dashboard: '控制台',
        nav_login: '登录',
        nav_register: '免费开始',
        nav_logout: '退出',
        nav_lang: '语言',
        nav_select_lang: '选择语言',
        chat_title: 'TouristAI 智能旅行助手',
        chat_subtitle: '多语言智能旅行路线规划专家',
        chat_welcome_title: '您下一次想去哪里旅行？',
        chat_welcome_desc: '用您熟悉的语言咨询定制行程、交通路线和预算详情。',
        chat_input_placeholder: '输入关于旅行、预算或行程的问题…',
        chat_send: '发送',
        chat_mic_start: '语音输入',
        chat_listen: '朗读',
        chat_stop: '停止',
        chat_copy: '复制',
        chat_copied: '已复制！',
        dest_hero_title: '探索印度与全球热门景点',
        dest_search_placeholder: '搜索目的地、景点或类别…',
        planner_title: 'AI 智能行程定制',
        planner_generate_btn: '生成旅行计划',
        lang_modal_title: '选择语言',
        lang_tab_all: '全部 (26)',
        lang_tab_indian: '印度语言',
        lang_tab_intl: '国际语言',
        lang_auto_detect_label: '⚡ 智能自动识别'
    },
    ja: {
        nav_home: 'ホーム',
        nav_chatbot: 'AI ガイド',
        nav_destinations: '観光地',
        nav_planner: '旅行プラン',
        nav_dashboard: 'ダッシュボード',
        nav_login: 'ログイン',
        nav_register: '今すぐ開始',
        nav_logout: 'ログアウト',
        nav_lang: '言語',
        nav_select_lang: '言語を選択',
        chat_title: 'TouristAI トラベルコンパニオン',
        chat_welcome_title: '次はどこへ旅行しますか？',
        chat_input_placeholder: '旅行プランや予算について何でも聞いてください…',
        chat_send: '送信',
        chat_listen: '音声再生',
        chat_stop: '停止',
        dest_hero_title: '素晴らしい旅先を見つけよう',
        planner_title: 'AI 旅行プランナー',
        planner_generate_btn: '旅程を作成する',
        lang_modal_title: '言語を選択',
        lang_tab_all: 'すべて (26)',
        lang_tab_indian: 'インドの言語',
        lang_tab_intl: '国際言語',
        lang_auto_detect_label: '⚡ 自動言語検出'
    },
    ko: {
        nav_home: '홈',
        nav_chatbot: 'AI 가이드',
        nav_destinations: '여행지',
        nav_planner: '여행 계획',
        nav_dashboard: '대시보드',
        nav_login: '로그인',
        nav_register: '시작하기',
        nav_logout: '로그아웃',
        nav_lang: '언어',
        nav_select_lang: '언어 선택',
        chat_title: 'TouristAI 여행 도우미',
        chat_welcome_title: '어디로 여행을 떠나시겠습니까?',
        chat_input_placeholder: '여행 일정, 예산, 코스에 대해 질문하세요…',
        chat_send: '전송',
        chat_listen: '듣기',
        chat_stop: '정지',
        dest_hero_title: '멋진 여행지를 탐험해보세요',
        planner_title: 'AI 여행 플래너',
        planner_generate_btn: '일정 생성하기',
        lang_modal_title: '언어 선택',
        lang_tab_all: '전체 (26)',
        lang_tab_indian: '인도 언어',
        lang_tab_intl: '국제 언어',
        lang_auto_detect_label: '⚡ 자동 언어 감지'
    },
    ru: {
        nav_home: 'Главная',
        nav_chatbot: 'ИИ-гид',
        nav_destinations: 'Направления',
        nav_planner: 'План поездки',
        nav_dashboard: 'Панель',
        nav_login: 'Войти',
        nav_register: 'Начать',
        nav_logout: 'Выйти',
        nav_lang: 'Язык',
        nav_select_lang: 'Выбрать язык',
        chat_title: 'TouristAI Ваш попутчик',
        chat_welcome_title: 'Куда бы вы хотели отправиться?',
        chat_input_placeholder: 'Спросите о маршрутах, ценах и отелях…',
        chat_send: 'Отправить',
        chat_listen: 'Слушать',
        chat_stop: 'Стоп',
        dest_hero_title: 'Откройте для себя Индию и мир',
        planner_title: 'ИИ-планировщик маршрутов',
        planner_generate_btn: 'Создать маршрут',
        lang_modal_title: 'Выберите язык',
        lang_tab_all: 'Все (26)',
        lang_tab_indian: 'Языки Индии',
        lang_tab_intl: 'Международные',
        lang_auto_detect_label: '⚡ Автоопределение языка'
    },
    id: {
        nav_home: 'Beranda',
        nav_chatbot: 'Panduan AI',
        nav_destinations: 'Destinasi',
        nav_planner: 'Rencana Perjalanan',
        nav_dashboard: 'Dasbor',
        nav_login: 'Masuk',
        nav_register: 'Mulai',
        nav_logout: 'Keluar',
        nav_lang: 'Bahasa',
        nav_select_lang: 'Pilih Bahasa',
        chat_title: 'TouristAI Sahabat Perjalanan',
        chat_welcome_title: 'Ke mana Anda ingin bepergian selanjutnya?',
        chat_input_placeholder: 'Tanyakan apa saja tentang wisata, rute, dan bujet…',
        chat_send: 'Kirim',
        chat_listen: 'Dengarkan',
        chat_stop: 'Berhenti',
        dest_hero_title: 'Jelajahi Berbagai Destinasi Indah',
        planner_title: 'Perencana Perjalanan AI',
        planner_generate_btn: 'Buat Rencana Perjalanan',
        lang_modal_title: 'Pilih Bahasa',
        lang_tab_all: 'Semua (26)',
        lang_tab_indian: 'Bahasa India',
        lang_tab_intl: 'Internasional',
        lang_auto_detect_label: '⚡ Deteksi Otomatis'
    },
    th: {
        nav_home: 'หน้าแรก',
        nav_chatbot: 'คู่มือ AI',
        nav_destinations: 'จุดหมายปลายทาง',
        nav_planner: 'วางแผนเที่ยว',
        nav_dashboard: 'แดชบอร์ด',
        nav_login: 'เข้าสู่ระบบ',
        nav_register: 'เริ่มต้นใช้งาน',
        nav_logout: 'ออกจากระบบ',
        nav_lang: 'ภาษา',
        nav_select_lang: 'เลือกภาษา',
        chat_title: 'TouristAI เพื่อนเดินทางอัจฉริยะ',
        chat_welcome_title: 'คุณอยากไปเที่ยวที่ไหนต่อไป?',
        chat_input_placeholder: 'สอบถามเกี่ยวกับทริป แผนการเดินทาง และงบประมาณ…',
        chat_send: 'ส่ง',
        chat_listen: 'ฟังเสียง',
        chat_stop: 'หยุด',
        dest_hero_title: 'สำรวจสถานที่ท่องเที่ยวที่น่าตื่นตาตื่นใจ',
        planner_title: 'ระบบวางแผนการเดินทาง AI',
        planner_generate_btn: 'สร้างแผนการเดินทาง',
        lang_modal_title: 'เลือกภาษา',
        lang_tab_all: 'ทั้งหมด (26)',
        lang_tab_indian: 'ภาษาอินเดีย',
        lang_tab_intl: 'ต่างประเทศ',
        lang_auto_detect_label: '⚡ ตรวจจับภาษาอัตโนมัติ'
    },
    vi: {
        nav_home: 'Trang chủ',
        nav_chatbot: 'Hướng dẫn viên AI',
        nav_destinations: 'Điểm đến',
        nav_planner: 'Lên kế hoạch',
        nav_dashboard: 'Bảng điều khiển',
        nav_login: 'Đăng nhập',
        nav_register: 'Bắt đầu',
        nav_logout: 'Đăng xuất',
        nav_lang: 'Ngôn ngữ',
        nav_select_lang: 'Chọn ngôn ngữ',
        chat_title: 'TouristAI Bạn đồng hành du lịch',
        chat_welcome_title: 'Bạn muốn đi du lịch ở đâu tiếp theo?',
        chat_input_placeholder: 'Hỏi bất kỳ điều gì về lịch trình, chi phí…',
        chat_send: 'Gửi',
        chat_listen: 'Nghe',
        chat_stop: 'Dừng',
        dest_hero_title: 'Khám phá các điểm đến tuyệt đẹp',
        planner_title: 'Lập kế hoạch du lịch AI',
        planner_generate_btn: 'Tạo lịch trình',
        lang_modal_title: 'Chọn ngôn ngữ',
        lang_tab_all: 'Tất cả (26)',
        lang_tab_indian: 'Ngôn ngữ Ấn Độ',
        lang_tab_intl: 'Quốc tế',
        lang_auto_detect_label: '⚡ Tự động nhận diện ngôn ngữ'
    }
};

const I18n = {
    languages: SUPPORTED_LANGUAGES,

    getCurrentLanguage() {
        return localStorage.getItem(I18N_STORAGE_KEY) || 'auto';
    },

    getEffectiveLanguage() {
        const lang = this.getCurrentLanguage();
        if (lang === 'auto') {
            return 'en';
        }
        return lang;
    },

    getLanguageMeta(code) {
        return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES.find(l => l.code === 'en');
    },

    setLanguage(code) {
        const target = SUPPORTED_LANGUAGES.find(l => l.code === code);
        if (!target) return;

        localStorage.setItem(I18N_STORAGE_KEY, code);

        // Apply HTML dir and lang
        const effective = code === 'auto' ? 'en' : code;
        const meta = this.getLanguageMeta(effective);
        document.documentElement.setAttribute('lang', effective);
        document.documentElement.setAttribute('dir', meta.dir || 'ltr');

        // Apply translations
        this.applyTranslations();

        // Update Nav indicator
        this.updateNavButton();

        // Dispatch global event for other components
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: code, effectiveLanguage: effective } }));
    },

    t(key, fallback = '') {
        const current = this.getCurrentLanguage();
        const effective = (current === 'auto') ? 'en' : current;

        // Try selected language
        if (TRANSLATIONS[effective] && TRANSLATIONS[effective][key]) {
            return TRANSLATIONS[effective][key];
        }

        // Try English fallback
        if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
            return TRANSLATIONS.en[key];
        }

        return fallback || key;
    },

    applyTranslations() {
        // Elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const text = this.t(key);
                if (text) el.textContent = text;
            }
        });

        // Elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const text = this.t(key);
                if (text) el.setAttribute('placeholder', text);
            }
        });

        // Elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                const text = this.t(key);
                if (text) el.setAttribute('title', text);
            }
        });
    },

    detectLanguage(text) {
        if (!text || typeof text !== 'string') return 'en';
        const str = text.trim();
        const lower = str.toLowerCase();

        // 0. Explicit language switch commands in user prompt
        const cmdMatch = lower.match(/\b(?:reply|answer|speak|respond|talk|write|translate|switch)\s+(?:in|into|to)\s+([a-zA-Z]+)\b/i);
        if (cmdMatch) {
            const map = {
                tamil: 'ta', hindi: 'hi', telugu: 'te', malayalam: 'ml', kannada: 'kn', bengali: 'bn',
                marathi: 'mr', gujarati: 'gu', punjabi: 'pa', urdu: 'ur', french: 'fr', spanish: 'es',
                german: 'de', italian: 'it', portuguese: 'pt', arabic: 'ar', chinese: 'zh', japanese: 'ja',
                korean: 'ko', russian: 'ru', english: 'en'
            };
            const target = cmdMatch[1].toLowerCase();
            if (map[target]) return map[target];
        }
        if (lower.includes('தமிழில்') || lower.includes('தமிள்') || lower.includes('tamil la') || lower.includes('tanglish')) return 'ta';
        if (lower.includes('हिंदी में') || lower.includes('हिन्दी में') || lower.includes('hindi me') || lower.includes('hinglish')) return 'hi';
        if (lower.includes('తెలుగులో')) return 'te';
        if (lower.includes('മലയാളത്തിൽ')) return 'ml';
        if (lower.includes('ಕನ್ನಡದಲ್ಲಿ')) return 'kn';
        if (lower.includes('বাংলায়')) return 'bn';
        if (lower.includes('en français') || lower.includes('en francais')) return 'fr';
        if (lower.includes('en español') || lower.includes('en espanol')) return 'es';
        if (lower.includes('auf deutsch')) return 'de';

        // 1. Unicode Script Range Detection
        if (/[\u0B80-\u0BFF]/.test(str)) return 'ta'; // Tamil
        if (/[\u0D00-\u0D7F]/.test(str)) return 'ml'; // Malayalam
        if (/[\u0C00-\u0C7F]/.test(str)) return 'te'; // Telugu
        if (/[\u0C80-\u0CFF]/.test(str)) return 'kn'; // Kannada
        if (/[\u0980-\u09FF]/.test(str)) return 'bn'; // Bengali / Assamese
        if (/[\u0A80-\u0AFF]/.test(str)) return 'gu'; // Gujarati
        if (/[\u0A00-\u0A7F]/.test(str)) return 'pa'; // Punjabi (Gurmukhi)
        if (/[\u0B00-\u0B7F]/.test(str)) return 'or'; // Odia
        if (/[\u0900-\u097F]/.test(str)) return 'hi'; // Devanagari (Hindi / Marathi)
        if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str)) {
            // Check for Urdu specific letters (ٹ, ڈ, ڑ, ے, ں, ہ)
            if (/[ٹڈڑےں]/.test(str)) return 'ur';
            return 'ar';
        }
        if (/[\u3040-\u309F\u30A0-\u30FF]/.test(str)) return 'ja'; // Japanese
        if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(str)) return 'ko'; // Korean
        if (/[\u4E00-\u9FFF]/.test(str)) return 'zh'; // Chinese
        if (/[\u0400-\u04FF]/.test(str)) return 'ru'; // Russian (Cyrillic)
        if (/[\u0E00-\u0E7F]/.test(str)) return 'th'; // Thai

        // 2. Code-switching / Latin heuristics (Tanglish, Hinglish, Spanish, French, etc.)
        // Tanglish heuristics (Tamil-English mixed)
        const tanglishKeywords = [
            'pathi', 'sollunga', 'sollu', 'irundhu', 'lerundhu', 'lendhu', 'lirundhu', 'pannu', 'pannunga', 
            'theriyuma', 'vanakkam', 'konjam', 'kammi', 'kamti', 'nalla', 'polaam', 'polam', 'enna', 
            'eppadi', 'epdi', 'inga', 'enga', 'romba', 'machan', 'bro', 'thambi', 'kooda', 'paakalaam', 
            'iruku', 'irukku', 'edhuvum', 'venum', 'poga', 'neram', 'kudunga', 'thanga', 'vaanga', 
            'ooru', 'nanba', 'ponga', 'oru', 'naal', 'ootyku', 'paakanum', 'selavu'
        ];
        if (tanglishKeywords.some(w => new RegExp('\\b' + w + '\\b', 'i').test(lower))) {
            return 'ta';
        }

        // Hinglish heuristics (Hindi-English mixed)
        const hinglishKeywords = [
            'kaise', 'batao', 'bataiye', 'jaa', 'sakte', 'kya', 'hai', 'hain', 'karo', 'karna', 
            'kahan', 'kitna', 'kitne', 'chahiye', 'chalna', 'jaana', 'bhi', 'aur', 'accha', 'achha', 
            'ghumne', 'jagah', 'raasta', 'paas', 'dikhaye', 'chalo', 'bhai', 'mujhe', 'humko', 
            'kripya', 'shukriya'
        ];
        if (hinglishKeywords.some(w => new RegExp('\\b' + w + '\\b', 'i').test(lower))) {
            return 'hi';
        }

        // French
        if (/\b(bonjour|merci|comment aller|voyage|visiter|je veux|quel est|s'il vous plaît|pourquoi)\b/i.test(lower)) return 'fr';
        // Spanish
        if (/\b(hola|gracias|cómo llegar|como llegar|viaje|visitar|quiero|cuál es|por favor|dónde está)\b/i.test(lower)) return 'es';
        // German
        if (/\b(hallo|danke|wie komme|reise|besuchen|ich möchte|wo ist|bitte)\b/i.test(lower)) return 'de';
        // Italian
        if (/\b(ciao|grazie|viaggio|dove|quanto costa|come arrivare)\b/i.test(lower)) return 'it';
        // Portuguese
        if (/\b(ola|obrigado|viagem|onde|quanto custa|como chegar)\b/i.test(lower)) return 'pt';
        // Indonesian
        if (/\b(halo|terima kasih|perjalanan|bagaimana|berapa|ke mana)\b/i.test(lower)) return 'id';

        return 'en';
    },

    getChatLanguage() {
        return localStorage.getItem('tourist_chat_language') || 'auto';
    },

    setChatLanguage(code) {
        if (!code) code = 'auto';
        localStorage.setItem('tourist_chat_language', code);
        window.dispatchEvent(new CustomEvent('chatLanguageChanged', { detail: { language: code } }));
    },

    updateNavButton() {
        const label = document.getElementById('currentLangLabel');
        const flag = document.getElementById('currentLangFlag');
        const current = this.getCurrentLanguage();
        const meta = this.getLanguageMeta(current);

        if (label && meta) {
            label.textContent = meta.code === 'auto' ? 'Auto Detect' : meta.nativeName;
        }
        if (flag && meta) {
            flag.textContent = meta.flag || '🌐';
        }
    },

    renderLanguageModal() {
        let modal = document.getElementById('langModalBackdrop');
        if (modal) return;

        modal = document.createElement('div');
        modal.id = 'langModalBackdrop';
        modal.className = 'lang-modal-backdrop';
        modal.innerHTML = `
            <div class="lang-modal-card" role="dialog" aria-modal="true" aria-labelledby="langModalTitle">
                <div class="lang-modal-header">
                    <div>
                        <h3 id="langModalTitle" class="lang-modal-title">Select Language</h3>
                        <p class="lang-modal-desc">26 Languages supported with native scripts & AI planning</p>
                    </div>
                    <button class="lang-modal-close" onclick="I18n.closeModal()" title="Close" aria-label="Close modal">&times;</button>
                </div>

                <div class="lang-search-wrap">
                    <i class="fas fa-search lang-search-icon"></i>
                    <input 
                        type="text" 
                        id="langSearchInput" 
                        class="lang-search-input" 
                        placeholder="Search language (e.g. Tamil, French, हिंदी)..." 
                        oninput="I18n.filterLanguages(this.value)">
                </div>

                <div class="lang-tabs-bar">
                    <button class="lang-tab-btn active" data-cat="all" onclick="I18n.switchTab('all', this)">All (26)</button>
                    <button class="lang-tab-btn" data-cat="indian" onclick="I18n.switchTab('indian', this)">Indian (13)</button>
                    <button class="lang-tab-btn" data-cat="intl" onclick="I18n.switchTab('intl', this)">International (13)</button>
                </div>

                <!-- Auto Detect Toggle Card -->
                <div class="lang-auto-card ${this.getCurrentLanguage() === 'auto' ? 'active' : ''}" onclick="I18n.selectAndClose('auto')">
                    <div class="lang-auto-icon">⚡</div>
                    <div class="lang-auto-info">
                        <strong>Auto Detect from Message (Recommended)</strong>
                        <span>Automatically replies in Tamil, Tanglish, Hindi, French, or whichever language you ask in.</span>
                    </div>
                    <span class="lang-active-badge">${this.getCurrentLanguage() === 'auto' ? 'Active' : ''}</span>
                </div>

                <div class="lang-grid-container" id="langGridContainer"></div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) I18n.closeModal();
        });

        this.renderLangGrid();
    },

    renderLangGrid(filterQuery = '', activeCat = 'all') {
        const container = document.getElementById('langGridContainer');
        if (!container) return;

        const current = this.getCurrentLanguage();
        const q = filterQuery.toLowerCase().trim();

        // Exclude 'auto' from standard grid since it's pinned at top
        const list = SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto').filter(l => {
            if (activeCat !== 'all' && l.category !== activeCat) return false;
            if (q) {
                return l.name.toLowerCase().includes(q) || 
                       l.nativeName.toLowerCase().includes(q) || 
                       l.code.toLowerCase().includes(q);
            }
            return true;
        });

        container.innerHTML = list.map(l => `
            <button class="lang-grid-item ${l.code === current ? 'active' : ''}" onclick="I18n.selectAndClose('${l.code}')">
                <span class="lang-grid-flag">${l.flag}</span>
                <div class="lang-grid-texts">
                    <span class="lang-grid-native">${l.nativeName}</span>
                    <span class="lang-grid-name">${l.name}</span>
                </div>
                ${l.code === current ? '<i class="fas fa-check lang-grid-check"></i>' : ''}
            </button>
        `).join('');
    },

    filterLanguages(query) {
        const activeTab = document.querySelector('.lang-tab-btn.active');
        const cat = activeTab ? activeTab.getAttribute('data-cat') : 'all';
        this.renderLangGrid(query, cat);
    },

    switchTab(cat, btn) {
        document.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const searchInput = document.getElementById('langSearchInput');
        this.renderLangGrid(searchInput ? searchInput.value : '', cat);
    },

    selectAndClose(code) {
        this.setLanguage(code);
        this.closeModal();
    },

    openModal() {
        this.renderLanguageModal();
        const modal = document.getElementById('langModalBackdrop');
        if (modal) {
            modal.classList.add('open');
            const search = document.getElementById('langSearchInput');
            if (search) {
                search.value = '';
                setTimeout(() => search.focus(), 100);
            }
            this.renderLangGrid('', 'all');
        }
    },

    closeModal() {
        const modal = document.getElementById('langModalBackdrop');
        if (modal) {
            modal.classList.remove('open');
            setTimeout(() => {
                if (modal.parentElement) modal.parentElement.removeChild(modal);
            }, 200);
        }
    },

    init() {
        const current = this.getCurrentLanguage();
        const effective = current === 'auto' ? 'en' : current;
        const meta = this.getLanguageMeta(effective);

        document.documentElement.setAttribute('lang', effective);
        document.documentElement.setAttribute('dir', meta.dir || 'ltr');

        this.applyTranslations();
        this.updateNavButton();

        // Wire any #langSelectorBtn
        document.querySelectorAll('.lang-selector-trigger, #langSelectorBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                I18n.openModal();
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    I18n.init();
});
