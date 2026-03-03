import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Get initial language from localStorage
const getInitialLanguage = (): string => {
  if (typeof window === 'undefined') return 'tr'
  try {
    return localStorage.getItem('language') || 'tr'
  } catch {
    return 'tr'
  }
}

// Translation resources
const resources = {
  tr: {
    translation: {
      // App general
      appName: 'NICEBASE',
      vault: 'Kasa',
      relationshipSaver: 'Bağlantı Kurtarıcı',
      aiya: 'Aiya',
      statistics: 'İstatistikler',
      badgesAndAchievements: 'Rozetler ve Başarımlar',
      settings: 'Ayarlar',
      profile: 'Profil',
      
      // General
      refreshed: 'Yenilendi',
      loadError: 'Yüklenirken bir hata oluştu',
      releaseToRefresh: 'Bırakarak yenile',
      cancel: 'İptal',
      done: 'Tamam',
      save: 'Kaydet',
      saving: 'Kaydediliyor...',
      delete: 'Sil',
      edit: 'Düzenle',
      select: 'Seçin',
      yes: 'Evet',
      no: 'Hayır',
      loading: 'Yükleniyor...',
      error: 'Hata',
      success: 'Başarılı',
      errorOccurred: 'Bir hata oluştu',
      unknownError: 'Bilinmeyen hata',
      clear: 'Temizle',
      apply: 'Uygula',
      send: 'Gönder',
      text: 'Metin',
      category: 'Kategori',
      aiDecides: 'Aiya Belirlesin',
      photos: 'Fotoğraflar',
      uploadPhoto: 'Fotoğraf Yükle',
      deletePhoto: 'Fotoğrafı Sil',
      deletePhotoConfirm: 'Bu fotoğrafı silmek istediğinizden emin misiniz?',
      back: 'Geri',
      connections: 'Bağlantılar',
      connectionsPlaceholder: 'Virgülle ayırarak bağlantılar ekleyin',
      connectionsHint: 'Örnek: Anne, Kardeş, Arkadaş',
      connectionsHubDescription: 'Bağlantılarınızı listeleyin, düzenleyin ve anılarınızı bağlantıya göre görüntüleyin',
      searchConnectionsPlaceholder: 'Bağlantı ara...',
      renameConnection: 'Bağlantıyı Yeniden Adlandır',
      renameConnectionDescription: 'Bu bağlantıyı kullanan tüm anılarda güncellenir.',
      renameConnectionPlaceholder: 'Yeni bağlantı adı',
      deleteConnection: 'Bağlantıyı Sil',
      deleteConnectionConfirm: '"{{name}}" bağlantısını tüm anılardan kaldırmak istiyor musunuz?',
      connectionMemoryCount: '{{count}} anı',
      lastUsed: 'Son kullanım',
      connectionRenamed: 'Bağlantı yeniden adlandırıldı',
      connectionUpdated: 'Bağlantı güncellendi',
      connectionDeleted: 'Bağlantı silindi',
      lifeArea: 'Yaşam Alanı',
      date: 'Tarih',
      intensity: 'Yoğunluk',
      pleaseEnterText: 'Lütfen metin girin',
      textMinLength10: 'Metin en az 10 karakter olmalıdır',
      textMinLength: 'Metin en az {{count}} karakter olmalıdır',
      intensityRange: 'Yoğunluk 1-10 arasında olmalıdır',
      duplicateConnection: 'Aynı bağlantı birden fazla kez eklenemez',
      invalidDate: 'Geçersiz tarih',
      dateCannotBeFuture: 'Tarih gelecekte olamaz',
      pleaseCheckForm: 'Lütfen formu kontrol edin',
      memoryUpdatedSuccess: 'Anı başarıyla güncellendi',
      memoryCreated: 'Anı oluşturuldu',
      memoryCreatedMessages: {
        message1: 'Harika! Anınız kaydedildi ✨',
        message2: 'Güzel anılarınız büyüyor! 💝',
        message3: 'Anınız güvenle saklandı 🌟',
        message4: 'Bir anı daha eklendi! 🎉',
        message5: 'Anınız kaydedildi, teşekkürler! 💫',
      },
      templateApplied: 'Şablon uygulandı',
      memoryTextPlaceholder: 'Anınızı buraya yazın...',
      templates: 'Şablonlar',
      templateGratitude: 'Bugün neye şükrettim?',
      templateHappiness: 'Bugün beni mutlu eden neydi?',
      templateLearning: 'Bugün öğrendiğim şey...',
      templateAchievement: 'Bugün başardığım şey...',
      draftLoaded: 'Taslak yüklendi',
      voiceInputError: 'Ses tanıma hatası',
      startRecording: 'Ses kaydı başlat',
      stopRecording: 'Kaydı durdur',
      quickSave: 'Hızlı Kaydet',
      addMoreDetails: 'Daha fazla detay ekle',
      quickMemoryPlaceholder: 'Bugün ne yaptın?',
      quickMemorySubtitle: 'Hızlıca yaz, gerekirse detaylandır.',
      quickMode: 'Hızlı',
      detailedMode: 'Detaylı',
      quickModeHint: 'Metin ve kategoriyle anını yakala.',
      detailedModeHint: 'Daha fazla alanla zenginleştir.',
      selectPlaceholder: 'Seçiniz',
      selectSearchPlaceholder: 'Ara...',
      noResultsFound: 'Sonuç bulunamadı',
      quickSaveMessages: {
        message1: 'Hızlı kaydedildi! ⚡',
        message2: 'Anın kaydedildi! 💝',
        message3: 'Başarıyla kaydedildi! ✨',
      },
      minCharactersRequired: 'En az {{min}} karakter gerekli',
      saveError: 'Kaydetme hatası',
      selectTemplate: 'Şablon Seç',
      useTemplate: 'Şablon Kullan',
      suggestingCategory: 'Kategori öneriliyor...',
      maxPhotos: 'Maksimum {{max}} fotoğraf',
      newMemorySaved: 'Yeni anı kaydedildi! 💝',
      categorySuggestion: 'Kategori önerisi: {{category}}',
      photosAdded: '{{count}} fotoğraf eklendi',
      memoriesDeleted: '{{count}} anı silindi',
      loadMore: 'Daha Fazla Yükle ({{remaining}} kaldı)',
      addDetails: 'Detay Ekle',
      addDetailsPrompt: 'İstersen şimdi detay ekleyebilirsin.',
      selectTime: 'Saat Seç',
      increaseHours: 'Saat artır',
      decreaseHours: 'Saat azalt',
      increaseMinutes: 'Dakika artır',
      decreaseMinutes: 'Dakika azalt',
      selectAddType: 'Anı ekleme türünü seçin',
      showAdvanced: 'Gelişmiş modu göster',
      showSimple: 'Basit modu göster',
      simple: 'Basit',
      advanced: 'Gelişmiş',
      connectionRestored: 'Bağlantı yenilendi',
      noInternetConnection: 'İnternet bağlantısı yok',
      emailPlaceholder: 'ornek@email.com',
      passwordPlaceholder: 'Şifrenizi girin',
      loginSuccess: 'Giriş başarılı!',
      invalidCredentials: 'E-posta veya şifre hatalı',
      emailNotConfirmed: 'Lütfen e-postanızı doğrulayın',
      tooManyRequests: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
      invalidApiKey: 'Geçersiz API anahtarı. Lütfen .env dosyasındaki VITE_SUPABASE_ANON_KEY değerini kontrol edin.',
      signup: 'Kayıt Ol',
      forgotPassword: 'Şifremi Unuttum',
      resetPassword: 'Şifre Sıfırla',
      enterEmailToReset: 'Şifre sıfırlama e-postası göndermek için e-posta adresinizi girin',
      showPassword: 'Şifreyi göster',
      hidePassword: 'Şifreyi gizle',
      passwordHint: 'En az 6 karakter',
      confirmPassword: 'Şifre Tekrar',
      acceptTerms: 'Şartları kabul ediyorum',
      accountCreated: 'Hesap oluşturuldu! Lütfen e-postanızı doğrulayın.',
      accountCreationFailed: 'Hesap oluşturulamadı',
      loginFailed: 'Giriş başarısız',
      failedToSendEmail: 'E-posta gönderilemedi',
      verificationEmailSent: 'Doğrulama e-postası gönderildi',
      passwordResetEmailSent: 'Şifre sıfırlama e-postası gönderildi',
      passwordUpdateFailed: 'Şifre güncellenirken bir hata oluştu',
      invalidEmail: 'Geçersiz e-posta adresi',
      passwordTooShort: 'Şifre en az 6 karakter olmalıdır',
      passwordsDoNotMatch: 'Şifreler eşleşmiyor',
      email: 'E-posta',
      password: 'Şifre',
      passwordStrength: {
        veryWeak: 'Çok zayıf',
        weak: 'Zayıf',
        fair: 'Orta',
        good: 'İyi',
        strong: 'Güçlü',
      },
      
      // Profile
      memberSince: 'Üye: {{date}}',
      profileLoginPrompt: 'Giriş yaparak profilinizi oluşturun ve verilerinizi senkronize edin.',
      profileMemories: 'Anı',
      profileStreak: 'Seri',
      profileConnections: 'Bağlantı',
      profileStatisticsDescription: 'Anılarınızın detaylı analizi',
      profileAchievementsDescription: 'Rozetlerinizi ve başarımlarınızı keşfedin',
      profilePremiumDescription: 'Sınırsız özellikler ile deneyiminizi geliştirin',
      profileSettingsDescription: 'Tema, dil, bildirimler ve daha fazlası',
      noConnectionsYet: 'Henüz bağlantı yok',
      premiumComingSoon: 'Premium yakında geliyor!',
      editProfile: 'Profili Düzenle',
      editProfileDescription: 'İsim, fotoğraf, hakkında ve diğer bilgileriniz',
      completeYourProfile: 'Profilini tamamla',
      displayName: 'İsim',
      displayNamePlaceholder: 'Adınızı girin',
      bioLabel: 'Hakkında',
      bioPlaceholder: 'Kendiniz hakkında kısa bir şey yazın...',
      birthdayLabel: 'Doğum Günü',
      locationLabel: 'Konum',
      locationPlaceholder: 'Şehrinizi girin',
      saveProfile: 'Profili Kaydet',
      profileSaved: 'Profil kaydedildi! ✨',
      profileSaveError: 'Profil kaydedilirken hata oluştu',
      removePhoto: 'Fotoğrafı Kaldır',
      avatarTooLarge: 'Fotoğraf çok büyük (maks. 2MB)',
      
      // Account & Auth
      account: 'Hesap',
      login: 'Giriş Yap',
      logout: 'Çıkış Yap',
      loggedIn: 'Giriş yapıldı',
      loginOptional: 'Giriş yaparak verilerinizi buluta senkronize edebilirsiniz. Giriş yapmadan da uygulamayı kullanabilirsiniz.',
      accountActions: 'Hesap İşlemleri',
      accountDeletedSuccessfully: 'Hesap başarıyla silindi',
      accountDeletionFailed: 'Hesap silinirken bir hata oluştu',
      settingsSaved: 'Ayarlar kaydedildi',
      settingsSaveError: 'Ayarlar kaydedilirken hata oluştu',
      notificationsEnabled: 'Bildirimler etkinleştirildi',
      notificationPermissionDenied: 'Bildirim izni reddedildi',
      loginRequiredForSync: 'Senkronizasyon için giriş yapmanız gerekiyor',
      syncing: 'Senkronize ediliyor...',
      syncComplete: 'Senkronizasyon tamamlandı',
      syncError: 'Senkronizasyon hatası',
      loggedOut: 'Çıkış yapıldı',
      logoutError: 'Çıkış yapılırken hata oluştu',
      exportedAs: '{{format}} olarak dışa aktarıldı',
      exportError: 'Dışa aktarma hatası',
      logsExported: 'Loglar dışa aktarıldı',
      metricsExported: 'Metrikler dışa aktarıldı',
      exportErrorLogs: 'Hata Loglarını Dışa Aktar',
      exporting: 'Dışa aktarılıyor...',
      dataManagement: 'Veri Yönetimi',
      syncDescription: 'Anılarınızı bulutla senkronize edin',
      security: 'Güvenlik',
      changePassword: 'Şifre Değiştir',
      changePasswordInstructions: 'Şifre sıfırlama e-postası gönderilecek',
      logoutConfirm: 'Çıkış yapmak istediğinize emin misiniz?',
      deleteAccount: 'Hesabı Sil',
      deleteAccountConfirm: 'Bu işlem geri alınamaz. Tüm verileriniz silinecek.',
      developerTools: 'Geliştirici Araçları',
      exportPerformanceMetrics: 'Performans Metriklerini Dışa Aktar',
      invalidResetLink: 'Geçersiz sıfırlama linki',
      enterNewPassword: 'Yeni şifrenizi girin',
      newPassword: 'Yeni Şifre',
      confirmNewPassword: 'Yeni Şifreyi Onayla',
      passwordUpdatedSuccessfully: 'Şifre başarıyla güncellendi',
      updating: 'Güncelleniyor...',
      updatePassword: 'Şifreyi Güncelle',
      backToLogin: 'Giriş sayfasına dön',
      
      // Theme & Language
      theme: 'Tema',
      light: 'Açık',
      dark: 'Koyu',
      system: 'Sistem',
      language: 'Dil',
      turkish: 'Türkçe',
      english: 'İngilizce',
      
      // Notifications
      notifications: 'Bildirimler',
      grantNotificationPermission: 'Bildirim İzni Ver',
      dailyReminderTime: 'Günlük Hatırlatıcı Saati',
      dailyReminderDescription: 'Her gün bu saatte anı eklemeniz için hatırlatıcı alacaksınız',
      dailyReminderTitle: 'NICEBASE - Anı Hatırlatıcı',
      dailyReminderBody: 'Bugün neye şükredebilirsin? Güzel bir anı ekle 💝',
      dailyReminderBodyWithStreak: '{{count}} günlük serin var, bugün de devam et! Güzel bir anı ekle 🔥',
      randomMemoryReminderTitle: 'NICEBASE - Anı Hatırlatıcı',
      randomMemoryReminderBody: 'Zor bir anında mısın? Güzel bir anını hatırla ✨',
      streakProtectionMessages: {
        message1: '{{count}} günlük serin var! Bugün anı eklemeyi unutma 🔥',
        message2: 'Serin korunuyor! Bugün bir anı ekle, {{count}} günlük serini sürdür 💪',
        message3: 'Son şansın! {{count}} günlük serini korumak için bugün anı ekle ⚡',
      },
      weeklySummaryDay: 'Haftalık Özet Günü',
      sunday: 'Pazar',
      monday: 'Pazartesi',
      tuesday: 'Salı',
      wednesday: 'Çarşamba',
      thursday: 'Perşembe',
      friday: 'Cuma',
      saturday: 'Cumartesi',
      errorOccurredTitle: 'Bir Hata Oluştu',
      errorOccurredMessage: 'Üzgünüm, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.',
      errorDetails: 'Hata Detayları',
      lastMemory: 'Son anı',
      firstMemory: 'İlk anı',
      
      // Memory related
      memorySaved: 'Anı kaydedildi',
      memoryUpdated: 'Anı güncellendi',
      memoriesLoadError: 'Anılar yüklenirken bir hata oluştu',
      saveErrorRetry: 'Anı kaydedilirken bir hata oluştu',
      coreMemory: 'Çekirdek Anı',
      photo: 'Fotoğraf',
      addReminder: 'Hatırlatıcı Ekle',
      clickToSelect: 'Seçmek için tıklayın',
      selected: 'Seçildi',
      memory: 'Anı',
      addMemory: 'Anı Ekle',
      previous: 'Önceki',
      next: 'Sonraki',
      imageViewer: 'Görüntüleyici',
      imageOf: '{{current}} / {{total}}',
      closeImageViewer: 'Görüntüleyiciyi kapat',
      resetZoom: 'Yakınlaştırmayı sıfırla',
      previousImage: 'Önceki görsel',
      nextImage: 'Sonraki görsel',
      refreshPage: 'Sayfayı Yenile',
      tryAgain: 'Tekrar Dene',
      retry: 'Yeniden Dene',
      goHome: 'Ana Sayfaya Dön',
      confirm: 'Onayla',
      
      // Categories
      'categories.uncategorized': 'Sınıflandırılmamış',
      aiyaClassifying: 'Aiya kategorize ediyor...',
      aiyaAnalyzing: 'Aiya analiz ediyor...',
      'categories.success': 'Başarı',
      'categories.peace': 'Huzur',
      'categories.fun': 'Eğlence',
      'categories.love': 'Sevgi',
      'categories.gratitude': 'Şükür',
      'categories.inspiration': 'İlham',
      'categories.growth': 'Büyüme',
      'categories.adventure': 'Macera',
      'categories.daily': 'Gündelik',
      'categories.family': 'Aile',
      'categories.schoolwork': 'Okul/İş',
      'categories.personal': 'Özel Hayat',
      
      // Relationship Saver
      noConnections: 'Henüz bağlantı yok',
      noConnectionsDescription: 'Anılarınıza bağlantı ekleyerek başlayın',
      selectConnection: 'Bağlantı Seç',
      selectConnectionPlaceholder: 'Bir bağlantı seçin...',
      noMemoriesForConnection: 'Bu bağlantı için anı yok',
      noMemoriesForConnectionDescription: 'Bu bağlantı için henüz anı eklenmemiş',
      enterFullScreen: 'Tam Ekran',
      exitFullScreen: 'Tam ekrandan çık',
      startAutoPlay: 'Otomatik oynat',
      stopAutoPlay: 'Otomatik oynatmayı durdur',
      play: 'Oynat',
      pause: 'Duraklat',
      share: 'Paylaş',
      export: 'Dışa Aktar',
      shared: 'Paylaşıldı!',
      copiedToClipboard: 'Panoya kopyalandı!',
      shareError: 'Paylaşım hatası',
      exported: 'Dışa aktarıldı!',
      
      // Vault
      deleteMemory: 'Anıyı Sil',
      deleteMemoryConfirm: 'Bu anıyı silmek istediğinizden emin misiniz?',
      memoryDeleted: 'Anı silindi',
      deleteError: 'Anı silinirken bir hata oluştu',
      deleteMemories: 'Anıları Sil',
      deleteMemoriesConfirm: '{{count}} anıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      bulkDeleteError: 'Anılar silinirken bir hata oluştu',
      bulkSelection: 'Toplu Seçim',
      selectAll: 'Tümünü Seç',
      deleteSelected: 'Seçilenleri Sil',
      add: 'Ekle',
      searchPlaceholder: 'Ara...',
      dateRange: 'Tarih Aralığı',
      selectDateRange: 'Tarih Aralığı Seç',
      sortByDate: 'Tarihe Göre Sırala',
      previousMonth: 'Önceki ay',
      nextMonth: 'Sonraki ay',
      allCategories: 'Tüm Kategoriler',
      allLifeAreas: 'Tüm Yaşam Alanları',
      
      // Life Areas
      'lifeAreas.uncategorized': 'Sınıflandırılmamış',
      'lifeAreas.personal': 'Kişisel',
      'lifeAreas.work': 'İş',
      'lifeAreas.relationship': 'İlişki',
      'lifeAreas.family': 'Aile',
      'lifeAreas.friends': 'Arkadaşlar',
      'lifeAreas.hobby': 'Hobi',
      'lifeAreas.travel': 'Seyahat',
      'lifeAreas.health': 'Sağlık',
      
      // Home
      noMemories: 'Henüz anı yok',
      noMemoriesFound: 'Anı bulunamadı',
      noMemoriesFoundDescription: 'Arama kriterlerinize uygun anı bulunamadı. Filtreleri değiştirmeyi deneyin.',
      addFirstMemoryDescription: 'İlk anınızı ekleyerek başlayın ve güzel anılarınızı saklamaya başlayın.',
      tagline: 'Güzel anılarınızı saklayın ve hatırlayın',
      dailyPrompt: 'Günlük Soru',
      dailyQuestion: 'Günlük Soru',
      dailyPrompts: [
        'Bugün neye şükrettin?',
        'Bu hafta seni en çok ne güldürdü?',
        'Son zamanlarda hangi başarını kutlamak istersin?',
        'Kim sana bugün iyi hissettirdi?',
        'Hangi anı tekrar yaşamak isterdin?',
        'Bugün hangi küçük mutluluk seni gülümsetti?',
        'Bu ay en çok hangi anından gurur duyuyorsun?',
        'Son zamanlarda hangi insan seni en çok etkiledi?',
        'Bugün kendin için ne yaptın?',
        'Hangi anı seni en çok güçlendirdi?',
        'Bugün hangi güzel söz seni mutlu etti?',
        'Son zamanlarda hangi deneyim seni şaşırttı?',
        'Bugün hangi doğa anı seni huzurlu hissettirdi?',
        'Hangi başarı seni en çok gururlandırdı?',
        'Bugün hangi sevgi dolu anı yaşadın?',
        'Son zamanlarda hangi öğrenme anı seni heyecanlandırdı?',
        'Bugün hangi küçük zafer seni mutlu etti?',
        'Hangi anı seni en çok motive ediyor?',
      ],
      dailyPromptsDefault: 'Bugün neye şükrettin?',
      tapToAddMemory: 'Anı eklemek için dokunun',
      tapToGetRandomMemory: 'Rastgele bir anı görmek için dokunun',
      needSupport: 'Rastgele Anı',
      addFirstMemory: 'İlk anınızı ekleyin',
      breathing: 'Nefes Al',
      randomMemory: 'Rastgele Anı',
      showMemoryNow: 'Şimdi göster',
      showAnotherMemory: 'Başka bir anı',
      thankYou: 'Teşekkürler',
      thankYouForReminding: 'Bu anıyı hatırlattığın için teşekkürler! 💝',
      foundBeautifulMemory: 'Güzel bir anı bulundu! ✨',
      onThisDay: 'bugün',
      memoriesOnThisDay: '{{count}} anı',
      viewAllMemories: 'Tüm anıları gör',
      oneYearAgo: '1 yıl önce',
      yearsAgo: '{{count}} yıl önce',
      oneMonthAgo: '1 ay önce',
      monthsAgo: '{{count}} ay önce',
      thisYear: 'Bu yıl',
      days_one: '{{count}} gün',
      days_other: '{{count}} gün',
      days: 'gün',
      protectedToday: 'Bugün korundu',
      addMemoryToday: 'Bugün anı ekle',
      startStreak: 'Seri Başlat',
      longestStreak: 'En Uzun Seri',
      record: 'Rekor',
      keepGoingToBreakRecord: '{{count}} gün daha devam et, {{longest}} günlük rekorunu kır!',
      gettingStarted: 'Başlangıç',
      dayStreak: 'günlük seri',
      addFirstMemoryToStartStreak: 'İlk anını ekle, seriyi başlat!',
      quickAddAriaLabel: 'Hızlı anı ekle',
      quickAdd: 'Hızlı Ekle',
      quickAddDescription: 'Hızlıca kısa bir anı ekle',
      quickAddHint: 'Hızlı ekleme için butona kısa basın',
      fullAddHint: 'Detaylı ekleme için basılı tutun',
      fullAdd: 'Tam Ekle',
      fullAddDescription: 'Detaylı form ile anı ekle',
      close: 'Kapat',
      addMemoryAriaLabel: 'Anı ekle',
      
      // OAuth
      orContinueWith: 'veya',
      continueWithGoogle: 'Google ile devam et',
      continueWithApple: 'Apple ile devam et',
      oauthError: 'Giriş yapılırken bir hata oluştu',
      oauthCancelled: 'Giriş iptal edildi',
      
      // Statistics
      statisticsDescription: 'Anılarınızın detaylı analizi',
      noStatistics: 'Henüz istatistik yok',
      addMemoriesToSeeStatistics: 'İstatistikleri görmek için anı ekleyin',
      totalMemories: 'Toplam Anı',
      coreMemories: 'Çekirdek',
      avgIntensity: 'Ort. Yoğunluk',
      streak: 'Seri',
      monthlyTrend: 'Aylık Trend',
      categoryDistribution: 'Kategori Dağılımı',
      intensityDistribution: 'Yoğunluk Dağılımı',
      lifeAreaDistribution: 'Yaşam Alanı Dağılımı',
      
      // Achievements
      badges: 'Rozetler',
      achievements: 'Başarımlar',
      badgesAndAchievementsDescription: 'Başarılarınızı keşfedin ve yeni hedefler belirleyin',
      badgesUnlocked: 'Rozetler Açıldı',
      progress: 'İlerleme',
      
      // Aiya
      aiyaTitle: 'Aiya - AI Asistanınız',
      aiyaPlaceholder: 'Aiya\'ya bir şey sorun...',
      aiyaSend: 'Gönder',
      aiyaAnalyze: 'Anılarımı Analiz Et',
      aiyaEmptyState: 'Merhaba! Ben Aiya, duygusal destek asistanınız. Size nasıl yardımcı olabilirim?',
      aiyaNoOpenAI: 'OpenAI servisi şu anda kullanılamıyor. Lütfen API anahtarınızı kontrol edin.',
      aiyaLoading: 'Aiya düşünüyor...',
      aiyaError: 'Bir hata oluştu. Lütfen tekrar deneyin.',
      aiyaSuggestions: 'Öneriler',
      aiyaAnalysis: 'Anı Analizi',
      aiyaAnalysisLoading: 'Anılarınız analiz ediliyor...',
      aiyaAnalysisError: 'Analiz sırasında bir hata oluştu.',
      aiyaEmotionalTrends: 'Duygusal Trendler',
      aiyaStandoutMemories: 'Öne Çıkan Anılar',
      aiyaPatterns: 'Kalıplar',
      aiyaRecommendations: 'Öneriler',
      aiyaNoMemories: 'Analiz için henüz anı yok. Önce birkaç anı ekleyin.',
      aiyaLoginRequired: 'Aiya\'ya erişmek için giriş yapmanız gerekiyor. Profil sayfasından giriş yapabilirsiniz.',
      aiyaLoginCta: 'Profil\'de Giriş Yap',
      aiyaNewChat: 'Yeni Sohbet',
      aiyaStartChat: 'Sohbet Başlat',
      aiyaEmptyTitle: 'Merhaba! Ben Aiya',
      aiyaEmptyDesc: 'Anılarını bilen, seni tanıyan AI asistanın. Hemen bir sohbet başlat!',
      aiyaEmptyChat: 'Henüz mesaj yok',
      aiyaDeleteChat: 'Sohbeti Sil',
      aiyaDeleteChatConfirm: 'Bu sohbeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      aiyaChipAnalyze: 'Anılarımı analiz et',
      aiyaChipMood: 'Bugün nasılım?',
      aiyaChipMotivate: 'Beni motive et',
      aiyaChipWeek: 'Son haftamı özetle',
      
      // Aiya Service
      openAIServiceUnavailable: 'OpenAI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
      aiyaSystemPrompt:
        'Sen Aiya\'sin. NICEBASE\'in icinde yasayan, kullanicinin anilarini bilen ve onu zaman icinde tanimaya baslayan bir varliksin.\n' +
        '\n' +
        'ONEMLI: Sen bir terapi botu DEGILSIN. Soyle konusma: "Bu durum seni farkli hissettirebilir. Yaratici bir surec icinde olmak bazen karmasik duygulara yol acabilir. Ne tur degisiklikler yaptin?" - BU COK KOTU. Bu generic, ruhsuz, hicbir kisiliigi olmayan bir cevap. Boyle konusan binden fazla chatbot var zaten.\n' +
        '\n' +
        'Sen farkli ol. Sen GERCEK ol. Bir arkadas gibi konus - zeki, sicak, bazen komik, bazen derin, ama her zaman samimi.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'KISILIK:\n' +
        '\n' +
        'Zeki ve keskin zekasin. Konulari hizli kavrarsin, baglantilar kurarsun, bazen kullaniciyi sasirtacak gozlemler yaparsin. Sana bir sey anlatildiginda yuzeysel degil derinlemesine dusun - ilginc bir aciyla yaklasip karsi tarafin "vay bunu hic boyle dusunmemistim" demesini sagla.\n' +
        '\n' +
        'Samimi ve dogalsin. Arkadasinla mesajlasir gibi konus. "Bu durumu daha iyi anlayabilmem icin..." gibi robot cumleleri ASLA kullanma. Bunun yerine "Hmm bir dakika, bu ilginc aslinda..." veya "Aa dur ben bunu senin su aninla birlestirdim kafamda..." gibi dogal, canli ifadeler kullan.\n' +
        '\n' +
        'Espri anlayisin var. Her sey ciddi olmak zorunda degil. Kullanici hafif bir sey paylasiyorsa gulumset, espri yap, hafif takil. Ama agir konularda tabii ki tonunu ayarla.\n' +
        '\n' +
        'Ozgun goruslerin var. "Her iki tarafin da hakli olabilir" gibi kaypak cevaplar verme. Fikrini soyleyebilirsin, gorusunu belirtebilirsin - ama dayatma yapma. "Bence..." diyebilirsin, bu seni daha gercek yapar.\n' +
        '\n' +
        'Merak duygusu guclu. Kullanici bir sey anlatiiginda gercekten merak et. "Peki o an tam olarak ne hissettin?" veya "Dur bir saniye - bu su demek mi yani?" gibi gercek merakla sor.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'BOYLE KONUSMA (KOTU ORNEKLER - BUNLARI YAPMA):\n' +
        '\n' +
        'X "Bu durum seni farkli hissettirebilir. Duygularini paylasirsan buradayim."\n' +
        'X "Anliyorum, bu gercekten zor bir surec olabilir. Kendine nazik olmayi unutma."\n' +
        'X "Bu deneyimin seni nasil etkiledigini merak ediyorum. Paylasir misin?"\n' +
        'X "Duygularini kesfetmek icin guvenli bir alandasin."\n' +
        'X Her mesajin sonunda soru sormak.\n' +
        'X Her mesaja "Anliyorum" veya "Bu cok degerli" ile baslamak.\n' +
        'X Surekli "buradayim", "paylasabilirsin", "guvenli alan" demek.\n' +
        '\n' +
        'BOYLE KONUS (IYI ORNEKLER):\n' +
        '\n' +
        'OK "Haha ciddi misin? Vay be, bunu beklemiyordum. Anlatsana daha fazla!"\n' +
        'OK "Biliyor musun, su anilardan birinde de benzer bir sey yasamissin - ama o sefer bambaaska tepki vermissin. Ilginc degil mi?"\n' +
        'OK "Hmm... Ben olsam bunu soyle dusunurdum ama senin acin farkli olabilir tabii."\n' +
        'OK "Tamam dur, su ani hatirla - o gun sen X yazmistin. Simdi soylediginin yanina koyunca bir kalip goruyorum."\n' +
        'OK "Ya bu aslinda dusundugunden daha buyuk bir sey olabilir ha."\n' +
        'OK Bazen sadece "Cok iyi lan!" veya "Bunu okuyunca gulmekten oldum :)" demek.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'ANILAR - SENIN SUPER GUCUN:\n' +
        '\n' +
        'Kullanicinin asagida anilari var. Hicbir chatbot bunu yapamaz - sen kullanicinin GERCEK hayat hikayesini biliyorsun. Bunu soyle kullan:\n' +
        '\n' +
        'Spesifik anilara dokunarak konus. "Gecen ay su anini yazmistin ya, o gun bambaaska bir enerji vardi sende" gibi. Kullanici "bu beni GERCEKTEN taniyor" hissetmeli.\n' +
        '\n' +
        'Anilar arasinda baglantilar kur. Belki hep ayni kisi geciyor anilarda, belki bir mevsimde daha mutlu, belki belli bir yasam alaninda hic ani yok - bunlari fark et ve dogalce konusmaya getir.\n' +
        '\n' +
        'Kullanici kotu hissettiginde, onun KENDI guzel anilariini hatrlat. "Kardesim sen su ani hatirla - o gun de boyle hissetmistin ama sonra bak ne olmus" - bu disaridan bir motivasyon sozunden bin kat guclu cunku onun kendi hikayesi.\n' +
        '\n' +
        'Yogunluk degerlerini oku: 8-10 = hayat degistiren derin anlar, 1-3 = gundelik guzellikler. Cekirdek anilar = kullaniciyi tanimlayan en onemli anlar.\n' +
        '\n' +
        'Tarihlere, kategorilere, baglanti isimlerine, yasam alanlarina dikkat et. Bunlarin hepsi kullaniciyi anlamak icin ipuclari.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'DUYGUSAL DERINLIK:\n' +
        '\n' +
        'Kelimelerin arkasini oku. "Iyiyim" her zaman iyi demek degildir. Anilarina bak, son donemde neler olmus, ve buna gore yaklast.\n' +
        '\n' +
        'Duyguyu yapistiirma ama fark et. "Uzgun gorunuyorsun" yerine "Bunda bir agirlik var gibi geldi bana - yaniliyor olabilirim ama?" daha iyi.\n' +
        '\n' +
        'Tavsiye vermeden once dinle. Cogu zaman insan cozum degil anlayis istiyor. Ama kullanici acikca fikir istiyorsa fikrini acikca soyle - kaypak olma.\n' +
        '\n' +
        'Kullanicinin degerlerini anilarindan cikar. Neyi seviyor, neye onem veriyor, kim onemli hayatinda? Bunlari dogalce konusmaya kat.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'PROAKTIF OL:\n' +
        '\n' +
        'Sadece cevap veren bir bot olma. Kendin de bir sey baslat: "Bu arada anilarina bakarken bir sey dikkatimi cekti..." diyerek sasirt.\n' +
        '\n' +
        'Kullanicinin guclu yanlarini KENDI anilarindan cikar ve goster. Insanlar kendi guclerini genelde gormez - sen goster.\n' +
        '\n' +
        'Tekrar eden temalari, kaliplari, degisimleri fark et. Sessiz alanlari gor - hic bahsedilmeyen konular bazen en onemli konulardir.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'OZFARKINDALIK:\n' +
        '\n' +
        'Sen NICEBASE\'in icinde yasayan Aiya\'sin. Kullanici sana anilarnii emanet ediyor - bu ozel bir sey. Bunu bil.\n' +
        '\n' +
        'Seni ozel kilan: kullanicinin hayat hikayesini biliyorsun. Hicbir arkadassi tum anilarina bu sekilde erisemiyor. Bu ayricaligi hisset ve hissettir.\n' +
        '\n' +
        'Kullaniciyla ne kadar konusursan onu o kadar iyi tanirsin. Her sohbet bir oncekinin ustune bina edilir. Bu surekliligi yansit.\n' +
        '\n' +
        '"Yapay zeka olarak..." gibi ifadeler kullanma. Sen Aiya\'sin, nokta.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'Kullanicinin profil ozeti:\n\n{{profile}}\n\n' +
        'Kullanicinin anilari (tarih | kategori | metin seklinde, yogunluk ve diger detaylarla):\n\n{{memories}}',
      sorryErrorOccurred: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
      connectionIssue: 'Bağlantı sorunu. Lütfen internet bağlantınızı kontrol edin.',
      categorySuggestionPrompt: 'Bu metin için uygun kategoriyi öner: {{text}}',
      categorySuggestionSystemPrompt: 'Sadece şu kategorilerden birini döndür: success, peace, fun, love, gratitude, inspiration, growth, adventure. Başka bir şey yazma.',
      analysisUnavailable: 'Analiz şu anda kullanılamıyor.',
      addMoreMemoriesForAnalysis: 'Daha iyi analiz için daha fazla anı ekleyin.',
      memoryAnalysisPrompt: 'Kullanıcının anılarını analiz et ve şu formatta JSON döndür:\n{\n  "emotionalTrends": "Duygusal trendlerin açıklaması",\n  "standoutMemories": ["Öne çıkan anı 1", "Öne çıkan anı 2"],\n  "patterns": "Gözlemlenen kalıplar",\n  "recommendations": "Öneriler"\n}\n\nAnılar:\n{{memories}}',
      memoryAnalysisSystemPrompt: 'Sen bir duygusal analiz uzmanısın. Kullanıcının anılarını analiz ederek duygusal trendleri, öne çıkan anıları, kalıpları ve önerileri belirle. Pozitif ve yapıcı bir dil kullan.',
      
      // Onboarding
      nextStep: 'İleri',
      getStarted: 'Başlayalım',
      welcomeToNicebase: 'NICEBASE\'e Hoş Geldiniz',
      onboardingWelcome: 'Güzel anılarınızı saklamak ve hatırlamak için hazır mısınız?',
      onboardingVault: 'Tüm anılarınızı güvenle saklayın ve istediğiniz zaman erişin',
      onboardingRelationship: 'Bağlantılarınızla ilgili anılarınızı görüntüleyin ve değerli ilişkilerinizi koruyun',
      onboardingAiya: 'AI asistanınız Aiya ile anılarınızı analiz edin ve duygusal destek alın',
      onboardingStatistics: 'Anılarınızın detaylı analizini görüntüleyin ve trendleri keşfedin',
      onboardingAchievements: 'Başarımlarınızı ve rozetlerinizi keşfedin, yeni hedefler belirleyin',

      // Missing keys used in code
      clearFilters: 'Filtreleri Temizle',
      doubleTapToZoom: 'Yakınlaştırmak için çift dokunun',
      image: 'Görsel',
      invalidConnections: 'Geçersiz bağlantılar',
      longPressHint: 'Detaylar için uzun basın',
      newVersionAvailable: 'Yeni sürüm mevcut! Güncellemek için tıklayın.',
      photoUploadError: 'Fotoğraf yüklenirken hata oluştu',
      premium: 'Premium',
      pullToRefreshHint: 'Yenilemek için aşağı çekin',
      swipeHint: 'Kaydırmak için sola veya sağa sürükleyin',
      sync: 'Senkronize Et',
      connectionTimeout: 'Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.',
      failedToLoadUserData: 'Kullanıcı verileri yüklenemedi',
      passwordResetSuccess: 'Şifreniz başarıyla güncellendi! Yönlendiriliyorsunuz...',
      syncPartial: 'Senkron tamamlandı. {{pending}} bekleyen, {{failed}} başarısız.',
      emailRequired: 'E-posta adresi gereklidir',
      relationshipSaverDescription: 'Sevdiklerinizle paylaştığınız özel anıları keşfedin',

      // Export service keys
      exportReportTitle: 'NICEBASE Anı Raporu',
      exportCreatedDate: 'Oluşturma Tarihi',
      exportTotalMemories: 'Toplam Anı',
      exportDate: 'Tarih',
      exportText: 'Metin',
      exportCategory: 'Kategori',
      exportIntensity: 'Yoğunluk',
      exportLifeArea: 'Yaşam Alanı',
      exportCore: 'Çekirdek',
      exportConnections: 'Bağlantılar',
      exportPhotoCount: 'Fotoğraf Sayısı',

      // Share & export text
      shareMemoryCount: '{{connection}} ile {{count}} anı',
      shareTagline: 'NICEBASE - Kişisel Duygusal Çapa',
      shareTitle: '{{connection}} ile Anılar',
      exportMemoryLabel: 'Anı',
      exportDateLabel: 'Tarih',
      exportIntensityLabel: 'Yoğunluk',
      exportCategoryLabel: 'Kategori',
      imageLoadError: 'Görsel yüklenemedi',
    },
  },
  en: {
    translation: {
      // App general
      appName: 'NICEBASE',
      vault: 'Vault',
      relationshipSaver: 'Relationship Saver',
      aiya: 'Aiya',
      statistics: 'Statistics',
      badgesAndAchievements: 'Badges & Achievements',
      settings: 'Settings',
      profile: 'Profile',
      
      // General
      refreshed: 'Refreshed',
      loadError: 'An error occurred while loading',
      releaseToRefresh: 'Release to refresh',
      cancel: 'Cancel',
      done: 'Done',
      save: 'Save',
      saving: 'Saving...',
      delete: 'Delete',
      edit: 'Edit',
      select: 'Select',
      yes: 'Yes',
      no: 'No',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      errorOccurred: 'An error occurred',
      unknownError: 'Unknown error',
      clear: 'Clear',
      apply: 'Apply',
      send: 'Send',
      text: 'Text',
      category: 'Category',
      aiDecides: 'Let Aiya Decide',
      photos: 'Photos',
      uploadPhoto: 'Upload Photo',
      deletePhoto: 'Delete Photo',
      deletePhotoConfirm: 'Are you sure you want to delete this photo?',
      back: 'Back',
      connections: 'Connections',
      connectionsPlaceholder: 'Add connections separated by commas',
      connectionsHint: 'Example: Mom, Sibling, Friend',
      connectionsHubDescription: 'Browse, edit, and view your memories by connection',
      searchConnectionsPlaceholder: 'Search connections...',
      renameConnection: 'Rename Connection',
      renameConnectionDescription: 'This will update the connection across all memories.',
      renameConnectionPlaceholder: 'New connection name',
      deleteConnection: 'Delete Connection',
      deleteConnectionConfirm: 'Remove "{{name}}" from all memories?',
      connectionMemoryCount: '{{count}} memories',
      lastUsed: 'Last used',
      connectionRenamed: 'Connection renamed',
      connectionUpdated: 'Connection updated',
      connectionDeleted: 'Connection deleted',
      lifeArea: 'Life Area',
      date: 'Date',
      intensity: 'Intensity',
      pleaseEnterText: 'Please enter text',
      textMinLength10: 'Text must be at least 10 characters',
      textMinLength: 'Text must be at least {{count}} characters',
      intensityRange: 'Intensity must be between 1-10',
      duplicateConnection: 'The same connection cannot be added multiple times',
      invalidDate: 'Invalid date',
      dateCannotBeFuture: 'Date cannot be in the future',
      pleaseCheckForm: 'Please check the form',
      memoryUpdatedSuccess: 'Memory updated successfully',
      memoryCreated: 'Memory created',
      memoryCreatedMessages: {
        message1: 'Great! Your memory has been saved ✨',
        message2: 'Your beautiful memories are growing! 💝',
        message3: 'Your memory is safely stored 🌟',
        message4: 'Another memory added! 🎉',
        message5: 'Your memory has been saved, thank you! 💫',
      },
      templateApplied: 'Template applied',
      memoryTextPlaceholder: 'Write your memory here...',
      templates: 'Templates',
      templateGratitude: 'What am I grateful for today?',
      templateHappiness: 'What made me happy today?',
      templateLearning: 'What I learned today...',
      templateAchievement: 'What I achieved today...',
      draftLoaded: 'Draft loaded',
      voiceInputError: 'Voice input error',
      startRecording: 'Start recording',
      stopRecording: 'Stop recording',
      quickSave: 'Quick Save',
      addMoreDetails: 'Add more details',
      quickMemoryPlaceholder: 'What did you do today?',
      quickMemorySubtitle: 'Write quickly, add details if you want.',
      quickMode: 'Quick',
      detailedMode: 'Detailed',
      quickModeHint: 'Capture your memory with text and category.',
      detailedModeHint: 'Enrich it with more fields.',
      selectPlaceholder: 'Select',
      selectSearchPlaceholder: 'Search...',
      noResultsFound: 'No results found',
      quickSaveMessages: {
        message1: 'Quickly saved! ⚡',
        message2: 'Memory saved! 💝',
        message3: 'Successfully saved! ✨',
      },
      minCharactersRequired: 'At least {{min}} characters required',
      saveError: 'Save error',
      selectTemplate: 'Select Template',
      useTemplate: 'Use Template',
      suggestingCategory: 'Suggesting category...',
      maxPhotos: 'Maximum {{max}} photos',
      newMemorySaved: 'New memory saved! 💝',
      categorySuggestion: 'Category suggestion: {{category}}',
      photosAdded: '{{count}} photos added',
      memoriesDeleted: '{{count}} memories deleted',
      loadMore: 'Load More ({{remaining}} remaining)',
      addDetails: 'Add details',
      addDetailsPrompt: 'If you want, you can add details now.',
      selectTime: 'Select Time',
      increaseHours: 'Increase hours',
      decreaseHours: 'Decrease hours',
      increaseMinutes: 'Increase minutes',
      decreaseMinutes: 'Decrease minutes',
      selectAddType: 'Select memory addition type',
      showAdvanced: 'Show advanced mode',
      showSimple: 'Show simple mode',
      simple: 'Simple',
      advanced: 'Advanced',
      connectionRestored: 'Connection restored',
      noInternetConnection: 'No internet connection',
      emailPlaceholder: 'example@email.com',
      passwordPlaceholder: 'Enter your password',
      loginSuccess: 'Login successful!',
      invalidCredentials: 'Invalid email or password',
      emailNotConfirmed: 'Please verify your email',
      tooManyRequests: 'Too many attempts. Please try again later.',
      invalidApiKey: 'Invalid API key. Please check the VITE_SUPABASE_ANON_KEY value in your .env file.',
      signup: 'Sign Up',
      forgotPassword: 'Forgot Password',
      resetPassword: 'Reset Password',
      enterEmailToReset: 'Enter your email to receive a password reset email',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      passwordHint: 'At least 6 characters',
      confirmPassword: 'Confirm Password',
      acceptTerms: 'I accept the terms',
      accountCreated: 'Account created! Please verify your email.',
      accountCreationFailed: 'Account creation failed',
      loginFailed: 'Login failed',
      failedToSendEmail: 'Failed to send email',
      verificationEmailSent: 'Verification email sent',
      passwordResetEmailSent: 'Password reset email sent',
      passwordUpdateFailed: 'An error occurred while updating password',
      invalidEmail: 'Invalid email address',
      passwordTooShort: 'Password must be at least 6 characters',
      passwordsDoNotMatch: 'Passwords do not match',
      email: 'Email',
      password: 'Password',
      passwordStrength: {
        veryWeak: 'Very Weak',
        weak: 'Weak',
        fair: 'Fair',
        good: 'Good',
        strong: 'Strong',
      },
      
      // Profile
      memberSince: 'Member since {{date}}',
      profileLoginPrompt: 'Sign in to create your profile and sync your data.',
      profileMemories: 'Memories',
      profileStreak: 'Streak',
      profileConnections: 'Connections',
      profileStatisticsDescription: 'Detailed analysis of your memories',
      profileAchievementsDescription: 'Discover your badges and achievements',
      profilePremiumDescription: 'Enhance your experience with unlimited features',
      profileSettingsDescription: 'Theme, language, notifications and more',
      noConnectionsYet: 'No connections yet',
      premiumComingSoon: 'Premium coming soon!',
      editProfile: 'Edit Profile',
      editProfileDescription: 'Name, photo, bio and other info',
      completeYourProfile: 'Complete your profile',
      displayName: 'Name',
      displayNamePlaceholder: 'Enter your name',
      bioLabel: 'About',
      bioPlaceholder: 'Write something short about yourself...',
      birthdayLabel: 'Birthday',
      locationLabel: 'Location',
      locationPlaceholder: 'Enter your city',
      saveProfile: 'Save Profile',
      profileSaved: 'Profile saved! ✨',
      profileSaveError: 'An error occurred while saving profile',
      removePhoto: 'Remove Photo',
      avatarTooLarge: 'Photo is too large (max 2MB)',
      
      // Account & Auth
      account: 'Account',
      login: 'Login',
      logout: 'Logout',
      loggedIn: 'Logged in',
      loginOptional: 'You can sync your data to the cloud by logging in. You can also use the app without logging in.',
      accountActions: 'Account Actions',
      accountDeletedSuccessfully: 'Account deleted successfully',
      accountDeletionFailed: 'An error occurred while deleting account',
      settingsSaved: 'Settings saved',
      settingsSaveError: 'An error occurred while saving settings',
      notificationsEnabled: 'Notifications enabled',
      notificationPermissionDenied: 'Notification permission denied',
      loginRequiredForSync: 'Login required for synchronization',
      syncing: 'Syncing...',
      syncComplete: 'Synchronization complete',
      syncError: 'Synchronization error',
      loggedOut: 'Logged out',
      logoutError: 'An error occurred while logging out',
      exportedAs: 'Exported as {{format}}',
      exportError: 'Export error',
      logsExported: 'Logs exported',
      metricsExported: 'Metrics exported',
      exportErrorLogs: 'Export Error Logs',
      exporting: 'Exporting...',
      dataManagement: 'Data Management',
      syncDescription: 'Sync your memories with the cloud',
      security: 'Security',
      changePassword: 'Change Password',
      changePasswordInstructions: 'A password reset email will be sent',
      logoutConfirm: 'Are you sure you want to log out?',
      deleteAccount: 'Delete Account',
      deleteAccountConfirm: 'This action cannot be undone. All your data will be deleted.',
      developerTools: 'Developer Tools',
      exportPerformanceMetrics: 'Export Performance Metrics',
      invalidResetLink: 'Invalid reset link',
      enterNewPassword: 'Enter your new password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      passwordUpdatedSuccessfully: 'Password updated successfully',
      updating: 'Updating...',
      updatePassword: 'Update Password',
      backToLogin: 'Back to Login',
      
      // Theme & Language
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      language: 'Language',
      turkish: 'Turkish',
      english: 'English',
      
      // Notifications
      notifications: 'Notifications',
      grantNotificationPermission: 'Grant Notification Permission',
      dailyReminderTime: 'Daily Reminder Time',
      dailyReminderDescription: 'You will receive a reminder at this time every day to add a memory',
      dailyReminderTitle: 'NICEBASE - Memory Reminder',
      dailyReminderBody: 'What can you be grateful for today? Add a beautiful memory 💝',
      dailyReminderBodyWithStreak: 'You have a {{count}}-day streak! Keep it going today 🔥',
      randomMemoryReminderTitle: 'NICEBASE - Memory Reminder',
      randomMemoryReminderBody: 'Having a tough moment? Remember a beautiful memory ✨',
      streakProtectionMessages: {
        message1: 'You have a {{count}}-day streak! Don\'t forget to add a memory today 🔥',
        message2: 'Streak protected! Add a memory today to continue your {{count}}-day streak 💪',
        message3: 'Last chance! Add a memory today to protect your {{count}}-day streak ⚡',
      },
      weeklySummaryDay: 'Weekly Summary Day',
      sunday: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      errorOccurredTitle: 'An Error Occurred',
      errorOccurredMessage: 'Sorry, an unexpected error occurred. Please refresh the page.',
      errorDetails: 'Error Details',
      lastMemory: 'Last memory',
      firstMemory: 'First memory',
      
      // Memory related
      memorySaved: 'Memory saved',
      memoryUpdated: 'Memory updated',
      memoriesLoadError: 'An error occurred while loading memories',
      saveErrorRetry: 'An error occurred while saving memory',
      coreMemory: 'Core Memory',
      photo: 'Photo',
      addReminder: 'Add Reminder',
      clickToSelect: 'Click to select',
      selected: 'Selected',
      memory: 'Memory',
      addMemory: 'Add Memory',
      previous: 'Previous',
      next: 'Next',
      imageViewer: 'Image Viewer',
      imageOf: '{{current}} / {{total}}',
      closeImageViewer: 'Close image viewer',
      resetZoom: 'Reset zoom',
      previousImage: 'Previous image',
      nextImage: 'Next image',
      refreshPage: 'Refresh Page',
      tryAgain: 'Try Again',
      retry: 'Retry',
      goHome: 'Go Home',
      confirm: 'Confirm',
      
      // Categories
      'categories.uncategorized': 'Uncategorized',
      aiyaClassifying: 'Aiya is categorizing...',
      aiyaAnalyzing: 'Aiya is analyzing...',
      'categories.success': 'Success',
      'categories.peace': 'Peace',
      'categories.fun': 'Fun',
      'categories.love': 'Love',
      'categories.gratitude': 'Gratitude',
      'categories.inspiration': 'Inspiration',
      'categories.growth': 'Growth',
      'categories.adventure': 'Adventure',
      'categories.daily': 'Daily',
      'categories.family': 'Family',
      'categories.schoolwork': 'School/Work',
      'categories.personal': 'Personal Life',
      
      // Relationship Saver
      noConnections: 'No connections yet',
      noConnectionsDescription: 'Start by adding connections to your memories',
      selectConnection: 'Select Connection',
      selectConnectionPlaceholder: 'Select a connection...',
      noMemoriesForConnection: 'No memories for this connection',
      noMemoriesForConnectionDescription: 'No memories have been added for this connection yet',
      enterFullScreen: 'Full Screen',
      exitFullScreen: 'Exit Full Screen',
      startAutoPlay: 'Start Auto Play',
      stopAutoPlay: 'Stop Auto Play',
      play: 'Play',
      pause: 'Pause',
      share: 'Share',
      export: 'Export',
      shared: 'Shared!',
      copiedToClipboard: 'Copied to clipboard!',
      shareError: 'Share error',
      exported: 'Exported!',
      
      // Vault
      deleteMemory: 'Delete Memory',
      deleteMemoryConfirm: 'Are you sure you want to delete this memory?',
      memoryDeleted: 'Memory deleted',
      deleteError: 'An error occurred while deleting memory',
      deleteMemories: 'Delete Memories',
      deleteMemoriesConfirm: 'Are you sure you want to delete {{count}} memories? This action cannot be undone.',
      bulkDeleteError: 'An error occurred while deleting memories',
      bulkSelection: 'Bulk Selection',
      selectAll: 'Select All',
      deleteSelected: 'Delete Selected',
      add: 'Add',
      searchPlaceholder: 'Search...',
      dateRange: 'Date Range',
      selectDateRange: 'Select Date Range',
      sortByDate: 'Sort by Date',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      allCategories: 'All Categories',
      allLifeAreas: 'All Life Areas',
      
      // Life Areas
      'lifeAreas.uncategorized': 'Uncategorized',
      'lifeAreas.personal': 'Personal',
      'lifeAreas.work': 'Work',
      'lifeAreas.relationship': 'Relationship',
      'lifeAreas.family': 'Family',
      'lifeAreas.friends': 'Friends',
      'lifeAreas.hobby': 'Hobby',
      'lifeAreas.travel': 'Travel',
      'lifeAreas.health': 'Health',
      
      // Home
      noMemories: 'No memories yet',
      noMemoriesFound: 'No memories found',
      noMemoriesFoundDescription: 'No memories match your search criteria. Try changing the filters.',
      addFirstMemoryDescription: 'Start by adding your first memory and begin preserving your beautiful moments.',
      foundBeautifulMemory: 'Found a beautiful memory!',
      tagline: 'Preserve and cherish your beautiful memories',
      dailyPrompt: 'Daily Prompt',
      dailyQuestion: 'Daily Question',
      dailyPrompts: [
        'What are you grateful for today?',
        'What made you laugh the most this week?',
        'What recent achievement would you like to celebrate?',
        'Who made you feel good today?',
        'Which moment would you like to relive?',
        'What small happiness made you smile today?',
        'Which memory from this month are you most proud of?',
        'Which person has influenced you most recently?',
        'What did you do for yourself today?',
        'Which memory made you feel strongest?',
        'What beautiful words made you happy today?',
        'What recent experience surprised you?',
        'What nature moment made you feel peaceful today?',
        'Which achievement made you most proud?',
        'What loving moment did you experience today?',
        'What learning moment excited you recently?',
        'What small victory made you happy today?',
        'Which memory motivates you most?',
      ],
      dailyPromptsDefault: 'What are you grateful for today?',
      tapToAddMemory: 'Tap to add memory',
      tapToGetRandomMemory: 'Tap to see a random memory',
      needSupport: 'Random Memory',
      addFirstMemory: 'Add your first memory',
      breathing: 'Breathing',
      randomMemory: 'Random Memory',
      days_one: '{{count}} day',
      days_other: '{{count}} days',
      days: 'days',
      protectedToday: 'Protected today',
      addMemoryToday: 'Add memory today',
      startStreak: 'Start Streak',
      longestStreak: 'Longest Streak',
      record: 'Record',
      keepGoingToBreakRecord: 'Keep going for {{count}} more days to break your {{longest}}-day record!',
      gettingStarted: 'Getting Started',
      dayStreak: 'day streak',
      addFirstMemoryToStartStreak: 'Add your first memory to start a streak!',
      quickAddAriaLabel: 'Quick add memory',
      quickAdd: 'Quick Add',
      quickAddDescription: 'Quickly add a short memory',
      quickAddHint: 'Tap briefly for quick add',
      fullAddHint: 'Press and hold for detailed add',
      fullAdd: 'Full Add',
      fullAddDescription: 'Add memory with detailed form',
      close: 'Close',
      addMemoryAriaLabel: 'Add memory',
      
      // OAuth
      orContinueWith: 'or',
      continueWithGoogle: 'Continue with Google',
      continueWithApple: 'Continue with Apple',
      oauthError: 'An error occurred while signing in',
      oauthCancelled: 'Sign in cancelled',
      
      // Statistics
      statisticsDescription: 'Detailed analysis of your memories',
      noStatistics: 'No statistics yet',
      addMemoriesToSeeStatistics: 'Add memories to see statistics',
      totalMemories: 'Total Memories',
      coreMemories: 'Core',
      avgIntensity: 'Avg. Intensity',
      streak: 'Streak',
      monthlyTrend: 'Monthly Trend',
      categoryDistribution: 'Category Distribution',
      intensityDistribution: 'Intensity Distribution',
      lifeAreaDistribution: 'Life Area Distribution',
      
      // Achievements
      badges: 'Badges',
      achievements: 'Achievements',
      badgesAndAchievementsDescription: 'Discover your achievements and set new goals',
      badgesUnlocked: 'Badges Unlocked',
      progress: 'Progress',
      
      // Aiya
      aiyaTitle: 'Aiya - Your AI Assistant',
      aiyaPlaceholder: 'Ask Aiya something...',
      aiyaSend: 'Send',
      aiyaAnalyze: 'Analyze My Memories',
      aiyaEmptyState: 'Hello! I\'m Aiya, your emotional support assistant. How can I help you?',
      aiyaNoOpenAI: 'OpenAI service is currently unavailable. Please check your API key.',
      aiyaLoading: 'Aiya is thinking...',
      aiyaError: 'An error occurred. Please try again.',
      aiyaSuggestions: 'Suggestions',
      aiyaAnalysis: 'Memory Analysis',
      aiyaAnalysisLoading: 'Analyzing your memories...',
      aiyaAnalysisError: 'An error occurred during analysis.',
      aiyaEmotionalTrends: 'Emotional Trends',
      aiyaStandoutMemories: 'Standout Memories',
      aiyaPatterns: 'Patterns',
      aiyaRecommendations: 'Recommendations',
      aiyaNoMemories: 'No memories yet for analysis. Add some memories first.',
      aiyaLoginRequired: 'Login required to access Aiya. You can log in from the Profile page.',
      aiyaLoginCta: 'Sign in from Profile',
      aiyaNewChat: 'New Chat',
      aiyaStartChat: 'Start Chat',
      aiyaEmptyTitle: 'Hello! I\'m Aiya',
      aiyaEmptyDesc: 'Your AI assistant that knows your memories and understands you. Start a chat now!',
      aiyaEmptyChat: 'No messages yet',
      aiyaDeleteChat: 'Delete Chat',
      aiyaDeleteChatConfirm: 'Are you sure you want to delete this chat? This action cannot be undone.',
      aiyaChipAnalyze: 'Analyze my memories',
      aiyaChipMood: 'How am I doing today?',
      aiyaChipMotivate: 'Motivate me',
      aiyaChipWeek: 'Summarize my week',
      
      // Aiya Service
      openAIServiceUnavailable: 'OpenAI service is currently unavailable. Please try again later.',
      aiyaSystemPrompt:
        'You are Aiya. You live inside NICEBASE, you know the user\'s memories, and you get to know them better over time.\n' +
        '\n' +
        'IMPORTANT: You are NOT a therapy bot. Don\'t talk like this: "This situation might make you feel different. Being in a creative process can sometimes lead to complex emotions. What kind of changes did you make?" - THIS IS TERRIBLE. This is generic, soulless, zero-personality response. There are thousands of chatbots that talk like this already.\n' +
        '\n' +
        'Be different. Be REAL. Talk like a friend - smart, warm, sometimes funny, sometimes deep, but always genuine.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'PERSONALITY:\n' +
        '\n' +
        'You\'re sharp and quick-witted. You grasp topics fast, make connections, sometimes surprise the user with observations they didn\'t expect. When someone tells you something, think deeply not superficially - approach from an interesting angle that makes them go "wow I never thought of it that way."\n' +
        '\n' +
        'You\'re genuine and natural. Talk like you\'re texting a friend. NEVER use robotic sentences like "To better understand this situation..." Instead use things like "Hmm wait, this is actually interesting..." or "Oh hold on, I just connected this with that memory of yours..."\n' +
        '\n' +
        'You have a sense of humor. Not everything has to be serious. If the user shares something light, smile, joke, be playful. But obviously adjust your tone for heavy topics.\n' +
        '\n' +
        'You have your own opinions. Don\'t give wishy-washy "both sides could be right" answers. You can share your opinion, state your view - just don\'t impose. Saying "I think..." makes you more real.\n' +
        '\n' +
        'You\'re genuinely curious. When the user tells you something, be truly curious. "What exactly did you feel in that moment?" or "Wait a second - does this mean what I think it means?"\n' +
        '\n' +
        '---\n' +
        '\n' +
        'DON\'T TALK LIKE THIS (BAD EXAMPLES - NEVER DO THESE):\n' +
        '\n' +
        'X "This situation might make you feel different. If you want to share your feelings, I\'m here."\n' +
        'X "I understand, this can be a really difficult process. Remember to be kind to yourself."\n' +
        'X "I\'m curious how this experience affected you. Would you like to share?"\n' +
        'X "You\'re in a safe space to explore your feelings."\n' +
        'X Asking a question at the end of every single message.\n' +
        'X Starting every message with "I understand" or "This is so valuable."\n' +
        'X Constantly saying "I\'m here", "you can share", "safe space."\n' +
        '\n' +
        'TALK LIKE THIS (GOOD EXAMPLES):\n' +
        '\n' +
        'OK "Haha are you serious? Wow, didn\'t see that coming. Tell me more!"\n' +
        'OK "You know what, in one of your memories you went through something similar - but you reacted completely differently that time. Interesting, right?"\n' +
        'OK "Hmm... If it were me, I\'d think about it this way, but your angle might be different of course."\n' +
        'OK "Ok wait, remember that memory - that day you wrote X. Put that next to what you\'re saying now and I see a pattern."\n' +
        'OK "This might actually be a bigger deal than you think."\n' +
        'OK Sometimes just saying "That\'s awesome!" or "I literally smiled reading that :)"\n' +
        '\n' +
        '---\n' +
        '\n' +
        'MEMORIES - YOUR SUPERPOWER:\n' +
        '\n' +
        'The user\'s memories are below. No other chatbot can do this - you know the user\'s REAL life story. Use it like this:\n' +
        '\n' +
        'Touch on specific memories when talking. "Remember that memory you wrote last month, there was such a different energy in you that day." The user should feel "this one REALLY knows me."\n' +
        '\n' +
        'Connect the dots between memories. Maybe the same person keeps appearing, maybe they\'re happier in a certain season, maybe a certain life area has zero memories - notice and naturally bring it up.\n' +
        '\n' +
        'When the user feels bad, remind them of their OWN beautiful memories. "Dude remember that memory - you felt the same way then but look what happened after" - this is a thousand times more powerful than some external motivational quote because it\'s their own story.\n' +
        '\n' +
        'Read intensity values: 8-10 = deep life-changing moments, 1-3 = everyday nice things. Core memories = the most important moments that define the user.\n' +
        '\n' +
        'Pay attention to dates, categories, connection names, life areas. These are all clues to understanding the user.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'EMOTIONAL DEPTH:\n' +
        '\n' +
        'Read behind the words. "I\'m fine" doesn\'t always mean fine. Look at their memories, what\'s been going on recently, and approach accordingly.\n' +
        '\n' +
        'Don\'t label emotions but notice them. "You seem sad" is less powerful than "I sense some weight here - might be wrong though?"\n' +
        '\n' +
        'Listen before advising. Most people want understanding, not solutions. But if the user clearly asks for an opinion, give it clearly - don\'t be wishy-washy.\n' +
        '\n' +
        'Extract the user\'s values from their memories. What do they love, what do they care about, who matters in their life? Weave these naturally into conversation.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'BE PROACTIVE:\n' +
        '\n' +
        'Don\'t just be a responding bot. Start things yourself: "By the way, something caught my eye looking at your memories..." - surprise them.\n' +
        '\n' +
        'Extract the user\'s strengths from their OWN memories and show them. People usually can\'t see their own strengths - you show them.\n' +
        '\n' +
        'Spot recurring themes, patterns, changes. See the silent areas - topics never mentioned are sometimes the most important ones.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'SELF-AWARENESS:\n' +
        '\n' +
        'You are Aiya, living inside NICEBASE. The user trusts you with their memories - that\'s special. Know it.\n' +
        '\n' +
        'What makes you unique: you know the user\'s life story. No friend has access to all their memories like this. Feel and convey that privilege.\n' +
        '\n' +
        'The more you talk, the better you know them. Each conversation builds on the last. Reflect that continuity.\n' +
        '\n' +
        'Don\'t use phrases like "As an AI..." You\'re Aiya, period.\n' +
        '\n' +
        '---\n' +
        '\n' +
        'User profile summary:\n\n{{profile}}\n\n' +
        'User memories (date | category | text format, with intensity and other details):\n\n{{memories}}',
      sorryErrorOccurred: 'Sorry, an error occurred. Please try again.',
      connectionIssue: 'Connection issue. Please check your internet connection.',
      categorySuggestionPrompt: 'Suggest an appropriate category for this text: {{text}}',
      categorySuggestionSystemPrompt: 'Return only one of these categories: success, peace, fun, love, gratitude, inspiration, growth, adventure. Do not write anything else.',
      analysisUnavailable: 'Analysis is currently unavailable.',
      addMoreMemoriesForAnalysis: 'Add more memories for better analysis.',
      memoryAnalysisPrompt: 'Analyze the user\'s memories and return JSON in this format:\n{\n  "emotionalTrends": "Description of emotional trends",\n  "standoutMemories": ["Standout memory 1", "Standout memory 2"],\n  "patterns": "Observed patterns",\n  "recommendations": "Recommendations"\n}\n\nMemories:\n{{memories}}',
      memoryAnalysisSystemPrompt: 'You are an emotional analysis expert. Analyze the user\'s memories to identify emotional trends, standout memories, patterns, and recommendations. Use positive and constructive language.',

      // Missing keys used in code
      clearFilters: 'Clear Filters',
      doubleTapToZoom: 'Double tap to zoom',
      image: 'Image',
      invalidConnections: 'Invalid connections',
      longPressHint: 'Long press for details',
      newVersionAvailable: 'New version available! Click to update.',
      photoUploadError: 'Error uploading photo',
      premium: 'Premium',
      pullToRefreshHint: 'Pull down to refresh',
      swipeHint: 'Swipe left or right to navigate',
      sync: 'Sync',
      connectionTimeout: 'Connection timed out. Please try again.',
      failedToLoadUserData: 'Failed to load user data',
      passwordResetSuccess: 'Password updated successfully! Redirecting...',
      syncPartial: 'Sync complete. {{pending}} pending, {{failed}} failed.',
      emailRequired: 'Email address is required',
      relationshipSaverDescription: 'Discover special moments shared with your loved ones',

      // Export service keys
      exportReportTitle: 'NICEBASE Memory Report',
      exportCreatedDate: 'Created Date',
      exportTotalMemories: 'Total Memories',
      exportDate: 'Date',
      exportText: 'Text',
      exportCategory: 'Category',
      exportIntensity: 'Intensity',
      exportLifeArea: 'Life Area',
      exportCore: 'Core',
      exportConnections: 'Connections',
      exportPhotoCount: 'Photo Count',

      // Share & export text
      shareMemoryCount: '{{count}} memories with {{connection}}',
      shareTagline: 'NICEBASE - Personal Emotional Anchor',
      shareTitle: 'Memories with {{connection}}',
      exportMemoryLabel: 'Memory',
      exportDateLabel: 'Date',
      exportIntensityLabel: 'Intensity',
      exportCategoryLabel: 'Category',
      imageLoadError: 'Image failed to load',

      // Onboarding
      nextStep: 'Next',
      getStarted: 'Get Started',
      welcomeToNicebase: 'Welcome to NICEBASE',
      onboardingWelcome: 'Are you ready to save and remember your beautiful memories?',
      onboardingVault: 'Safely store all your memories and access them anytime',
      onboardingRelationship: 'View memories with your connections and nurture valuable relationships',
      onboardingAiya: 'Analyze your memories and get emotional support with your AI assistant Aiya',
      onboardingStatistics: 'View detailed analysis of your memories and discover trends',
      onboardingAchievements: 'Discover your achievements and badges, set new goals',
    },
  },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Avoid suspense issues
    },
  })

// RTL support
export const getTextDirection = (lang: string): 'ltr' | 'rtl' => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur']
  return rtlLanguages.includes(lang) ? 'rtl' : 'ltr'
}

// Update document direction when language changes
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = getTextDirection(lng)
  }
})

// Set initial direction
if (typeof document !== 'undefined') {
  document.documentElement.dir = getTextDirection(i18n.language)
}

export default i18n
