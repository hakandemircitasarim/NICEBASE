import { motion } from 'framer-motion'

export function SkeletonCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-8 overflow-hidden"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 sm:h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
            <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-20 sm:w-24 animate-pulse"></div>
          <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-16 sm:w-20 animate-pulse"></div>
        </div>
      </div>
    </motion.div>
  )
}

export function SkeletonStats() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-5"
    >
      <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3 animate-pulse"></div>
      <div className="h-8 sm:h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse"></div>
    </motion.div>
  )
}

export function SkeletonMemoryCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 sm:p-8"
    >
      <div className="space-y-5">
        {/* Core memory badge skeleton */}
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-28 animate-pulse"></div>
        
        {/* Text content skeleton - more realistic */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" style={{ animationDelay: '200ms' }}></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse" style={{ animationDelay: '300ms' }}></div>
        </div>
        
        {/* Image grid skeleton */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="h-28 sm:h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse aspect-square"
              style={{ animationDelay: `${i * 50}ms` }}
            ></div>
          ))}
        </div>
        
        {/* Tags skeleton */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className="h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-20 sm:w-24 animate-pulse"
              style={{ animationDelay: `${i * 75}ms` }}
            ></div>
          ))}
        </div>
        
        {/* Date and actions skeleton */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

