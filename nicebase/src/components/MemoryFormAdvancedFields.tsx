import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { AlertCircle, Briefcase, Users, Home, Plane, Activity, Heart, Sparkles } from 'lucide-react'
import { LifeArea } from '../types'
import Select from './Select'
import Toggle from './Toggle'
import ConnectionsInput from './ConnectionsInput'

interface MemoryFormAdvancedFieldsProps {
  date: string
  connections: string
  lifeArea: LifeArea
  isCore: boolean
  dateError?: string
  connectionsError?: string
  connectionSuggestions?: string[]
  onDateChange: (date: string) => void
  onDateBlur: () => void
  onConnectionsChange: (connections: string) => void
  onLifeAreaChange: (lifeArea: LifeArea) => void
  onIsCoreChange: (isCore: boolean) => void
}

export default function MemoryFormAdvancedFields({
  date,
  connections,
  lifeArea,
  isCore,
  dateError,
  connectionsError,
  connectionSuggestions = [],
  onDateChange,
  onDateBlur,
  onConnectionsChange,
  onLifeAreaChange,
  onIsCoreChange,
}: MemoryFormAdvancedFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Advanced Mode Divider */}
      <div className="flex items-center gap-2 my-6">
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('advanced')}
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
      </div>

      <div>
        <label className="block text-sm sm:text-base font-semibold mb-3 text-gray-700 dark:text-gray-300">
          {t('date')}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            onDateChange(e.target.value)
          }}
          onBlur={onDateBlur}
          max={new Date().toISOString().split('T')[0]}
          className={`w-full px-4 py-3.5 sm:py-4 border-2 rounded-xl bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none touch-manipulation ${
            dateError
              ? 'border-red-500 focus:border-red-500'
              : 'border-gray-200 dark:border-gray-600 focus:border-primary'
          }`}
        />
        {dateError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-red-500 flex items-center gap-2"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{dateError}</span>
          </motion.p>
        )}
      </div>

      <div>
        <label className="block text-sm sm:text-base font-semibold mb-3 text-gray-700 dark:text-gray-300">
          {t('connections')}
        </label>
        <ConnectionsInput
          value={connections}
          onChange={onConnectionsChange}
          suggestions={connectionSuggestions}
          placeholder={t('connectionsPlaceholder')}
          hint={t('connectionsHint')}
          error={connectionsError}
        />
      </div>

      <div>
        <label className="block text-sm sm:text-base font-semibold mb-3 text-gray-700 dark:text-gray-300">
          {t('lifeArea')}
        </label>
        <Select
          value={lifeArea}
          onChange={(val) => onLifeAreaChange(val as LifeArea)}
          placeholder={t('lifeAreas.personal')}
          options={[
            { value: 'personal', label: t('lifeAreas.personal'), icon: <Users size={18} /> },
            { value: 'work', label: t('lifeAreas.work'), icon: <Briefcase size={18} /> },
            { value: 'relationship', label: t('lifeAreas.relationship'), icon: <Heart size={18} /> },
            { value: 'family', label: t('lifeAreas.family'), icon: <Home size={18} /> },
            { value: 'friends', label: t('lifeAreas.friends'), icon: <Users size={18} /> },
            { value: 'hobby', label: t('lifeAreas.hobby'), icon: <Sparkles size={18} /> },
            { value: 'travel', label: t('lifeAreas.travel'), icon: <Plane size={18} /> },
            { value: 'health', label: t('lifeAreas.health'), icon: <Activity size={18} /> },
          ]}
          searchable
        />
      </div>

      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {t('coreMemory')}
          </span>
          <span className="text-yellow-500 flex-shrink-0" aria-hidden="true">⭐</span>
        </div>
        <Toggle
          checked={isCore}
          onChange={onIsCoreChange}
          ariaLabel={t('coreMemory')}
          size="md"
          className="flex-shrink-0"
        />
      </div>
    </>
  )
}






