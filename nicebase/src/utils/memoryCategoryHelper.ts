import { Memory, MemoryCategory } from '../types'

/**
 * Gets the primary category from a memory object.
 * Priority: categories array (first item) > category field (for backward compatibility)
 * 
 * This helper function handles the migration from single category to categories array.
 * The category field is deprecated but kept for backward compatibility.
 * 
 * @param memory - Memory object
 * @returns Primary category (first category from array or fallback to category field)
 */
export function getPrimaryCategory(memory: Memory): MemoryCategory {
  // Priority 1: Use first category from categories array (new approach)
  if (memory.categories && memory.categories.length > 0) {
    return memory.categories[0]
  }
  
  // Priority 2: Fall back to category field (backward compatibility)
  if (memory.category) {
    return memory.category
  }
  
  // Default fallback
  return 'uncategorized'
}

/**
 * Ensures a memory has both category (for backward compatibility) and categories array.
 * This function should be called when creating or updating memories to ensure consistency.
 * 
 * @param memory - Memory object (may have category, categories, or both)
 * @returns Memory object with both category and categories fields populated
 */
export function ensureCategoryConsistency(memory: Memory): Memory {
  // If categories array exists and has items, use it as source of truth
  if (memory.categories && memory.categories.length > 0) {
    return {
      ...memory,
      category: memory.categories[0], // Set category from first item in array
    }
  }
  
  // If only category field exists, create categories array from it
  if (memory.category && (!memory.categories || memory.categories.length === 0)) {
    return {
      ...memory,
      categories: [memory.category],
    }
  }
  
  // If neither exists, set defaults
  if (!memory.category && (!memory.categories || memory.categories.length === 0)) {
    return {
      ...memory,
      category: 'uncategorized',
      categories: ['uncategorized'],
    }
  }
  
  return memory
}

/**
 * Validates that categories array contains valid MemoryCategory values
 * @param categories - Array of category strings
 * @returns true if all categories are valid
 */
export function isValidCategoriesArray(categories: string[]): categories is MemoryCategory[] {
  const validCategories: MemoryCategory[] = [
    'uncategorized', 'success', 'peace', 'fun', 'love', 
    'gratitude', 'inspiration', 'growth', 'adventure'
  ]
  return categories.every(cat => validCategories.includes(cat as MemoryCategory))
}
