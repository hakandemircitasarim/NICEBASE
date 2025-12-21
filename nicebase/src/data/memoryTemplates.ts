import { MemoryCategory, LifeArea } from '../types'

export interface MemoryTemplate {
  id: string
  name: string
  nameEn: string
  text: string
  textEn: string
  category: MemoryCategory
  lifeArea: LifeArea
  suggestedConnections: string[]
  icon: string
}

export const memoryTemplates: MemoryTemplate[] = [
  {
    id: 'gratitude',
    name: 'Şükür Anısı',
    nameEn: 'Gratitude Memory',
    text: 'Bugün şükrettiğim şeyler:',
    textEn: 'Things I\'m grateful for today:',
    category: 'peace',
    lifeArea: 'personal',
    suggestedConnections: [],
    icon: '🙏',
  },
  {
    id: 'achievement',
    name: 'Başarı Anısı',
    nameEn: 'Achievement Memory',
    text: 'Bugün başardığım şey:',
    textEn: 'What I achieved today:',
    category: 'success',
    lifeArea: 'work',
    suggestedConnections: [],
    icon: '🏆',
  },
  {
    id: 'laughter',
    name: 'Kahkaha Anısı',
    nameEn: 'Laughter Memory',
    text: 'Bugün beni güldüren şey:',
    textEn: 'What made me laugh today:',
    category: 'fun',
    lifeArea: 'personal',
    suggestedConnections: [],
    icon: '😂',
  },
  {
    id: 'love',
    name: 'Sevgi Anısı',
    nameEn: 'Love Memory',
    text: 'Bugün sevgi hissettiğim an:',
    textEn: 'A moment I felt love today:',
    category: 'love',
    lifeArea: 'relationship',
    suggestedConnections: [],
    icon: '💕',
  },
  {
    id: 'nature',
    name: 'Doğa Anısı',
    nameEn: 'Nature Memory',
    text: 'Bugün doğada yaşadığım güzel an:',
    textEn: 'A beautiful moment in nature today:',
    category: 'peace',
    lifeArea: 'personal',
    suggestedConnections: [],
    icon: '🌿',
  },
  {
    id: 'friendship',
    name: 'Arkadaşlık Anısı',
    nameEn: 'Friendship Memory',
    text: 'Bugün arkadaşlarımla paylaştığım güzel an:',
    textEn: 'A beautiful moment I shared with friends today:',
    category: 'love',
    lifeArea: 'friends',
    suggestedConnections: [],
    icon: '👥',
  },
  {
    id: 'learning',
    name: 'Öğrenme Anısı',
    nameEn: 'Learning Memory',
    text: 'Bugün öğrendiğim yeni şey:',
    textEn: 'Something new I learned today:',
    category: 'success',
    lifeArea: 'personal',
    suggestedConnections: [],
    icon: '📚',
  },
  {
    id: 'family',
    name: 'Aile Anısı',
    nameEn: 'Family Memory',
    text: 'Bugün ailemle paylaştığım özel an:',
    textEn: 'A special moment I shared with my family today:',
    category: 'love',
    lifeArea: 'family',
    suggestedConnections: [],
    icon: '👨‍👩‍👧‍👦',
  },
]











