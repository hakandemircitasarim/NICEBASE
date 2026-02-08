import { Memory } from '../types'

/**
 * Supabase database row format for memories table
 */
interface SupabaseMemoryRow {
  id: string
  user_id?: string
  userId?: string
  text: string
  category: Memory['category']
  intensity: number
  date: string
  connections?: string[]
  life_area?: string
  lifeArea?: string
  is_core?: boolean
  isCore?: boolean
  photos?: string[]
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
}

/**
 * Maps Memory object to Supabase format (snake_case)
 * @param memory - Memory object to convert
 * @returns Supabase-formatted memory object
 */
export function memoryToSupabase(memory: Memory) {
  // Map 'uncategorized' to safe defaults so older DB schemas (without the
  // CHECK constraint update) still accept the row.  AI classification will
  // overwrite these values shortly after creation.
  const safeCategory = memory.category === 'uncategorized' ? 'gratitude' : memory.category
  const safeLifeArea = memory.lifeArea === 'uncategorized' ? 'personal' : memory.lifeArea

  return {
    id: memory.id,
    user_id: memory.userId,
    text: memory.text,
    category: safeCategory,
    intensity: memory.intensity,
    date: memory.date.split('T')[0], // Just the date part
    connections: memory.connections,
    life_area: safeLifeArea,
    is_core: memory.isCore,
    photos: memory.photos,
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
  }
}

/**
 * Maps Supabase format to Memory object
 * @param data - Supabase row data (can be snake_case or camelCase)
 * @returns Memory object
 */
export function memoryFromSupabase(data: SupabaseMemoryRow): Memory {
  return {
    id: data.id,
    userId: data.user_id ?? data.userId ?? '',
    text: data.text,
    category: (data.category || 'uncategorized') as Memory['category'],
    intensity: data.intensity,
    date: data.date,
    connections: data.connections ?? [],
    lifeArea: (data.life_area ?? data.lifeArea ?? 'uncategorized') as Memory['lifeArea'],
    isCore: data.is_core ?? data.isCore ?? false,
    photos: data.photos ?? [],
    createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? data.updatedAt ?? new Date().toISOString(),
    synced: true,
  }
}

/**
 * Maps memory updates to Supabase format (snake_case)
 * @param updates - Partial memory updates to map
 * @returns Object with Supabase-formatted updates
 */
export function memoryUpdatesToSupabase(updates: Partial<Memory>): Record<string, unknown> {
  const supabaseUpdates: Record<string, unknown> = {}
  
  if (updates.text !== undefined) supabaseUpdates.text = updates.text
  if (updates.category !== undefined) {
    supabaseUpdates.category = updates.category === 'uncategorized' ? 'gratitude' : updates.category
  }
  if (updates.intensity !== undefined) supabaseUpdates.intensity = updates.intensity
  if (updates.date !== undefined) supabaseUpdates.date = updates.date.split('T')[0]
  if (updates.connections !== undefined) supabaseUpdates.connections = updates.connections
  if (updates.lifeArea !== undefined) {
    supabaseUpdates.life_area = updates.lifeArea === 'uncategorized' ? 'personal' : updates.lifeArea
  }
  if (updates.isCore !== undefined) supabaseUpdates.is_core = updates.isCore
  if (updates.photos !== undefined) supabaseUpdates.photos = updates.photos
  
  supabaseUpdates.updated_at = new Date().toISOString()
  
  return supabaseUpdates
}













